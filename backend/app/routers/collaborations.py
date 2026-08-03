"""
Collaborations router — connection requests, accept/decline, progress
tracking, and per-collaboration personal chat.

GET  /collaborations?box=incoming|outgoing|active -> list
POST /collaborations                              -> send a request
POST /collaborations/{id}/respond                 -> accept / decline
PATCH /collaborations/{id}/progress               -> update project progress
GET  /collaborations/{id}/messages                -> chat history
POST /collaborations/{id}/messages                -> send a chat message
"""

from fastapi import APIRouter, Depends, Query

from app.deps.auth import get_current_user
from app.schemas.collaboration import (
    ChatMessageCreate,
    ChatMessageRead,
    CollaborationCreate,
    CollaborationProgressUpdate,
    CollaborationRead,
    CollaborationRespond,
)
from app.services import collaboration_service

router = APIRouter(prefix="/collaborations", tags=["collaborations"])


@router.get("", response_model=list[CollaborationRead])
async def list_collaborations(
    box: str = Query("active"),  # 'incoming' | 'outgoing' | 'active'
    user: dict = Depends(get_current_user),
):
    return collaboration_service.list_collaborations(current_user_id=user["id"], box=box)


@router.post("", response_model=CollaborationRead, status_code=201)
async def create_collaboration(body: CollaborationCreate, user: dict = Depends(get_current_user)):
    return collaboration_service.create_collaboration(
        requested_by=user["id"],
        requested_by_name=user.get("full_name", "A colleague"),
        requested_to=body.requested_to,
        message=body.message,
        kind=body.kind,
        related_case_id=body.related_case_id,
        related_signal_id=body.related_signal_id,
        project_title=body.project_title,
    )


@router.post("/{collaboration_id}/respond", response_model=CollaborationRead)
async def respond_to_collaboration(
    collaboration_id: str,
    body: CollaborationRespond,
    user: dict = Depends(get_current_user),
):
    return collaboration_service.respond_to_collaboration(
        collaboration_id=collaboration_id, current_user_id=user["id"], action=body.action
    )


@router.patch("/{collaboration_id}/progress", response_model=CollaborationRead)
async def update_progress(
    collaboration_id: str,
    body: CollaborationProgressUpdate,
    user: dict = Depends(get_current_user),
):
    return collaboration_service.update_progress(
        collaboration_id=collaboration_id,
        current_user_id=user["id"],
        progress_percent=body.progress_percent,
        project_title=body.project_title,
    )


@router.get("/{collaboration_id}/messages", response_model=list[ChatMessageRead])
async def list_messages(collaboration_id: str, user: dict = Depends(get_current_user)):
    return collaboration_service.list_messages(collaboration_id=collaboration_id, current_user_id=user["id"])


@router.post("/{collaboration_id}/messages", response_model=ChatMessageRead, status_code=201)
async def send_message(
    collaboration_id: str,
    body: ChatMessageCreate,
    user: dict = Depends(get_current_user),
):
    return collaboration_service.send_message(
        collaboration_id=collaboration_id, current_user_id=user["id"], content=body.content
    )