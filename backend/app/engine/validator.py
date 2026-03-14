"""Validator for generated schedules."""
from __future__ import annotations

from .context import KitchenContext
from .models import Capability
from .scheduler import SchedulerEngine


def validate(context: KitchenContext, assignments, shift_counts):
    engine = SchedulerEngine(context)
    errors = []
    warnings = []
    infos = []

    by_day = {}
    for assignment in assignments:
        by_day.setdefault(assignment.day, []).append(assignment)

    for day in context.open_days:
        day_assignments = by_day.get(day, [])
        seen = {}
        for assignment in day_assignments:
            key = (assignment.employee, assignment.shift)
            if key in seen:
                errors.append(
                    f"ERROR: {assignment.employee} double-booked on {day} {assignment.shift} "
                    f"({seen[key]} and {assignment.station})"
                )
            seen[key] = assignment.station

        for assignment in day_assignments:
            if assignment.coverage_type == "training":
                continue
            employee = engine._employee(assignment.employee)
            if employee:
                capability = engine.capability_for_station_on_day(employee, assignment.station, day)
                if capability == Capability.NOT_QUALIFIED:
                    errors.append(f"ERROR: {assignment.employee} not qualified for {assignment.station} on {day}")

        for assignment in day_assignments:
            employee = engine._employee(assignment.employee)
            if employee and not engine.is_available(employee, day):
                errors.append(f"ERROR: {assignment.employee} unavailable on {day} but assigned to {assignment.station}")

        pm_requirements = engine.build_pm_requirements(day)
        am_requirements = engine.build_am_requirements(day)
        pm_assigned = {}
        am_assigned = {}
        for assignment in day_assignments:
            target = pm_assigned if assignment.shift == "PM" else am_assigned
            target[assignment.station] = target.get(assignment.station, 0) + 1

        for station, needed in pm_requirements:
            got = pm_assigned.get(station, 0)
            if got >= needed:
                continue
            already_assigned_pm = {assignment.employee for assignment in day_assignments if assignment.shift == "PM"}
            qualified_and_unassigned = [
                employee
                for employee in context.employees
                if engine.is_available(employee, day)
                and engine.capability_for_station(employee, station) != Capability.NOT_QUALIFIED
                and employee.name not in already_assigned_pm
            ]
            if not qualified_and_unassigned:
                warnings.append(
                    f"WARNING [deployment gap]: {station} on {day} PM needs {needed}, only {got} assigned - "
                    "all qualified people are already deployed or unavailable"
                )
            else:
                errors.append(f"ERROR: {station} on {day} PM needs {needed}, only {got} assigned")

        for station, needed in am_requirements:
            got = am_assigned.get(station, 0)
            if got < needed:
                errors.append(f"ERROR: {station} on {day} AM needs {needed}, only {got} assigned")

        exp_people = [assignment.employee for assignment in day_assignments if "Expeditor" in assignment.station and assignment.shift == "PM"]
        if not any(name in {"Chef", "CDC", "Raimi"} for name in exp_people):
            warnings.append(f"WARNING: No leadership on Expeditor on {day}")

        for assignment in day_assignments:
            if assignment.coverage_type == "learning":
                warnings.append(f"WARNING: {assignment.employee} on {assignment.station} ({day}) is learning-level coverage")

        pm_day = [assignment for assignment in day_assignments if assignment.shift == "PM"]
        am_day = [assignment for assignment in day_assignments if assignment.shift == "AM"]
        for assignment in day_assignments:
            employee = engine._employee(assignment.employee)
            if not employee or not employee.training_on:
                continue
            for training_station in employee.training_on:
                shift_assignments = pm_day if assignment.shift == "PM" else am_day
                qualified_on_station = [
                    item
                    for item in shift_assignments
                    if item.employee != assignment.employee
                    and engine.capability_for_station(engine._employee(item.employee), training_station) == Capability.STABLE
                ]
                if not qualified_on_station:
                    warnings.append(
                        f"WARNING: {assignment.employee} training on {training_station} on {day} but no qualified mentor on the line"
                    )

    pm_counts = {employee.name: shift_counts.get(employee.name, 0) for employee in context.employees if employee.role == "pm_staff"}
    if pm_counts:
        max_shifts = max(pm_counts.values())
        min_shifts = min(pm_counts.values())
        if max_shifts - min_shifts > 2:
            high = [name for name, count in pm_counts.items() if count == max_shifts]
            low = [name for name, count in pm_counts.items() if count == min_shifts]
            warnings.append(f"WARNING: PM shift imbalance - high: {high} ({max_shifts}), low: {low} ({min_shifts})")

    for employee in context.leadership:
        available_days = [day for day in context.open_days if engine.is_available(employee, day)]
        worked = shift_counts.get(employee.name, 0)
        if worked < len(available_days):
            warnings.append(
                f"WARNING: {employee.name} (leadership) available {len(available_days)} days but only scheduled {worked}"
            )

    assumptions = list(context.week_config.get("notes", []))
    assumptions.append(f"Week starts on {context.week_start}.")

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

