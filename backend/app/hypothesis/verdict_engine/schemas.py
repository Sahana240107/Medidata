"""
schemas.py — Verdict Engine

`EvidenceInput` is Member 2's own copy of the SHAPE Member 1's
evidence_engine/statistics.py will eventually produce (odds ratio, CI,
p-value from a cohort's contingency table). It is hand-written here, not
imported from Member 1 — per the phase note, this module must be "fully
testable without Member 1's real output." Once Member 1 ships, wiring their
real response into this shape is a one-time mapping at the API boundary, not
a code dependency.

`FalsificationInput` is NOT a mock — it's literally
`falsification_engine.schemas.FalsificationRunResult`, reused directly,
because that's this same member's own upstream engine.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from ..falsification_engine.schemas import FalsificationRunResult


class EvidenceInput(BaseModel):
    """Evidence-shaped object: what Member 1's cohort_builder.py + statistics.py
    produces for a hypothesis question. Written by hand here as the guide
    instructs, matching the fields listed for Member 1's
    `POST /api/member1/evidence/compute` endpoint (odds ratio, CI, p-value)
    plus the minimal cohort description needed for a readable verdict.
    """

    hypothesis_question: str = Field(..., description="The original natural-language question, e.g. 'Does Cetuximab improve outcomes in Colorectal Cancer?'")
    cohort_description: str = Field(..., description="Human-readable cohort definition, e.g. 'Colorectal Cancer patients, Cetuximab vs. no Cetuximab'")
    n_intervention: int
    n_control: int
    odds_ratio: Optional[float]
    ci_low: Optional[float]
    ci_high: Optional[float]
    p_value: Optional[float]
    test_used: Literal["fisher_exact", "chi_square", "insufficient_data"]
    direction: Optional[Literal["favors_intervention", "favors_control", "no_effect"]] = None


class Scorecard(BaseModel):
    """1-5 scale, rule-based, documented and versioned so it's auditable, not
    a black box, per the guide's explicit instruction for quality_rubric-style
    scoring."""

    rubric_version: str = "v1"
    evidence_strength: int = Field(..., ge=1, le=5)
    evidence_strength_reason: str
    falsification_resistance: int = Field(..., ge=1, le=5)
    falsification_resistance_reason: str
    generalizability: int = Field(..., ge=1, le=5)
    generalizability_reason: str
    confounding_risk: int = Field(..., ge=1, le=5, description="1 = low risk, 5 = high risk")
    confounding_risk_reason: str

    @property
    def overall(self) -> float:
        # confounding_risk is inverted (low risk is good) before averaging
        return round(
            (self.evidence_strength + self.falsification_resistance + self.generalizability + (6 - self.confounding_risk))
            / 4,
            2,
        )


class VerdictResult(BaseModel):
    verdict_id: str
    verdict: Literal[
        "supported",
        "fragile_support",
        "no_significant_association",
        "contradicted_by_falsification",
        "insufficient_evidence",
    ]
    restricted_to: Optional[str] = Field(
        default=None,
        description="Plain-language subgroup/scope restriction the verdict is conditioned on, or null if unrestricted.",
    )
    rule_fired: str = Field(..., description="Which row of decision_rules.py's if/else table produced this verdict — for audit purposes.")
    scorecard: Scorecard
    narrative: str
    evidence: EvidenceInput
    falsification: FalsificationRunResult
    computed_at: datetime


class AuditPack(BaseModel):
    audit_pack_id: str
    verdict_id: str
    trace: list[dict] = Field(..., description="Flattened, chronological: evidence step (if provided) + every falsification step + every verdict step.")
    generated_at: datetime
