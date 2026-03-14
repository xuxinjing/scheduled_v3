"""
Acquerello constraint-based scheduler v4.

Architecture:
  Phase 0 — Compute leadership assignments per day.
  Phase 1 — Determine remaining line-staff slots per day.
  Phase 2 — Assign line staff to work-day PATTERNS that maximize consecutive
            off days (Rule #10), respecting station capabilities and fairness.
  Phase 3 — Within each day, assign specific stations to the scheduled line staff.

Source of truth: kitchen_state.md + week_constraints.md.
All station names, capabilities, and rules are read from kitchen_data.py,
which must be regenerated from the markdown files before each scheduling run.

Priority order (kitchen_state.md §Practical Scheduling Rules):
1. Satisfy hard constraints
2. Secure expeditor / pass leadership
3. Secure highest-risk hot station (Sauté)
4. Secure bottleneck stations with thin depth
5. Fill cold-side coverage
6. Control labor cost
7. Preserve safe training reps
8. Improve fairness + consecutive off days
"""
import json, os
from models import Assignment, Capability, ServiceLevel, Shift
from kitchen_data import (
    OPEN_DAYS, SERVICE_LEVELS,
    PM_EMPLOYEES, AM_EMPLOYEES, EMPLOYEES,
    LEADERSHIP, LINE_STAFF,
)

# ── Load training_shadows from week_config ──────────────────────
_CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "week_config.json")
with open(_CONFIG_PATH) as _f:
    _WEEK_CFG = json.load(_f)
_TRAINING_SHADOWS = _WEEK_CFG.get("training_shadows", {})
_CAPABILITY_GRANTS = _WEEK_CFG.get("weekly_capability_grants", {})
# Build day-keyed lookup: {day: {emp_name: {station: Capability}}}
_GRANTS_BY_DAY = {}
_LEVEL_MAP = {"stable": Capability.STABLE, "learning": Capability.LEARNING, "emergency": Capability.EMERGENCY}
for _gname, _ginfo in _CAPABILITY_GRANTS.items():
    for _gday in _ginfo.get("days", []):
        _GRANTS_BY_DAY.setdefault(_gday, {}).setdefault(_gname, {})[_ginfo["station"]] = \
            _LEVEL_MAP.get(_ginfo.get("level", "stable"), Capability.STABLE)


# ── Helpers ────────────────────────────────────────────────────
def _is_available(emp, day):
    return day not in emp.unavailable_days


def _cap_level(emp, station_name) -> Capability:
    return emp.capabilities.get(station_name, Capability.NOT_QUALIFIED)


def _cap_level_on_day(emp, station_name, day) -> Capability:
    """Like _cap_level but also checks weekly_capability_grants for this day."""
    grant = _GRANTS_BY_DAY.get(day, {}).get(emp.name, {}).get(station_name)
    if grant is not None:
        return grant
    return _cap_level(emp, station_name)


def _coverage_label(cap: Capability) -> str:
    return {
        Capability.STABLE: "stable",
        Capability.LEARNING: "learning",
        Capability.EMERGENCY: "emergency",
    }.get(cap, "emergency")


def _emp(name: str):
    for e in EMPLOYEES:
        if e.name == name:
            return e
    return None


# ── Service-level fill orders ──────────────────────────────────
# Source: kitchen_state.md §2 Peak vs Mid-level vs Slow Service

PEAK_FILL_ORDER = [
    "Expeditor", "Expeditor",
    "Sauté", "Pasta", "Mids",
    "Pantry", "Stuzz", "Pastry", "Floater",
]
MID_FILL_ORDER = [
    "Expeditor", "Expeditor",
    "Sauté", "Pasta", "Mids",
    "Pantry", "Stuzz", "Pastry",
]
SLOW_FILL_ORDER = [
    "Expeditor/Pantry", "Sauté", "Pasta/Mids", "Stuzz/Pastry",
]


def build_pm_requirements(day: str) -> list[tuple[str, int]]:
    level = SERVICE_LEVELS[day]
    if level == ServiceLevel.SLOW:
        return [
            ("Expeditor/Pantry", 1), ("Sauté", 1),
            ("Pasta/Mids", 1), ("Stuzz/Pastry", 1),
        ]
    elif level == ServiceLevel.MID:
        return [
            ("Expeditor", 2), ("Sauté", 1),
            ("Pasta", 1), ("Mids", 1),
            ("Pantry", 1), ("Stuzz", 1), ("Pastry", 1),
        ]
    elif level == ServiceLevel.PEAK:
        return [
            ("Expeditor", 2), ("Sauté", 1),
            ("Pasta", 1), ("Mids", 1),
            ("Pantry", 1), ("Stuzz", 1), ("Pastry", 1),
            ("Floater", 1),
        ]
    return []


def build_am_requirements(day: str) -> list[tuple[str, int]]:
    from kitchen_data import AM_STATIONS
    return [(st.name, 1) for st in AM_STATIONS]


# ── Phase 0: Leadership assignment ─────────────────────────────

def _assign_leadership_pm(day, level):
    """
    Assign leadership (Chef, CDC, Raimi, Brandon) to PM stations.
    Returns list of (station, employee_name) tuples and set of used names.
    """
    assignments = []
    used = set()

    chef = _emp("Chef")
    cdc = _emp("CDC")
    raimi = _emp("Raimi")
    brandon = _emp("Brandon")

    chef_avail = chef and _is_available(chef, day)
    cdc_avail = cdc and _is_available(cdc, day)
    raimi_avail = raimi and _is_available(raimi, day)
    brandon_avail = brandon and _is_available(brandon, day)

    needs_2_exp = level in (ServiceLevel.PEAK, ServiceLevel.MID)
    needs_floater = level == ServiceLevel.PEAK
    is_slow = level == ServiceLevel.SLOW
    exp_station = "Expeditor/Pantry" if is_slow else "Expeditor"

    if chef_avail:
        assignments.append((exp_station, "Chef"))
        used.add("Chef")

    if cdc_avail:
        if needs_2_exp and "Chef" in used:
            assignments.append(("Expeditor", "CDC"))
        elif needs_2_exp and "Chef" not in used:
            assignments.append(("Expeditor", "CDC"))
        elif is_slow and "Chef" in used:
            assignments.append(("Sauté", "CDC"))
        elif is_slow and "Chef" not in used:
            assignments.append(("Expeditor/Pantry", "CDC"))
        used.add("CDC")

    if raimi_avail:
        exp_count = sum(1 for s, _ in assignments if s in ("Expeditor", "Expeditor/Pantry"))
        saute_taken = any(s == "Sauté" for s, _ in assignments)

        if needs_2_exp and exp_count < 2:
            assignments.append(("Expeditor", "Raimi"))
        elif is_slow and exp_count < 1:
            assignments.append(("Expeditor/Pantry", "Raimi"))
        elif needs_floater:
            assignments.append(("Floater", "Raimi"))
        elif is_slow:
            if not saute_taken:
                assignments.append(("Sauté", "Raimi"))
            else:
                assignments.append(("Pasta/Mids", "Raimi"))
        else:
            if not saute_taken:
                assignments.append(("Sauté", "Raimi"))
            else:
                assignments.append(("Pasta", "Raimi"))
        used.add("Raimi")

    if brandon_avail:
        saute_taken = any(s == "Sauté" for s, _ in assignments)
        if not saute_taken:
            assignments.append(("Sauté", "Brandon"))
        else:
            if is_slow:
                assignments.append(("Pasta/Mids", "Brandon"))
            else:
                assignments.append(("Pasta", "Brandon"))
        used.add("Brandon")

    return assignments, used


# ── Phase 1+2: Line-staff pattern assignment ───────────────────

def _consecutive_off_score(working_days: set) -> int:
    """
    Score how consecutive the off days are (higher = better).
    Considers Mon+Sun as closed (adjacent to Tue and Sat).
    Rule #10: "Multiple days off should be consecutive whenever possible."
    """
    all_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    # Build a 7-day off/on map (Mon=closed, Sun=closed → always off)
    off = []
    for d in all_days:
        if d in ("Monday", "Sunday"):
            off.append(True)  # closed days border off days
        elif d in OPEN_DAYS:
            off.append(d not in working_days)
        else:
            off.append(True)

    # Count consecutive off blocks — fewer blocks = better
    blocks = 0
    in_block = False
    for is_off in off:
        if is_off and not in_block:
            blocks += 1
            in_block = True
        elif not is_off:
            in_block = False

    # Ideal: 1 block (all off days consecutive, bordering Mon or Sun)
    # Score: negative blocks so higher is better
    max_block_len = 0
    curr_len = 0
    for is_off in off:
        if is_off:
            curr_len += 1
            max_block_len = max(max_block_len, curr_len)
        else:
            curr_len = 0

    # Prefer fewer blocks and longer max block
    return -blocks * 10 + max_block_len


def _can_cover_stations(worker_names, stations, day=None):
    """
    Check if a set of workers can cover all stations via recursive matching.
    Uses most-constrained-station-first heuristic for fast pruning.
    Accepts optional day for weekly_capability_grants awareness.
    """
    if not stations:
        return True

    cap_fn = (lambda n, s: _cap_level_on_day(_emp(n), s, day)) if day \
             else (lambda n, s: _cap_level(_emp(n), s))

    # Find the most constrained station (fewest qualified candidates)
    best_idx = None
    best_candidates = None
    for i, station in enumerate(stations):
        candidates = [
            n for n in worker_names
            if cap_fn(n, station) != Capability.NOT_QUALIFIED
        ]
        if not candidates:
            return False
        if best_candidates is None or len(candidates) < len(best_candidates):
            best_idx = i
            best_candidates = candidates

    remaining_stations = stations[:best_idx] + stations[best_idx + 1:]
    for candidate in best_candidates:
        remaining_workers = [n for n in worker_names if n != candidate]
        if _can_cover_stations(remaining_workers, remaining_stations, day):
            return True
    return False


def _compute_line_staff_schedule(leadership_by_day):
    """
    Phase 2: Determine which days each line staff member works,
    optimizing for consecutive off days and fairness.
    Includes station-coverage feasibility checking to ensure the
    selected workers can actually fill all required stations each day.

    Respects forced_days: employees with forced_days are pre-assigned
    those days before the combinatorial search runs on the remaining staff.

    Returns: dict mapping employee_name -> set of working days
    """
    # Compute remaining line-staff slots per day
    line_slots = {}  # day -> list of station names needing line staff
    for day in OPEN_DAYS:
        level = SERVICE_LEVELS[day]
        if level == ServiceLevel.SLOW:
            fill = SLOW_FILL_ORDER
        elif level == ServiceLevel.MID:
            fill = MID_FILL_ORDER
        else:
            fill = PEAK_FILL_ORDER

        # Use a list copy and remove one-at-a-time to properly handle
        # duplicate stations (e.g. 2× Expeditor on peak/mid days)
        leadership_station_list = [s for s, _ in leadership_by_day[day]]
        remaining = list(fill)
        for s in leadership_station_list:
            if s in remaining:
                remaining.remove(s)
        line_slots[day] = remaining

    # ── Remove station slots no line staff can ever fill (e.g. Expeditor gap on Tue) ──
    for day in OPEN_DAYS:
        line_slots[day] = [
            s for s in line_slots[day]
            if any(_cap_level(e, s) != Capability.NOT_QUALIFIED for e in LINE_STAFF)
        ]

    # ── Pre-assign forced employees ──────────────────────────────
    forced_staff = [e for e in LINE_STAFF if e.forced_days]
    free_staff   = [e for e in LINE_STAFF if not e.forced_days]

    pre_assigned = {}   # name -> set of days (forced employees)
    pre_remaining = {day: len(line_slots[day]) for day in OPEN_DAYS}

    for emp in forced_staff:
        work_days = set(d for d in emp.forced_days if d in OPEN_DAYS and _is_available(emp, d))
        pre_assigned[emp.name] = work_days
        for d in work_days:
            pre_remaining[d] = max(0, pre_remaining[d] - 1)

    # For each free line staff, determine which days they CAN work
    # Uses day-aware capability check to honour weekly_capability_grants
    can_work = {}  # name -> list of possible days
    for emp in free_staff:
        possible = []
        for day in OPEN_DAYS:
            if not _is_available(emp, day):
                continue
            for station in line_slots[day]:
                if _cap_level_on_day(emp, station, day) != Capability.NOT_QUALIFIED:
                    possible.append(day)
                    break
        can_work[emp.name] = possible

    # Target shifts per free person (fairness across non-forced staff)
    remaining_slots = sum(pre_remaining[d] for d in OPEN_DAYS)
    n_free = len(free_staff)
    base = remaining_slots // n_free if n_free else 0

    from itertools import combinations

    best_assignment = None
    best_score = float('-inf')

    def _check_coverage_feasible(assigned):
        """Verify that for each day, the assigned workers can cover all stations."""
        for day in OPEN_DAYS:
            workers_today = [name for name, days in assigned.items() if day in days]
            stations_today = line_slots[day]
            if len(workers_today) < len(stations_today):
                return False
            if not _can_cover_stations(workers_today, stations_today, day):
                return False
        return True

    def _try_assign(staff_list, slots_remaining, assigned, depth=0):
        nonlocal best_assignment, best_score

        if depth == len(staff_list):
            # Check all slots filled
            for day in OPEN_DAYS:
                if slots_remaining[day] > 0:
                    return
            # Build full assignment (forced + free) for feasibility check
            full_assigned = {**pre_assigned, **assigned}
            if not _check_coverage_feasible(full_assigned):
                return
            # Score this assignment (all workers, including forced)
            total_score = sum(
                _consecutive_off_score(days)
                for _, days in full_assigned.items()
            )
            if total_score > best_score:
                best_score = total_score
                best_assignment = {k: set(v) for k, v in full_assigned.items()}
            return

        emp = staff_list[depth]
        possible_days = can_work[emp.name]
        # Try shift counts: base or base+1
        for n_shifts in [base + 1, base]:
            if n_shifts > len(possible_days):
                continue
            if n_shifts < 0:
                continue
            for combo in combinations(possible_days, n_shifts):
                work_set = set(combo)
                valid = True
                new_remaining = dict(slots_remaining)
                for d in work_set:
                    if new_remaining[d] <= 0:
                        valid = False
                        break
                    new_remaining[d] -= 1
                if not valid:
                    continue
                assigned[emp.name] = work_set
                _try_assign(staff_list, new_remaining, assigned, depth + 1)
                del assigned[emp.name]

    # Sort free staff by flexibility (most constrained first for better pruning)
    sorted_free_staff = sorted(free_staff, key=lambda e: len(can_work[e.name]))

    _try_assign(sorted_free_staff, dict(pre_remaining), {})

    if best_assignment is None:
        # Fallback: forced employees keep forced days; greedy for rest
        best_assignment = dict(pre_assigned)
        for emp in free_staff:
            best_assignment[emp.name] = set(can_work[emp.name])

    return best_assignment, line_slots


# ── Phase 3: Assign stations within each day ───────────────────

def _assign_line_staff_stations(day, line_slots_today, working_staff, global_shift_counts):
    """
    Given which line staff work today, assign them to specific stations.
    Uses most-constrained-station-first matching to avoid dead ends where
    a greedy approach assigns a flexible worker to a station that a
    specialist needed.
    """
    available_names = [e.name for e in LINE_STAFF if e.name in working_staff]
    stations = list(line_slots_today)

    # Recursive matching: assign the most-constrained station first
    def _match(remaining_stations, remaining_workers):
        if not remaining_stations:
            return {}

        # Find station with fewest qualified candidates (day-aware for grants)
        best_idx = None
        best_candidates = None
        for i, station in enumerate(remaining_stations):
            candidates = [
                n for n in remaining_workers
                if _cap_level_on_day(_emp(n), station, day) != Capability.NOT_QUALIFIED
            ]
            if not candidates:
                return None  # infeasible
            if best_candidates is None or len(candidates) < len(best_candidates):
                best_idx = i
                best_candidates = candidates
                best_station = station

        rest_stations = remaining_stations[:best_idx] + remaining_stations[best_idx + 1:]

        # Sort candidates by quality: stable > learning, preference match (day-aware)
        def sort_key(name):
            emp = _emp(name)
            cap = _cap_level_on_day(emp, best_station, day)
            cap_rank = 0 if cap == Capability.STABLE else 1
            pref_rank = 0 if best_station in emp.preferred_stations else 1
            return (cap_rank, pref_rank, name)

        best_candidates.sort(key=sort_key)

        for candidate in best_candidates:
            rest_workers = [n for n in remaining_workers if n != candidate]
            result = _match(rest_stations, rest_workers)
            if result is not None:
                result[best_station] = candidate
                return result
        return None

    matching = _match(stations, available_names)
    if matching is None:
        matching = {}  # shouldn't happen if _compute_line_staff_schedule validated

    assignments = []
    for station, name in matching.items():
        emp = _emp(name)
        cap = _cap_level_on_day(emp, station, day)  # honours weekly grants
        note = ""
        if emp.training_on:
            # Only note training on stations OTHER than the one currently assigned.
            # If the employee is the primary person at a training station (e.g. via
            # weekly_capability_grants), don't redundantly flag it as "training on X".
            extra = [t for t in emp.training_on if t != station]
            if extra:
                note = f"Also training on {', '.join(extra)}"
        assignments.append(Assignment(
            day=day, shift="PM", station=station,
            employee=name,
            coverage_type=_coverage_label(cap),
            notes=note,
        ))
        global_shift_counts[name] = global_shift_counts.get(name, 0) + 1

    return assignments


# ── AM scheduling ──────────────────────────────────────────────

def schedule_am(day, global_shift_counts):
    from kitchen_data import AM_STATIONS
    assignments = []
    used = set()
    am_fill_order = [
        "AM Savory Prep Lead", "Butcher", "Savory Prep",
        "AM Pastry Lead", "AM Pastry Support",
    ]
    for station in am_fill_order:
        candidates = [
            e for e in AM_EMPLOYEES
            if e.name not in used
            and _is_available(e, day)
            and _cap_level(e, station) != Capability.NOT_QUALIFIED
        ]
        candidates.sort(key=lambda e: (
            0 if _cap_level(e, station) == Capability.STABLE else 1, e.name))
        if candidates:
            best = candidates[0]
            cap = _cap_level(best, station)
            note = ""
            if best.training_on:
                extra = [t for t in best.training_on if t != station]
                if extra:
                    note = f"Also training on {', '.join(extra)}"
            assignments.append(Assignment(
                day=day, shift="AM", station=station,
                employee=best.name,
                coverage_type=_coverage_label(cap),
                notes=note,
            ))
            used.add(best.name)
            global_shift_counts[best.name] = global_shift_counts.get(best.name, 0) + 1
    return assignments


# ── Main entry ─────────────────────────────────────────────────

def run_scheduler():
    all_assignments = []
    global_shift_counts = {}

    # Phase 0: Leadership assignments
    leadership_by_day = {}
    for day in OPEN_DAYS:
        level = SERVICE_LEVELS[day]
        pairs, _ = _assign_leadership_pm(day, level)
        leadership_by_day[day] = pairs

    # Phase 1+2: Compute optimal line-staff work patterns
    line_schedule, line_slots = _compute_line_staff_schedule(leadership_by_day)

    # Generate assignments day by day
    for day in OPEN_DAYS:
        # AM
        am = schedule_am(day, global_shift_counts)
        all_assignments.extend(am)

        # PM leadership
        level = SERVICE_LEVELS[day]
        leadership_pairs = leadership_by_day[day]
        for station, name in leadership_pairs:
            cap = _cap_level(_emp(name), station)
            all_assignments.append(Assignment(
                day=day, shift="PM", station=station,
                employee=name,
                coverage_type=_coverage_label(cap),
                notes="",
            ))
            global_shift_counts[name] = global_shift_counts.get(name, 0) + 1

        # PM line staff
        working_today = {name for name, days in line_schedule.items() if day in days}
        line_assignments = _assign_line_staff_stations(
            day, line_slots[day], working_today, global_shift_counts
        )
        all_assignments.extend(line_assignments)

    # ── Phase 4: Training shadow assignments ────────────────────
    # For trainees who shadow a mentor at a station on specific days
    # (week_config: training_shadows). Trainee counts as 0 for coverage.
    for emp_name, shadow_info in _TRAINING_SHADOWS.items():
        shadow_days = shadow_info.get("days", [])
        shadow_station = shadow_info.get("station", "")
        for day in shadow_days:
            if day not in OPEN_DAYS:
                continue
            # Skip if already assigned this day
            already_assigned = any(
                a.day == day and a.employee == emp_name
                for a in all_assignments
            )
            if already_assigned:
                continue
            # Only add shadow if a stable person already covers that station
            stable_mentor = any(
                a.day == day and a.station == shadow_station and a.shift == "PM"
                and _cap_level(_emp(a.employee), shadow_station) == Capability.STABLE
                for a in all_assignments
            )
            if stable_mentor:
                all_assignments.append(Assignment(
                    day=day, shift="PM", station=shadow_station,
                    employee=emp_name,
                    coverage_type="training",
                    notes="Shadow training — counts 0 for coverage; mentor present",
                ))
                global_shift_counts[emp_name] = global_shift_counts.get(emp_name, 0) + 1

    return all_assignments, global_shift_counts
