"""
sync_manifest.py — Acknowledge a completed sync between human truth and machine truth.

Run this AFTER you have manually propagated changes from a human-editable file
into its corresponding machine truth file:

  kitchen_state.md  →  src/kitchen_data.py     (roster / capability changes)
  week_constraints.md  →  week_config.json      (weekly notes → JSON config)

Usage:
  python src/sync_manifest.py               # re-hash all tracked files
  python src/sync_manifest.py --check       # check drift only, don't update
  python src/sync_manifest.py --init        # create manifest from scratch

What it does:
  - Reads current file contents and recomputes MD5 hashes
  - Updates kitchen_manifest.json with the new hashes + timestamp
  - Next preflight run will see no drift
"""
import sys, os, hashlib, json
from datetime import datetime

_SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT    = os.path.dirname(_SCRIPT_DIR)
_MANIFEST_PATH = os.path.join(_SCRIPT_DIR, "kitchen_manifest.json")

# Files to track: (display_key, path_relative_to_repo_root, role, machine_mirror_or_None)
_SOURCES = [
    ("kitchen_state.md",    "kitchen_state.md",    "Human-readable static truth",   "src/kitchen_data.py"),
    ("week_constraints.md", "week_constraints.md", "Human-readable weekly notes",   "week_config.json"),
]
_MACHINE = [
    ("src/kitchen_data.py", "src/kitchen_data.py", "Stable machine truth — roster/capabilities/stations", None),
    ("week_config.json",    "week_config.json",    "Weekly machine input — only file AI edits",           None),
]


def _hash(rel_path: str) -> str | None:
    full = os.path.join(_REPO_ROOT, rel_path)
    if not os.path.exists(full):
        return None
    with open(full, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def _build_manifest(synced_by: str = "sync_manifest.py") -> dict:
    manifest = {
        "_comment": (
            "Drift guard — hashes of human-editable truth sources vs machine truth. "
            "Run sync_manifest.py after any manual sync between markdown and code/JSON."
        ),
        "sources": {},
        "machine_truth": {},
        "last_synced_by": synced_by,
        "last_synced_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    for key, path, role, mirror in _SOURCES:
        h = _hash(path)
        entry = {"path": path, "hash": h, "role": role}
        if mirror:
            entry["machine_mirror"] = mirror
        manifest["sources"][key] = entry

    for key, path, role, _ in _MACHINE:
        h = _hash(path)
        manifest["machine_truth"][key] = {"path": path, "hash": h, "role": role}

    return manifest


def _check_only():
    """Print drift status without updating anything."""
    if not os.path.exists(_MANIFEST_PATH):
        print("❌  kitchen_manifest.json not found — run: python src/sync_manifest.py --init")
        return False

    with open(_MANIFEST_PATH) as f:
        manifest = json.load(f)

    ok = True
    print("=== DRIFT CHECK ===")
    for key, info in manifest.get("sources", {}).items():
        current = _hash(info["path"])
        stored  = info.get("hash")
        if current is None:
            print(f"  ⚪  {info['path']} — file not found (skipped)")
        elif current == stored:
            print(f"  ✅  {info['path']} — in sync")
        else:
            mirror = info.get("machine_mirror", "?")
            print(f"  ❌  {info['path']} — CHANGED (sync to {mirror} required)")
            ok = False

    for key, info in manifest.get("machine_truth", {}).items():
        current = _hash(info["path"])
        stored  = info.get("hash")
        if current is None:
            print(f"  ⚪  {info['path']} — file not found (skipped)")
        elif current == stored:
            print(f"  ✅  {info['path']} — unchanged")
        else:
            print(f"  🔄  {info['path']} — modified (expected for weekly edits)")

    print()
    if ok:
        print("All sources in sync. Safe to run preflight.")
    else:
        print("Drift detected. Sync human sources to machine truth, then re-run sync_manifest.py.")
    return ok


def _sync():
    """Recompute all hashes and update the manifest (acknowledges completed sync)."""
    manifest = _build_manifest()
    with open(_MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, indent=2)

    print("=== MANIFEST UPDATED ===")
    for key, info in manifest["sources"].items():
        status = "✅" if info["hash"] else "⚪ (missing)"
        print(f"  {status}  {info['path']}  →  {info['hash'] or 'n/a'}")
    for key, info in manifest["machine_truth"].items():
        status = "✅" if info["hash"] else "⚪ (missing)"
        print(f"  {status}  {info['path']}  →  {info['hash'] or 'n/a'}")
    print(f"\nSynced at: {manifest['last_synced_at']}")
    print("Preflight drift check will now pass.")


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--check" in args:
        ok = _check_only()
        sys.exit(0 if ok else 1)
    elif "--init" in args:
        _sync()
        print("(--init: created fresh manifest)")
    else:
        _sync()
