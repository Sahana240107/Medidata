"""
Experts router.

GET /experts                 -> filterable, paginated expert list
GET /experts/filters          -> distinct specialty / country values for dropdowns
GET /experts/network-activity -> top-contributor table (Network Activity Signals)
GET /experts/{expert_id}      -> single expert detail
"""

from fastapi import APIRouter, Depends, Query

from app.deps.auth import get_current_user
from app.schemas.expert import ExpertDetail, ExpertFilterOptionsResponse, ExpertListResponse, NetworkActivityRow
from app.services import expert_service

router = APIRouter(prefix="/experts", tags=["experts"])


@router.get("", response_model=ExpertListResponse)
async def list_experts(
    specialty: str | None = Query(None),
    country: str | None = Query(None),
    verification_status: str | None = Query(None),
    search: str | None = Query(None),
    sort: str = Query("cases"),  # 'cases' | 'publications' | 'name'
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
):
    return expert_service.list_experts(
        current_user_id=user["id"],
        specialty=specialty,
        country=country,
        verification_status=verification_status,
        search=search,
        sort=sort,
        limit=limit,
        offset=offset,
    )


@router.get("/filters", response_model=ExpertFilterOptionsResponse)
async def get_filters(user: dict = Depends(get_current_user)):
    return expert_service.get_filter_options()


@router.get("/network-activity", response_model=list[NetworkActivityRow])
async def get_network_activity(
    limit: int = Query(10, ge=1, le=50),
    user: dict = Depends(get_current_user),
):
    return expert_service.get_network_activity(limit=limit)


@router.get("/{expert_id}", response_model=ExpertDetail)
async def get_expert(expert_id: str, user: dict = Depends(get_current_user)):
    return expert_service.get_expert(current_user_id=user["id"], expert_id=expert_id)