"""Transactional email delivery for generated schedules."""
from __future__ import annotations

import base64
from dataclasses import dataclass

import httpx

from ..core.settings import get_settings
from .config_store import load_restaurant_config
from .schedule_store import load_schedule_artifact, load_schedule_run, mark_schedule_emailed


class EmailDeliveryError(Exception):
    def __init__(self, message: str, *, status_code: int = 500, details: dict | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {"message": message}


@dataclass
class EmailDeliveryResult:
    schedule_id: str
    recipient_email: str
    provider: str
    provider_message_id: str | None


def _build_email_summary(payload: dict) -> str:
    warnings = payload["report"].get("warnings", [])
    warning_lines = "\n".join(f"- {warning}" for warning in warnings[:3]) or "- None"
    return (
        f"Hi Chef,\n\n"
        f"Your schedule for the week of {payload['context']['week_start']} is attached.\n\n"
        f"Status: {payload['report']['status']}\n"
        f"Warnings: {len(warnings)}\n\n"
        f"Key notes:\n{warning_lines}\n\n"
        "Best,\nKitchen Scheduler"
    )


def send_schedule_email(schedule_id: str, recipient_email: str) -> EmailDeliveryResult:
    settings = get_settings()
    if not settings.resend_api_key:
        raise EmailDeliveryError(
            "RESEND_API_KEY is not configured",
            status_code=503,
            details={"message": "Email delivery is not configured", "missing": ["RESEND_API_KEY"]},
        )

    payload = load_schedule_run(schedule_id)
    if payload is None:
        raise EmailDeliveryError("Schedule not found", status_code=404, details={"message": "Schedule not found"})

    artifact = load_schedule_artifact(schedule_id, "schedule_workbook_path")
    if artifact is None:
        raise EmailDeliveryError(
            "Excel artifact is not available for this schedule",
            status_code=409,
            details={"message": "Excel artifact is not available for this schedule"},
        )

    workbook_path, _ = artifact
    restaurant_config = load_restaurant_config()
    from_email = settings.email_from or restaurant_config.get("email_config", {}).get("from_email") or "Acquerello Scheduler <onboarding@resend.dev>"
    summary_text = _build_email_summary(payload)
    html = "<br/>".join(summary_text.splitlines())

    encoded_attachment = base64.b64encode(workbook_path.read_bytes()).decode("utf-8")
    request_payload = {
        "from": from_email,
        "to": [recipient_email],
        "subject": f"Acquerello Schedule - Week of {payload['context']['week_start']}",
        "text": summary_text,
        "html": f"<p>{html}</p>",
        "attachments": [
            {
                "filename": "schedule_output.xlsx",
                "content": encoded_attachment,
            }
        ],
        "tags": [
            {"name": "schedule_id", "value": schedule_id},
            {"name": "restaurant", "value": payload["context"]["restaurant_name"].replace(" ", "_")},
        ],
    }

    with httpx.Client(timeout=30) as client:
        response = client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json=request_payload,
        )

    if response.status_code >= 400:
        raise EmailDeliveryError(
            "Resend rejected the email request",
            status_code=502,
            details={"message": "Email delivery failed", "provider_response": response.text},
        )

    provider_payload = response.json()
    provider_message_id = provider_payload.get("id")
    mark_schedule_emailed(schedule_id, recipient_email=recipient_email, provider_message_id=provider_message_id)
    return EmailDeliveryResult(
        schedule_id=schedule_id,
        recipient_email=recipient_email,
        provider="resend",
        provider_message_id=provider_message_id,
    )
