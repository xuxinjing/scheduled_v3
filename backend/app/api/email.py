"""Email delivery endpoints."""
from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from ..services.email_service import EmailDeliveryError, send_schedule_email

router = APIRouter(prefix="/email", tags=["email"])

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class EmailRequest(BaseModel):
    schedule_id: str
    recipient_email: str

    @field_validator("recipient_email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if not EMAIL_PATTERN.match(value):
            raise ValueError("recipient_email must be a valid email address")
        return value


@router.post("")
def send_email(payload: EmailRequest):
    try:
        result = send_schedule_email(payload.schedule_id, str(payload.recipient_email))
        return {
            "sent": True,
            "schedule_id": result.schedule_id,
            "recipient_email": result.recipient_email,
            "provider": result.provider,
            "provider_message_id": result.provider_message_id,
        }
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.details) from exc
