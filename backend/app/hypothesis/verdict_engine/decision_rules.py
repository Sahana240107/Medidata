"""
decision_rules.py

Plain if/else rule table -> verdict + restricted_to. Deliberately NOT a
model, NOT an LLM call, NOT a weighted score threshold — a rule table someone
can read top to bottom and know exactly why a hypothesis got the verdict it
got. Each rule records its own name in `rule_fired` so the verdict is
self-documenting.

Rules are checked in order; the FIRST matching rule wins. Order matters and
is intentional — see comments.
"""
from __future__ import annotations

from .schemas import EvidenceInput
from ..falsification_engine.schemas import FalsificationRunResult

ALPHA = 0.05


def _evidence_significant(evidence: EvidenceInput) -> bool:
    if evidence.test_used == "insufficient_data" or evidence.p_value is None:
        return False
    if evidence.ci_low is None or evidence.ci_high is None:
        return evidence.p_value < ALPHA
    # CI must exclude 1.0 (OR=1 means no association) AND p must clear alpha.
    ci_excludes_one = evidence.ci_low > 1.0 or evidence.ci_high < 1.0
    return evidence.p_value < ALPHA and ci_excludes_one


def _count_significant_flips(falsification: FalsificationRunResult) -> int:
    return sum(
        1
        for c in falsification.checks
        if c.verdict_flipped and c.significant_after_correction
    )


def _count_testable_checks(falsification: FalsificationRunResult) -> int:
    return sum(1 for c in falsification.checks if c.status in ("passed", "failed"))


def _describe_restriction(falsification: FalsificationRunResult) -> str | None:
    """Builds a plain-language scope restriction from whichever checks
    actually flipped, so 'fragile' verdicts come with an explanation a
    clinician-reader can act on rather than a bare label."""
    flipped_hospital = [c for c in falsification.checks if c.check_family == "leave_one_hospital_out" and c.verdict_flipped and c.significant_after_correction]
    flipped_country = [c for c in falsification.checks if c.check_family == "leave_one_country_out" and c.verdict_flipped and c.significant_after_correction]
    flipped_demo = [c for c in falsification.checks if c.check_family == "leave_one_demographic_out" and c.verdict_flipped and c.significant_after_correction]
    flipped_time = [c for c in falsification.checks if c.check_family == "time_split" and c.verdict_flipped and c.significant_after_correction]
    flipped_strat = [c for c in falsification.checks if c.check_family == "stratified_interaction" and c.verdict_flipped and c.significant_after_correction]
    flipped_boot = [c for c in falsification.checks if c.check_family == "bootstrap_stability" and c.verdict_flipped and c.significant_after_correction]

    notes = []
    if flipped_hospital:
        notes.append(f"depends on {len(flipped_hospital)} specific hospital(s) being included")
    if flipped_country:
        notes.append("depends on specific countries being included")
    if flipped_demo:
        notes.append(f"depends on {len(flipped_demo)} specific demographic subgroup(s) being included")
    if flipped_time:
        notes.append("direction differs between earlier- and later-recorded cases")
    if flipped_strat:
        notes.append("effect size differs significantly across a subgroup (possible effect modifier)")
    if flipped_boot:
        notes.append("odds ratio direction is not stable under case-level resampling")

    if not notes:
        return None
    return "Effect " + "; ".join(notes) + " — do not generalize beyond the tested cohort without re-checking."


def apply_decision_rules(
    evidence: EvidenceInput, falsification: FalsificationRunResult
) -> tuple[str, str | None, str]:
    """Returns (verdict, restricted_to, rule_fired)."""

    # Rule 1: either engine couldn't compute anything meaningful.
    if evidence.test_used == "insufficient_data" or evidence.p_value is None:
        return (
            "insufficient_evidence",
            None,
            "rule_1_evidence_insufficient: evidence.test_used == insufficient_data or p_value is None",
        )

    if falsification.overall_verdict == "insufficient_data":
        return (
            "insufficient_evidence",
            None,
            "rule_2_falsification_insufficient: falsification cohort too small to stress-test",
        )

    # Rule 3: evidence itself shows no significant association — nothing to
    # stress-test in the first place. Checked before fragility rules because
    # a non-significant baseline makes "fragile" or "contradicted" the wrong
    # framing (both imply there WAS a signal, which there wasn't).
    if not _evidence_significant(evidence):
        return (
            "no_significant_association",
            None,
            "rule_3_evidence_not_significant: p >= alpha or CI includes 1.0",
        )

    n_flipped = _count_significant_flips(falsification)
    n_testable = _count_testable_checks(falsification)

    # Rule 4: evidence significant, but falsification found NO checks were
    # even testable (e.g. cohort matched baseline min_arm_size exactly but
    # every perturbation immediately drops below it). Can't claim robustness
    # we never actually tested.
    if n_testable == 0:
        return (
            "insufficient_evidence",
            None,
            "rule_4_no_testable_checks: evidence significant but zero falsification checks could run",
        )

    # Rule 5: majority of testable checks flip significantly -> the baseline
    # association looks like an artifact of a specific slice of the data,
    # not a real signal. Stronger language than "fragile".
    if n_testable > 0 and n_flipped / n_testable > 0.5:
        return (
            "contradicted_by_falsification",
            _describe_restriction(falsification),
            f"rule_5_majority_flipped: {n_flipped}/{n_testable} testable checks flipped direction significantly",
        )

    # Rule 6: at least one check flips significantly, but not a majority —
    # real signal, but conditional.
    if n_flipped > 0:
        return (
            "fragile_support",
            _describe_restriction(falsification),
            f"rule_6_minority_flipped: {n_flipped}/{n_testable} testable checks flipped direction significantly",
        )

    # Rule 7: significant evidence, and it survived every check that could
    # actually be run.
    return (
        "supported",
        None,
        f"rule_7_no_flips: 0/{n_testable} testable checks flipped direction significantly",
    )
