"""
test_verdict_engine.py

Per the guide's phase note: "decision_rules.py + scorecard.py against two
hardcoded mock inputs (an evidence-shaped object and a falsification-shaped
object you write yourself). Fully testable without Member 1's real output."

This file has both:
  1. Fully synthetic mock evidence + mock falsification (hand-written, no
     dependency on the falsification engine actually running) — covers every
     decision_rules.py branch deliberately.
  2. Real evidence-shaped mock PAIRED WITH a real FalsificationRunResult
     produced by actually running this member's own falsification_engine
     against the real dataset — proves the two engines snap together.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from ..audit_pack import assemble_audit_pack, audit_pack_to_csv, audit_pack_to_json
from ..decision_rules import apply_decision_rules
from ..narrative_templates import fill_narrative_deterministic, validate_no_invented_numbers, build_slots
from ..schemas import EvidenceInput
from ..scorecard import build_scorecard
from ..service import compute_verdict

from ...falsification_engine.schemas import CohortFilters, FalsificationRunResult
from ...falsification_engine.service import run_falsification
from ...falsification_engine.tests.csv_case_source import load_cases_from_csv

_CSV_PATH = Path(__file__).parents[2] / "falsification_engine" / "tests" / "sample_dataset.csv"


# ---------------------------------------------------------------------------
# Hand-written mock objects — the guide's required "two hardcoded mock inputs"
# ---------------------------------------------------------------------------

def _mock_evidence(**overrides) -> EvidenceInput:
    base = dict(
        hypothesis_question="Does Drug X improve outcomes in Disease Y?",
        cohort_description="Disease Y patients, Drug X vs. no Drug X",
        n_intervention=40,
        n_control=38,
        odds_ratio=3.2,
        ci_low=1.4,
        ci_high=7.3,
        p_value=0.004,
        test_used="chi_square",
        direction="favors_intervention",
    )
    base.update(overrides)
    return EvidenceInput(**base)


def _mock_falsification(overall_verdict, checks=None, run_id="mock-run-1", **overrides) -> FalsificationRunResult:
    from ...falsification_engine.schemas import ContingencyResult

    base_baseline = dict(
        a_intervention_favorable=28,
        b_intervention_unfavorable=12,
        c_control_favorable=14,
        d_control_unfavorable=24,
        n_intervention=40,
        n_control=38,
        n_excluded_ongoing=0,
        n_excluded_unclassified=0,
        odds_ratio=3.2,
        ci_low=1.4,
        ci_high=7.3,
        p_value=0.004,
        test_used="chi_square",
        direction="favors_intervention",
    )
    return FalsificationRunResult(
        run_id=run_id,
        filters=CohortFilters(disease="Disease Y", intervention_medication="Drug X", min_arm_size=5),
        baseline=ContingencyResult(**base_baseline),
        checks=checks or [],
        family_size=len(checks or []),
        overall_verdict=overall_verdict,
        fragility_reasons=overrides.pop("fragility_reasons", []),
        audit_trace=[{"step": "mock", "library": "mock", "function": "mock", "params": {}, "result": {}, "timestamp": datetime.now(timezone.utc).isoformat()}],
        computed_at=datetime.now(timezone.utc),
    )


def test_rule_1_evidence_insufficient():
    evidence = _mock_evidence(test_used="insufficient_data", p_value=None, odds_ratio=None, ci_low=None, ci_high=None)
    falsification = _mock_falsification("insufficient_data")
    verdict, restricted_to, rule = apply_decision_rules(evidence, falsification)
    assert verdict == "insufficient_evidence"
    assert rule.startswith("rule_1")


def test_rule_2_falsification_insufficient():
    evidence = _mock_evidence()
    falsification = _mock_falsification("insufficient_data")
    verdict, restricted_to, rule = apply_decision_rules(evidence, falsification)
    assert verdict == "insufficient_evidence"
    assert rule.startswith("rule_2")


def test_rule_3_evidence_not_significant():
    evidence = _mock_evidence(p_value=0.6, odds_ratio=1.1, ci_low=0.7, ci_high=1.8)
    falsification = _mock_falsification("robust")
    verdict, restricted_to, rule = apply_decision_rules(evidence, falsification)
    assert verdict == "no_significant_association"
    assert rule.startswith("rule_3")


def test_rule_7_supported_no_flips():
    from ..schemas import EvidenceInput as _E
    evidence = _mock_evidence()
    falsification = _mock_falsification(
        "robust",
        checks=[
            {"check_family": "leave_one_hospital_out", "check_name": "x", "status": "passed", "verdict_flipped": False, "p_value_raw": 0.9, "p_value_corrected": 0.9, "significant_after_correction": False},
        ],
    )
    verdict, restricted_to, rule = apply_decision_rules(evidence, falsification)
    assert verdict == "supported"
    assert restricted_to is None
    assert rule.startswith("rule_7")


def test_rule_6_minority_flip_gives_fragile_support():
    evidence = _mock_evidence()
    checks = [
        {"check_family": "leave_one_hospital_out", "check_name": "excluding Hospital A", "status": "failed", "verdict_flipped": True, "p_value_raw": 0.01, "p_value_corrected": 0.02, "significant_after_correction": True},
        {"check_family": "leave_one_hospital_out", "check_name": "excluding Hospital B", "status": "passed", "verdict_flipped": False, "p_value_raw": 0.8, "p_value_corrected": 0.8, "significant_after_correction": False},
        {"check_family": "bootstrap_stability", "check_name": "bootstrap", "status": "passed", "verdict_flipped": False, "p_value_raw": 0.02, "p_value_corrected": 0.04, "significant_after_correction": False},
    ]
    falsification = _mock_falsification("fragile", checks=checks)
    verdict, restricted_to, rule = apply_decision_rules(evidence, falsification)
    assert verdict == "fragile_support"
    assert restricted_to is not None
    assert "hospital" in restricted_to.lower()
    assert rule.startswith("rule_6")


def test_rule_5_majority_flip_gives_contradicted():
    evidence = _mock_evidence()
    checks = [
        {"check_family": "leave_one_hospital_out", "check_name": "a", "status": "failed", "verdict_flipped": True, "p_value_raw": 0.01, "p_value_corrected": 0.01, "significant_after_correction": True},
        {"check_family": "time_split", "check_name": "b", "status": "failed", "verdict_flipped": True, "p_value_raw": 0.01, "p_value_corrected": 0.01, "significant_after_correction": True},
        {"check_family": "bootstrap_stability", "check_name": "c", "status": "passed", "verdict_flipped": False, "p_value_raw": 0.8, "p_value_corrected": 0.8, "significant_after_correction": False},
    ]
    falsification = _mock_falsification("fragile", checks=checks)
    verdict, restricted_to, rule = apply_decision_rules(evidence, falsification)
    assert verdict == "contradicted_by_falsification"
    assert rule.startswith("rule_5")


def test_scorecard_ranges_and_reasons_present():
    evidence = _mock_evidence()
    falsification = _mock_falsification(
        "robust",
        checks=[
            {"check_family": "leave_one_hospital_out", "check_name": "a", "status": "passed", "verdict_flipped": False, "p_value_raw": 0.5, "p_value_corrected": 0.5, "significant_after_correction": False},
            {"check_family": "leave_one_hospital_out", "check_name": "b", "status": "passed", "verdict_flipped": False, "p_value_raw": 0.6, "p_value_corrected": 0.6, "significant_after_correction": False},
            {"check_family": "leave_one_country_out", "check_name": "c", "status": "not_applicable"},
            {"check_family": "stratified_interaction", "check_name": "d", "status": "passed", "verdict_flipped": False, "p_value_raw": 0.4, "p_value_corrected": 0.4, "significant_after_correction": False},
        ],
    )
    sc = build_scorecard(evidence, falsification)
    for field in (sc.evidence_strength, sc.falsification_resistance, sc.generalizability, sc.confounding_risk):
        assert 1 <= field <= 5
    assert sc.evidence_strength_reason
    assert sc.falsification_resistance_reason
    assert sc.generalizability_reason
    assert sc.confounding_risk_reason
    assert 1.0 <= sc.overall <= 5.0


def test_narrative_contains_no_invented_numbers():
    evidence = _mock_evidence()
    falsification = _mock_falsification("robust", checks=[])
    sc = build_scorecard(evidence, falsification)
    narrative = fill_narrative_deterministic(evidence, falsification, sc, "supported", None)
    slots = build_slots(evidence, falsification, sc, "supported", None)
    assert validate_no_invented_numbers(narrative, slots)
    assert "3.2" in narrative  # the odds ratio should actually appear


def test_validator_rejects_a_fabricated_number():
    evidence = _mock_evidence()
    falsification = _mock_falsification("robust", checks=[])
    sc = build_scorecard(evidence, falsification)
    slots = build_slots(evidence, falsification, sc, "supported", None)
    fabricated = "The odds ratio was an enormous 999.9, proving the effect conclusively."
    assert not validate_no_invented_numbers(fabricated, slots)


def test_compute_verdict_end_to_end_with_mocks_and_audit_pack():
    evidence = _mock_evidence()
    checks = [
        {"check_family": "leave_one_hospital_out", "check_name": "a", "status": "passed", "verdict_flipped": False, "p_value_raw": 0.5, "p_value_corrected": 0.5, "significant_after_correction": False},
    ]
    falsification = _mock_falsification("robust", checks=checks)
    verdict, trace = compute_verdict(evidence, falsification)
    assert verdict.verdict == "supported"
    assert verdict.scorecard is not None
    assert len(trace) == 3  # decision_rules, scorecard, narrative

    pack = assemble_audit_pack(verdict, verdict_trace=trace)
    assert len(pack.trace) == len(falsification.audit_trace) + len(trace)

    as_json = audit_pack_to_json(pack)
    assert verdict.verdict_id in as_json

    as_csv = audit_pack_to_csv(pack)
    assert "step,library,function,params,result,timestamp" in as_csv
    assert as_csv.count("\n") == len(pack.trace) + 1  # header + one row per step (+trailing newline handled by csv writer)


# ---------------------------------------------------------------------------
# Integration: real falsification output from the real dataset, paired with
# a hand-written evidence mock (Member 1 doesn't exist yet, per the brief).
# ---------------------------------------------------------------------------

def test_verdict_engine_against_real_falsification_output():
    cases = load_cases_from_csv(_CSV_PATH)
    filters = CohortFilters(disease="Colorectal Cancer", intervention_medication="Cetuximab", min_arm_size=2)
    real_falsification = run_falsification(filters, case_source=lambda: cases, n_bootstrap_resamples=300)

    # Hand-written evidence mock matching this cohort's real baseline shape
    # (Member 1 doesn't exist yet — this is exactly what the guide instructs).
    evidence = EvidenceInput(
        hypothesis_question="Does Cetuximab improve outcomes in Colorectal Cancer?",
        cohort_description="Colorectal Cancer patients, Cetuximab vs. no Cetuximab",
        n_intervention=real_falsification.baseline.n_intervention,
        n_control=real_falsification.baseline.n_control,
        odds_ratio=real_falsification.baseline.odds_ratio,
        ci_low=real_falsification.baseline.ci_low,
        ci_high=real_falsification.baseline.ci_high,
        p_value=real_falsification.baseline.p_value,
        test_used=real_falsification.baseline.test_used,
        direction=real_falsification.baseline.direction,
    )

    verdict, trace = compute_verdict(evidence, real_falsification)
    assert verdict.verdict in (
        "supported",
        "fragile_support",
        "no_significant_association",
        "contradicted_by_falsification",
        "insufficient_evidence",
    )
    assert verdict.narrative
    pack = assemble_audit_pack(verdict, verdict_trace=trace)
    assert len(pack.trace) > 0


def test_verdict_engine_insufficient_evidence_on_tiny_real_cohort():
    cases = load_cases_from_csv(_CSV_PATH)
    filters = CohortFilters(disease="Leukemia", intervention_medication="Rituximab", min_arm_size=5)
    real_falsification = run_falsification(filters, case_source=lambda: cases)

    evidence = EvidenceInput(
        hypothesis_question="Does Rituximab improve outcomes in Leukemia?",
        cohort_description="Leukemia patients, Rituximab vs. no Rituximab",
        n_intervention=real_falsification.baseline.n_intervention,
        n_control=real_falsification.baseline.n_control,
        odds_ratio=real_falsification.baseline.odds_ratio,
        ci_low=real_falsification.baseline.ci_low,
        ci_high=real_falsification.baseline.ci_high,
        p_value=real_falsification.baseline.p_value,
        test_used=real_falsification.baseline.test_used,
        direction=real_falsification.baseline.direction,
    )
    verdict, trace = compute_verdict(evidence, real_falsification)
    assert verdict.verdict == "insufficient_evidence"


if __name__ == "__main__":
    import sys

    import pytest

    sys.exit(pytest.main([__file__, "-v"]))
