"""Service layer for schedule generation and integrity streaming."""
from __future__ import annotations

from typing import Callable

from ..engine.context import build_context
from ..engine.excel_output import generate_schedule_workbook_bytes
from ..engine.pivot_output import build_pivot_preview, generate_pivot_workbook_bytes
from ..engine.preflight import run_preflight
from ..engine.report_output import generate_report
from ..engine.scheduler import run_scheduler
from ..engine.validator import validate
from .config_store import load_restaurant_config, load_week_config
from .integrity_service import IntegrityCheckError, verify_integrity


class PreflightError(Exception):
    def __init__(self, errors: list[str], warnings: list[str]) -> None:
        super().__init__("Preflight failed")
        self.errors = errors
        self.warnings = warnings


def run_schedule(
    week_config: dict | None = None,
    restaurant_config: dict | None = None,
    week_constraints_md: str | None = None,
    progress_callback: Callable[[str, str], None] | None = None,
    include_binary_artifacts: bool = False,
    run_integrity_check: bool = True,
) -> dict:
    resolved_week_config = week_config or load_week_config()
    resolved_restaurant_config = restaurant_config or load_restaurant_config()
    context = build_context(resolved_week_config, resolved_restaurant_config)

    integrity = None
    if run_integrity_check:
        if progress_callback:
            progress_callback("integrity", "Running integrity review.")
        integrity = verify_integrity(
            week_config=resolved_week_config,
            restaurant_config=resolved_restaurant_config,
            week_constraints_md=week_constraints_md,
        )
        if integrity.status == "fail":
            raise IntegrityCheckError(
                "Integrity check failed",
                status_code=400,
                details={
                    "message": "Integrity check failed",
                    "summary": integrity.summary,
                    "warnings": integrity.warnings,
                    "changes_made": integrity.changes_made,
                    "local_preflight_errors": integrity.local_preflight_errors,
                    "local_preflight_warnings": integrity.local_preflight_warnings,
                },
            )

    if progress_callback:
        progress_callback("preflight", "Running preflight checks.")
    preflight_errors, preflight_warnings = run_preflight(context)
    if preflight_errors:
        raise PreflightError(preflight_errors, preflight_warnings)

    assignments, shift_counts = run_scheduler(context, progress_callback=progress_callback)
    report = validate(context, assignments, shift_counts)
    pivot_preview = build_pivot_preview(context, assignments)
    markdown_report = generate_report(report, context.week_start)

    artifacts = {
        "pivot_workbook_available": False,
        "schedule_workbook_available": False,
    }
    binary_artifacts = {}
    try:
        pivot_bytes = generate_pivot_workbook_bytes(context, assignments)
    except RuntimeError as exc:
        artifacts["pivot_workbook_error"] = str(exc)
    else:
        artifacts["pivot_workbook_available"] = True
        artifacts["pivot_workbook_size_bytes"] = len(pivot_bytes)
        if include_binary_artifacts:
            binary_artifacts["pivot_workbook"] = pivot_bytes

    try:
        schedule_bytes = generate_schedule_workbook_bytes(context, assignments, shift_counts, report)
    except RuntimeError as exc:
        artifacts["schedule_workbook_error"] = str(exc)
    else:
        artifacts["schedule_workbook_available"] = True
        artifacts["schedule_workbook_size_bytes"] = len(schedule_bytes)
        if include_binary_artifacts:
            binary_artifacts["schedule_workbook"] = schedule_bytes

    result = {
        "context": {
            "week_start": context.week_start,
            "open_days": context.open_days,
            "restaurant_name": context.restaurant_config["name"],
        },
        "integrity": None
        if integrity is None
        else {
            "status": integrity.status,
            "summary": integrity.summary,
            "model": integrity.model,
            "warnings": integrity.warnings,
            "changes_made": integrity.changes_made,
            "local_preflight_errors": integrity.local_preflight_errors,
            "local_preflight_warnings": integrity.local_preflight_warnings,
        },
        "inputs": {
            "restaurant_config": resolved_restaurant_config,
            "week_config": resolved_week_config,
            "week_constraints_md": week_constraints_md,
        },
        "preflight": {"errors": preflight_errors, "warnings": preflight_warnings},
        "assignments": [assignment.__dict__ for assignment in assignments],
        "shift_counts": shift_counts,
        "report": report,
        "report_markdown": markdown_report,
        "pivot_preview": pivot_preview,
        "artifacts": artifacts,
    }
    if include_binary_artifacts:
        result["binary_artifacts"] = binary_artifacts
    return result
