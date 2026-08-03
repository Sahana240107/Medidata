"""
router.py

Exposes the Cross-Dataset Discovery endpoints:

    POST /api/cross-dataset/compare       dataset selections -> overlap + co-occurrence results
    GET  /api/cross-dataset/discoveries   ranked list of every surfaced pattern so far
"""
from __future__ import annotations

from fastapi import APIRouter, Query

from .schemas import CompareRequest, CompareResult, DiscoveryListResponse
from .service import list_discoveries, run_compare

router = APIRouter(prefix="/api/cross-dataset", tags=["cross-dataset-discovery"])


@router.post("/compare", response_model=CompareResult)
def compare(request: CompareRequest) -> CompareResult:
    return run_compare(request)


@router.get("/discoveries", response_model=DiscoveryListResponse)
def discoveries(limit: int = Query(default=50, ge=1, le=200)) -> DiscoveryListResponse:
    return DiscoveryListResponse(discoveries=list_discoveries(limit=limit))