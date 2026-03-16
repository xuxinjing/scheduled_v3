"""POST /api/chat — SSE streaming chat powered by Claude."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

import anthropic
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..services.conversation_store import save_conversation

router = APIRouter(prefix="/chat", tags=["chat"])

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


def _build_system(selected_week: str) -> str:
    kitchen = _load_file("kitchen_state.md")
    constraints = _load_file("week_constraints.md")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return (
        f"You are scheduled.ai, an AI scheduling assistant for Acquerello restaurant.\n\n"
        f"Today's date: {today}\n"
        f"Selected week starting: {selected_week}\n\n"
        f"RESTAURANT CONTEXT:\n{kitchen}\n\n"
        f"BASE CONSTRAINTS:\n{constraints}\n\n"
        "Your job: Have a natural conversation with the chef to understand what's different "
        "this week. Ask clarifying questions one at a time. When you have enough information, "
        "summarize the scheduling changes needed and ask for confirmation. Be concise, warm, "
        "and professional. Never output raw JSON to the user."
    )


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    selected_week: str = ""
    history: list[Message] = []


@router.post("")
async def chat(request: ChatRequest):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    client = anthropic.Anthropic(api_key=api_key)

    # Build message list: history + new user message
    msgs = [{"role": m.role, "content": m.content} for m in request.history]
    msgs.append({"role": "user", "content": request.message})

    system_prompt = _build_system(request.selected_week)
    collected_response: list[str] = []

    async def generate():
        try:
            with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=system_prompt,
                messages=msgs,
            ) as stream:
                for text in stream.text_stream:
                    collected_response.append(text)
                    # Escape newlines in SSE data field
                    safe = text.replace("\n", "\\n")
                    yield f"data: {safe}\n\n"

            # Persist conversation after stream completes
            full_reply = "".join(collected_response)
            all_messages = msgs + [{"role": "assistant", "content": full_reply}]
            save_conversation(
                conversation_id=request.conversation_id,
                messages=all_messages,
                selected_week=request.selected_week,
            )
        except Exception as e:
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"
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
