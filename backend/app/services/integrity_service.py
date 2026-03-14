"""Anthropic-backed integrity check service with SSE helpers."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Generator, Iterable

from anthropic import APIConnectionError, APIError, APIStatusError, Anthropic

from ..core.settings import get_settings
from ..engine.context import KitchenContext, build_context
from ..engine.preflight import run_preflight
from .config_store import load_restaurant_config, load_week_config

VERDICT_PATTERN = re.compile(r"VERDICT:\s*(PASS|WARN|FAIL)\b", re.IGNORECASE)
SUMMARY_PATTERN = re.compile(r"SUMMARY:\s*(.+)", re.IGNORECASE)


@dataclass
class IntegrityResult:
    status: str
    summary: str
    model: str | None
    raw_text: str
    warnings: list[str]
    local_preflight_errors: list[str]
    local_preflight_warnings: list[str]
    changes_made: list[str]


class IntegrityCheckError(Exception):
    def __init__(self, message: str, *, status_code: int = 503, details: dict | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {"message": message}


def render_week_constraints_md(week_config: dict) -> str:
    lines = [
        "# week_constraints.md",
        "",
        f"## Week Of",
        week_config.get("week_start", "Unknown"),
        "",
        "## Service Levels",
    ]
    for day, level in week_config.get("service_levels", {}).items():
        lines.append(f"- {day}: {level}")
    lines.extend(["", "## Unavailable"])
    unavailable = week_config.get("unavailable", {})
    if unavailable:
        for employee, days in unavailable.items():
            lines.append(f"- {employee}: {', '.join(days)}")
    else:
        lines.append("- None")
    lines.extend(["", "## Forced Days"])
    forced = week_config.get("forced_days", {})
    if forced:
        for employee, days in forced.items():
            lines.append(f"- {employee}: {', '.join(days)}")
    else:
        lines.append("- None")
    lines.extend(["", "## Training Shadows"])
    shadows = week_config.get("training_shadows", {})
    if shadows:
        for employee, config in shadows.items():
            lines.append(f"- {employee}: {config.get('station')} on {', '.join(config.get('days', []))}")
    else:
        lines.append("- None")
    notes = week_config.get("notes", [])
    lines.extend(["", "## Notes"])
    lines.extend([f"- {note}" for note in notes] or ["- None"])
    return "\n".join(lines)


def _create_client() -> Anthropic:
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise IntegrityCheckError(
            "ANTHROPIC_API_KEY is not configured",
            status_code=503,
            details={"message": "Integrity check is not configured", "missing": ["ANTHROPIC_API_KEY"]},
        )
    return Anthropic(api_key=settings.anthropic_api_key)


def build_integrity_prompt(context: KitchenContext, week_constraints_md: str) -> tuple[str, str]:
    restaurant_summary = {
        "name": context.restaurant_config.get("name"),
        "slug": context.restaurant_config.get("slug"),
        "employee_count": len(context.employees),
        "open_days": context.open_days,
        "pm_station_count": len(context.pm_stations),
        "am_station_count": len(context.am_stations),
        "training_shadows": context.training_shadows,
        "weekly_capability_grants": context.week_config.get("weekly_capability_grants", {}),
    }
    system = (
        "You are the restaurant scheduling integrity agent. "
        "Check whether the deterministic scheduling model matches the current kitchen truth and this week's constraints before solve. "
        "Be concise and operational. Output one line per thought. "
        "Allowed prefixes: PHASE, OK, WARN, FAIL, FIX, VERDICT, SUMMARY. "
        "If you detect drift, describe the minimum required file change in a FIX line. "
        "Finish with exactly one VERDICT line using PASS, WARN, or FAIL, then one SUMMARY line."
    )
    user = (
        "Validate this schedule setup.\n\n"
        f"Restaurant summary:\n{json.dumps(restaurant_summary, indent=2)}\n\n"
        "Restaurant config:\n"
        f"{json.dumps(context.restaurant_config, indent=2)}\n\n"
        "week_constraints.md:\n"
        f"{week_constraints_md}\n\n"
        "week_config.json:\n"
        f"{json.dumps(context.week_config, indent=2)}\n\n"
        "Deterministic scheduler guardrails:\n"
        "- leadership owns expeditor/pass first\n"
        "- line staff patterns are optimized after hard constraints\n"
        "- training shadows count as zero coverage\n"
        "- weekly capability grants are day-scoped\n"
        "- preflight catches deadlocks, force/unavailable conflicts, and zero-qualified stations\n\n"
        "Tasks:\n"
        "1. Diff stable restaurant truth against encoded staff/stations/capabilities.\n"
        "2. Diff week_constraints.md against week_config.json.\n"
        "3. Flag any new structural constraint types.\n"
        "4. Return PASS, WARN, or FAIL.\n"
        "Use FIX lines only for concrete targeted code/model updates."
    )
    return system, user


def _line_to_event(line: str) -> dict:
    prefix, _, content = line.partition(":")
    prefix = prefix.strip().upper()
    content = content.strip()
    if prefix == "PHASE":
        return {"type": "phase", "content": content}
    if prefix == "OK":
        return {"type": "reasoning", "status": "complete", "content": content}
    if prefix == "WARN":
        return {"type": "reasoning", "status": "warning", "content": content}
    if prefix == "FAIL":
        return {"type": "reasoning", "status": "failed", "content": content}
    if prefix == "FIX":
        return {"type": "code_change", "content": content}
    if prefix == "VERDICT":
        verdict = content.upper()
        mapped = {"PASS": "pass", "WARN": "warn", "FAIL": "fail"}.get(verdict, "warn")
        return {"type": "status", "integrity_status": mapped, "content": verdict, "status": mapped}
    if prefix == "SUMMARY":
        return {"type": "summary", "content": content}
    return {"type": "reasoning", "content": line}


def _consume_buffer(buffer: str) -> tuple[list[dict], str]:
    events: list[dict] = []
    while "\n" in buffer:
        line, buffer = buffer.split("\n", 1)
        line = line.strip()
        if line:
            events.append(_line_to_event(line))
    return events, buffer


def _parse_final_result(final_text: str, preflight_errors: list[str], preflight_warnings: list[str], model: str | None) -> IntegrityResult:
    verdict_match = VERDICT_PATTERN.search(final_text)
    summary_match = SUMMARY_PATTERN.search(final_text)
    changes_made = [match.group(1).strip() for match in re.finditer(r"FIX:\s*(.+)", final_text)]
    status = "warn"
    if verdict_match:
        status = {"PASS": "pass", "WARN": "warn", "FAIL": "fail"}[verdict_match.group(1).upper()]
    elif preflight_errors:
        status = "fail"
    elif preflight_warnings:
        status = "warn"
    summary = summary_match.group(1).strip() if summary_match else (
        "Preflight found blocking issues."
        if preflight_errors
        else "Preflight passed with warnings."
        if preflight_warnings
        else "Integrity review completed."
    )
    warnings = list(preflight_warnings)
    if status == "fail" and preflight_errors:
        warnings.extend(preflight_errors)
    return IntegrityResult(
        status=status,
        summary=summary,
        model=model,
        raw_text=final_text,
        warnings=warnings,
        local_preflight_errors=preflight_errors,
        local_preflight_warnings=preflight_warnings,
        changes_made=changes_made,
    )


def verify_integrity(
    week_config: dict | None = None,
    restaurant_config: dict | None = None,
    week_constraints_md: str | None = None,
) -> IntegrityResult:
    settings = get_settings()
    resolved_week_config = week_config or load_week_config()
    resolved_restaurant_config = restaurant_config or load_restaurant_config()
    resolved_week_constraints = week_constraints_md or render_week_constraints_md(resolved_week_config)
    context = build_context(resolved_week_config, resolved_restaurant_config)
    preflight_errors, preflight_warnings = run_preflight(context)

    if not settings.integrity_configured:
        if settings.integrity_check_mode == "required":
            raise IntegrityCheckError(
                "Integrity check is required but ANTHROPIC_INTEGRITY_MODEL and ANTHROPIC_API_KEY are not both configured",
                status_code=503,
                details={
                    "message": "Integrity check is required but not configured",
                    "missing": [
                        name
                        for name, present in (
                            ("ANTHROPIC_API_KEY", bool(settings.anthropic_api_key)),
                            ("ANTHROPIC_INTEGRITY_MODEL", bool(settings.anthropic_integrity_model)),
                        )
                        if not present
                    ],
                },
            )
        return IntegrityResult(
            status="fail" if preflight_errors else "warn" if preflight_warnings else "skipped",
            summary="Anthropic integrity review skipped because the integration is not configured.",
            model=None,
            raw_text="",
            warnings=preflight_warnings,
            local_preflight_errors=preflight_errors,
            local_preflight_warnings=preflight_warnings,
            changes_made=[],
        )

    client = _create_client()
    system_prompt, user_prompt = build_integrity_prompt(context, resolved_week_constraints)
    attempts = 2
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            response = client.messages.create(
                model=settings.anthropic_integrity_model,
                max_tokens=settings.integrity_max_tokens,
                temperature=settings.integrity_temperature,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
                timeout=settings.integrity_timeout_seconds,
            )
            final_text = "\n".join(block.text for block in response.content if getattr(block, "type", None) == "text")
            return _parse_final_result(final_text, preflight_errors, preflight_warnings, settings.anthropic_integrity_model)
        except (APIConnectionError, APIStatusError, APIError) as exc:
            last_error = exc
            if settings.integrity_check_mode != "required":
                break
    if settings.integrity_check_mode == "required":
        raise IntegrityCheckError(
            f"Integrity check failed: {last_error}",
            status_code=503,
            details={"message": "Integrity check request failed", "error": str(last_error)},
        ) from last_error
    return IntegrityResult(
        status="fail" if preflight_errors else "warn" if preflight_warnings else "warn",
        summary=f"Anthropic integrity review failed, continuing in best-effort mode: {last_error}",
        model=settings.anthropic_integrity_model,
        raw_text="",
        warnings=preflight_warnings + ([str(last_error)] if last_error else []),
        local_preflight_errors=preflight_errors,
        local_preflight_warnings=preflight_warnings,
        changes_made=[],
    )


def integrity_event_stream(
    week_config: dict | None = None,
    restaurant_config: dict | None = None,
    week_constraints_md: str | None = None,
) -> Generator[str, None, None]:
    settings = get_settings()
    resolved_week_config = week_config or load_week_config()
    resolved_restaurant_config = restaurant_config or load_restaurant_config()
    resolved_week_constraints = week_constraints_md or render_week_constraints_md(resolved_week_config)
    context = build_context(resolved_week_config, resolved_restaurant_config)
    preflight_errors, preflight_warnings = run_preflight(context)

    def emit(event: dict) -> str:
        return f"data: {json.dumps(event)}\n\n"

    yield emit({"type": "phase", "content": "Starting..."})
    yield emit({"type": "phase", "content": "Verifying scheduling model..."})
    yield emit({"type": "reasoning", "status": "complete", "content": f"Employee roster: {len(context.employees)} staff verified"})
    yield emit({"type": "reasoning", "status": "complete", "content": f"Station structure: {len(context.pm_stations)} PM + {len(context.am_stations)} AM"})
    yield emit({"type": "reasoning", "status": "complete", "content": f"Week constraints captured for {resolved_week_config.get('week_start', 'this week')}"})

    if not settings.integrity_configured:
        if settings.integrity_check_mode == "required":
            yield emit({"type": "error", "content": "Integrity check is required but not configured."})
            yield emit({"type": "done"})
            return
        yield emit({"type": "reasoning", "status": "warning", "content": "Anthropic integrity review skipped; integration is not configured."})
    else:
        client = _create_client()
        system_prompt, user_prompt = build_integrity_prompt(context, resolved_week_constraints)
        final_result: IntegrityResult | None = None
        last_error: Exception | None = None
        for attempt in range(1, 3):
            yield emit({"type": "phase", "content": f"Integrity attempt {attempt}/2 with {settings.anthropic_integrity_model}"})
            try:
                with client.messages.stream(
                    model=settings.anthropic_integrity_model,
                    max_tokens=settings.integrity_max_tokens,
                    temperature=settings.integrity_temperature,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}],
                    timeout=settings.integrity_timeout_seconds,
                ) as stream:
                    buffer = ""
                    for event in stream:
                        if getattr(event, "type", None) == "thinking":
                            yield emit({"type": "reasoning", "content": event.thinking})
                        elif getattr(event, "type", None) == "text":
                            buffer += event.text
                            mapped_events, buffer = _consume_buffer(buffer)
                            for mapped_event in mapped_events:
                                yield emit(mapped_event)
                    final_text = stream.get_final_text()
                    if buffer.strip():
                        yield emit(_line_to_event(buffer.strip()))
                    final_result = _parse_final_result(final_text, preflight_errors, preflight_warnings, settings.anthropic_integrity_model)
                    break
            except (APIConnectionError, APIStatusError, APIError) as exc:
                last_error = exc
                yield emit({"type": "reasoning", "status": "warning", "content": f"Integrity attempt {attempt} failed: {exc}"})
                if attempt == 2 and settings.integrity_check_mode == "required":
                    yield emit({"type": "error", "content": "Integrity check failed after 2 attempts.", "error": str(exc)})
                    yield emit({"type": "done"})
                    return
        if final_result is not None:
            for change in final_result.changes_made:
                yield emit({"type": "code_change", "content": change})
            yield emit(
                {
                    "type": "status",
                    "integrity_status": final_result.status,
                    "status": final_result.status,
                    "changes": final_result.changes_made,
                    "content": final_result.summary,
                }
            )
        elif last_error and settings.integrity_check_mode != "required":
            yield emit({"type": "reasoning", "status": "warning", "content": f"Continuing in best-effort mode after integrity API failure: {last_error}"})

    if preflight_errors:
        for error in preflight_errors:
            yield emit({"type": "reasoning", "status": "failed", "content": error})
        yield emit({"type": "error", "content": "Preflight failed", "errors": preflight_errors, "warnings": preflight_warnings})
        yield emit({"type": "done"})
        return

    for warning in preflight_warnings:
        yield emit({"type": "reasoning", "status": "warning", "content": warning})
    yield emit({"type": "phase", "content": "Integrity check complete. Scheduler ready."})
    yield emit({"type": "done"})
