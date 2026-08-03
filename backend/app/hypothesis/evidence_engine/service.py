"""
service.py

Orchestrates the Evidence Discovery Engine. Three independent operations the
router exposes separately (parse / build-cohort / compute), plus one
convenience function (`run_full_pipeline`) that chains all three for a single
"ask a question, get a statistic" call.

No import of Member 2 or Member 3's code anywhere in this file.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.db.supabase_client import get_supabase_admin

from .cohort_builder import CaseRow, build_cohort, fetch_cases_for_cohort
from .outcome_mapping import normalize_outcome
from .query_parser import parse_question as _parse_question
from .schemas import (
    CohortFilters,
    CohortIdsResult,
    ComputeRequest,
    ContingencyResult,
    EvidenceRunResult,
    QuestionParseResponse,
)
from .statistics import build_binary_counts, compute_contingency


async def parse(question: str) -> QuestionParseResponse:
    filters, raw, warnings, retries = await _parse_question(question)
    return QuestionParseResponse(
        filters=filters, raw_llm_output=raw, warnings=warnings, retries_used=retries
    )


def build_cohort_from_filters(filters: CohortFilters) -> CohortIdsResult:
    cases = fetch_cases_for_cohort(filters)
    result = build_cohort(filters, cases)
    return CohortIdsResult(
        intervention_ids=result.intervention_ids,
        control_ids=result.control_ids,
        excluded_ids=result.excluded_ids,
        n_intervention=len(result.intervention_ids),
        n_control=len(result.control_ids),
        n_excluded=len(result.excluded_ids),
        notes=result.notes,
    )


def _fetch_outcomes_by_id(ids: list[str]) -> dict[str, str]:
    """Re-fetches just the `outcome` column for a specific set of case ids.
    Kept as its own small read (rather than caching build-cohort's full rows
    in memory) so /compute stays a pure function of whatever id lists the
    caller passes in — including id lists a caller assembled themselves.
    """
    if not ids:
        return {}
    supabase = get_supabase_admin()
    resp = supabase.table("cases").select("id, outcome").in_("id", ids).execute()
    return {row["id"]: row.get("outcome") or "" for row in (resp.data or [])}


def compute(request: ComputeRequest) -> ContingencyResult:
    all_ids = list(request.intervention_ids) + list(request.control_ids)
    outcome_by_id = _fetch_outcomes_by_id(all_ids)

    intervention_outcomes = [
        normalize_outcome(outcome_by_id[i]) for i in request.intervention_ids if i in outcome_by_id
    ]
    control_outcomes = [
        normalize_outcome(outcome_by_id[i]) for i in request.control_ids if i in outcome_by_id
    ]

    return compute_contingency(
        intervention_outcomes, control_outcomes, min_arm_size=request.min_arm_size
    )


async def run_full_pipeline(question: str | None, filters: CohortFilters | None) -> EvidenceRunResult:
    """Convenience path for the frontend's single 'Run' button: question OR
    filters in, full result out. Exactly one of (question, filters) should be
    given; if both are given, filters wins and the question is kept only for
    display.
    """
    if filters is None:
        if not question:
            raise ValueError("run_full_pipeline requires either `question` or `filters`.")
        parsed = await parse(question)
        filters = parsed.filters

    cohort = build_cohort_from_filters(filters)
    stats = compute(
        ComputeRequest(
            intervention_ids=cohort.intervention_ids,
            control_ids=cohort.control_ids,
            min_arm_size=filters.min_arm_size,
        )
    )

    return EvidenceRunResult(
        run_id=str(uuid.uuid4()),
        question=question,
        filters=filters,
        cohort=cohort,
        statistics=stats,
        computed_at=datetime.now(timezone.utc),
    )