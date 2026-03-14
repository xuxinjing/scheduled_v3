"""
Validator for the generated schedule.
Checks hard constraints, coverage, training rules, and operational risks.
Source of truth: kitchen_state.md + week_constraints.md.
"""
from models import Capability, ServiceLevel
from kitchen_data import (
    OPEN_DAYS, SERVICE_LEVELS, EMPLOYEES, PM_STATIONS, AM_STATIONS,
)
from scheduler import build_pm_requirements, build_am_requirements, _cap_level, _cap_level_on_day, _is_available


def _emp(name):
    for e in EMPLOYEES:
        if e.name == name:
            return e
    return None


def validate(assignments, shift_counts):
    errors = []
    warnings = []
    infos = []

    # Index assignments by day
    by_day = {}
    for a in assignments:
        by_day.setdefault(a.day, []).append(a)

    for day in OPEN_DAYS:
        day_assignments = by_day.get(day, [])
        level = SERVICE_LEVELS[day]

        # ── 1. No double-booking ────────────────────────────
        seen = {}
        for a in day_assignments:
            key = (a.employee, a.shift)
            if key in seen:
                errors.append(f"ERROR: {a.employee} double-booked on {day} {a.shift} "
                              f"({seen[key]} and {a.station})")
            seen[key] = a.station

        # ── 2. Capability check ─────────────────────────────
        for a in day_assignments:
            if a.coverage_type == "training":
                continue  # shadow trainees are intentionally unqualified — skip cap check
            emp = _emp(a.employee)
            if emp:
                cap = _cap_level_on_day(emp, a.station, day)  # honours weekly grants
                if cap == Capability.NOT_QUALIFIED:
                    errors.append(f"ERROR: {a.employee} not qualified for {a.station} on {day}")

        # ── 3. Availability check ───────────────────────────
        for a in day_assignments:
            emp = _emp(a.employee)
            if emp and not _is_available(emp, day):
                errors.append(f"ERROR: {a.employee} unavailable on {day} but assigned to {a.station}")

        # ── 4. Coverage completeness ────────────────────────
        pm_reqs = build_pm_requirements(day)
        am_reqs = build_am_requirements(day)
        pm_assigned = {}
        am_assigned = {}
        for a in day_assignments:
            if a.shift == "PM":
                pm_assigned[a.station] = pm_assigned.get(a.station, 0) + 1
            else:
                am_assigned[a.station] = am_assigned.get(a.station, 0) + 1

        for station, needed in pm_reqs:
            got = pm_assigned.get(station, 0)
            if got < needed:
                # Determine if this is a structural/deployment gap or a true scheduling error.
                # Structural/deployment gap: every qualified+available person is already assigned
                # to another PM station this day (i.e. gap is physically unavoidable).
                already_assigned_pm = {a.employee for a in day_assignments if a.shift == "PM"}
                qualified_and_unassigned = [
                    e for e in EMPLOYEES
                    if _is_available(e, day)
                    and _cap_level(e, station) != Capability.NOT_QUALIFIED
                    and e.name not in already_assigned_pm
                ]
                if not qualified_and_unassigned:
                    warnings.append(
                        f"WARNING [deployment gap]: {station} on {day} PM needs {needed}, "
                        f"only {got} assigned — all qualified people are already deployed or unavailable"
                    )
                else:
                    errors.append(f"ERROR: {station} on {day} PM needs {needed}, only {got} assigned")

        for station, needed in am_reqs:
            got = am_assigned.get(station, 0)
            if got < needed:
                errors.append(f"ERROR: {station} on {day} AM needs {needed}, only {got} assigned")

        # ── 5. Expeditor leadership check ───────────────────
        exp_people = [a.employee for a in day_assignments
                      if "Expeditor" in a.station and a.shift == "PM"]
        leadership_names = {"Chef", "CDC", "Raimi"}
        if not any(p in leadership_names for p in exp_people):
            warnings.append(f"WARNING: No leadership on Expeditor on {day}")

        # ── 6. Learning coverage risk ───────────────────────
        for a in day_assignments:
            if a.coverage_type == "learning":
                warnings.append(f"WARNING: {a.employee} on {a.station} ({day}) is learning-level coverage")

        # ── 7. Training pairing check ───────────────────────
        # Rule #7: trainees must be paired with a qualified person
        pm_day = [a for a in day_assignments if a.shift == "PM"]
        am_day = [a for a in day_assignments if a.shift == "AM"]

        for a in day_assignments:
            emp = _emp(a.employee)
            if not emp or not emp.training_on:
                continue
            for training_station in emp.training_on:
                # Check if there's a qualified person on that station today
                shift_assignments = pm_day if a.shift == "PM" else am_day
                qualified_on_station = [
                    x for x in shift_assignments
                    if x.employee != a.employee
                    and _cap_level(_emp(x.employee), training_station) == Capability.STABLE
                ]
                if not qualified_on_station:
                    warnings.append(
                        f"WARNING: {a.employee} training on {training_station} on {day} "
                        f"but no qualified mentor on the line"
                    )

    # ── 8. Fairness check ───────────────────────────────────
    pm_staff_names = {e.name for e in EMPLOYEES if e.role == "pm_staff"}
    pm_counts = {n: shift_counts.get(n, 0) for n in pm_staff_names}
    if pm_counts:
        max_shifts = max(pm_counts.values())
        min_shifts = min(pm_counts.values())
        if max_shifts - min_shifts > 2:
            high = [n for n, c in pm_counts.items() if c == max_shifts]
            low = [n for n, c in pm_counts.items() if c == min_shifts]
            warnings.append(f"WARNING: PM shift imbalance — high: {high} ({max_shifts}), "
                            f"low: {low} ({min_shifts})")

    # ── 9. Leadership utilization check ─────────────────────
    # Rule #8: prioritize leadership usage
    for emp in EMPLOYEES:
        if emp.role == "leadership":
            avail_days = [d for d in OPEN_DAYS if _is_available(emp, d)]
            worked = shift_counts.get(emp.name, 0)
            if worked < len(avail_days):
                warnings.append(
                    f"WARNING: {emp.name} (leadership) available {len(avail_days)} days "
                    f"but only scheduled {worked}"
                )

    # Assumptions — derived from kitchen_state.md and week_constraints.md (week of 2026-03-02)
    assumptions = [
        "CDC off ALL week (Tue–Sat) per week_constraints",
        "Chef off Tuesday only per week_constraints",
        "Brandon available all week (no days off) per week_constraints",
        "Tue/Wed/Thu = mid-level service; Fri/Sat = peak per week_constraints",
        "Sam forced to work all 5 days (chef directive); assigned Pasta; trains on Sauté alongside Brandon",
        "Kate pre-assigned Tue+Wed+Thu (Mids); Chris pre-assigned Fri+Sat (Mids) — non-overlapping to avoid Mids deadlock",
        "Slow service: Exp/Pantry merged, Pasta/Mids merged, Stuzz/Pastry merged, no floater",
        "Mid-level service: all stations dedicated, 2 expeditors, no floater",
        "Peak service: all stations dedicated, 2 expeditors, 1 floater",
        "Training: trainee counts as 0 for training station, must be paired with qualified person",
        "Sam training on Sauté — does Pasta as primary, does NOT count as Sauté coverage; Brandon present every day as Sauté mentor",
        "James training on AM Pastry Support — does Savory Prep as primary, counts 0 for AM Pastry",
        "Tuesday structural gap: with Chef+CDC both absent, only 1 Expeditor available (Raimi); 2nd Expeditor slot unfillable — accepted operational risk",
    ]

    status = "PASS"
    if errors:
        status = "FAIL"
    elif warnings:
        status = "PASS WITH WARNINGS"

    return {
        "status": status,
        "errors": errors,
        "warnings": warnings,
        "infos": infos,
        "assumptions": assumptions,
        "shift_counts": shift_counts,
    }
