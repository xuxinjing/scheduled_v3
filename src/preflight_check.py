"""
preflight_check.py — Static constraint validation before scheduling.

Runs in <1 second. Catches issues that would cause the scheduler to
fail or produce a bad result, BEFORE the expensive solve runs.

Checks:
  0. Drift guard: kitchen_state.md or week_constraints.md changed since last
     sync → human must confirm sync to kitchen_data.py / week_config.json.
  1. Shared-station deadlock: two employees share the only slot for a station
     but are not split via forced_days → optimizer will deadlock.
  2. Unfillable station slots: leadership can't fill a required slot and no
     line staff qualifies either → accepted deployment gap, flagged clearly.
  3. Missing forced_days coverage: a forced employee is unavailable on their
     forced day → config conflict.
  4. Service level sanity: all OPEN_DAYS have a valid service level.
  5. Leadership solo-expeditor days: days where only 1 expeditor is available.
"""
import sys, os, hashlib, json
sys.path.insert(0, os.path.dirname(__file__))

from kitchen_data import OPEN_DAYS, SERVICE_LEVELS, EMPLOYEES, LINE_STAFF, LEADERSHIP
from scheduler import build_pm_requirements, _assign_leadership_pm, _cap_level, _is_available
from models import Capability, ServiceLevel


_MANIFEST_PATH = os.path.join(os.path.dirname(__file__), "kitchen_manifest.json")
_REPO_ROOT      = os.path.dirname(os.path.dirname(__file__))

def _file_hash(rel_path: str) -> str | None:
    """Return MD5 hex digest for a file relative to repo root, or None if missing."""
    full = os.path.join(_REPO_ROOT, rel_path)
    if not os.path.exists(full):
        return None
    with open(full, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def check_drift() -> list[str]:
    """
    Check 0: Drift guard.

    Reads kitchen_manifest.json and compares stored hashes against current
    file contents for:
      - kitchen_state.md     (human truth)  vs  src/kitchen_data.py  (machine truth)
      - week_constraints.md  (human notes)  vs  week_config.json     (machine input)

    Returns a list of ERROR strings if any drift is detected.
    An empty list means all sources are in sync.
    """
    if not os.path.exists(_MANIFEST_PATH):
        return ["[preflight] DRIFT GUARD: kitchen_manifest.json not found. "
                "Run: python src/sync_manifest.py --init  to create it."]

    with open(_MANIFEST_PATH) as f:
        manifest = json.load(f)

    drift_errors = []

    # Check human-readable sources for changes since last sync
    for src_key, info in manifest.get("sources", {}).items():
        current = _file_hash(info["path"])
        stored  = info.get("hash")
        if current is None:
            continue  # file doesn't exist, nothing to compare
        if current != stored:
            mirror = info.get("machine_mirror", "?")
            drift_errors.append(
                f"[preflight] DRIFT DETECTED: '{info['path']}' has changed since last sync. "
                f"If you updated this file, manually sync the changes to '{mirror}', "
                f"then run:  python src/sync_manifest.py  to acknowledge the sync."
            )

    # Also check if machine truth files changed unexpectedly (sanity)
    for key, info in manifest.get("machine_truth", {}).items():
        current = _file_hash(info["path"])
        stored  = info.get("hash")
        if current is None or current == stored:
            continue
        # Machine truth changed — that's expected (AI edits week_config.json each week).
        # Only flag if it's kitchen_data.py changing without a corresponding kitchen_state.md change.
        if "kitchen_data" in info["path"]:
            src_hash_stored  = manifest["sources"]["kitchen_state.md"]["hash"]
            src_hash_current = _file_hash("kitchen_state.md")
            if src_hash_current == src_hash_stored:
                # kitchen_data.py changed but kitchen_state.md didn't — warn but don't block
                drift_errors.append(
                    f"[preflight] DRIFT WARNING: 'src/kitchen_data.py' changed but "
                    f"'kitchen_state.md' hash is unchanged. If this was an AI code fix, "
                    f"update kitchen_state.md to match, then run: python src/sync_manifest.py"
                )

    return drift_errors


def _emp(name):
    for e in EMPLOYEES:
        if e.name == name:
            return e
    return None


def run_preflight() -> tuple[list[str], list[str]]:
    """
    Returns (errors, warnings).
    Errors = schedule will definitely fail or be wrong.
    Warnings = risk worth flagging but schedule may still run.
    """
    errors = []
    warnings = []

    # ── 0. Drift guard ───────────────────────────────────────────
    drift_errors = check_drift()
    errors.extend(drift_errors)

    # ── 1. Service level sanity ─────────────────────────────────
    for day in OPEN_DAYS:
        if SERVICE_LEVELS[day] == ServiceLevel.CLOSED:
            errors.append(f"[preflight] {day} is in OPEN_DAYS but has CLOSED service level.")

    # ── 2. Shared-station deadlock detection ────────────────────
    # If two+ employees can ONLY cover the same single station and that station
    # has just 1 slot/day, they must be in forced_days with non-overlapping days.
    station_to_only_workers = {}  # station -> list of employees who can ONLY do that station
    for emp in LINE_STAFF:
        non_merged = [s for s in emp.capabilities
                      if "/" not in s and s not in ("Floater",)]
        if len(non_merged) == 1:
            station_to_only_workers.setdefault(non_merged[0], []).append(emp)

    for station, workers in station_to_only_workers.items():
        if len(workers) > 1:
            # Check if they have non-overlapping forced_days
            forced_sets = [set(w.forced_days) for w in workers]
            overlapping = forced_sets[0].intersection(*forced_sets[1:])
            if overlapping:
                names = [w.name for w in workers]
                errors.append(
                    f"[preflight] DEADLOCK RISK: {names} all can only do '{station}' "
                    f"(1 slot/day) but share forced_days on: {sorted(overlapping)}. "
                    f"Split their forced_days to non-overlapping sets."
                )
            elif not all(w.forced_days for w in workers):
                unforced = [w.name for w in workers if not w.forced_days]
                warnings.append(
                    f"[preflight] SHARED STATION: {[w.name for w in workers]} share '{station}' "
                    f"(1 slot/day). {unforced} have no forced_days — optimizer may deadlock. "
                    f"Consider adding forced_days split in week_config.json."
                )

    # ── 3. Forced_days vs unavailability conflict ────────────────
    for emp in EMPLOYEES:
        if emp.forced_days:
            conflicts = [d for d in emp.forced_days if not _is_available(emp, d)]
            if conflicts:
                errors.append(
                    f"[preflight] CONFIG CONFLICT: {emp.name} has forced_days {emp.forced_days} "
                    f"but is marked unavailable on {conflicts}."
                )

    # ── 4. Leadership deployment gaps per day ───────────────────
    for day in OPEN_DAYS:
        level = SERVICE_LEVELS[day]
        leadership_pairs, _ = _assign_leadership_pm(day, level)
        reqs = dict(build_pm_requirements(day))

        # Count how many expeditors leadership fills
        exp_filled = sum(1 for s, _ in leadership_pairs if "Expeditor" in s)
        exp_needed = reqs.get("Expeditor", 0)

        if exp_filled < exp_needed:
            # Check if any line staff can fill the gap
            line_can_exp = [e for e in LINE_STAFF
                            if _is_available(e, day)
                            and _cap_level(e, "Expeditor") != Capability.NOT_QUALIFIED]
            if line_can_exp:
                warnings.append(
                    f"[preflight] {day}: Expeditor needs {exp_needed}, leadership fills {exp_filled}. "
                    f"Line staff {[e.name for e in line_can_exp]} can cover the gap."
                )
            else:
                warnings.append(
                    f"[preflight] {day}: DEPLOYMENT GAP — Expeditor needs {exp_needed}, "
                    f"leadership fills {exp_filled}, no line staff qualified. "
                    f"Accepted risk: keep {day} covers light."
                )

        # Check Sauté — always 1 required
        saute_filled = sum(1 for s, _ in leadership_pairs if s == "Sauté")
        if saute_filled == 0:
            warnings.append(
                f"[preflight] {day}: No leadership assigned to Sauté. "
                f"Verify Sauté coverage from line staff."
            )

    # ── 5. Station coverage: any station with zero qualified available people? ─
    for day in OPEN_DAYS:
        for req_station, _ in build_pm_requirements(day):
            qualified = [
                e for e in EMPLOYEES
                if _is_available(e, day)
                and _cap_level(e, req_station) != Capability.NOT_QUALIFIED
            ]
            if not qualified:
                errors.append(
                    f"[preflight] {day} PM: No available qualified person for '{req_station}'. "
                    f"Schedule will fail for this station."
                )

    return errors, warnings


if __name__ == "__main__":
    errors, warnings = run_preflight()
    print("=== PREFLIGHT CHECK ===")
    if not errors and not warnings:
        print("✅  All clear — safe to run scheduler.")
    for e in errors:
        print(f"❌  {e}")
    for w in warnings:
        print(f"⚠️   {w}")
    if errors:
        print(f"\nFAIL — fix {len(errors)} error(s) before running main.py")
        sys.exit(1)
    else:
        print(f"\nPASS ({len(warnings)} warning(s)) — safe to proceed.")
