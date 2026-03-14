"""Core data models for the refactored scheduling engine."""
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
    merge_with: Optional[str] = None


@dataclass
class Employee:
    name: str
    role: str
    capabilities: dict = field(default_factory=dict)
    preferred_stations: list = field(default_factory=list)
    unavailable_days: list = field(default_factory=list)
    training_on: list = field(default_factory=list)
    forced_days: list = field(default_factory=list)


@dataclass
class Assignment:
    day: str
    shift: str
    station: str
    employee: str
    coverage_type: str
    notes: str = ""

