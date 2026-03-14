"""Integrity-check streaming endpoints."""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..services.integrity_service import integrity_event_stream

router = APIRouter(tags=["integrity"])


class IntegrityRequest(BaseModel):
    restaurant_id: str | None = None
    week_config: dict | None = None
    restaurant_config: dict | None = None
    week_constraints_md: str | None = None


@router.post("/integrity")
@router.post("/integrity-check")
def stream_integrity(payload: IntegrityRequest):
    return StreamingResponse(
        integrity_event_stream(
            week_config=payload.week_config,
            restaurant_config=payload.restaurant_config,
            week_constraints_md=payload.week_constraints_md,
        ),
        media_type="text/event-stream",
    )
