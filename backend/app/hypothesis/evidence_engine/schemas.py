"""
Schemas for the Evidence Discovery Engine.

CohortFilters here is Member 1's OWN definition (same shape as Member 2's,
no shared import) — per the Independence Checklist each member keeps its own
copy so neither track blocks on, or breaks because of, the other's code.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class CohortFilters(BaseModel):
    """Defines a hypothesis cohort in schema-valid terms.

    Intervention/control is derived from `medications`, not stored — see
    shared_config/db_schema_notes.md. `control_medication` is optional; when
    omitted, the control arm is every case in the base cohort that does NOT
    contain `intervention_medication`.
    """

    disease: Optional[str] = Field(
        default=None, description="Exact or substring match against `cases.disease`."
    )
    domain: Optional[str] = Field(
        default=None,
        description="Broader clinical domain (Oncology, Cardiovascular, ...) — "
        "fallback grouping when `disease` is too sparse or 'Unclassified'.",
    )
    intervention_medication: str = Field(
        ..., description="Substring (case-insensitive) matched against `medications` entries."
    )
    control_medication: Optional[str] = Field(
        default=None,
        description="If set, control arm = cases containing THIS drug instead of "
        "the default 'everyone else in the base cohort'.",
    )
    country: Optional[str] = None
    hospital_id: Optional[str] = None
    sex: Optional[str] = None
    age_range: Optional[str] = None
    min_arm_size: int = Field(
        default=5,
        ge=1,
        description="Below this per-arm case count, compute() short-circuits to insufficient_data.",
    )

    @model_validator(mode="after")
    def _require_one_grouping(self):
        if not self.disease and not self.domain:
            raise ValueError("CohortFilters requires at least one of `disease` or `domain`.")
        return self


class QuestionParseRequest(BaseModel):
    question: str = Field(..., min_length=3, description="Free-text hypothesis question.")


class QuestionParseResponse(BaseModel):
    filters: CohortFilters
    raw_llm_output: dict
    warnings: list[str] = Field(default_factory=list)
    retries_used: int = 0


class CohortIdsResult(BaseModel):
    intervention_ids: list[str]
    control_ids: list[str]
    excluded_ids: list[str]
    n_intervention: int
    n_control: int
    n_excluded: int
    notes: list[str]


class ComputeRequest(BaseModel):
    intervention_ids: list[str] = Field(..., min_length=0)
    control_ids: list[str] = Field(..., min_length=0)
    min_arm_size: int = Field(default=5, ge=1)


class ContingencyResult(BaseModel):
    """A single 2x2 contingency table result: intervention/control x favorable/unfavorable."""

    a_intervention_favorable: int
    b_intervention_unfavorable: int
    c_control_favorable: int
    d_control_unfavorable: int
    n_intervention: int
    n_control: int
    n_excluded_ongoing: int
    n_excluded_unclassified: int
    odds_ratio: Optional[float]
    ci_low: Optional[float]
    ci_high: Optional[float]
    p_value: Optional[float]
    test_used: Literal["fisher_exact", "chi_square", "insufficient_data"]
    continuity_correction_applied: bool = False
    direction: Optional[Literal["favors_intervention", "favors_control", "no_effect"]] = None


class EvidenceRunResult(BaseModel):
    """Full pipeline result: question (optional) -> filters -> cohort -> statistics."""

    run_id: str
    question: Optional[str] = None
    filters: CohortFilters
    cohort: CohortIdsResult
    statistics: ContingencyResult
    computed_at: datetime