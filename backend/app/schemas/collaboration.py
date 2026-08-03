"""Pydantic schemas for the Collaborations feature (requests + personal chat)."""

from typing import Optional

from pydantic import BaseModel, Field


class PartyBrief(BaseModel):
    id: str
    full_name: str
    avatar_url: Optional[str] = None
    specialty: Optional[str] = None
    country: Optional[str] = None
    hospital_name: Optional[str] = None


class CollaborationCreate(BaseModel):
    requested_to: str
    message: Optional[str] = None
    kind: str = "connect"  # 'connect' | 'collaborate' | 'invite_to_study' -- UI hint only, not persisted as its own column
    related_case_id: Optional[str] = None
    related_signal_id: Optional[str] = None
    project_title: Optional[str] = None


class CollaborationRespond(BaseModel):
    action: str  # 'accept' | 'decline'


class CollaborationProgressUpdate(BaseModel):
    progress_percent: int = Field(..., ge=0, le=100)
    project_title: Optional[str] = None


class CollaborationRead(BaseModel):
    id: str
    status: str
    message: Optional[str] = None
    project_title: Optional[str] = None
    progress_percent: int = 0
    related_case_id: Optional[str] = None
    related_signal_id: Optional[str] = None
    created_at: str
    updated_at: str

    # Whoever ISN'T the caller, pre-resolved so the frontend never has to guess.
    counterpart: PartyBrief
    direction: str  # 'incoming' | 'outgoing'


class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)


class ChatMessageRead(BaseModel):
    id: str
    collaboration_id: str
    sender_id: str
    content: str
    created_at: str
    is_mine: bool = False