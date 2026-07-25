"""
Hospitals / Nodes router — Multi-Node Simulator + Hospital Insights page.

GET  /hospitals                 -> list every node in the network + local case count
GET  /hospitals/insights/me     -> network overview + the caller's own hospital's
                                    stats, leaderboard placement, achievements, and
                                    recent activity (Hospital Insights page)
POST /hospitals/metrics/recompute -> recompute + persist scores/ranks for every
                                    hospital in the network (admin-triggered; also
                                    runnable on a schedule via
                                    backend/scripts/recompute_metrics.py)
GET  /hospitals/{id}            -> a single node's detail
GET  /hospitals/{id}/cases      -> that node's local dataset only (never cross-node)
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps.auth import get_current_user
from app.schemas.hospital import HospitalNode, HospitalInsightsResponse
from app.services import hospital_service
from app.services.metrics_service import recompute_all_hospital_metrics

router = APIRouter(prefix="/hospitals", tags=["hospitals"])


@router.get("", response_model=List[HospitalNode])
async def list_nodes(user: dict = Depends(get_current_user)):
    return hospital_service.list_hospitals()


# NOTE: also static, so it must come before the dynamic /{hospital_id} route.
@router.post("/metrics/recompute")
async def recompute_network_metrics(user: dict = Depends(get_current_user)):
    """
    Recomputes disease_discoveries, collaboration/research-impact/validation
    scores, and discovery_score for every hospital from live cases /
    collaborations / research_signals / validation_requests rows, writes a
    fresh hospital_metrics snapshot for each, and re-ranks global_rank
    network-wide. Individual hospitals also self-heal on page load (see
    hospital_service.get_hospital_insights), so this is mainly for keeping
    ranks fresh across hospitals nobody has viewed recently.
    """
    # Swap this for your real role-check dependency if/when one exists
    # (e.g. `Depends(require_admin)`) — gating here inline so this file
    # doesn't import something that may not exist yet in app.deps.auth.
    if user.get("role") not in ("admin", "hospital_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")

    results = recompute_all_hospital_metrics()
    return {"recomputed": len(results), "results": results}


# NOTE: this static route must be declared before the dynamic /{hospital_id}
# route below, or FastAPI will try to match "insights" as a hospital_id.
@router.get("/insights/me", response_model=HospitalInsightsResponse)
async def get_my_hospital_insights(user: dict = Depends(get_current_user)):
    return hospital_service.get_hospital_insights(user)


@router.get("/{hospital_id}", response_model=HospitalNode)
async def get_node(hospital_id: str, user: dict = Depends(get_current_user)):
    return hospital_service.get_hospital(hospital_id)


@router.get("/{hospital_id}/cases")
async def get_node_cases(
    hospital_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
):
    return hospital_service.get_hospital_cases(hospital_id, limit=limit, offset=offset)