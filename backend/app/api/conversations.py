"""GET /api/conversations — conversation history sidebar."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..services.conversation_store import delete_conversation, get_conversation, list_conversations

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("")
def list_convs():
    return list_conversations()


@router.get("/{conversation_id}")
def get_conv(conversation_id: str):
    conv = get_conversation(conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.delete("/{conversation_id}")
def delete_conv(conversation_id: str):
    deleted = delete_conversation(conversation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"deleted": conversation_id}
