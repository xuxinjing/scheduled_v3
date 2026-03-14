"""Data models for the Acquerello scheduling engine."""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class ServiceLevel(Enum):
    CLOSED = "closed"
    SLOW = "slow"
    MID = "mid"
    PEAK = "peak"


class Capability(Enum):
    STABLE = "stable"
    LEARNING = "learning"
    EMERGENCY = "emergency"
    NOT_QUALIFIED = "not_qualified"


class Shift(Enum):
    AM = "AM"
    PM = "PM"


@dataclass
class Station:
    name: str
    shift: Shift
    peak_headcount: int = 1
    slow_headcount: int = 1
    merge_with: Optional[str] = None  # station it can merge with in slow service


@dataclass
class Employee:
    name: str
    role: str  # leadership, pm_staff, am_staff
    capabilities: dict = field(default_factory=dict)  # station_name -> Capability
    preferred_stations: list = field(default_factory=list)
    unavailable_days: list = field(default_factory=list)
    training_on: list = field(default_factory=list)  # stations being trained on (counts as 0)
    forced_days: list = field(default_factory=list)  # days this employee MUST work (chef directive)


@dataclass
class Assignment:
    day: str
    shift: str
    station: str
    employee: str
    coverage_type: str  # stable, learning, emergency
    notes: str = ""
