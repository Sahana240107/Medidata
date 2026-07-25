"""
scorecard.py

Fixed rule-based score (completeness/severity-weighted, not an LLM guess),
documented and versioned so it's auditable — same principle the guide
applies to Member 3's quality_rubric.py, extended to verdict quality here.
Every threshold below is a plain constant, not a learned weight.

Four dimensions, each 1-5:
  evidence_strength        — how strong is the baseline statistical signal
  falsification_resistance — how much of the stress-test did it survive
  generalizability          — how broad is the evidence base (sites, geography)
  confounding_risk          — 1=low risk, 5=high risk (based on stratified interaction findings)
"""
from __future__ import annotations

from .schemas import EvidenceInput, Scorecard
from ..falsification_engine.schemas import FalsificationRunResult

RUBRIC_VERSION = "v1"


def _score_evidence_strength(evidence: EvidenceInput) -> tuple[int, str]:
    if evidence.test_used == "insufficient_data" or evidence.p_value is None:
        return 1, "baseline statistic could not be computed (insufficient_data)"

    p = evidence.p_value
    ci_width = None
    if evidence.ci_low is not None and evidence.ci_high is not None and evidence.ci_low > 0:
        ci_width = evidence.ci_high / evidence.ci_low  # ratio, not difference — ORs are log-scale

    if p < 0.001 and ci_width is not None and ci_width < 4:
        return 5, f"p={p:.4g} < 0.001 with a tight CI (ratio {ci_width:.1f}x)"
    if p < 0.01:
        return 4, f"p={p:.4g} < 0.01"
    if p < 0.05:
        return 3, f"p={p:.4g} < 0.05 (conventional significance, not strong)"
    if p < 0.10:
        return 2, f"p={p:.4g} — below conventional significance, borderline"
    return 1, f"p={p:.4g} — not significant"


def _score_falsification_resistance(falsification: FalsificationRunResult) -> tuple[int, str]:
    if falsification.overall_verdict == "insufficient_data":
        return 1, "falsification cohort too small — resistance untested, treated as worst case"

    testable = [c for c in falsification.checks if c.status in ("passed", "failed")]
    n_testable = len(testable)
    n_flipped = sum(1 for c in testable if c.verdict_flipped and c.significant_after_correction)

    if n_testable == 0:
        return 1, "zero checks were testable — resistance unverified, treated as worst case"
    if n_flipped == 0 and n_testable >= 4:
        return 5, f"survived all {n_testable} testable checks, including a broad check family"
    if n_flipped == 0:
        return 4, f"survived all {n_testable} testable checks (small check family — some caution warranted)"
    flip_rate = n_flipped / n_testable
    if flip_rate <= 0.25:
        return 2, f"{n_flipped}/{n_testable} checks flipped significantly ({flip_rate:.0%})"
    return 1, f"{n_flipped}/{n_testable} checks flipped significantly ({flip_rate:.0%}) — majority or near-majority"


def _score_generalizability(evidence: EvidenceInput, falsification: FalsificationRunResult) -> tuple[int, str]:
    hospital_checks = [c for c in falsification.checks if c.check_family == "leave_one_hospital_out"]
    country_checks = [c for c in falsification.checks if c.check_family == "leave_one_country_out"]

    n_hospital_variants = len(hospital_checks)
    country_not_applicable = any(c.status == "not_applicable" for c in country_checks)

    total_n = evidence.n_intervention + evidence.n_control

    if n_hospital_variants == 0 or (n_hospital_variants == 1 and hospital_checks[0].status == "not_applicable"):
        base = 1
        reason = "cohort drawn from a single hospital — no cross-site evidence"
    elif n_hospital_variants >= 3:
        base = 4
        reason = f"cohort spans {n_hospital_variants} hospitals"
    else:
        base = 3
        reason = f"cohort spans {n_hospital_variants} hospitals — modest site diversity"

    if country_not_applicable:
        reason += "; single-country dataset (no cross-country evidence yet)"
        base = min(base, 3)

    if total_n < 10:
        base = min(base, 2)
        reason += f"; small total n={total_n} limits how far results can be generalized regardless of site count"

    return max(1, base), reason


def _score_confounding_risk(falsification: FalsificationRunResult) -> tuple[int, str]:
    strat_checks = [c for c in falsification.checks if c.check_family == "stratified_interaction"]
    if not strat_checks:
        return 3, "no stratified interaction checks were run — confounding risk unknown, scored neutral"

    n_run = sum(1 for c in strat_checks if c.status in ("passed", "failed"))
    n_significant = sum(1 for c in strat_checks if c.status == "failed" and c.significant_after_correction)

    if n_run == 0:
        return 3, "stratified interaction models could not fit (insufficient_data) — risk unknown, scored neutral"
    if n_significant == 0:
        return 2, f"no significant subgroup x intervention interaction found across {n_run} tested subgroup(s)"
    if n_significant == 1:
        return 4, "one subgroup shows a significant interaction — candidate confounder, flag for Member 3 review"
    return 5, f"{n_significant} subgroups show significant interactions — substantial confounding risk"


def build_scorecard(evidence: EvidenceInput, falsification: FalsificationRunResult) -> Scorecard:
    es, es_reason = _score_evidence_strength(evidence)
    fr, fr_reason = _score_falsification_resistance(falsification)
    gz, gz_reason = _score_generalizability(evidence, falsification)
    cr, cr_reason = _score_confounding_risk(falsification)

    return Scorecard(
        rubric_version=RUBRIC_VERSION,
        evidence_strength=es,
        evidence_strength_reason=es_reason,
        falsification_resistance=fr,
        falsification_resistance_reason=fr_reason,
        generalizability=gz,
        generalizability_reason=gz_reason,
        confounding_risk=cr,
        confounding_risk_reason=cr_reason,
    )
