"""POST /api/vapi/webhook — Vapi server-URL handler.

Handles all Vapi webhook event types:
  - assistant-request  -> return dynamic assistant config
  - function-call      -> execute tool and return result
  - end-of-call-report -> persist transcript
  - *                  -> acknowledge
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..services.conversation_store import save_conversation

router = APIRouter(prefix="/vapi", tags=["vapi"])
logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).parent.parent.parent.parent  # repo root


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_file(name: str) -> str:
    for candidate in [
        _DATA_DIR / name,
        _DATA_DIR / "data" / name,
        Path(__file__).parent.parent / "data" / name,
    ]:
        if candidate.exists():
            return candidate.read_text(encoding="utf-8")
    return f"[{name} not found]"


def _build_system_prompt() -> str:
    kitchen = _load_file("kitchen_state.md")
    constraints = _load_file("week_constraints.md")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return (
        f"You are scheduled.ai, an AI scheduling assistant for Acquerello restaurant.\n\n"
        f"Today's date: {today}\n\n"
        f"RESTAURANT CONTEXT:\n{kitchen}\n\n"
        f"BASE CONSTRAINTS:\n{constraints}\n\n"
        "Your job: Have a natural conversation with the chef to understand what's different "
        "this week. Ask clarifying questions one at a time. When you have enough information, "
        "summarize the scheduling changes needed and ask for confirmation. Be concise, warm, "
        "and professional. Never output raw JSON to the user."
    )


# ---------------------------------------------------------------------------
# Webhook authentication
# ---------------------------------------------------------------------------

def _verify_secret(request: Request) -> bool:
    """Return True if the request carries a valid Vapi server secret, or if
    no secret is configured (development mode)."""
    expected = os.getenv("VAPI_SERVER_SECRET")
    if not expected:
        return True  # no secret configured — allow all (dev only)
    incoming = request.headers.get("x-vapi-secret", "")
    return incoming == expected


# ---------------------------------------------------------------------------
# Tool / function-call handlers
# ---------------------------------------------------------------------------

_saved_requirements: dict[str, str] = {}


def _get_kitchen_context(_args: dict) -> str:
    return _load_file("kitchen_state.md")


def _get_week_constraints(_args: dict) -> str:
    return _load_file("week_constraints.md")


def _save_requirements(args: dict) -> str:
    week = args.get("week", "")
    requirements = args.get("requirements", "")
    _saved_requirements[week] = requirements
    return f"Requirements saved for week {week}."


def _trigger_solve(args: dict) -> str:
    conv_id = args.get("conversation_id", "")
    return f"Schedule solve triggered for conversation {conv_id}. POST /api/solve to generate."


_TOOL_HANDLERS = {
    "get_kitchen_context": _get_kitchen_context,
    "get_week_constraints": _get_week_constraints,
    "save_requirements": _save_requirements,
    "trigger_solve": _trigger_solve,
}

# Tool definitions sent to Vapi in the assistant-request response so the LLM
# knows which functions it can call.
_TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_kitchen_context",
            "description": "Retrieve the current kitchen state (staff, stations, roles).",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_week_constraints",
            "description": "Retrieve the base weekly constraints and rules.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_requirements",
            "description": "Save the chef's scheduling requirements for a given week.",
            "parameters": {
                "type": "object",
                "properties": {
                    "week": {"type": "string", "description": "ISO week start date, e.g. 2026-03-16"},
                    "requirements": {"type": "string", "description": "Free-text requirements from the chef"},
                },
                "required": ["week", "requirements"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "trigger_solve",
            "description": "Trigger the schedule solver after requirements are confirmed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "conversation_id": {"type": "string", "description": "Current conversation ID"},
                },
                "required": ["conversation_id"],
            },
        },
    },
]


# ---------------------------------------------------------------------------
# Event handlers
# ---------------------------------------------------------------------------

def _handle_assistant_request(body: dict) -> dict:
    """Return a full assistant configuration so Vapi knows how to run the call.

    This makes the backend the source of truth for the system prompt, model,
    voice, and available tools — no need to duplicate config in the Vapi
    dashboard.
    """
    return {
        "assistant": {
            "model": {
                "provider": "anthropic",
                "model": "claude-sonnet-4-6",
                "systemPrompt": _build_system_prompt(),
                "tools": _TOOL_DEFINITIONS,
            },
            "voice": {
                "provider": "11labs",
                "voiceId": "21m00Tcm4TlvDq8ikWAM",  # "Rachel" — swap for any ElevenLabs voice ID
            },
            "firstMessage": "Hi, this is scheduled.ai. How can I help with this week's schedule?",
            "serverUrl": os.getenv("VAPI_SERVER_URL", ""),
        },
    }


def _handle_function_call(message: dict) -> dict:
    """Execute a tool requested by the LLM and return the result."""
    fn_call = message.get("functionCall", {})
    name = fn_call.get("name", "")
    raw_params = fn_call.get("parameters", {})

    try:
        parameters = json.loads(raw_params) if isinstance(raw_params, str) else raw_params
    except (json.JSONDecodeError, TypeError):
        parameters = {}

    handler = _TOOL_HANDLERS.get(name)
    if handler:
        result = handler(parameters)
        return {"result": result}
    logger.warning("Unknown tool requested: %s", name)
    return {"result": f"Unknown tool: {name}"}


def _handle_end_of_call_report(body: dict) -> dict:
    """Persist the call transcript into the conversation store."""
    message = body.get("message", {})
    artifact = message.get("artifact", {})
    transcript = artifact.get("transcript", "")
    call_meta = message.get("call", {}).get("metadata", {})
    conversation_id = call_meta.get("conversation_id")
    selected_week = call_meta.get("selected_week", "")

    if transcript:
        messages = [{"role": "user", "content": f"[Voice transcript]\n{transcript}"}]
        save_conversation(
            conversation_id=conversation_id,
            messages=messages,
            selected_week=selected_week,
        )

    return {"result": "transcript saved"}


# ---------------------------------------------------------------------------
# Main webhook endpoint
# ---------------------------------------------------------------------------

@router.post("/webhook")
async def vapi_webhook(request: Request):
    # --- Auth ---
    if not _verify_secret(request):
        return JSONResponse(status_code=401, content={"error": "invalid secret"})

    # --- Parse body ---
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON"})

    # --- Dispatch on message.type ---
    message = body.get("message", {})
    event_type = message.get("type", "")
    logger.info("Vapi webhook event: %s", event_type)

    if event_type == "assistant-request":
        return JSONResponse(_handle_assistant_request(body))

    if event_type == "function-call":
        return JSONResponse(_handle_function_call(message))

    if event_type == "end-of-call-report":
        return JSONResponse(_handle_end_of_call_report(body))

    # status-update, transcript, hang, speech-update, etc.
    return JSONResponse({"result": "ok"})
