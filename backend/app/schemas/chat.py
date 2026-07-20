"""
Pydantic schemas for the research chat endpoints.
Mirrors the `chat_sessions` / `chat_messages` tables in the Supabase schema.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: Optional[UUID] = Field(
        default=None, description="Omit to start a new chat session."
    )


class ToolEvidenceOut(BaseModel):
    tool_name: str
    tool_input: dict
    result: dict


class ChatResponse(BaseModel):
    session_id: UUID
    reply: str
    case_count: Optional[int] = None
    low_confidence: bool = False
    confidence_score: Optional[float] = None
    evidence: list[ToolEvidenceOut] = []
    retrieved_case_ids: list[str] = []


class ChatMessageOut(BaseModel):
    id: UUID
    role: str
    content: str
    retrieved_case_ids: list[str] = []
    confidence_score: Optional[float] = None
    created_at: datetime


class ChatSessionOut(BaseModel):
    id: UUID
    title: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ChatSessionWithMessages(ChatSessionOut):
    messages: list[ChatMessageOut] = []
