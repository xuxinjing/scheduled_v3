"""Scheduling endpoints."""
from __future__ import annotations

import json
import mimetypes
from pathlib import Path
from queue import Empty, Queue
from threading import Thread

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from ..core.settings import get_settings
from ..services.integrity_service import IntegrityCheckError, integrity_event_stream
from ..services.schedule_runner import PreflightError, run_schedule
from ..services.schedule_store import list_schedule_runs, load_schedule_artifact, load_schedule_run, save_schedule_run

router = APIRouter(prefix="/schedule", tags=["schedule"])


class ScheduleRequest(BaseModel):
    restaurant_id: str | None = None
    week_config: dict | None = None
    restaurant_config: dict | None = None
    week_constraints_md: str | None = None
    conversation_messages: list[dict] | None = None
    run_integrity_check: bool = True


@router.post("")
def create_schedule(payload: ScheduleRequest):
    settings = get_settings()
    if settings.is_production and not payload.run_integrity_check:
        raise HTTPException(status_code=400, detail={"message": "Integrity check is mandatory in production"})
    try:
        result = run_schedule(
            week_config=payload.week_config,
            restaurant_config=payload.restaurant_config,
            week_constraints_md=payload.week_constraints_md,
            include_binary_artifacts=True,
            run_integrity_check=payload.run_integrity_check,
        )
        persisted = save_schedule_run(
            result,
            conversation_messages=payload.conversation_messages,
            week_constraints_md=payload.week_constraints_md,
        )
        return {
            "schedule_id": persisted["id"],
            "created_at": persisted["created_at"],
            "context": persisted["context"],
            "integrity": persisted["integrity"],
            "preflight": persisted["preflight"],
            "assignments": persisted["assignments"],
            "shift_counts": persisted["shift_counts"],
            "report": persisted["report"],
            "report_markdown": persisted["report_markdown"],
            "pivot_preview": persisted["pivot_preview"],
            "excel_url": persisted.get("excel_url"),
            "artifacts": persisted["artifacts"],
            "email_sent_at": persisted.get("email_sent_at"),
            "email_recipient": persisted.get("email_recipient"),
        }
    except PreflightError as exc:
        raise HTTPException(
            status_code=400,
            detail={"message": "Preflight failed", "errors": exc.errors, "warnings": exc.warnings},
        ) from exc
    except IntegrityCheckError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.details) from exc


@router.post("/stream")
def create_schedule_stream(payload: ScheduleRequest):
    settings = get_settings()
    if settings.is_production and not payload.run_integrity_check:
        raise HTTPException(status_code=400, detail={"message": "Integrity check is mandatory in production"})
    def emit(event: dict) -> str:
        return f"data: {json.dumps(event)}\n\n"

    def stream():
        if payload.run_integrity_check:
            for chunk in integrity_event_stream(
                week_config=payload.week_config,
                restaurant_config=payload.restaurant_config,
                week_constraints_md=payload.week_constraints_md,
            ):
                yield chunk
                if '"type": "error"' in chunk:
                    return
        queue: Queue[dict] = Queue()
        outcome: dict = {}

        def progress_callback(phase: str, message: str) -> None:
            mapped_type = "phase" if phase in {"integrity", "preflight"} else "reasoning"
            queue.put({"type": mapped_type, "content": message})

        def worker() -> None:
            try:
                result = run_schedule(
                    week_config=payload.week_config,
                    restaurant_config=payload.restaurant_config,
                    week_constraints_md=payload.week_constraints_md,
                    include_binary_artifacts=True,
                    run_integrity_check=False,
                    progress_callback=progress_callback,
                )
                outcome["result"] = save_schedule_run(
                    result,
                    conversation_messages=payload.conversation_messages,
                    week_constraints_md=payload.week_constraints_md,
                )
            except Exception as exc:  # pragma: no cover - streamed to caller
                outcome["error"] = exc
            finally:
                outcome["done"] = True

        thread = Thread(target=worker, daemon=True)
        thread.start()
        while not outcome.get("done") or not queue.empty():
            try:
                yield emit(queue.get(timeout=0.1))
            except Empty:
                continue

        try:
            error = outcome.get("error")
            if isinstance(error, PreflightError):
                yield emit({"type": "error", "content": "Preflight failed", "errors": error.errors, "warnings": error.warnings})
                yield emit({"type": "done"})
                return
            if isinstance(error, IntegrityCheckError):
                yield emit({"type": "error", "content": error.details.get("message", "Integrity check failed"), "details": error.details})
                yield emit({"type": "done"})
                return
            if error is not None:
                raise error

            persisted = outcome["result"]
            yield emit({"type": "phase", "content": "Validating schedule..."})
            yield emit({"type": "status", "integrity_status": persisted["report"]["status"], "changes": []})
            yield emit({"type": "complete", "content": persisted})
            yield emit({"type": "done"})
        except Exception as exc:
            yield emit({"type": "error", "content": str(exc)})
            yield emit({"type": "done"})

    return StreamingResponse(stream(), media_type="text/event-stream")


@router.get("")
def get_schedules():
    return {"items": list_schedule_runs()}


@router.get("/{schedule_id}")
def get_schedule(schedule_id: str):
    payload = load_schedule_run(schedule_id)
    if payload is None:
        raise HTTPException(status_code=404, detail={"message": "Schedule not found"})
    return payload


@router.get("/{schedule_id}/artifacts/{artifact_name}")
def get_schedule_artifact(schedule_id: str, artifact_name: str):
    allowed = {
        "schedule_output.xlsx": "schedule_workbook_path",
        "pivot_schedule.xlsx": "pivot_workbook_path",
        "validator_report.md": "validator_report_path",
    }
    artifact_key = allowed.get(artifact_name)
    if artifact_key is None:
        raise HTTPException(status_code=404, detail={"message": "Artifact not found"})

    artifact = load_schedule_artifact(schedule_id, artifact_key)
    if artifact is None:
        raise HTTPException(status_code=404, detail={"message": "Artifact not found"})

    path, _ = artifact
    media_type, _ = mimetypes.guess_type(Path(path).name)
    return FileResponse(path, media_type=media_type or "application/octet-stream", filename=artifact_name)
