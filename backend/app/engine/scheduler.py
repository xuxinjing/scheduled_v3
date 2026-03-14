"""Context-driven scheduler preserving the CLI engine's scheduling logic."""
from __future__ import annotations

from itertools import combinations
from typing import Callable

from .context import KitchenContext
from .models import Assignment, Capability, ServiceLevel

PEAK_FILL_ORDER = [
    "Expeditor",
    "Expeditor",
    "Sauté",
    "Pasta",
    "Mids",
    "Pantry",
    "Stuzz",
    "Pastry",
    "Floater",
]
MID_FILL_ORDER = [
    "Expeditor",
    "Expeditor",
    "Sauté",
    "Pasta",
    "Mids",
    "Pantry",
    "Stuzz",
    "Pastry",
]
SLOW_FILL_ORDER = ["Expeditor/Pantry", "Sauté", "Pasta/Mids", "Stuzz/Pastry"]

ProgressCallback = Callable[[str, str], None] | None


class SchedulerEngine:
    def __init__(self, context: KitchenContext, progress_callback: ProgressCallback = None) -> None:
        self.context = context
        self.progress_callback = progress_callback

    def _emit(self, phase: str, message: str) -> None:
        if self.progress_callback:
            self.progress_callback(phase, message)

    def _employee(self, name: str):
        for employee in self.context.employees:
            if employee.name == name:
                return employee
        return None

    @staticmethod
    def _coverage_label(capability: Capability) -> str:
        return {
            Capability.STABLE: "stable",
            Capability.LEARNING: "learning",
            Capability.EMERGENCY: "emergency",
        }.get(capability, "emergency")

    @staticmethod
    def _consecutive_off_score(working_days: set[str]) -> int:
        all_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        off = []
        for day in all_days:
            if day in ("Monday", "Sunday"):
                off.append(True)
            else:
                off.append(day not in working_days)

        blocks = 0
        in_block = False
        for is_off in off:
            if is_off and not in_block:
                blocks += 1
                in_block = True
            elif not is_off:
                in_block = False

        max_block_len = 0
        current_len = 0
        for is_off in off:
            if is_off:
                current_len += 1
                max_block_len = max(max_block_len, current_len)
            else:
                current_len = 0
        return -blocks * 10 + max_block_len

    @staticmethod
    def is_available(employee, day: str) -> bool:
        return day not in employee.unavailable_days

    def capability_for_station(self, employee, station_name: str) -> Capability:
        return employee.capabilities.get(station_name, Capability.NOT_QUALIFIED)

    def capability_for_station_on_day(self, employee, station_name: str, day: str) -> Capability:
        grant = self.context.capability_grants_by_day.get(day, {}).get(employee.name, {}).get(station_name)
        if grant is not None:
            return grant
        return self.capability_for_station(employee, station_name)

    def build_pm_requirements(self, day: str) -> list[tuple[str, int]]:
        level = self.context.service_levels[day]
        if level == ServiceLevel.SLOW:
            return [("Expeditor/Pantry", 1), ("Sauté", 1), ("Pasta/Mids", 1), ("Stuzz/Pastry", 1)]
        if level == ServiceLevel.MID:
            return [
                ("Expeditor", 2),
                ("Sauté", 1),
                ("Pasta", 1),
                ("Mids", 1),
                ("Pantry", 1),
                ("Stuzz", 1),
                ("Pastry", 1),
            ]
        if level == ServiceLevel.PEAK:
            return [
                ("Expeditor", 2),
                ("Sauté", 1),
                ("Pasta", 1),
                ("Mids", 1),
                ("Pantry", 1),
                ("Stuzz", 1),
                ("Pastry", 1),
                ("Floater", 1),
            ]
        return []

    def build_am_requirements(self, day: str) -> list[tuple[str, int]]:
        return [(station.name, 1) for station in self.context.am_stations]

    def assign_leadership_pm(self, day: str, level: ServiceLevel):
        assignments = []
        used = set()

        chef = self._employee("Chef")
        cdc = self._employee("CDC")
        raimi = self._employee("Raimi")
        brandon = self._employee("Brandon")

        chef_available = chef and self.is_available(chef, day)
        cdc_available = cdc and self.is_available(cdc, day)
        raimi_available = raimi and self.is_available(raimi, day)
        brandon_available = brandon and self.is_available(brandon, day)

        needs_two_expeditors = level in (ServiceLevel.PEAK, ServiceLevel.MID)
        needs_floater = level == ServiceLevel.PEAK
        is_slow = level == ServiceLevel.SLOW
        exp_station = "Expeditor/Pantry" if is_slow else "Expeditor"

        if chef_available:
            assignments.append((exp_station, "Chef"))
            used.add("Chef")

        if cdc_available:
            if needs_two_expeditors:
                assignments.append(("Expeditor", "CDC"))
            elif is_slow and "Chef" in used:
                assignments.append(("Sauté", "CDC"))
            elif is_slow:
                assignments.append(("Expeditor/Pantry", "CDC"))
            used.add("CDC")

        if raimi_available:
            exp_count = sum(1 for station, _ in assignments if station in ("Expeditor", "Expeditor/Pantry"))
            saute_taken = any(station == "Sauté" for station, _ in assignments)

            if needs_two_expeditors and exp_count < 2:
                assignments.append(("Expeditor", "Raimi"))
            elif is_slow and exp_count < 1:
                assignments.append(("Expeditor/Pantry", "Raimi"))
            elif needs_floater:
                assignments.append(("Floater", "Raimi"))
            elif is_slow:
                assignments.append(("Sauté", "Raimi") if not saute_taken else ("Pasta/Mids", "Raimi"))
            else:
                assignments.append(("Sauté", "Raimi") if not saute_taken else ("Pasta", "Raimi"))
            used.add("Raimi")

        if brandon_available:
            saute_taken = any(station == "Sauté" for station, _ in assignments)
            if not saute_taken:
                assignments.append(("Sauté", "Brandon"))
            else:
                assignments.append(("Pasta/Mids", "Brandon") if is_slow else ("Pasta", "Brandon"))
            used.add("Brandon")

        return assignments, used

    def _can_cover_stations(self, worker_names: list[str], stations: list[str], day: str | None = None) -> bool:
        if not stations:
            return True

        def capability(name: str, station: str) -> Capability:
            employee = self._employee(name)
            if employee is None:
                return Capability.NOT_QUALIFIED
            if day:
                return self.capability_for_station_on_day(employee, station, day)
            return self.capability_for_station(employee, station)

        best_index = None
        best_candidates = None
        for index, station in enumerate(stations):
            candidates = [name for name in worker_names if capability(name, station) != Capability.NOT_QUALIFIED]
            if not candidates:
                return False
            if best_candidates is None or len(candidates) < len(best_candidates):
                best_index = index
                best_candidates = candidates

        remaining_stations = stations[:best_index] + stations[best_index + 1 :]
        for candidate in best_candidates:
            remaining_workers = [name for name in worker_names if name != candidate]
            if self._can_cover_stations(remaining_workers, remaining_stations, day):
                return True
        return False

    def _compute_line_staff_schedule(self, leadership_by_day: dict[str, list[tuple[str, str]]]):
        line_slots = {}
        for day in self.context.open_days:
            level = self.context.service_levels[day]
            fill = SLOW_FILL_ORDER if level == ServiceLevel.SLOW else MID_FILL_ORDER if level == ServiceLevel.MID else PEAK_FILL_ORDER
            leadership_station_list = [station for station, _ in leadership_by_day[day]]
            remaining = list(fill)
            for station in leadership_station_list:
                if station in remaining:
                    remaining.remove(station)
            line_slots[day] = remaining

        for day in self.context.open_days:
            line_slots[day] = [
                station
                for station in line_slots[day]
                if any(self.capability_for_station(employee, station) != Capability.NOT_QUALIFIED for employee in self.context.line_staff)
            ]

        forced_staff = [employee for employee in self.context.line_staff if employee.forced_days]
        free_staff = [employee for employee in self.context.line_staff if not employee.forced_days]

        pre_assigned = {}
        pre_remaining = {day: len(line_slots[day]) for day in self.context.open_days}
        for employee in forced_staff:
            work_days = {day for day in employee.forced_days if day in self.context.open_days and self.is_available(employee, day)}
            pre_assigned[employee.name] = work_days
            for day in work_days:
                pre_remaining[day] = max(0, pre_remaining[day] - 1)

        can_work = {}
        for employee in free_staff:
            possible = []
            for day in self.context.open_days:
                if not self.is_available(employee, day):
                    continue
                for station in line_slots[day]:
                    if self.capability_for_station_on_day(employee, station, day) != Capability.NOT_QUALIFIED:
                        possible.append(day)
                        break
            can_work[employee.name] = possible

        remaining_slots = sum(pre_remaining.values())
        free_count = len(free_staff)
        base = remaining_slots // free_count if free_count else 0
        best_assignment = None
        best_score = float("-inf")

        def check_coverage_feasible(assigned: dict[str, set[str]]) -> bool:
            for day in self.context.open_days:
                workers_today = [name for name, days in assigned.items() if day in days]
                stations_today = line_slots[day]
                if len(workers_today) < len(stations_today):
                    return False
                if not self._can_cover_stations(workers_today, stations_today, day):
                    return False
            return True

        def try_assign(staff_list, slots_remaining, assigned, depth=0):
            nonlocal best_assignment, best_score

            if depth == len(staff_list):
                if any(slots_remaining[day] > 0 for day in self.context.open_days):
                    return
                full_assigned = {**pre_assigned, **assigned}
                if not check_coverage_feasible(full_assigned):
                    return
                total_score = sum(self._consecutive_off_score(days) for days in full_assigned.values())
                if total_score > best_score:
                    best_score = total_score
                    best_assignment = {name: set(days) for name, days in full_assigned.items()}
                return

            employee = staff_list[depth]
            possible_days = can_work[employee.name]
            for shift_count in [base + 1, base]:
                if shift_count > len(possible_days) or shift_count < 0:
                    continue
                for combo in combinations(possible_days, shift_count):
                    work_set = set(combo)
                    valid = True
                    new_remaining = dict(slots_remaining)
                    for day in work_set:
                        if new_remaining[day] <= 0:
                            valid = False
                            break
                        new_remaining[day] -= 1
                    if not valid:
                        continue
                    assigned[employee.name] = work_set
                    try_assign(staff_list, new_remaining, assigned, depth + 1)
                    del assigned[employee.name]

        sorted_free_staff = sorted(free_staff, key=lambda employee: len(can_work[employee.name]))
        try_assign(sorted_free_staff, dict(pre_remaining), {})
        if best_assignment is None:
            best_assignment = dict(pre_assigned)
            for employee in free_staff:
                best_assignment[employee.name] = set(can_work[employee.name])
        return best_assignment, line_slots

    def _assign_line_staff_stations(self, day: str, line_slots_today: list[str], working_staff: set[str], shift_counts: dict[str, int]):
        available_names = [employee.name for employee in self.context.line_staff if employee.name in working_staff]
        stations = list(line_slots_today)

        def match(remaining_stations, remaining_workers):
            if not remaining_stations:
                return {}

            best_index = None
            best_candidates = None
            best_station = None
            for index, station in enumerate(remaining_stations):
                candidates = [
                    name
                    for name in remaining_workers
                    if self.capability_for_station_on_day(self._employee(name), station, day) != Capability.NOT_QUALIFIED
                ]
                if not candidates:
                    return None
                if best_candidates is None or len(candidates) < len(best_candidates):
                    best_index = index
                    best_candidates = candidates
                    best_station = station

            rest_stations = remaining_stations[:best_index] + remaining_stations[best_index + 1 :]

            def sort_key(name: str):
                employee = self._employee(name)
                capability = self.capability_for_station_on_day(employee, best_station, day)
                capability_rank = 0 if capability == Capability.STABLE else 1
                preferred_rank = 0 if best_station in employee.preferred_stations else 1
                return (capability_rank, preferred_rank, name)

            best_candidates.sort(key=sort_key)
            for candidate in best_candidates:
                rest_workers = [name for name in remaining_workers if name != candidate]
                result = match(rest_stations, rest_workers)
                if result is not None:
                    result[best_station] = candidate
                    return result
            return None

        matching = match(stations, available_names) or {}
        assignments = []
        for station, name in matching.items():
            employee = self._employee(name)
            capability = self.capability_for_station_on_day(employee, station, day)
            note = ""
            if employee.training_on:
                extra = [training_station for training_station in employee.training_on if training_station != station]
                if extra:
                    note = f"Also training on {', '.join(extra)}"
            assignments.append(
                Assignment(
                    day=day,
                    shift="PM",
                    station=station,
                    employee=name,
                    coverage_type=self._coverage_label(capability),
                    notes=note,
                )
            )
            shift_counts[name] = shift_counts.get(name, 0) + 1
        return assignments

    def schedule_am(self, day: str, shift_counts: dict[str, int]):
        assignments = []
        used = set()
        am_fill_order = ["AM Savory Prep Lead", "Butcher", "Savory Prep", "AM Pastry Lead", "AM Pastry Support"]
        for station in am_fill_order:
            candidates = [
                employee
                for employee in self.context.am_employees
                if employee.name not in used
                and self.is_available(employee, day)
                and self.capability_for_station(employee, station) != Capability.NOT_QUALIFIED
            ]
            candidates.sort(key=lambda employee: (0 if self.capability_for_station(employee, station) == Capability.STABLE else 1, employee.name))
            if candidates:
                best = candidates[0]
                capability = self.capability_for_station(best, station)
                note = ""
                if best.training_on:
                    extra = [training_station for training_station in best.training_on if training_station != station]
                    if extra:
                        note = f"Also training on {', '.join(extra)}"
                assignments.append(
                    Assignment(
                        day=day,
                        shift="AM",
                        station=station,
                        employee=best.name,
                        coverage_type=self._coverage_label(capability),
                        notes=note,
                    )
                )
                used.add(best.name)
                shift_counts[best.name] = shift_counts.get(best.name, 0) + 1
        return assignments

    def run(self):
        self._emit("solver", "Computing leadership coverage.")
        assignments = []
        shift_counts: dict[str, int] = {}
        leadership_by_day = {}
        for day in self.context.open_days:
            level = self.context.service_levels[day]
            leadership_by_day[day], _ = self.assign_leadership_pm(day, level)

        self._emit("solver", "Optimizing line staff work patterns.")
        line_schedule, line_slots = self._compute_line_staff_schedule(leadership_by_day)

        self._emit("solver", "Assigning AM and PM stations.")
        for day in self.context.open_days:
            assignments.extend(self.schedule_am(day, shift_counts))
            for station, name in leadership_by_day[day]:
                capability = self.capability_for_station(self._employee(name), station)
                assignments.append(
                    Assignment(
                        day=day,
                        shift="PM",
                        station=station,
                        employee=name,
                        coverage_type=self._coverage_label(capability),
                    )
                )
                shift_counts[name] = shift_counts.get(name, 0) + 1

            working_today = {name for name, days in line_schedule.items() if day in days}
            assignments.extend(self._assign_line_staff_stations(day, line_slots[day], working_today, shift_counts))

        self._emit("solver", "Applying training shadow overlays.")
        for employee_name, shadow_info in self.context.training_shadows.items():
            shadow_days = shadow_info.get("days", [])
            shadow_station = shadow_info.get("station", "")
            for day in shadow_days:
                if day not in self.context.open_days:
                    continue
                already_assigned = any(assignment.day == day and assignment.employee == employee_name for assignment in assignments)
                if already_assigned:
                    continue
                stable_mentor = any(
                    assignment.day == day
                    and assignment.station == shadow_station
                    and assignment.shift == "PM"
                    and self.capability_for_station(self._employee(assignment.employee), shadow_station) == Capability.STABLE
                    for assignment in assignments
                )
                if stable_mentor:
                    assignments.append(
                        Assignment(
                            day=day,
                            shift="PM",
                            station=shadow_station,
                            employee=employee_name,
                            coverage_type="training",
                            notes="Shadow training - counts 0 for coverage; mentor present",
                        )
                    )
                    shift_counts[employee_name] = shift_counts.get(employee_name, 0) + 1

        return assignments, shift_counts


def run_scheduler(context: KitchenContext, progress_callback: ProgressCallback = None):
    return SchedulerEngine(context, progress_callback=progress_callback).run()

