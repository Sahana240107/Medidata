"""
Visualization router.

GET /viz/fingerprint-space -> 2D-projected fingerprint vectors, for the
                               "irreversible representation" proof panel.
                               Pass hospital_id to scope to one node, or
                               omit it for the whole-network view.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.deps.auth import get_current_user
from app.schemas.viz import FingerprintSpaceResponse
from app.services.projection_service import project_fingerprint_space

router = APIRouter(prefix="/viz", tags=["viz"])


@router.get("/fingerprint-space", response_model=FingerprintSpaceResponse)
async def fingerprint_space(
    hospital_id: Optional[str] = Query(None, description="Scope to one node; omit for the global network view."),
    limit: int = Query(300, ge=3, le=1000),
    user: dict = Depends(get_current_user),
):
    return project_fingerprint_space(hospital_id=hospital_id, limit=limit)