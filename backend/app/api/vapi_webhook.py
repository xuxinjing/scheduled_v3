"""POST /api/vapi/webhook — Vapi function-call tool handler."""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/vapi", tags=["vapi"])

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


_saved_requirements: dict[str, str] = {}  # in-memory; replace with DB for production


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


@router.post("/webhook")
async def vapi_webhook(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON"})

    # Vapi sends function call events under message.functionCall or tool_calls
    message = body.get("message", {})
    fn_call = message.get("functionCall") or message.get("function_call")

    if fn_call:
        name = fn_call.get("name", "")
        try:
            parameters = json.loads(fn_call.get("parameters", "{}")) if isinstance(fn_call.get("parameters"), str) else fn_call.get("parameters", {})
        except (json.JSONDecodeError, TypeError):
            parameters = {}

        handler = _TOOL_HANDLERS.get(name)
        if handler:
            result = handler(parameters)
            return JSONResponse({"result": result})
        return JSONResponse({"result": f"Unknown tool: {name}"})

    # Acknowledge other event types (call-start, transcript, etc.)
    return JSONResponse({"result": "ok"})
