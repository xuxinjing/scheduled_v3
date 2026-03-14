# Phase 1: Backend Engine Refactoring — Implementation Plan

## Overview

Transform the local Python CLI scheduling engine into a FastAPI web backend. The core scheduling algorithm stays **identical** — we refactor data access patterns (module-level globals → dependency-injected context object) and I/O patterns (file reads/writes → function args/return values).

---

## 1. Target Directory Structure

```
backend/
  app/
    __init__.py
    main.py                    # FastAPI app, CORS, lifespan
    config.py                  # pydantic-settings (env vars)
    api/
      __init__.py
      integrity.py             # POST /api/integrity-check (SSE)
      schedule.py              # POST /api/schedule, GET /api/schedule/{id}
      restaurant.py            # GET/PUT /api/restaurant/{id}
      email.py                 # POST /api/email
    engine/
      __init__.py
      models.py                # Existing dataclasses + new ScheduleResult
      context.py               # KitchenContext dataclass + create_kitchen_context()
      scheduler.py             # Refactored: all functions take ctx arg
      validator.py             # Refactored: all functions take ctx arg
      preflight.py             # Refactored: no drift guard, takes ctx arg
      pivot_output.py          # Refactored: returns io.BytesIO
      excel_output.py          # Refactored: returns io.BytesIO
      report_output.py         # Refactored: returns string
      acquerello.py            # Hardcoded Acquerello restaurant_config dict (v1)
    db/
      __init__.py
      database.py              # async SQLAlchemy engine + session factory
      models.py                # ORM models (restaurants, schedules, conversations)
    services/
      __init__.py
      storage.py               # S3/R2 upload + presigned URL
      email_service.py         # Resend/SendGrid
      integrity_agent.py       # Opus 4.6 integrity check logic
  requirements.txt
  Dockerfile
  render.yaml
  tests/
    __init__.py
    conftest.py                # Shared fixtures
    test_context.py
    test_scheduler.py
    test_validator.py
    test_preflight.py
    test_outputs.py
    test_api.py
```

---

## 2. Implementation Steps (in order)

### Step 1: Project scaffold + engine/models.py
- Create `backend/` directory structure with all `__init__.py` files
- Copy existing `models.py` dataclasses (ServiceLevel, Capability, Shift, Station, Employee, Assignment)
- Add new `ScheduleResult` dataclass
- Add `requirements.txt`

### Step 2: engine/acquerello.py (NEW)
- Extract Acquerello's hardcoded roster, stations, capabilities into a plain `ACQUERELLO_CONFIG` dict
- Station names must match the original exactly (including "Sauté" with accent)
- This replaces `kitchen_data.py`'s hardcoded data for v1

### Step 3: engine/context.py (NEW — the key refactoring artifact)
- Create `KitchenContext` dataclass holding ALL data that was previously module-level globals
- Create `create_kitchen_context(restaurant_config, week_config, on_progress=None)` builder
- This replaces: `EMPLOYEES`, `OPEN_DAYS`, `SERVICE_LEVELS`, `PM_EMPLOYEES`, `AM_EMPLOYEES`, `LEADERSHIP`, `LINE_STAFF`, `_TRAINING_SHADOWS`, `_CAPABILITY_GRANTS`, `_GRANTS_BY_DAY`, `PEAK_FILL_ORDER`, `MID_FILL_ORDER`, `SLOW_FILL_ORDER`, `AM_STATIONS`
- `on_progress` callback enables SSE streaming from scheduler phases

### Step 4: engine/scheduler.py (REFACTOR — most complex)
- Remove all `from kitchen_data import ...` and module-level `json.load()`
- Add `ctx: KitchenContext` as first parameter to EVERY function
- Replace global references: `OPEN_DAYS` → `ctx.open_days`, `SERVICE_LEVELS` → `ctx.service_levels`, `EMPLOYEES` → `ctx.employees`, etc.
- `_cap_level_on_day(emp, station, day)` → `_cap_level_on_day(ctx, emp, station, day)` (reads `ctx.grants_by_day`)
- `_emp(name)` → `_emp(ctx, name)` (searches `ctx.employees`)
- Add progress callbacks at phase boundaries
- **Algorithm logic stays 100% identical**

### Step 5: engine/validator.py (REFACTOR)
- Remove imports from `kitchen_data`
- `validate(assignments, shift_counts)` → `validate(ctx, assignments, shift_counts)`
- Replace all global refs with `ctx.*`
- Pass `ctx` through to scheduler helpers (`build_pm_requirements`, `_cap_level_on_day`, etc.)
- Remove hardcoded assumptions list (generate dynamically or leave empty for v1)

### Step 6: engine/preflight.py (REFACTOR)
- Remove drift guard entirely (replaced by Opus integrity check)
- `run_preflight()` → `run_preflight(ctx)`
- Keep checks: service level sanity, deadlock detection, forced_days conflicts, leadership gaps, station coverage
- Replace all global refs with `ctx.*`

### Step 7: engine/pivot_output.py (REFACTOR)
- Remove internal `run_scheduler()` call — accept `assignments` + `shift_counts` as params
- `generate_pivot(output_path)` → `generate_pivot(ctx, assignments, shift_counts) -> io.BytesIO`
- Replace `wb.save(path)` with `wb.save(buffer); return buffer`
- Replace all global refs with `ctx.*`

### Step 8: engine/excel_output.py (REFACTOR)
- Same pattern as pivot_output
- `generate(output_path)` → `generate_excel(ctx, assignments, shift_counts, validation_report) -> io.BytesIO`
- Remove internal `run_scheduler()` and `validate()` calls

### Step 9: engine/report_output.py (REFACTOR)
- `generate_report(report, output_path)` → `generate_report(ctx, report) -> str`
- Return string instead of writing file
- Replace hardcoded week dates with `ctx.week_start`

### Step 10: Tests for engine layer
- `test_context.py`: context builds correctly, all fields populated, weekly overrides injected
- `test_scheduler.py`: smoke test, no double-booking, training shadows, capability grants, forced days, unavailability — **regression test comparing output to original CLI**
- `test_validator.py`: valid schedule passes, detects fabricated violations
- `test_preflight.py`: passes valid config, catches forced+unavailable conflicts
- `test_outputs.py`: pivot returns BytesIO, excel loadable by openpyxl, report returns valid markdown

### Step 11: FastAPI app skeleton
- `app/config.py`: pydantic-settings for env vars (DATABASE_URL, ANTHROPIC_API_KEY, etc.)
- `app/main.py`: FastAPI app with CORS, lifespan, router includes

### Step 12: Database layer
- `db/models.py`: SQLAlchemy ORM models (Restaurant, Schedule, Conversation)
- `db/database.py`: async engine, session factory, create_tables

### Step 13: Core API endpoints
- `POST /api/schedule`: accepts week_config → preflight → schedule → validate → generate excel → persist → return
- `GET /api/schedule/{id}`: retrieve stored schedule
- `GET /api/restaurant/{id}`: returns Acquerello config (v1 hardcoded)

### Step 14: Integrity check agent (SSE)
- `services/integrity_agent.py`: Opus 4.6 streaming verification
- `api/integrity.py`: SSE endpoint wrapping the agent
- Streams reasoning events as the model checks employee roster, capabilities, stations, weekly config consistency

### Step 15: Email + storage services
- `services/storage.py`: S3-compatible upload, presigned URL generation
- `services/email_service.py`: Resend/SendGrid with Excel attachment
- `api/email.py`: POST /api/email endpoint

### Step 16: Integration testing + deployment config
- `test_api.py`: full happy path, error cases, SSE format
- `Dockerfile`, `render.yaml` for Render deployment
- `.env.example` with all required variables

---

## 3. Key Architectural Decisions

1. **KitchenContext is the single source of truth** — every engine function receives it, no module-level state
2. **Acquerello data hardcoded in acquerello.py for v1** — DB-backed configs are v2
3. **Drift guard removed** — the Opus integrity check replaces hash-based drift detection
4. **Progress callbacks in scheduler** — enables real-time SSE streaming of solver progress
5. **All outputs return bytes/strings** — no file I/O inside the engine
6. **Station name fidelity is critical** — "Sauté" must match exactly across acquerello.py and scheduler.py; regression test catches mismatches

---

## 4. Risk Mitigations

- **Regression test**: Run original CLI + refactored engine with same week_config.json, compare assignments count and composition
- **Station name verification**: Automated test that fill order names exist in station definitions
- **CPU-bound scheduler**: For v1 (7 line staff), completes in ~1s. If roster grows, move to background task
- **Leadership hardcoding**: `_assign_leadership_pm` uses "Chef"/"CDC"/"Raimi"/"Brandon" by name — acceptable for v1
