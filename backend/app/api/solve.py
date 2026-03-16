"""POST /api/solve — SSE schedule generation via Claude Opus."""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

import anthropic
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/solve", tags=["solve"])

_DATA_DIR = Path(__file__).parent.parent.parent.parent  # repo root


def _load_file(name: str) -> str:
    for candidate in [
        _DATA_DIR / name,
        _DATA_DIR / "data" / name,
        Path(__file__).parent.parent / "data" / name,
    ]:
        if candidate.exists():
            return candidate.read_text(encoding="utf-8")
    return f"[{name} not found]"


def _build_solve_system(selected_week: str, confirmed_requirements: str) -> str:
    kitchen = _load_file("kitchen_state.md")
    constraints = _load_file("week_constraints.md")
    return (
        f"You are a scheduling optimization engine for Acquerello restaurant.\n\n"
        f"Week: {selected_week}\n\n"
        f"RESTAURANT CONTEXT:\n{kitchen}\n\n"
        f"BASE CONSTRAINTS:\n{constraints}\n\n"
        f"ADDITIONAL REQUIREMENTS THIS WEEK:\n{confirmed_requirements}\n\n"
        "Think step by step through every constraint and conflict. Show your reasoning "
        "explicitly. Then output a complete weekly schedule as a JSON block wrapped in "
        "<schedule></schedule> tags. The schedule JSON must include every staff member, "
        "every shift, and every day Mon-Sun."
    )


class SolveRequest(BaseModel):
    conversation_id: str | None = None
    selected_week: str = ""
    confirmed_requirements: str = ""


@router.post("")
async def solve(request: SolveRequest):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    client = anthropic.Anthropic(api_key=api_key)

    system_prompt = _build_solve_system(request.selected_week, request.confirmed_requirements)
    full_text: list[str] = []

    async def generate():
        try:
            with client.messages.stream(
                model="claude-opus-4-6",
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": "Generate the complete schedule."}],
            ) as stream:
                for text in stream.text_stream:
                    full_text.append(text)
                    event = json.dumps({"type": "reasoning", "text": text})
                    yield f"data: {event}\n\n"

            # Extract <schedule>…</schedule> JSON block if present
            combined = "".join(full_text)
            match = re.search(r"<schedule>(.*?)</schedule>", combined, re.DOTALL)
            if match:
                try:
                    schedule_data = json.loads(match.group(1).strip())
                    event = json.dumps({"type": "schedule", "data": schedule_data})
                    yield f"data: {event}\n\n"
                except json.JSONDecodeError:
                    yield f"data: {json.dumps({'type': 'error', 'text': 'Failed to parse schedule JSON from model response'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'text': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
