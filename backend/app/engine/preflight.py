"""Static constraint validation before scheduling."""
from __future__ import annotations

from .context import KitchenContext
from .models import Capability, ServiceLevel
from .scheduler import SchedulerEngine


def run_preflight(context: KitchenContext) -> tuple[list[str], list[str]]:
    engine = SchedulerEngine(context)
    errors: list[str] = []
    warnings: list[str] = []

    for day in context.open_days:
        if context.service_levels[day] == ServiceLevel.CLOSED:
            errors.append(f"[preflight] {day} is in OPEN_DAYS but has CLOSED service level.")

    station_to_only_workers = {}
    for employee in context.line_staff:
        non_merged = [station for station in employee.capabilities if "/" not in station and station != "Floater"]
        if len(non_merged) == 1:
            station_to_only_workers.setdefault(non_merged[0], []).append(employee)

    for station, workers in station_to_only_workers.items():
        if len(workers) <= 1:
            continue
        forced_sets = [set(worker.forced_days) for worker in workers]
        overlapping = forced_sets[0].intersection(*forced_sets[1:]) if forced_sets else set()
        if overlapping:
            errors.append(
                f"[preflight] DEADLOCK RISK: {[worker.name for worker in workers]} all can only do '{station}' "
                f"(1 slot/day) but share forced_days on: {sorted(overlapping)}. Split their forced days."
            )
        elif not all(worker.forced_days for worker in workers):
            warnings.append(
                f"[preflight] SHARED STATION: {[worker.name for worker in workers]} share '{station}' "
                f"(1 slot/day). Optimizer may deadlock without forced day splits."
            )

    for employee in context.employees:
        conflicts = [day for day in employee.forced_days if not engine.is_available(employee, day)]
        if conflicts:
            errors.append(
                f"[preflight] CONFIG CONFLICT: {employee.name} has forced_days {employee.forced_days} "
                f"but is unavailable on {conflicts}."
            )

    for day in context.open_days:
        level = context.service_levels[day]
        leadership_pairs, _ = engine.assign_leadership_pm(day, level)
        requirements = dict(engine.build_pm_requirements(day))
        exp_filled = sum(1 for station, _ in leadership_pairs if "Expeditor" in station)
        exp_needed = requirements.get("Expeditor", 0)
        if exp_filled < exp_needed:
            line_can_exp = [
                employee
                for employee in context.line_staff
                if engine.is_available(employee, day)
                and engine.capability_for_station(employee, "Expeditor") != Capability.NOT_QUALIFIED
            ]
            if line_can_exp:
                warnings.append(
                    f"[preflight] {day}: Expeditor needs {exp_needed}, leadership fills {exp_filled}. "
                    f"Line staff {[employee.name for employee in line_can_exp]} can cover the gap."
                )
            else:
                warnings.append(
                    f"[preflight] {day}: DEPLOYMENT GAP - Expeditor needs {exp_needed}, leadership fills {exp_filled}, "
                    "no line staff qualified."
                )

        saute_filled = sum(1 for station, _ in leadership_pairs if station == "Sauté")
        if saute_filled == 0:
            warnings.append(f"[preflight] {day}: No leadership assigned to Sauté. Verify line coverage.")

    for day in context.open_days:
        for required_station, _ in engine.build_pm_requirements(day):
            qualified = [
                employee
                for employee in context.employees
                if engine.is_available(employee, day)
                and engine.capability_for_station(employee, required_station) != Capability.NOT_QUALIFIED
            ]
            if not qualified:
                errors.append(
                    f"[preflight] {day} PM: No available qualified person for '{required_station}'. Schedule will fail."
                )

    return errors, warnings

