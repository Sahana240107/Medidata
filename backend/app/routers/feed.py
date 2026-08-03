"""
Feed router — powers the dashboard's Discovery Feed cards, the /feed list
page, and the /feed/[signalId] detail page.

GET  /feed/signals            -> paginated + filterable list ({items, total})
GET  /feed/signals/{signal_id} -> single signal
GET  /feed/stats               -> the 4 stat cards on the dashboard
POST /feed/scan                -> run the clustering pipeline on-demand,
                                   turning real cases into real signals
"""

from fastapi import APIRouter, Depends, Query

from app.deps.auth import get_current_user
from app.schemas.feed import FeedSignalsPage, FeedStats, ResearchSignalRead, ScanResult
from app.services import feed_service
from app.services.clustering_service import run_discovery_scan

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("/signals", response_model=FeedSignalsPage)
async def get_signals(
    limit: int = Query(12, ge=1, le=100),
    offset: int = Query(0, ge=0),
    signal_type: str | None = Query(None),
    sort: str = Query("recent"),  # 'recent' | 'confidence'
    status: str | None = Query("active"),
    user: dict = Depends(get_current_user),
):
    return feed_service.list_signals(
        limit=limit, offset=offset, signal_type=signal_type, sort=sort, signal_status=status
    )


@router.get("/signals/{signal_id}", response_model=ResearchSignalRead)
async def get_signal(signal_id: str, user: dict = Depends(get_current_user)):
    return feed_service.get_signal(signal_id)


@router.get("/stats", response_model=FeedStats)
async def get_stats(user: dict = Depends(get_current_user)):
    return feed_service.get_stats(hospital_id=user.get("hospital_id"))


@router.post("/scan", response_model=ScanResult)
async def scan(user: dict = Depends(get_current_user)):
    """Runs the clustering pipeline synchronously: embeds every active case,
    clusters them, and upserts research_signals + research_signal_cases.
    On a large case volume this should move to a background task — fine
    for on-demand use at current scale."""
    return await run_discovery_scan()