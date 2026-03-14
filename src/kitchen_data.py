"""
kitchen_data.py — Acquerello stable restaurant configuration.

ARCHITECTURE:
  - Stable facts (capabilities, stations, training) are hardcoded here.
    They change only when the kitchen roster or station structure changes.
  - Weekly dynamic facts (service levels, unavailability, forced_days)
    are loaded from week_config.json at import time.
  - AI should NEVER need to edit this file for a normal weekly scheduling run.
  - AI edits week_config.json only. See CONSTRAINT_TYPES.md for supported fields.
"""
import json, os
from models import Station, Employee, Shift, Capability, ServiceLevel

# ── Load weekly config ───────────────────────────────────────────
_CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "week_config.json")
with open(_CONFIG_PATH) as _f:
    _CFG = json.load(_f)

WEEK_START = _CFG["week_start"]

# ── Service levels (weekly dynamic) ─────────────────────────────
_SL_MAP = {"slow": ServiceLevel.SLOW, "mid": ServiceLevel.MID, "peak": ServiceLevel.PEAK}
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
SERVICE_LEVELS = {
    "Monday": ServiceLevel.CLOSED,
    "Sunday": ServiceLevel.CLOSED,
}
for _day, _lvl in _CFG.get("service_levels", {}).items():
    SERVICE_LEVELS[_day] = _SL_MAP[_lvl]
# Fill any open day not in config as CLOSED (safe default)
for _day in DAYS:
    SERVICE_LEVELS.setdefault(_day, ServiceLevel.CLOSED)

OPEN_DAYS = [d for d in DAYS if SERVICE_LEVELS[d] != ServiceLevel.CLOSED]

# ── Weekly dynamic lookups (applied to Employee objects below) ───
_UNAVAILABLE = _CFG.get("unavailable", {})   # name -> [days]
_FORCED_DAYS = _CFG.get("forced_days", {})   # name -> [days]


# ── AM Stations (stable) ─────────────────────────────────────────
AM_STATIONS = [
    Station("AM Savory Prep Lead", Shift.AM),
    Station("Butcher", Shift.AM),
    Station("Savory Prep", Shift.AM),
    Station("AM Pastry Lead", Shift.AM),
    Station("AM Pastry Support", Shift.AM),
]

# ── PM Stations (stable) ─────────────────────────────────────────
PM_STATIONS = [
    Station("Stuzz",     Shift.PM, peak_headcount=1, slow_headcount=0, merge_with="Pastry"),
    Station("Pantry",    Shift.PM, peak_headcount=1, slow_headcount=0, merge_with="Expeditor"),
    Station("Pasta",     Shift.PM, peak_headcount=1, slow_headcount=0, merge_with="Mids"),
    Station("Mids",      Shift.PM, peak_headcount=1, slow_headcount=0, merge_with="Pasta"),
    Station("Sauté",     Shift.PM, peak_headcount=1, slow_headcount=1),
    Station("Pastry",    Shift.PM, peak_headcount=1, slow_headcount=0, merge_with="Stuzz"),
    Station("Expeditor", Shift.PM, peak_headcount=2, slow_headcount=1),
    Station("Floater",   Shift.PM, peak_headcount=1, slow_headcount=0),
]
SLOW_MERGED_STATIONS = [
    Station("Expeditor/Pantry", Shift.PM),
    Station("Pasta/Mids",       Shift.PM),
    Station("Stuzz/Pastry",     Shift.PM),
]


# ── Capability helpers (stable) ──────────────────────────────────
def _cap(stations: list[str], level: Capability) -> dict:
    return {s: level for s in stations}

def _all_pm_stations_stable() -> dict:
    return {
        "Expeditor": Capability.STABLE, "Sauté": Capability.STABLE,
        "Pasta": Capability.STABLE,     "Mids": Capability.STABLE,
        "Pantry": Capability.STABLE,    "Stuzz": Capability.STABLE,
        "Pastry": Capability.STABLE,    "Floater": Capability.STABLE,
        "Expeditor/Pantry": Capability.STABLE,
        "Pasta/Mids": Capability.STABLE,
        "Stuzz/Pastry": Capability.STABLE,
    }


def _emp(name, role, capabilities, preferred_stations=None, training_on=None):
    """Build Employee with weekly unavailability and forced_days injected from week_config.json."""
    return Employee(
        name=name,
        role=role,
        capabilities=capabilities,
        preferred_stations=preferred_stations or [],
        training_on=training_on or [],
        unavailable_days=_UNAVAILABLE.get(name, []),
        forced_days=_FORCED_DAYS.get(name, []),
    )


# ── Employees — STABLE roster ────────────────────────────────────
# Capabilities and training never change week-to-week.
# Weekly unavailability and forced_days are injected from week_config.json via _emp().
EMPLOYEES = [

    # ── Leadership ────────────────────────────────────────────────
    _emp("Chef", "leadership",
         capabilities={"Expeditor": Capability.STABLE, "Expeditor/Pantry": Capability.STABLE},
         preferred_stations=["Expeditor"]),

    _emp("CDC", "leadership",
         capabilities={"Expeditor": Capability.STABLE, "Floater": Capability.STABLE,
                       "Sauté": Capability.STABLE, "Expeditor/Pantry": Capability.STABLE},
         preferred_stations=["Expeditor", "Floater", "Sauté"]),

    _emp("Raimi", "leadership",
         capabilities=_all_pm_stations_stable(),
         preferred_stations=["Expeditor", "Floater", "Pasta", "Sauté"]),

    _emp("Brandon", "leadership",
         capabilities=_all_pm_stations_stable(),
         preferred_stations=["Sauté", "Pasta"]),

    # ── PM Line Staff ─────────────────────────────────────────────
    _emp("Kate", "pm_staff",
         capabilities={"Mids": Capability.STABLE, "Pasta": Capability.STABLE,
                       "Pasta/Mids": Capability.STABLE}),

    _emp("Chris", "pm_staff",
         capabilities={"Mids": Capability.STABLE}),

    _emp("Sam", "pm_staff",
         capabilities={"Pasta": Capability.STABLE, "Floater": Capability.STABLE,
                       "Pasta/Mids": Capability.STABLE},
         preferred_stations=["Pasta", "Floater"],
         training_on=["Sauté"]),

    _emp("Mateo", "pm_staff",
         capabilities={"Pantry": Capability.STABLE, "Floater": Capability.STABLE},
         preferred_stations=["Pantry", "Floater"]),

    _emp("Sebastian", "pm_staff",
         capabilities={"Stuzz": Capability.STABLE, "Pantry": Capability.STABLE,
                       "Pastry": Capability.STABLE, "Floater": Capability.STABLE,
                       "Stuzz/Pastry": Capability.STABLE},
         preferred_stations=["Stuzz", "Pantry", "Pastry", "Floater"]),

    _emp("Echo", "pm_staff",
         capabilities={},
         training_on=["Stuzz"]),

    _emp("AJ", "pm_staff",
         capabilities={"Pastry": Capability.STABLE, "Stuzz/Pastry": Capability.STABLE},
         preferred_stations=["Pastry"]),

    # ── AM Staff ──────────────────────────────────────────────────
    _emp("Natalia", "am_staff",
         capabilities={"AM Savory Prep Lead": Capability.STABLE,
                       "Savory Prep": Capability.STABLE,
                       "Floater": Capability.EMERGENCY}),

    _emp("Tucker", "am_staff",
         capabilities=_cap(["Butcher"], Capability.STABLE)),

    _emp("James", "am_staff",
         capabilities={"Savory Prep": Capability.STABLE},
         training_on=["AM Pastry Support"]),

    _emp("Chef T", "am_staff",
         capabilities=_cap(["AM Pastry Lead"], Capability.STABLE)),

    _emp("Kevin", "am_staff",
         capabilities=_cap(["AM Pastry Support"], Capability.STABLE)),
]

PM_EMPLOYEES = [e for e in EMPLOYEES if e.role in ("leadership", "pm_staff")]
AM_EMPLOYEES = [e for e in EMPLOYEES if e.role == "am_staff"]
LEADERSHIP  = [e for e in EMPLOYEES if e.role == "leadership"]
LINE_STAFF  = [e for e in EMPLOYEES if e.role == "pm_staff"]
