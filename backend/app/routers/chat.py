"""
Research chat endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.db.supabase_client import get_supabase_admin
from app.deps.auth import get_current_user
from app.schemas.chat import ChatRequest, ChatResponse, ChatSessionOut, ChatSessionWithMessages
from app.services.chat_service import handle_chat_turn

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def post_chat_message(payload: ChatRequest, user: dict = Depends(get_current_user)):
    """Send a message to the research assistant and get a tool-grounded reply."""
    try:
        return handle_chat_turn(
            user=user,
            message=payload.message,
            session_id=str(payload.session_id) if payload.session_id else None,
        )
    except RuntimeError as exc:
        # e.g. GROQ_API_KEY missing -- a config error, not a user error
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/sessions", response_model=list[ChatSessionOut])
def list_sessions(user: dict = Depends(get_current_user)):
    supabase = get_supabase_admin()
    resp = (
        supabase.table("chat_sessions")
        .select("id,title,created_at,updated_at")
        .eq("user_id", user["id"])
        .order("updated_at", desc=True)
        .execute()
    )
    return resp.data or []


@router.get("/sessions/{session_id}", response_model=ChatSessionWithMessages)
def get_session(session_id: str, user: dict = Depends(get_current_user)):
    supabase = get_supabase_admin()
    session_resp = (
        supabase.table("chat_sessions")
        .select("id,title,created_at,updated_at")
        .eq("id", session_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not session_resp.data:
        raise HTTPException(status_code=404, detail="Chat session not found.")

    messages_resp = (
        supabase.table("chat_messages")
        .select("id,role,content,retrieved_case_ids,confidence_score,created_at")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .execute()
    )
    session = session_resp.data[0]
    session["messages"] = messages_resp.data or []
    return session
