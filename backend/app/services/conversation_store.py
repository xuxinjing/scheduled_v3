"""File-based conversation persistence (db/conversations.json)."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from filelock import FileLock
    _HAS_FILELOCK = True
except ImportError:
    _HAS_FILELOCK = False

_DB_PATH = Path(__file__).parent.parent.parent / "db" / "conversations.json"
# backend/app/services/ → parent×3 = backend/


def _lock_path() -> Path:
    return _DB_PATH.with_suffix(".lock")


def _read_all() -> list[dict]:
    if not _DB_PATH.exists():
        return []
    try:
        return json.loads(_DB_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def _write_all(data: list[dict]) -> None:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    _DB_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _fmt_date(ts: str) -> str:
    """Return 'Today', 'Yesterday', or 'MMM D' from an ISO timestamp."""
    try:
        dt = datetime.fromisoformat(ts).replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        delta = (now.date() - dt.date()).days
        if delta == 0:
            return "Today"
        if delta == 1:
            return "Yesterday"
        return f"{dt.strftime('%b')} {dt.day}"
    except Exception:
        return ""


def list_conversations() -> list[dict]:
    rows = _read_all()
    return [
        {
            "id": r["id"],
            "title": r.get("title", "Untitled"),
            "preview": r.get("preview", ""),
            "date": _fmt_date(r.get("created_at", "")),
            "created_at": r.get("created_at", ""),
            "selected_week": r.get("selected_week", ""),
        }
        for r in rows
    ]


def get_conversation(conversation_id: str) -> dict | None:
    for r in _read_all():
        if r.get("id") == conversation_id:
            return r
    return None


def delete_conversation(conversation_id: str) -> bool:
    """Delete a conversation by ID. Returns True if found and deleted."""

    def _do_delete() -> bool:
        existing = _read_all()
        updated = [r for r in existing if r.get("id") != conversation_id]
        if len(updated) == len(existing):
            return False
        _write_all(updated)
        return True

    if _HAS_FILELOCK:
        with FileLock(str(_lock_path())):
            return _do_delete()
    return _do_delete()


def save_conversation(
    *,
    conversation_id: str | None,
    messages: list[dict[str, Any]],
    selected_week: str,
) -> str:
    cid = conversation_id or str(uuid.uuid4())
    # Derive title from first user message (≤40 chars)
    first_user = next((m["content"] for m in messages if m.get("role") == "user"), "")
    title = (first_user[:40] + "…") if len(first_user) > 40 else first_user or "Conversation"
    # Preview from first assistant reply
    first_asst = next((m["content"] for m in messages if m.get("role") == "assistant"), "")
    preview = (first_asst[:80] + "…") if len(first_asst) > 80 else first_asst

    now = datetime.now(timezone.utc).isoformat()

    record = {
        "id": cid,
        "title": title,
        "preview": preview,
        "created_at": now,
        "updated_at": now,
        "selected_week": selected_week,
        "messages": messages,
    }

    def _do_write():
        existing = _read_all()
        # Replace if exists, otherwise prepend
        idx = next((i for i, r in enumerate(existing) if r.get("id") == cid), None)
        if idx is not None:
            record["created_at"] = existing[idx].get("created_at", now)
            existing[idx] = record
        else:
            existing.insert(0, record)
        _write_all(existing)

    if _HAS_FILELOCK:
        with FileLock(str(_lock_path())):
            _do_write()
    else:
        _do_write()

    return cid
