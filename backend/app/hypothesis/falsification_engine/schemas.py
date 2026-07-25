"""
Schemas for the Falsification Engine.

Kept independent of Member 1's schemas on purpose — `CohortFilters` here is
Member 2's own copy (same shape, no shared import) so this module never
blocks on, or breaks because of, Member 1's code.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class CohortFilters(BaseModel):
    """Defines a hypothesis cohort in schema-valid terms.

    Intervention/control is derived from `medications`, not stored — see
    db_schema_notes.md. `control_medication` is optional; when omitted, the
    control arm is every same-disease case that does NOT contain
    `intervention_medication`.
    """

    disease: Optional[str] = Field(
        default=None, description="Exact or substring match against `disease`."
    )
    domain: Optional[str] = Field(
        default=None,
        description="Fallback grouping when `disease` is too sparse or 'Unclassified'.",
    )
    intervention_medication: str = Field(
        ..., description="Substring (case-insensitive) matched against `medications` entries."
    )
    control_medication: Optional[str] = Field(
        default=None,
        description="If set, control arm = cases containing THIS drug instead of the default 'everyone else'.",
    )
    country: Optional[str] = None
    hospital: Optional[str] = None
    sex: Optional[str] = None
    age_range: Optional[str] = None
    min_arm_size: int = Field(
        default=5,
        ge=1,
        description="Below this per-arm case count, checks short-circuit to insufficient_data.",
    )
    dataset_id: Optional[str] = Field(
        default=None,
        description=(
            "If set, run against the previously-uploaded dataset with this id "
            "(see POST /api/falsification/dataset/upload) instead of the live case source."
        ),
    )

    @field_validator("disease", "domain")
    @classmethod
    def _require_one_grouping(cls, v):
        return v

    def model_post_init(self, __context) -> None:
        if not self.disease and not self.domain:
            raise ValueError("CohortFilters requires at least one of `disease` or `domain`.")


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


class PerturbationCheckResult(BaseModel):
    """One robustness check's outcome, pre-correction."""

    check_family: Literal[
        "leave_one_hospital_out",
        "leave_one_country_out",
        "leave_one_demographic_out",
        "bootstrap_stability",
        "time_split",
        "stratified_interaction",
    ]
    check_name: str = Field(..., description="Human-readable label, e.g. 'excluding Chennai Apex Hospital'.")
    status: Literal["passed", "failed", "insufficient_data", "not_applicable"]
    baseline_direction: Optional[str] = None
    check_direction: Optional[str] = None
    verdict_flipped: bool = False
    odds_ratio: Optional[float] = None
    ci_low: Optional[float] = None
    ci_high: Optional[float] = None
    p_value_raw: Optional[float] = None
    p_value_corrected: Optional[float] = None
    significant_after_correction: Optional[bool] = None
    n_intervention: Optional[int] = None
    n_control: Optional[int] = None
    detail: str = ""


class FalsificationRunResult(BaseModel):
    run_id: str
    filters: CohortFilters
    baseline: ContingencyResult
    checks: list[PerturbationCheckResult]
    correction_method: Literal["holm_bonferroni"] = "holm_bonferroni"
    alpha: float = 0.05
    family_size: int
    overall_verdict: Literal["robust", "fragile", "insufficient_data"]
    fragility_reasons: list[str]
    audit_trace: list[dict]
    computed_at: datetime


class DatasetCasePreview(BaseModel):
    id: str
    disease: str
    domain: str
    hospital: str
    country: str
    sex: str
    age_range: str
    medications: str
    outcome: str
    created_at: str


class DatasetUploadResponse(BaseModel):
    dataset_id: str
    filename: str
    row_count: int
    columns: list[str]
    uploaded_at: datetime
    preview: list[DatasetCasePreview]