"""
router.py

Exposes the Evidence Discovery Engine endpoints. Prefix matches the
convention already established for Member 2's routers (/api/falsification,
/api/verdict) rather than the guide's original /api/member1 scaffold prefix,
so the whole team's API surface stays consistent:

    POST /api/evidence/parse          question -> CohortFilters
    POST /api/evidence/build-cohort   CohortFilters -> case ID lists
    POST /api/evidence/compute        case ID lists -> odds ratio, CI, p-value
    POST /api/evidence/run            question OR filters -> full result (bonus,
                                       convenience endpoint chaining the three above)
    GET  /api/evidence/run/{run_id}   cached full-pipeline result

Result caching is a simple in-memory dict — fine for this build's scope, swap
for Redis/Supabase if it needs to survive a process restart (same trade-off
Member 2 made in falsification_engine/router.py).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .query_parser import QueryParseError
from .schemas import (
    CohortFilters,
    CohortIdsResult,
    ComputeRequest,
    ContingencyResult,
    EvidenceRunResult,
    QuestionParseRequest,
    QuestionParseResponse,
)
from .service import build_cohort_from_filters, compute, parse, run_full_pipeline

router = APIRouter(prefix="/api/evidence", tags=["evidence-engine"])

_RUN_CACHE: dict[str, EvidenceRunResult] = {}


@router.post("/parse", response_model=QuestionParseResponse)
async def parse_question(body: QuestionParseRequest) -> QuestionParseResponse:
    try:
        return await parse(body.question)
    except QueryParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/build-cohort", response_model=CohortIdsResult)
def build_cohort_endpoint(filters: CohortFilters) -> CohortIdsResult:
    return build_cohort_from_filters(filters)


@router.post("/compute", response_model=ContingencyResult)
def compute_endpoint(body: ComputeRequest) -> ContingencyResult:
    return compute(body)


class RunRequest(BaseModel):
    question: Optional[str] = None
    filters: Optional[CohortFilters] = None


@router.post("/run", response_model=EvidenceRunResult)
async def run_endpoint(body: RunRequest) -> EvidenceRunResult:
    if not body.question and not body.filters:
        raise HTTPException(status_code=400, detail="Provide either `question` or `filters`.")
    try:
        result = await run_full_pipeline(body.question, body.filters)
    except QueryParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    _RUN_CACHE[result.run_id] = result
    return result


@router.get("/run/{run_id}", response_model=EvidenceRunResult)
def get_cached_run(run_id: str) -> EvidenceRunResult:
    result = _RUN_CACHE.get(run_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"no cached evidence run for run_id={run_id}")
    return result