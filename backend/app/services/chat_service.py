"""
Chat service: orchestrates a research-chat turn end to end.

  1. load or create the chat_sessions row
  2. load prior chat_messages for that session, converted to OpenAI-style
     message format (role/content dicts), so follow-ups ("what about MS
     instead?") have context
  3. run the agent loop (agents/research_chat_agent.run_chat_turn)
  4. persist both the user turn and the assistant turn to chat_messages,
     stamping retrieved_case_ids + a confidence_score derived from the
     guardrail signals in the tool evidence
  5. return a ChatResponse the router can hand straight back to the client
"""

from uuid import UUID, uuid4

from app.agents.research_chat_agent import run_chat_turn
from app.core.constants import DATASET_CAVEAT
from app.db.supabase_client import get_supabase_admin
from app.schemas.chat import ChatResponse, ToolEvidenceOut

CHAT_SESSIONS_TABLE = "chat_sessions"
CHAT_MESSAGES_TABLE = "chat_messages"
MAX_HISTORY_MESSAGES = 20  # most recent N messages fed back in as context


def _get_or_create_session(user_id: str, session_id: str | None, first_message: str) -> str:
    supabase = get_supabase_admin()

    if session_id:
        existing = (
            supabase.table(CHAT_SESSIONS_TABLE)
            .select("id")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .execute()
        )
        if existing.data:
            return session_id

    title = (first_message[:60] + "...") if len(first_message) > 60 else first_message
    created = (
        supabase.table(CHAT_SESSIONS_TABLE)
        .insert({"id": str(uuid4()), "user_id": user_id, "title": title})
        .execute()
    )
    return created.data[0]["id"]


def _load_history(session_id: str) -> list[dict]:
    supabase = get_supabase_admin()
    resp = (
        supabase.table(CHAT_MESSAGES_TABLE)
        .select("role,content")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .limit(MAX_HISTORY_MESSAGES)
        .execute()
    )
    return [{"role": row["role"], "content": row["content"]} for row in (resp.data or [])]


def _save_message(session_id: str, role: str, content: str, retrieved_case_ids=None, confidence_score=None):
    supabase = get_supabase_admin()
    supabase.table(CHAT_MESSAGES_TABLE).insert({
        "id": str(uuid4()),
        "session_id": session_id,
        "role": role,
        "content": content,
        "retrieved_case_ids": retrieved_case_ids or [],
        "confidence_score": confidence_score,
    }).execute()


def _confidence_score(agent_result) -> float:
    """
    Simple guardrail-derived confidence signal for the confidence_score
    column: starts high, docked for low case counts and for hitting the
    tool-call iteration cap without a clean resolution.
    """
    score = 90.0
    if agent_result.any_low_confidence:
        score -= 35.0
    if agent_result.hit_iteration_cap:
        score -= 20.0
    if not agent_result.evidence:
        score -= 10.0  # answered without calling any tool at all
    return max(0.0, min(100.0, score))


def handle_chat_turn(user: dict, message: str, session_id: str | None) -> ChatResponse:
    user_id = user["id"]
    resolved_session_id = _get_or_create_session(user_id, session_id, message)
    history = _load_history(resolved_session_id)

    agent_result = run_chat_turn(history=history, user_message=message)

    reply = agent_result.reply
    if DATASET_CAVEAT.split(" ")[0].lower() not in reply.lower() and "not clinical guidance" not in reply.lower():
        reply = f"{reply}\n\n_{DATASET_CAVEAT}_"

    confidence = _confidence_score(agent_result)
    case_ids = agent_result.matched_case_ids

    _save_message(resolved_session_id, "user", message)
    _save_message(
        resolved_session_id,
        "assistant",
        reply,
        retrieved_case_ids=case_ids,
        confidence_score=confidence,
    )

    return ChatResponse(
        session_id=UUID(resolved_session_id),
        reply=reply,
        case_count=agent_result.total_case_count,
        low_confidence=agent_result.any_low_confidence,
        confidence_score=confidence,
        evidence=[
            ToolEvidenceOut(tool_name=e.tool_name, tool_input=e.tool_input, result=e.result)
            for e in agent_result.evidence
        ],
        retrieved_case_ids=case_ids,
    )
