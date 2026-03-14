# Acquerello Scheduling Engine — Web Application Build Prompt

## Mission

Transform the existing Acquerello kitchen scheduling engine (a local Python CLI tool) into a production web application where a head chef speaks scheduling requirements via voice, an AI confirms them conversationally, and a polished schedule is generated and emailed — all in under 5 minutes.

---

## 1. Product Vision & UX Flow

### The User Experience (Chef's perspective)

```
1. Chef opens webapp on phone/tablet → sees a simple voice interface
2. Chef taps "Start" and speaks naturally:
   "This week CDC is back. Chef is off Tuesday.
    Echo should train on Stuzz for the first two days then run it solo.
    Sam works all five days on Pasta, still training Sauté with Brandon.
    Thursday through Saturday are peak. Make sure everyone gets fair days off."
3. AI responds conversationally:
   "Got it. Here's what I'm hearing for the week of March 9:
    - Service levels: Tue/Wed mid, Thu/Fri/Sat peak
    - CDC available all week
    - Chef off Tuesday only
    - Echo: shadow training Stuzz Tue/Wed with Sebastian, solo Thu-Sat
    - Sam: forced all 5 days, Pasta primary, training Sauté with Brandon
    - Kate/Chris Mids split continues (Tue-Thu / Fri-Sat)
    Anything to change?"
4. Chef says "Looks good" or makes corrections
5. AI verifies model integrity and generates schedule → chef sees a live reasoning
   animation (like Claude Code's thinking stream) showing the AI checking constraints,
   verifying capabilities, running the solver — smooth, engaging, low-lag.
   Then the pivot-table preview appears on screen.
6. Chef taps "Send" → Excel schedule emailed to chef's address
```

### Design Principles
- **Zero forms.** No dropdowns, no checkboxes, no date pickers for scheduling input.
- **Voice-first, text-fallback.** Chef can type if they prefer.
- **Confirm before compute.** AI always summarizes and gets explicit confirmation.
- **One-screen simplicity.** The scheduling flow is a single conversational screen.
- **Settings are separate.** Restaurant setup (roster, stations, capabilities) lives in a settings page — this changes rarely.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js on Vercel)                           │
│                                                         │
│  /app                                                   │
│    ├── page.tsx           → Voice/chat scheduling UI    │
│    ├── settings/          → Restaurant configuration    │
│    ├── history/           → Past schedules              │
│    └── api/                                             │
│        ├── transcribe/    → Whisper proxy               │
│        ├── chat/          → Claude conversation proxy   │
│        └── schedule/      → Trigger backend scheduler   │
│                                                         │
│  Voice capture → Whisper API → Text                     │
│  Text → Claude API (Haiku) → Structured JSON            │
│  Structured JSON → POST to backend                      │
│  Reasoning stream ← SSE from backend (integrity check)  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────┐
│  BACKEND (Python/FastAPI on Render)                     │
│                                                         │
│  /api                                                   │
│    ├── POST /integrity    → Opus 4.6 model check (SSE)  │
│    ├── POST /schedule     → Run scheduling engine       │
│    ├── GET  /schedule/:id → Retrieve schedule result    │
│    ├── POST /email        → Send schedule via email     │
│    ├── GET  /restaurant   → Get restaurant config       │
│    └── PUT  /restaurant   → Update restaurant config    │
│                                                         │
│  /engine (the existing scheduling code, adapted)        │
│    ├── models.py                                        │
│    ├── scheduler.py                                     │
│    ├── validator.py                                     │
│    ├── preflight_check.py                               │
│    ├── pivot_output.py                                  │
│    ├── excel_output.py                                  │
│    └── report_output.py                                 │
│                                                         │
│  /data (per-restaurant, stored in DB or filesystem)     │
│    ├── kitchen_state (stable truth)                     │
│    ├── kitchen_data (compiled from state)               │
│    ├── week_config (weekly input from AI)               │
│    └── schedule_output (generated artifacts)            │
│                                                         │
│  Database: PostgreSQL (restaurant configs, schedules)   │
│  File storage: S3-compatible (Excel outputs)            │
│  Email: Resend or SendGrid                              │
└─────────────────────────────────────────────────────────┘
```

### Why This Split?
- **Frontend on Vercel**: Fast global CDN, zero-config Next.js deployment, serverless API routes for lightweight proxying.
- **Backend on Render**: The scheduling engine is CPU-bound Python with `openpyxl` and combinatorial search. It needs a real Python runtime, not a serverless function with 10s timeout.
- **Separation of concerns**: Frontend handles UX + AI conversation. Backend handles scheduling computation + data persistence.

---

## 3. Existing Scheduling Engine — Complete Source Reference

The engine is currently a local Python CLI tool. Below is every file you need to port. The scheduling logic is proven and working — do NOT rewrite the algorithms. Adapt them for web serving (remove hardcoded paths, accept config as function arguments, return results as data structures instead of writing files directly).

### 3.1 Data Models (`models.py`)

```python
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
```

### 3.2 Kitchen Data Configuration (`kitchen_data.py`)

This file currently hardcodes the restaurant roster and loads weekly config from `week_config.json`. For the web app, this needs to be refactored to:
1. Load restaurant config from database (not hardcoded)
2. Accept weekly config as a function argument (not file I/O at import time)
3. Return computed data structures instead of using module-level globals

Current structure (adapt, don't rewrite the capability logic):

```python
"""
kitchen_data.py — Acquerello stable restaurant configuration.

ARCHITECTURE:
  - Stable facts (capabilities, stations, training) are hardcoded here.
    They change only when the kitchen roster or station structure changes.
  - Weekly dynamic facts (service levels, unavailability, forced_days)
    are loaded from week_config.json at import time.
"""
import json, os
from models import Station, Employee, Shift, Capability, ServiceLevel

# Load weekly config
_CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "week_config.json")
with open(_CONFIG_PATH) as _f:
    _CFG = json.load(_f)

WEEK_START = _CFG["week_start"]

# Service levels (weekly dynamic)
_SL_MAP = {"slow": ServiceLevel.SLOW, "mid": ServiceLevel.MID, "peak": ServiceLevel.PEAK}
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
SERVICE_LEVELS = {
    "Monday": ServiceLevel.CLOSED,
    "Sunday": ServiceLevel.CLOSED,
}
for _day, _lvl in _CFG.get("service_levels", {}).items():
    SERVICE_LEVELS[_day] = _SL_MAP[_lvl]
for _day in DAYS:
    SERVICE_LEVELS.setdefault(_day, ServiceLevel.CLOSED)

OPEN_DAYS = [d for d in DAYS if SERVICE_LEVELS[d] != ServiceLevel.CLOSED]

# Weekly dynamic lookups
_UNAVAILABLE = _CFG.get("unavailable", {})
_FORCED_DAYS = _CFG.get("forced_days", {})

# AM Stations (stable)
AM_STATIONS = [
    Station("AM Savory Prep Lead", Shift.AM),
    Station("Butcher", Shift.AM),
    Station("Savory Prep", Shift.AM),
    Station("AM Pastry Lead", Shift.AM),
    Station("AM Pastry Support", Shift.AM),
]

# PM Stations (stable)
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

# Capability helpers
def _cap(stations, level):
    return {s: level for s in stations}

def _all_pm_stations_stable():
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
    """Build Employee with weekly unavailability and forced_days injected."""
    return Employee(
        name=name, role=role, capabilities=capabilities,
        preferred_stations=preferred_stations or [],
        training_on=training_on or [],
        unavailable_days=_UNAVAILABLE.get(name, []),
        forced_days=_FORCED_DAYS.get(name, []),
    )

# STABLE ROSTER (Acquerello-specific — in webapp this comes from DB)
EMPLOYEES = [
    # Leadership
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
    # PM Line Staff
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
    # AM Staff
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
```

### 3.3 Scheduler (`scheduler.py`)

The core 4-phase constraint-based scheduler. This is the most complex file (~617 lines). **Do not rewrite the algorithm.** Refactor it to accept configuration as arguments instead of importing module-level globals.

Key components:
- **Phase 0**: Leadership assignment (`_assign_leadership_pm`) — assigns Chef, CDC, Raimi, Brandon to Expeditor/Sauté/Floater based on service level and availability
- **Phase 1+2**: Line-staff pattern optimization (`_compute_line_staff_schedule`) — combinatorial search for optimal work-day patterns maximizing consecutive off days
- **Phase 3**: Station assignment (`_assign_line_staff_stations`) — most-constrained-station-first bipartite matching
- **Phase 4**: Training shadow post-processing — adds training shadow assignments for trainees paired with mentors
- **AM scheduling**: Greedy fill for morning prep stations

Critical features that MUST be preserved:
- `_cap_level_on_day()`: Day-aware capability checking that honors `weekly_capability_grants`
- `_can_cover_stations()`: Recursive bipartite matching for feasibility checking
- `_consecutive_off_score()`: Scoring function for off-day consecutiveness (Rule #10)
- Training shadow logic: Trainees count as 0 for coverage, must be paired with stable mentor
- Weekly capability grants: Temporary stable capability for specific days only

```python
# Full source at: src/scheduler.py (617 lines)
# Key function signatures:

def _cap_level_on_day(emp, station_name, day) -> Capability:
    """Like _cap_level but also checks weekly_capability_grants for this day."""

def _can_cover_stations(worker_names, stations, day=None):
    """Check if workers can cover all stations via recursive matching."""

def _assign_leadership_pm(day, level):
    """Assign leadership to PM stations. Returns (assignments, used_names)."""

def _compute_line_staff_schedule(leadership_by_day):
    """Determine which days each line staff member works."""

def _assign_line_staff_stations(day, line_slots_today, working_staff, global_shift_counts):
    """Given which line staff work today, assign them to specific stations."""

def schedule_am(day, global_shift_counts):
    """Greedy AM scheduling."""

def run_scheduler():
    """Main entry. Returns (all_assignments, global_shift_counts)."""
```

### 3.4 Validator (`validator.py`)

Post-schedule validation checking 9 constraint categories:
1. Double-booking
2. Capability check (day-aware, skips training shadows)
3. Availability check
4. Coverage completeness (distinguishes scheduling errors vs deployment gaps)
5. Expeditor leadership check
6. Learning coverage risk
7. Training pairing check (Rule #7)
8. Fairness check (PM staff shift variance ≤ 2)
9. Leadership utilization check

### 3.5 Preflight Check (`preflight_check.py`)

Pre-scheduling validation:
- Drift guard (hash-based sync detection)
- Service level sanity
- Shared-station deadlock detection
- Forced-days vs unavailability conflict
- Leadership deployment gaps
- Station coverage feasibility

### 3.6 Output Generators

**`pivot_output.py`**: Weekly pivot table (employees × days) with color coding:
- Blue = AM, Orange = PM, Yellow = Learning, Purple = Training, Gray = Off
- Training shadow label: "🎓 (shadow training)"
- Dual role label: "▶ training: X"

**`excel_output.py`**: 6-sheet XLSX workbook (Instructions, Employees, Station_Coverage, Daily_Schedule, Validation_Input, Summary)

**`report_output.py`**: Markdown validator report with fragility notes and repair options

### 3.7 Weekly Config Format (`week_config.json`)

This is what the AI conversation must produce — the structured output of the chef's voice input:

```json
{
  "week_start": "2026-03-02",
  "service_levels": {
    "Tuesday": "mid",
    "Wednesday": "mid",
    "Thursday": "peak",
    "Friday": "peak",
    "Saturday": "peak"
  },
  "unavailable": {
    "Chef": ["Tuesday"]
  },
  "forced_days": {
    "Sam": ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    "Kate": ["Tuesday", "Wednesday", "Thursday"],
    "Chris": ["Friday", "Saturday"],
    "Echo": ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    "Sebastian": ["Tuesday", "Wednesday"]
  },
  "training_shadows": {
    "Echo": {"days": ["Tuesday", "Wednesday"], "station": "Stuzz"}
  },
  "weekly_capability_grants": {
    "Echo": {"days": ["Thursday", "Friday", "Saturday"], "station": "Stuzz", "level": "stable"}
  },
  "notes": [
    "CDC back this week.",
    "Chef off Tuesday only.",
    "Sam must work 5 days — Pasta station; trains on Sauté alongside Brandon.",
    "Kate/Chris pre-split on Mids to avoid deadlock.",
    "Echo: Tue/Wed shadow training on Stuzz, Thu-Sat runs Stuzz solo (chef-approved)."
  ]
}
```

### 3.8 Constraint Types Registry (`CONSTRAINT_TYPES.md`)

Supported parametric constraints (AI fills `week_config.json`):
- `service_levels`: slow/mid/peak per day
- `unavailable`: days off per employee
- `forced_days`: must-work days per employee
- `notes`: free-text chef notes
- `training_shadows`: shadow training pairing (trainee + mentor + station + days)
- `weekly_capability_grants`: temporary capability boost for specific days

Planned but not yet implemented:
- `pairing_required`, `pairing_forbidden`, `max_consecutive_days`, `station_pin`, `min_days`/`max_days`, `split_shift`

### 3.9 Stable Restaurant Truth (`kitchen_state.md`)

Human-readable document defining:
- AM/PM station structure with slow-service merge rules
- Complete staff roster with capabilities, training status, preferred stations
- 10 practical scheduling rules (expedition, service levels, hot/cold line priority, pastry, floater, training awareness, availability, default interpretation, fairness)

Key rules the AI must understand:
- **Rule #7 (Training)**: Trainees count as 0 for coverage. Must be paired with qualified mentor. If someone has "Can do: X" AND "Training on: Y", they work X (counts 1) and train Y (counts 0) — a separate Y-qualified person must also be present.
- **Rule #10 (Fairness)**: PM staff should work comparable days. Multiple off days should be consecutive.

---

## 4. AI Conversation Layer

### 4.1 Voice → Text

Use **OpenAI Whisper API** for transcription.
- Cost: ~$0.006/minute
- Implementation: Record audio in browser via MediaRecorder API, send to `/api/transcribe` route, proxy to Whisper endpoint.

### 4.2 Text → Structured Intent (the critical AI step)

Use **Claude Haiku** (claude-haiku-4-5-20251001) for the conversational AI.

The AI's job in the conversation:
1. **Understand** the chef's natural language requirements
2. **Map** them to the constraint type registry (see CONSTRAINT_TYPES.md)
3. **Infer** implicit constraints from kitchen knowledge (e.g., if chef says "Echo trains on Stuzz first 2 days then solo" → generate both `training_shadows` AND `weekly_capability_grants` AND `forced_days` for Echo AND `forced_days` for Sebastian on those 2 days)
4. **Summarize** back to chef for confirmation
5. **Output** a complete `week_config.json` on confirmation

System prompt for the scheduling AI must include:
- The restaurant's `kitchen_state.md` content (loaded from DB)
- The `CONSTRAINT_TYPES.md` registry
- The previous week's `week_config.json` as baseline
- Instructions to output valid JSON matching the week_config schema

### 4.3 Conversation Flow State Machine

```
IDLE → LISTENING → PROCESSING → CONFIRMING → GENERATING → DONE
                       ↑              │
                       └──── REVISING ←┘
```

- **LISTENING**: Chef is speaking or typing
- **PROCESSING**: AI is parsing intent
- **CONFIRMING**: AI presents summary, awaits chef approval
- **REVISING**: Chef wants changes, AI updates
- **INTEGRITY_CHECK**: Opus 4.6 verifies engine model matches current kitchen state (see §4.4)
- **GENERATING**: Schedule is being computed on backend (solver runs, streamed reasoning)
- **DONE**: Schedule ready, preview shown, email option available

### 4.4 Model Integrity Check (Opus 4.6 — MANDATORY before every solve)

**This is the most critical step in the pipeline.** Before the deterministic scheduler runs, an Opus 4.6 agent MUST verify that the scheduling engine's code (`kitchen_data.py`, `scheduler.py`, `validator.py`) correctly models the current `kitchen_state.md` and `week_constraints.md`. This mirrors the workflow in the `restaurant-scheduling-orchestrator` skill used during local development.

**Why this exists:** The scheduling engine is a deterministic solver that operates on hardcoded data structures. If the restaurant's reality has changed (new employee, updated capability, new station merge rule, new constraint type) but the code hasn't been updated, the solver will produce a schedule that is technically valid but operationally wrong. No amount of `week_config.json` tuning can fix a stale model.

**Implementation — the Integrity Check Agent:**

```
Input:
  - kitchen_state.md (current human truth from DB)
  - week_constraints.md (current weekly notes, just generated from AI conversation)
  - kitchen_data.py (current engine code)
  - scheduler.py (current engine code)
  - validator.py (current engine code)
  - CONSTRAINT_TYPES.md (constraint registry)
  - week_config.json (just generated from AI conversation)

Agent task (Opus 4.6):
  1. DIFF kitchen_state.md against what kitchen_data.py currently encodes.
     - Are all employees present with correct capabilities?
     - Are all stations defined with correct merge rules?
     - Are training statuses accurate?
     - Are scheduling rules (§1-§10) reflected in the solver?
  2. DIFF week_constraints.md against week_config.json.
     - Are all availability changes captured?
     - Are service levels correct?
     - Are special directives (training shadows, capability grants, forced days) translated?
  3. CHECK if week_constraints.md contains any constraint type NOT in CONSTRAINT_TYPES.md.
     - If yes: this is a NEW structural constraint. The agent must implement it in scheduler.py/validator.py, register it in CONSTRAINT_TYPES.md, and update kitchen_data.py if needed.
  4. VERDICT:
     - "CONSISTENT" → proceed to solver
     - "DRIFT_DETECTED" → agent applies minimum targeted code edits, then re-checks
     - "NEW_CONSTRAINT" → agent implements new constraint type, tests it, then re-checks

Output:
  - integrity_status: "pass" | "fixed" | "failed"
  - changes_made: list of file edits (if any)
  - reasoning: step-by-step explanation of what was checked and what was found
  - updated engine files (if edits were made)
```

**Cost implications:**
- Normal week (no drift): Opus reads ~5 files, confirms consistency. ~$0.50-1.00 per check.
- Drift week (code changes needed): Opus reads + edits + re-checks. ~$2-5.00 per check.
- This is the ONE place where Opus-level reasoning is justified. Haiku cannot reliably verify code-level model consistency.

**Streaming the reasoning to frontend:**
The integrity check agent's reasoning should be streamed to the frontend in real-time (see §7.5 Reasoning Animation). The chef sees the AI "thinking through" the schedule — checking each constraint, verifying each employee's capabilities, flagging any issues. This makes the 30-60 second check feel engaging rather than like dead time.

**Backend endpoint:**
```python
# POST /api/integrity-check (SSE streaming)
# Input: { restaurant_id, week_config, week_constraints_md }
# Output (streamed): { type: "reasoning" | "status" | "code_change", content: ... }
# Final: { integrity_status: "pass"|"fixed", changes_made: [...] }
```

**Fallback:** If the integrity check fails after 2 retry attempts (Opus couldn't fix the code), abort the scheduling run and surface the error to the chef with a human-readable explanation. Do NOT run the solver on a stale model.

---

## 5. Frontend Implementation (Next.js)

### 5.1 Tech Stack
- **Next.js 14+** (App Router)
- **TypeScript**
- **Tailwind CSS** for styling
- **shadcn/ui** components
- **Web Speech API** or **MediaRecorder** for voice capture

### 5.2 Pages

#### `/` — Main Scheduling Interface
- Full-screen conversational UI (like a chat)
- Floating microphone button for voice input
- Text input fallback
- AI message bubbles with structured summary
- "Confirm" / "Revise" buttons after AI summary
- Schedule preview (HTML table matching the pivot layout)
- "Send to Email" button

#### `/settings` — Restaurant Configuration
- Staff roster editor (name, role, capabilities, training, preferences)
- Station structure editor
- Scheduling rules reference (display kitchen_state.md content)
- Email configuration

#### `/history` — Past Schedules
- List of generated schedules by week
- Download Excel
- View validation report

### 5.3 API Routes (Next.js serverless)

```
POST /api/transcribe     → Proxy audio to Whisper API, return text
POST /api/chat           → Proxy message to Claude API, return AI response
POST /api/integrity      → Proxy to backend integrity check (SSE passthrough)
POST /api/schedule       → Forward week_config to backend, return schedule
POST /api/email          → Send schedule Excel via email service
```

---

## 6. Backend Implementation (Python/FastAPI on Render)

### 6.1 Tech Stack
- **FastAPI** (async Python web framework)
- **PostgreSQL** (via SQLAlchemy or Prisma) for restaurant configs & schedule history
- **S3-compatible storage** (Render Disk or Cloudflare R2) for Excel files
- **Resend** or **SendGrid** for email delivery
- **openpyxl** for Excel generation (already used by existing code)

### 6.2 API Endpoints

```python
# POST /api/integrity-check (SSE streaming endpoint)
# Input: { restaurant_id, week_config, week_constraints_md }
# Output (streamed via SSE):
#   event: reasoning   → { step: "Checking employee roster...", detail: "..." }
#   event: code_change → { file: "kitchen_data.py", diff: "..." }
#   event: status      → { integrity_status: "pass"|"fixed"|"failed", changes: [...] }
# This endpoint uses Claude Opus 4.6 to verify the scheduling engine's model
# matches the current kitchen_state.md and week_constraints.md.
# It MUST complete successfully before /api/schedule is called.

# POST /api/schedule
# Input: { restaurant_id, week_config (the JSON), kitchen_state (from DB) }
# Output: { schedule_id, assignments[], shift_counts{}, validation_report{}, excel_url }

# GET /api/schedule/{id}
# Output: Full schedule data + download URL

# POST /api/email
# Input: { schedule_id, recipient_email }
# Output: { sent: true }

# GET /api/restaurant/{id}
# Output: { kitchen_state, staff[], stations[], rules[] }

# PUT /api/restaurant/{id}
# Input: Updated restaurant config
# Output: { updated: true }
```

### 6.3 Engine Refactoring Strategy

The existing engine uses module-level globals and file I/O. Refactor to dependency injection:

```python
# BEFORE (current):
from kitchen_data import EMPLOYEES, OPEN_DAYS, SERVICE_LEVELS  # module-level globals
# Scheduler reads week_config.json at import time

# AFTER (web):
def create_kitchen_context(restaurant_config: dict, week_config: dict) -> KitchenContext:
    """Build all data structures from config dicts instead of files."""
    # Returns a context object with EMPLOYEES, OPEN_DAYS, SERVICE_LEVELS, etc.

def run_schedule(context: KitchenContext) -> ScheduleResult:
    """Run the full pipeline: preflight → schedule → validate → output."""
    # Returns assignments, shift_counts, validation, excel_bytes
```

Key refactoring rules:
1. **No file I/O in the engine.** All inputs via function arguments, all outputs via return values.
2. **No hardcoded restaurant data.** Roster, stations, capabilities come from `restaurant_config` dict (stored in DB).
3. **Preserve all scheduling logic exactly.** The 4-phase scheduler, bipartite matching, training shadows, capability grants — all stay identical.
4. **Excel generation returns bytes, not files.** `pivot_output.py` and `excel_output.py` return `io.BytesIO` instead of saving to disk.

### 6.4 Database Schema

```sql
-- Restaurants
CREATE TABLE restaurants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  kitchen_state JSONB NOT NULL,  -- parsed kitchen_state.md content
  stations JSONB NOT NULL,       -- AM + PM station definitions
  staff JSONB NOT NULL,          -- employee roster with capabilities
  scheduling_rules JSONB,        -- practical scheduling rules
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Schedules
CREATE TABLE schedules (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id),
  week_start DATE NOT NULL,
  week_config JSONB NOT NULL,        -- the AI-generated week_config
  assignments JSONB NOT NULL,        -- full assignment list
  shift_counts JSONB NOT NULL,
  validation_report JSONB NOT NULL,
  excel_url TEXT,                     -- S3 URL to Excel file
  status TEXT DEFAULT 'generated',   -- generated, sent, archived
  created_at TIMESTAMPTZ
);

-- Conversations (for history/debugging)
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id),
  schedule_id UUID REFERENCES schedules(id),
  messages JSONB NOT NULL,  -- array of {role, content, timestamp}
  created_at TIMESTAMPTZ
);
```

---

## 7. Key Implementation Details

### 7.1 The AI System Prompt

The Claude Haiku system prompt for the scheduling conversation must be carefully constructed:

```
You are a kitchen scheduling assistant for {restaurant_name}.

## Your Role
Help the head chef create the weekly schedule by:
1. Understanding their natural language requirements
2. Mapping them to structured scheduling constraints
3. Confirming the full constraint set before generating

## Restaurant Knowledge
{kitchen_state_content}

## Constraint Types You Can Generate
{constraint_types_content}

## Last Week's Configuration (as baseline)
{previous_week_config_json}

## Staff Roster
{staff_roster_summary}

## Rules
- Always confirm before generating
- If the chef's instructions are ambiguous, ask for clarification
- Infer implicit constraints (e.g., if someone trains with a mentor, the mentor must be forced to work those days)
- The Kate/Chris Mids deadlock split is a standing pattern unless chef says otherwise
- Output the final week_config as valid JSON matching the schema

## Output Format
When the chef confirms, output EXACTLY this JSON structure:
{week_config_schema}
```

### 7.2 Voice Input Implementation

```typescript
// Use MediaRecorder API for audio capture
const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

// On stop, send to Whisper API via proxy
const formData = new FormData();
formData.append('file', audioBlob, 'audio.webm');
formData.append('model', 'whisper-1');

const response = await fetch('/api/transcribe', {
  method: 'POST',
  body: formData,
});
```

### 7.3 Schedule Preview Component

The frontend should render a pivot table matching the Excel pivot output format:
- Rows: employees grouped by role (Leadership, PM Line, AM Prep)
- Columns: Mon–Sun
- Color coding: AM (blue), PM (orange), Learning (yellow), Training (purple), Off (gray)
- Service level row at top

### 7.4 Email Delivery

Attach the Excel file and include a plain-text summary:
```
Subject: Acquerello Schedule — Week of {date}

Hi Chef,

Your schedule for the week of {date} is attached.

Status: {PASS/PASS WITH WARNINGS/FAIL}
Warnings: {count}

Key notes:
- {warning_1}
- {warning_2}

Best,
Kitchen Scheduler
```

### 7.5 Reasoning Animation (CRITICAL UX — must feel like Claude Code)

When the chef confirms requirements and the system starts generating, the frontend MUST show a live reasoning stream that is smooth, engaging, and low-lag. This covers two phases: the Opus integrity check and the solver execution.

**Design reference:** Claude Code's terminal animation — text streams in character-by-character with a thinking indicator, steps appear progressively, and the whole thing feels alive rather than like a loading spinner.

**Implementation architecture:**

```
Backend (FastAPI) ──SSE stream──→ Frontend (Next.js) ──render──→ Reasoning Panel

SSE event types:
  { type: "phase",     content: "🔍 Verifying scheduling model..." }
  { type: "reasoning", content: "Checking employee roster... 16 employees found ✓" }
  { type: "reasoning", content: "Verifying Echo's capabilities... training_on: Stuzz ✓" }
  { type: "reasoning", content: "Checking week_config alignment... service levels match ✓" }
  { type: "code_fix",  content: "⚠️ Drift detected: CDC availability changed. Updating..." }
  { type: "phase",     content: "⚡ Running scheduler..." }
  { type: "reasoning", content: "Phase 0: Leadership assignment... Chef→Expeditor, Brandon→Sauté ✓" }
  { type: "reasoning", content: "Phase 1-2: Computing line staff patterns... optimizing off-day consecutiveness" }
  { type: "reasoning", content: "Phase 3: Station matching... bipartite matching complete ✓" }
  { type: "reasoning", content: "Phase 4: Training shadows... Echo→Stuzz (Tue/Wed with Sebastian) ✓" }
  { type: "phase",     content: "✅ Validating schedule..." }
  { type: "warning",   content: "⚠️ PM shift imbalance: Sebastian(2) vs Echo(5)" }
  { type: "complete",  content: { assignments: [...], validation: {...} } }
```

**Frontend component: `<ReasoningStream />`**

```
┌─────────────────────────────────────────┐
│  🔍 Verifying scheduling model...       │
│                                         │
│  ✓ Employee roster: 16 staff verified   │
│  ✓ Station structure: 8 PM + 5 AM       │
│  ✓ Training status: Echo→Stuzz, Sam→... │
│  ✓ Service levels: mid/mid/peak/peak/pk │
│  ✓ Model integrity: PASS                │
│                                         │
│  ⚡ Running scheduler...                 │
│                                         │
│  ✓ Leadership: Chef, Brandon, Raimi OK  │
│  ✓ Line staff patterns: optimized       │  ← text streams in smoothly
│  ▸ Station matching...                  │  ← current step pulses
│                                         │
│  ░░░░░░░░░░░████████░░░░░░░░░░  63%    │  ← optional progress bar
└─────────────────────────────────────────┘
```

**Key UX requirements:**

1. **Streaming, not polling.** Use Server-Sent Events (SSE) from backend → frontend. Each reasoning step arrives as it happens. No loading spinners, no "please wait" screens.

2. **Character-by-character text animation.** Each reasoning line should appear with a typewriter effect (CSS animation or requestAnimationFrame). Target: 40-60 chars/second for readability. Don't dump entire lines at once.

3. **Phase transitions with visual distinction.** Phase headers ("🔍 Verifying...", "⚡ Running...", "✅ Validating...") should appear with a brief scale/fade animation. Use different background colors or left-border accents.

4. **Current step indicator.** The active step should have a pulsing dot or spinner (▸ or ●). Completed steps show ✓. Failed steps show ✗ in red.

5. **Smooth scroll.** The reasoning panel auto-scrolls to keep the latest step visible. Use `scroll-behavior: smooth` with a debounced scroll handler.

6. **Low perceived latency.** The first SSE event must arrive within 500ms of the chef hitting "Confirm". If Opus takes a moment to start, show a subtle "connecting..." animation immediately. The backend should send a `{ type: "phase", content: "Starting..." }` event before the Opus API call returns.

7. **Collapse on completion.** When the schedule is ready, the reasoning panel smoothly collapses (or becomes a toggleable "Show reasoning" section) and the pivot table preview slides in. The transition should feel like one continuous flow, not two separate screens.

8. **Error handling in-stream.** If the integrity check finds drift and fixes code, show it as a `code_fix` event with a diff-like format. If it fails completely, the stream ends with a clear error message — not a generic "Something went wrong."

**Technical notes:**
- Backend: Use FastAPI's `StreamingResponse` with `media_type="text/event-stream"` for SSE.
- The Opus integrity check uses the Anthropic streaming API (`stream=True`) — each reasoning chunk is forwarded as an SSE event.
- The solver phases (deterministic Python) emit progress events via a callback function passed to the scheduler.
- Frontend: Use `EventSource` or `fetch` with `ReadableStream` to consume SSE. React state updates batched per animation frame to avoid jank.

---

## 8. Environment Variables

### Frontend (Vercel)
```
ANTHROPIC_API_KEY=sk-ant-...          # For Claude Haiku (conversation)
OPENAI_API_KEY=sk-...                 # For Whisper (voice transcription)
BACKEND_URL=https://your-app.onrender.com
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Backend (Render)
```
ANTHROPIC_API_KEY=sk-ant-...          # For Claude Opus 4.6 (integrity check agent)
DATABASE_URL=postgresql://...
RESEND_API_KEY=re_...                 # Or SENDGRID_API_KEY
S3_BUCKET=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
FRONTEND_URL=https://your-app.vercel.app  # For CORS
```

---

## 9. Development Sequence

### Phase 1: Backend Engine Refactoring (do this FIRST)
1. Create a new Python project with FastAPI
2. Copy all engine files from `src/`
3. Refactor `kitchen_data.py` to accept config dicts instead of reading files
4. Refactor `scheduler.py` to accept a context object instead of importing globals; add progress callback hooks for SSE streaming
5. Refactor output generators to return bytes/dicts instead of writing files
6. Implement the Opus 4.6 integrity check agent (`/api/integrity-check`) with SSE streaming — this calls Anthropic's streaming API, verifies model consistency, and streams reasoning events to the frontend
7. Add FastAPI endpoints (`/api/schedule`, `/api/restaurant`)
8. Add PostgreSQL models and migrations
9. Test: POST a `week_config` JSON → integrity check passes → valid schedule back
10. Deploy to Render

### Phase 2: Frontend Core + Voice (voice is NOT optional — ship together)
1. Create Next.js project with Tailwind + shadcn/ui
2. Build the chat UI component with voice-first design
3. Implement MediaRecorder-based voice capture + Whisper API proxy route
4. Connect voice → text → Claude API → response flow (text input as fallback)
5. Add visual feedback for voice (recording indicator, waveform animation)
6. Add schedule preview component (HTML pivot table) with reasoning animation (see §7.5)
7. Add settings page for restaurant config
8. Deploy to Vercel

### Phase 3: Email & Polish
1. Integrate Resend/SendGrid for email delivery
2. Add Excel file attachment to emails
3. Add schedule history page
4. Add error handling and loading states
5. Mobile-responsive design (chef uses tablet/phone)

### Phase 4: Multi-Restaurant (future)
1. Authentication (Clerk or NextAuth)
2. Restaurant onboarding flow
3. Per-restaurant data isolation
4. Billing integration

---

## 10. Cost Model

Per scheduling run (normal week — no model drift):
- Whisper transcription: ~$0.01 (1-2 min of speech)
- Claude Haiku conversation: ~$0.01-0.02 (2-3 turns, small context)
- **Claude Opus 4.6 integrity check: ~$0.50-1.00** (reads ~5 files, confirms consistency)
- Backend compute: ~$0.001 (CPU time on Render)
- Email: ~$0.001 (Resend)
- **Total: ~$0.55-1.05 per run (normal week)**

Per scheduling run (drift week — model needs code updates):
- All of the above, plus:
- **Claude Opus 4.6 code editing + re-check: ~$2-5.00**
- **Total: ~$3-6 per run (drift week, ~5% of weeks)**

**Weighted monthly cost (4 runs/month):** ~$2.50-5.00/month for a single restaurant.

This is dramatically cheaper than the current $5/run Opus cost because:
1. Haiku replaces Opus for NL understanding (conversation layer)
2. Opus is only used for model integrity verification, not the full orchestration
3. No AI in the scheduling computation (deterministic solver)
4. Normal weeks (95%) cost ~$1; only drift weeks (5%) approach the old $5 cost

---

## 11. GitHub Repository Structure

```
acquerello-scheduler/
├── frontend/                    # Next.js app (Vercel)
│   ├── app/
│   │   ├── page.tsx             # Main scheduling UI
│   │   ├── settings/page.tsx    # Restaurant config
│   │   ├── history/page.tsx     # Past schedules
│   │   └── api/
│   │       ├── transcribe/route.ts
│   │       ├── chat/route.ts
│   │       ├── integrity/route.ts  # SSE passthrough to backend
│   │       ├── schedule/route.ts
│   │       └── email/route.ts
│   ├── components/
│   │   ├── ChatUI.tsx
│   │   ├── VoiceInput.tsx
│   │   ├── SchedulePreview.tsx
│   │   ├── StaffEditor.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── ai.ts                # Claude API wrapper
│   │   ├── whisper.ts           # Whisper API wrapper
│   │   └── types.ts             # Shared TypeScript types
│   ├── package.json
│   ├── tailwind.config.ts
│   └── next.config.js
│
├── backend/                     # Python/FastAPI app (Render)
│   ├── app/
│   │   ├── main.py              # FastAPI app entry
│   │   ├── api/
│   │   │   ├── integrity.py     # Opus 4.6 model integrity check (SSE)
│   │   │   ├── schedule.py      # Schedule endpoints
│   │   │   ├── restaurant.py    # Restaurant config endpoints
│   │   │   └── email.py         # Email endpoints
│   │   ├── engine/              # The scheduling engine (adapted)
│   │   │   ├── models.py
│   │   │   ├── context.py       # KitchenContext builder
│   │   │   ├── scheduler.py
│   │   │   ├── validator.py
│   │   │   ├── preflight.py
│   │   │   ├── pivot_output.py
│   │   │   ├── excel_output.py
│   │   │   └── report_output.py
│   │   ├── db/
│   │   │   ├── models.py        # SQLAlchemy models
│   │   │   └── database.py      # DB connection
│   │   └── services/
│   │       ├── email.py         # Email sending
│   │       └── storage.py       # S3 file storage
│   ├── requirements.txt
│   ├── Dockerfile
│   └── render.yaml
│
├── .github/
│   └── workflows/
│       ├── frontend.yml         # Vercel auto-deploys, but CI checks
│       └── backend.yml          # Test + deploy to Render
│
└── README.md
```

---

## 12. Critical Constraints for the Builder

1. **DO NOT rewrite the scheduling algorithm.** It is proven, tested, and handles edge cases (training shadows, capability grants, deadlock detection, bipartite matching). Refactor for web serving, don't redesign.

2. **The AI conversation is NOT the scheduler.** AI translates natural language → `week_config.json`. The deterministic solver does the scheduling. This is the key architectural insight that makes the product economically viable.

3. **Restaurant knowledge lives in the system prompt.** The AI's ability to infer implicit constraints (like forcing Sebastian's days when Echo needs a shadow mentor) comes from having `kitchen_state.md` in context — NOT from the scheduling code.

4. **Voice is a non-negotiable for v1.** The entire product premise is that the chef speaks instead of filling forms. Voice input must ship in the first working demo — it is NOT a Phase 3 enhancement. Implement MediaRecorder + Whisper transcription in the same sprint as the chat UI. Text input is the fallback, not the primary.

5. **Start with single-restaurant, hardcoded Acquerello data.** Multi-restaurant support and onboarding can come later. The v1 should work for one restaurant using the existing roster data.

6. **The Excel output format must match the current pivot layout exactly.** The chef is already familiar with it. Don't redesign the output.

7. **Mobile-first design.** The chef will use this on a phone or tablet in the kitchen, not at a desk.

8. **Opus 4.6 integrity check is MANDATORY before every solve.** Never run the deterministic scheduler without first verifying that the engine code matches the current kitchen state and weekly constraints. This is the guardrail that prevents operationally wrong schedules. Refer to the `restaurant-scheduling-orchestrator` skill's workflow (Steps 1-3: read → diff → sync) — the integrity check agent replicates this workflow programmatically.

9. **The reasoning stream is a product feature, not a debug log.** The chef should ENJOY watching the AI think. The animation must be smooth (60fps), the text must be readable (not a wall of technical jargon), and the whole experience must feel premium. Think of it as the scheduling equivalent of watching a barista make your coffee — the process IS the experience.
