"""Kitchen context builder for the Acquerello scheduler."""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Any

from .models import Capability, Employee, ServiceLevel, Shift, Station

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
SERVICE_LEVEL_MAP = {
    "closed": ServiceLevel.CLOSED,
    "slow": ServiceLevel.SLOW,
    "mid": ServiceLevel.MID,
    "peak": ServiceLevel.PEAK,
}
CAPABILITY_MAP = {
    "stable": Capability.STABLE,
    "learning": Capability.LEARNING,
    "emergency": Capability.EMERGENCY,
    "not_qualified": Capability.NOT_QUALIFIED,
}


def _cap(stations: list[str], level: str) -> dict[str, str]:
    return {station: level for station in stations}


def default_restaurant_config() -> dict[str, Any]:
    """Return the current Acquerello stable restaurant truth as serializable data."""
    all_pm_stations = {
        "Expeditor": "stable",
        "Sauté": "stable",
        "Pasta": "stable",
        "Mids": "stable",
        "Pantry": "stable",
        "Stuzz": "stable",
        "Pastry": "stable",
        "Floater": "stable",
        "Expeditor/Pantry": "stable",
        "Pasta/Mids": "stable",
        "Stuzz/Pastry": "stable",
    }
    return {
        "name": "Acquerello",
        "slug": "acquerello",
        "email_config": {
            "default_recipient": "chef@example.com",
            "from_email": "Acquerello Scheduler <onboarding@resend.dev>",
        },
        "am_stations": [
            {"name": "AM Savory Prep Lead", "shift": "AM"},
            {"name": "Butcher", "shift": "AM"},
            {"name": "Savory Prep", "shift": "AM"},
            {"name": "AM Pastry Lead", "shift": "AM"},
            {"name": "AM Pastry Support", "shift": "AM"},
        ],
        "pm_stations": [
            {"name": "Stuzz", "shift": "PM", "peak_headcount": 1, "slow_headcount": 0, "merge_with": "Pastry"},
            {"name": "Pantry", "shift": "PM", "peak_headcount": 1, "slow_headcount": 0, "merge_with": "Expeditor"},
            {"name": "Pasta", "shift": "PM", "peak_headcount": 1, "slow_headcount": 0, "merge_with": "Mids"},
            {"name": "Mids", "shift": "PM", "peak_headcount": 1, "slow_headcount": 0, "merge_with": "Pasta"},
            {"name": "Sauté", "shift": "PM", "peak_headcount": 1, "slow_headcount": 1},
            {"name": "Pastry", "shift": "PM", "peak_headcount": 1, "slow_headcount": 0, "merge_with": "Stuzz"},
            {"name": "Expeditor", "shift": "PM", "peak_headcount": 2, "slow_headcount": 1},
            {"name": "Floater", "shift": "PM", "peak_headcount": 1, "slow_headcount": 0},
        ],
        "slow_merged_stations": [
            {"name": "Expeditor/Pantry", "shift": "PM"},
            {"name": "Pasta/Mids", "shift": "PM"},
            {"name": "Stuzz/Pastry", "shift": "PM"},
        ],
        "employees": [
            {
                "name": "Chef",
                "role": "leadership",
                "capabilities": {"Expeditor": "stable", "Expeditor/Pantry": "stable"},
                "preferred_stations": ["Expeditor"],
            },
            {
                "name": "CDC",
                "role": "leadership",
                "capabilities": {
                    "Expeditor": "stable",
                    "Floater": "stable",
                    "Sauté": "stable",
                    "Expeditor/Pantry": "stable",
                },
                "preferred_stations": ["Expeditor", "Floater", "Sauté"],
            },
            {
                "name": "Raimi",
                "role": "leadership",
                "capabilities": deepcopy(all_pm_stations),
                "preferred_stations": ["Expeditor", "Floater", "Pasta", "Sauté"],
            },
            {
                "name": "Brandon",
                "role": "leadership",
                "capabilities": deepcopy(all_pm_stations),
                "preferred_stations": ["Sauté", "Pasta"],
            },
            {
                "name": "Kate",
                "role": "pm_staff",
                "capabilities": {"Mids": "stable", "Pasta": "stable", "Pasta/Mids": "stable"},
            },
            {"name": "Chris", "role": "pm_staff", "capabilities": {"Mids": "stable"}},
            {
                "name": "Sam",
                "role": "pm_staff",
                "capabilities": {"Pasta": "stable", "Floater": "stable", "Pasta/Mids": "stable"},
                "preferred_stations": ["Pasta", "Floater"],
                "training_on": ["Sauté"],
            },
            {
                "name": "Mateo",
                "role": "pm_staff",
                "capabilities": {"Pantry": "stable", "Floater": "stable"},
                "preferred_stations": ["Pantry", "Floater"],
            },
            {
                "name": "Sebastian",
                "role": "pm_staff",
                "capabilities": {
                    "Stuzz": "stable",
                    "Pantry": "stable",
                    "Pastry": "stable",
                    "Floater": "stable",
                    "Stuzz/Pastry": "stable",
                },
                "preferred_stations": ["Stuzz", "Pantry", "Pastry", "Floater"],
            },
            {"name": "Echo", "role": "pm_staff", "capabilities": {}, "training_on": ["Stuzz"]},
            {
                "name": "AJ",
                "role": "pm_staff",
                "capabilities": {"Pastry": "stable", "Stuzz/Pastry": "stable"},
                "preferred_stations": ["Pastry"],
            },
            {
                "name": "Natalia",
                "role": "am_staff",
                "capabilities": {
                    "AM Savory Prep Lead": "stable",
                    "Savory Prep": "stable",
                    "Floater": "emergency",
                },
            },
            {"name": "Tucker", "role": "am_staff", "capabilities": _cap(["Butcher"], "stable")},
            {
                "name": "James",
                "role": "am_staff",
                "capabilities": {"Savory Prep": "stable"},
                "training_on": ["AM Pastry Support"],
            },
            {"name": "Chef T", "role": "am_staff", "capabilities": _cap(["AM Pastry Lead"], "stable")},
            {"name": "Kevin", "role": "am_staff", "capabilities": _cap(["AM Pastry Support"], "stable")},
        ],
    }


@dataclass
class KitchenContext:
    restaurant_config: dict[str, Any]
    week_config: dict[str, Any]
    week_start: str
    days: list[str]
    service_levels: dict[str, ServiceLevel]
    open_days: list[str]
    am_stations: list[Station]
    pm_stations: list[Station]
    slow_merged_stations: list[Station]
    employees: list[Employee]
    pm_employees: list[Employee]
    am_employees: list[Employee]
    leadership: list[Employee]
    line_staff: list[Employee]
    training_shadows: dict[str, Any]
    capability_grants_by_day: dict[str, dict[str, dict[str, Capability]]]


def _build_station(raw: dict[str, Any]) -> Station:
    return Station(
        name=raw["name"],
        shift=Shift(raw["shift"]),
        peak_headcount=raw.get("peak_headcount", 1),
        slow_headcount=raw.get("slow_headcount", 1),
        merge_with=raw.get("merge_with"),
    )


def _capability_from_name(name: str) -> Capability:
    return CAPABILITY_MAP.get(name, Capability.NOT_QUALIFIED)


def _build_employee(raw: dict[str, Any], unavailable: dict[str, list[str]], forced_days: dict[str, list[str]]) -> Employee:
    return Employee(
        name=raw["name"],
        role=raw["role"],
        capabilities={station: _capability_from_name(level) for station, level in raw.get("capabilities", {}).items()},
        preferred_stations=list(raw.get("preferred_stations", [])),
        unavailable_days=list(unavailable.get(raw["name"], [])),
        training_on=list(raw.get("training_on", [])),
        forced_days=list(forced_days.get(raw["name"], [])),
    )


def build_context(week_config: dict[str, Any], restaurant_config: dict[str, Any] | None = None) -> KitchenContext:
    restaurant = deepcopy(restaurant_config or default_restaurant_config())
    service_levels = {"Monday": ServiceLevel.CLOSED, "Sunday": ServiceLevel.CLOSED}
    for day, level in week_config.get("service_levels", {}).items():
        service_levels[day] = SERVICE_LEVEL_MAP[level]
    for day in DAYS:
        service_levels.setdefault(day, ServiceLevel.CLOSED)
    open_days = [day for day in DAYS if service_levels[day] != ServiceLevel.CLOSED]

    unavailable = week_config.get("unavailable", {})
    forced_days = week_config.get("forced_days", {})
    employees = [_build_employee(raw, unavailable, forced_days) for raw in restaurant["employees"]]

    grants_by_day: dict[str, dict[str, dict[str, Capability]]] = {}
    for employee_name, grant in week_config.get("weekly_capability_grants", {}).items():
        station = grant["station"]
        level = _capability_from_name(grant.get("level", "stable"))
        for day in grant.get("days", []):
            grants_by_day.setdefault(day, {}).setdefault(employee_name, {})[station] = level

    return KitchenContext(
        restaurant_config=restaurant,
        week_config=deepcopy(week_config),
        week_start=week_config["week_start"],
        days=list(DAYS),
        service_levels=service_levels,
        open_days=open_days,
        am_stations=[_build_station(item) for item in restaurant["am_stations"]],
        pm_stations=[_build_station(item) for item in restaurant["pm_stations"]],
        slow_merged_stations=[_build_station(item) for item in restaurant["slow_merged_stations"]],
        employees=employees,
        pm_employees=[employee for employee in employees if employee.role in ("leadership", "pm_staff")],
        am_employees=[employee for employee in employees if employee.role == "am_staff"],
        leadership=[employee for employee in employees if employee.role == "leadership"],
        line_staff=[employee for employee in employees if employee.role == "pm_staff"],
        training_shadows=deepcopy(week_config.get("training_shadows", {})),
        capability_grants_by_day=grants_by_day,
    )
