# Acquerello Scheduling Engine v2 Spec
Version: v2
Restaurant: Acquerello
Last Updated: 2026-03-08

---

## 1. Goal

Build a scheduling system that does not rely on one giant prompt.
Instead, separate the problem into stable truth, weekly truth, schedule artifact, and validation artifact.

The system must be:
- human-editable
- machine-readable
- versionable
- debuggable
- resilient to ambiguity

---

## 2. Core Architecture

### 2.1 Files

1. `kitchen_state.md`
   - static truth layer
   - changes slowly
   - versioned intentionally

2. `week_constraints.md`
   - weekly dynamic layer
   - captures chef judgment for a specific week
   - supports natural language plus structured extraction

3. `schedule_output.xlsx`
   - final operational schedule artifact
   - human-usable by management and kitchen leads
   - should also expose structured schedule data for validator input

4. `validator_report.md`
   - explanation and contradiction layer
   - turns schedule correctness into something inspectable

### 2.2 Design Principle
The schedule is not the source of truth.
The schedule is a proposal generated from truth sources.

---

## 3. Data Flow

### Step 1: Static State Authoring
Human updates `kitchen_state.md`.

### Step 2: Weekly Note Authoring
Chef / CDC writes `week_constraints.md`.

### Step 3: Parsing
System extracts structured objects from the two markdown files.

### Step 4: Draft Generation
Solver generates one or more schedule candidates.

### Step 5: Validation
Validator checks candidate schedule against both truth layers.

### Step 6: Human Review
Chef reviews schedule + validator report.

### Step 7: Versioning
System stores:
- static state version
- week constraint version
- schedule version
- validator version

---

## 4. Parsing Contract

### 4.1 Parser Inputs
- markdown sections
- tables
- bullet lists
- stable headings
- explicit uncertainty language

### 4.2 Parser Outputs
At minimum:

#### From `kitchen_state.md`
- station definitions
- service mode staffing rules
- employee capability graph
- fixed role identities
- persistent hard constraints
- persistent soft preferences
- known fragility points
- unresolved questions

#### From `week_constraints.md`
- week metadata
- day-level intensity forecast
- availability changes
- temporary hard constraints
- temporary soft preferences
- temporary merge permissions
- training priorities
- special events
- risk notes
- unresolved questions

### 4.3 Parser Rule
If the text says "learning", "not stable", "prefer", "avoid", or similar uncertainty language,
the parser should preserve graded confidence rather than collapsing everything into hard booleans.

Recommended confidence levels:
- stable
- supervised
- developing
- unknown

---

## 5. Solver Contract

### 5.1 Solver Objective Order
1. satisfy hard constraints
2. protect service quality
3. cover expeditor
4. secure sauté
5. secure pasta / meats
6. fill cold-side stations
7. minimize labor waste
8. preserve training opportunities where safe

### 5.2 Solver Must Understand
- season mode: peak vs slow
- valid station merges
- operational risk from weak hot-line combinations
- attendance volatility
- emergency coverage vs normal coverage
- human-written weekly overrides

### 5.3 Solver Output
The solver should generate:
- exactly one primary recommended schedule
- optionally one conservative fallback schedule
- machine-readable assignment table
- reason annotations for risky assignments

### 5.4 Solver Must Not
- silently break hard constraints
- assume missing availability
- turn "can help in emergency" into "normal assignment"
- overuse Natalia as planned PM labor
- treat developmental staff as fully independent unless weekly notes explicitly allow it

---

## 6. Validator Contract

### 6.1 Validator Questions
For every day:
- is every required role covered?
- are merges legal for that day and service mode?
- is expeditor logic respected?
- is sauté adequately staffed for difficulty level?
- are developmental staff used safely?
- is emergency labor being misused?

### 6.2 Validator Output Types
- ERROR = invalid
- WARNING = legal but risky
- INFO = non-blocking note

### 6.3 Validator Philosophy
The validator should prefer explainability over cleverness.
If the schedule fails, the human should know why in one read.

---

## 7. Weekly Dynamic Layer Design

### 7.1 Why It Matters
The weekly dynamic layer is where actual operating judgment lives.
Without it, the system either becomes too rigid or starts hallucinating intent.

### 7.2 Content Type
This layer should accept natural language such as:
- "Kate can do pasta on Monday but not Friday."
- "Saturday looks peak because of VIPs."
- "Use Natalia only if there is a late callout."

### 7.3 Required Stability
Even though the content is natural language, the section layout must be stable:
- service forecast
- availability
- weekly notes
- extracted hard constraints
- extracted preferences
- training priorities
- risk notes
- unresolved questions

### 7.4 Workflow
Natural language first.
Structured extraction second.
Human confirmation third.

That order matters.

---

## 8. Recommended Schedule Workbook Design

### 8.1 Required Sheets in `schedule_output.xlsx`
- `Instructions`
- `Employees`
- `Station_Coverage`
- `Daily_Schedule`
- `Validation_Input`
- `Summary`

### 8.2 Sheet Roles
- `Instructions`: how managers use the workbook
- `Employees`: roster, stable stations, notes
- `Station_Coverage`: matrix by day and station
- `Daily_Schedule`: detailed assignments and notes
- `Validation_Input`: normalized table for validator ingestion
- `Summary`: counts, warnings, release status

### 8.3 Required Columns for Normalized Validation Table
- week_of
- day
- service_level
- employee
- assignment_type
- station
- role_priority
- notes
- source_override_flag

---

## 9. Contradiction Detector Grammar

Recommended contradiction categories:
- missing_required_role
- illegal_station_merge
- weak_hotline_pairing
- wrong_expeditor_logic
- emergency_coverage_misuse
- training_overreach
- attendance_conflict
- unsupported_skill_assignment
- unresolved_weekly_ambiguity

Each contradiction should carry:
- id
- severity
- day
- rule source
- explanation
- suggested repair

---

## 10. Versioning and Deltas

### 10.1 Why Versioning Matters
The system should answer:
- what changed since last week?
- what changed in the static kitchen state?
- which schedule failures came from stale assumptions?

### 10.2 Delta Types
- state delta
- weekly delta
- schedule delta
- validator delta

### 10.3 Example Delta Events
- Kate pasta confidence changed from developing to supervised
- Sam unavailable Wednesday
- Brandon started expeditor shadowing
- Friday reclassified from high to peak

---

## 11. Confidence Scoring

Recommended schedule confidence dimensions:
- coverage confidence
- hot-line confidence
- attendance confidence
- training risk confidence
- emergency reliance confidence

A day-level confidence score can be computed,
but the system should expose the components instead of hiding them behind one fake-precise number.

---

## 12. Fallback Ladder

When the solver cannot find an ideal solution, it should degrade in this order:

1. consume flexible senior coverage
2. use valid slow-season merge
3. reduce training exposure
4. use emergency support with warning
5. fail explicitly if still impossible

Explicit failure is better than a dishonest schedule.

---

## 13. Human Review UX

Before release, the reviewer should be able to inspect:
- the weekly notes that drove the schedule
- all deviations from static truth
- all warnings and errors
- why a specific risky assignment happened
- what changed vs prior version

---

## 14. Non-Goals

This v2 spec does not attempt to solve:
- payroll
- labor law compliance engine
- recipe prep planning
- purchasing
- front-of-house scheduling

It is focused on PM kitchen line staffing and related AM support interactions.

---

## 15. Success Condition

The engine is successful if:
- Chef can read and edit the truth files
- the solver produces schedules grounded in reality
- the validator catches fake-good schedules
- changes are explainable
- weekly decisions become easier, not more magical
