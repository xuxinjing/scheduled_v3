# Constraint Types — AI Reference Registry

This file tells the AI which constraints are **already supported** (parametric — edit `week_config.json` only)
vs. which require **new code** (structural — read `src/constraints.py`).

---

## ✅ Supported Parametric Constraints (week_config.json only, no code needed)

### `service_levels`
Set daily service intensity. Controls how many stations and staff are needed.
```json
"service_levels": {
  "Tuesday": "slow" | "mid" | "peak",
  ...
}
```
- `slow` → merged stations (Pasta/Mids, Stuzz/Pastry, Exp/Pantry), no floater, 1 expeditor
- `mid`  → all stations dedicated, 2 expeditors, no floater
- `peak` → all stations dedicated, 2 expeditors, 1 floater

---

### `unavailable`
Mark employees as off for specific days. Works for any employee (leadership or line staff).
```json
"unavailable": {
  "CDC":  ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  "Chef": ["Wednesday"]
}
```

---

### `forced_days`
Force an employee to work on specific days, regardless of the fairness optimizer.
Use for: chef directives ("Sam works all 5 days"), station deadlock resolution (Kate/Chris Mids split).
```json
"forced_days": {
  "Sam":   ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  "Kate":  ["Tuesday", "Wednesday", "Thursday"],
  "Chris": ["Friday", "Saturday"]
}
```
⚠️  Common use case: when two employees share the only slot for a station (e.g. both do Mids only),
    pre-split them into non-overlapping forced_days to prevent optimizer deadlock.

---

### `notes`
Free-text chef notes for the week. Stored in the report, not executed by the scheduler.
```json
"notes": ["Sam trains on Sauté alongside Brandon — counts 0 for Sauté coverage."]
```

---

## ✅ training_shadows (week_config.json + scheduler.py post-processing)

For trainees who must appear in the schedule alongside their mentor at a specific station on specific days.
Use when a training employee should shadow a stable person at a station — the trainee counts as 0 for coverage.

```json
"training_shadows": {
  "Echo": {"days": ["Tuesday", "Wednesday"], "station": "Stuzz"}
}
```

- The trainee is added as a shadow assignment (`coverage_type: "training"`) only if a stable person already covers that station on that day.
- If no stable person is found, the validator will flag a mentor-gap warning.
- Use alongside `forced_days` to ensure the trainee is working on those days.
- Distinct from `training_on` in `kitchen_data.py`: that is a permanent roster fact; `training_shadows` is a weekly override for structured shadow days.

---

## ✅ weekly_capability_grants (week_config.json + scheduler.py)

Temporarily grant an employee stable capability at a station for specific days this week only.
Use when chef approves a trainee to run a station solo before their kitchen_data.py has been updated.

```json
"weekly_capability_grants": {
  "Echo": {"days": ["Thursday", "Friday", "Saturday"], "station": "Stuzz", "level": "stable"}
}
```

- The employee is treated as STABLE at the granted station on those days only.
- Does NOT change kitchen_data.py or kitchen_state.md.
- Use alongside `training_shadows` for a mid-week graduation week: shadow Tue/Wed, solo Thu–Sat.
- Update kitchen_state.md to reflect the permanent capability change after the week.

---

## 🔧 Planned but Not Yet Implemented (requires code change in src/constraints.py)

The following constraint TYPES are not yet in the codebase. If a chef asks for one of these,
the AI must read `src/constraints.py` and `src/scheduler.py` to implement it, then add it
to this registry once done.

| Constraint Type | Description | Example |
|---|---|---|
| `pairing_required` | Two employees must work the same days | Sam and Brandon always together |
| `pairing_forbidden` | Two employees cannot work the same day | A and B can't overlap |
| `max_consecutive_days` | Cap how many days in a row someone can work | No more than 4 consecutive |
| `station_pin` | Force a specific employee to a specific station on a specific day | Brandon to Sauté on Friday |
| `min_days` / `max_days` | Override the fairness optimizer's shift target for one person | Echo works max 3 days this week |
| `split_shift` | AM + PM both assigned to one person | Natalia covers PM floater on Saturday |

---

## Architecture Notes for AI

**Normal week (95% of cases):**
1. Read `week_config.json` only (~10 lines)
2. Edit `week_config.json` with new week's values
3. Run `python src/main.py`
→ Target: 90 seconds total

**Week with new constraint TYPE (5% of cases):**
1. Read `CONSTRAINT_TYPES.md` first — confirm constraint is not already supported
2. Read `src/constraints.py` (single file for all constraint logic)
3. Add the new constraint type
4. Add it to this registry
→ Target: 3–5 minutes total

**Never need to read:** `scheduler.py`, `models.py`, `validator.py`, `pivot_output.py`, `report_output.py`
unless debugging a code-level bug (not a constraint issue).
