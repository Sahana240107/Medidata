"""
Cases router — doctor case intake.
POST /cases       -> create a de-identified case (Supabase + Qdrant)
GET  /cases       -> list cases for the caller's hospital
GET  /cases/{id}  -> fetch one case (scoped to the caller's hospital)
"""

from fastapi import APIRouter, Depends, Query

from app.deps.auth import get_current_user
from app.schemas.case import CaseCreate, CaseRead
from app.services import case_service

router = APIRouter(prefix="/cases", tags=["cases"])


@router.post("", response_model=CaseRead, status_code=201)
async def create_case(body: CaseCreate, user: dict = Depends(get_current_user)):
    """
    Doctor submits a de-identified case. Stored in Supabase, embedded, and
    upserted into Qdrant as a fingerprint vector for similar-case search.
    """
    case_row = case_service.create_case(
        case_in=body,
        hospital_id=user["hospital_id"],
        submitted_by=user["id"],
    )
    return case_row


@router.get("", response_model=list[CaseRead])
async def list_my_hospital_cases(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
):
    return case_service.list_cases(hospital_id=user["hospital_id"], limit=limit, offset=offset)


@router.get("/{case_id}", response_model=CaseRead)
async def get_case(case_id: str, user: dict = Depends(get_current_user)):
    return case_service.get_case(case_id=case_id, hospital_id=user["hospital_id"])
