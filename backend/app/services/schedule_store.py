"""Persistence for generated schedules with file storage and optional DB sync."""
from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4, uuid5, NAMESPACE_URL

from .config_store import DATA_DIR
from .storage import store_artifact

SCHEDULES_DIR = DATA_DIR / "schedules"


def _ensure_dir() -> None:
    SCHEDULES_DIR.mkdir(parents=True, exist_ok=True)


def save_schedule_run(result: dict, *, conversation_messages: list[dict] | None = None, week_constraints_md: str | None = None) -> dict:
    _ensure_dir()
    schedule_id = str(uuid4())
    created_at = datetime.now(UTC).isoformat()
    schedule_dir = SCHEDULES_DIR / schedule_id
    schedule_dir.mkdir(parents=True, exist_ok=True)

    binary_artifacts = result.pop("binary_artifacts", {})
    payload = {
        "id": schedule_id,
        "created_at": created_at,
        "schedule_id": schedule_id,
        "conversation_messages": conversation_messages or [],
        "week_constraints_md": week_constraints_md,
        **result,
    }
    (schedule_dir / "result.json").write_text(json.dumps(payload, indent=2) + "\n")
    report_path = schedule_dir / "validator_report.md"
    report_path.write_text(result["report_markdown"])

    artifact_manifest = {"artifact_urls": {}}
    report_artifact = store_artifact(report_path, schedule_id=schedule_id, artifact_name="validator_report.md")
    artifact_manifest["validator_report_path"] = report_artifact.local_path
    artifact_manifest["artifact_urls"]["validator_report"] = report_artifact.storage_url
    if "pivot_workbook" in binary_artifacts:
        pivot_path = schedule_dir / "pivot_schedule.xlsx"
        pivot_path.write_bytes(binary_artifacts["pivot_workbook"])
        pivot_artifact = store_artifact(pivot_path, schedule_id=schedule_id, artifact_name="pivot_schedule.xlsx")
        artifact_manifest["pivot_workbook_path"] = pivot_artifact.local_path
        artifact_manifest["artifact_urls"]["pivot_workbook"] = pivot_artifact.storage_url
    if "schedule_workbook" in binary_artifacts:
        schedule_path = schedule_dir / "schedule_output.xlsx"
        schedule_path.write_bytes(binary_artifacts["schedule_workbook"])
        schedule_artifact = store_artifact(schedule_path, schedule_id=schedule_id, artifact_name="schedule_output.xlsx")
        artifact_manifest["schedule_workbook_path"] = schedule_artifact.local_path
        artifact_manifest["artifact_urls"]["schedule_workbook"] = schedule_artifact.storage_url
        payload["excel_url"] = schedule_artifact.storage_url

    if artifact_manifest:
        payload["artifacts"].update(artifact_manifest)
        (schedule_dir / "result.json").write_text(json.dumps(payload, indent=2) + "\n")

    _sync_schedule_to_database(payload)
    return payload


def load_schedule_run(schedule_id: str) -> dict | None:
    path = SCHEDULES_DIR / schedule_id / "result.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


def load_schedule_artifact(schedule_id: str, artifact_key: str) -> tuple[Path, dict] | None:
    payload = load_schedule_run(schedule_id)
    if payload is None:
        return None
    artifact_path = payload.get("artifacts", {}).get(artifact_key)
    if not artifact_path:
        return None
    path = Path(str(artifact_path))
    if not path.exists():
        return None
    return path, payload


def list_schedule_runs(limit: int = 20) -> list[dict]:
    if not SCHEDULES_DIR.exists():
        return []
    runs = []
    for result_path in sorted(SCHEDULES_DIR.glob("*/result.json"), reverse=True):
        payload = json.loads(result_path.read_text())
        runs.append(
            {
                "id": payload["id"],
                "created_at": payload["created_at"],
                "week_start": payload["context"]["week_start"],
                "restaurant_name": payload["context"]["restaurant_name"],
                "status": payload["report"]["status"],
                "email_sent_at": payload.get("email_sent_at"),
                "has_excel": bool(payload.get("artifacts", {}).get("schedule_workbook_path")),
                "excel_url": payload.get("excel_url"),
            }
        )
        if len(runs) >= limit:
            break
    return runs


def mark_schedule_emailed(schedule_id: str, *, recipient_email: str, provider_message_id: str | None = None) -> dict | None:
    payload = load_schedule_run(schedule_id)
    if payload is None:
        return None

    payload["email_sent_at"] = datetime.now(UTC).isoformat()
    payload["email_recipient"] = recipient_email
    if provider_message_id:
        payload["email_provider_message_id"] = provider_message_id

    schedule_dir = SCHEDULES_DIR / schedule_id
    (schedule_dir / "result.json").write_text(json.dumps(payload, indent=2) + "\n")
    _sync_schedule_to_database(payload)
    return payload


def _sync_schedule_to_database(payload: dict) -> None:
    try:
        from ..db.database import SessionLocal, create_tables
        from ..db.models import Conversation, Schedule
    except ModuleNotFoundError:
        return

    create_tables()
    session = SessionLocal()
    try:
        restaurant_slug = payload["inputs"]["restaurant_config"].get("slug", "default")
        restaurant_id = str(uuid5(NAMESPACE_URL, f"restaurant:{restaurant_slug}"))
        record = Schedule(
            id=payload["id"],
            restaurant_id=restaurant_id,
            week_start=payload["context"]["week_start"],
            week_config=payload["inputs"]["week_config"],
            assignments=payload.get("assignments", []),
            shift_counts=payload.get("shift_counts", {}),
            validation_report=payload.get("report", {}),
            excel_url=payload.get("excel_url"),
            status="sent" if payload.get("email_sent_at") else "generated",
            payload_json=payload,
            report_markdown=payload.get("report_markdown"),
        )
        session.merge(record)
        if payload.get("conversation_messages"):
            session.merge(
                Conversation(
                    id=str(uuid5(NAMESPACE_URL, f"conversation:{payload['id']}")),
                    restaurant_id=restaurant_id,
                    schedule_id=payload["id"],
                    messages=payload["conversation_messages"],
                )
            )
        session.commit()
    finally:
        session.close()
