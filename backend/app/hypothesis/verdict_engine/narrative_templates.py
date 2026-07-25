"""
narrative_templates.py

Exact slot-fill templates. The default path is fully deterministic (no LLM,
no network call, no way to invent a number) — every sentence is built from
named slots computed directly off `EvidenceInput` / `FalsificationRunResult`
/ `Scorecard`.

An optional LLM-fill path is also provided for a more natural-reading
narrative, exactly as the guide describes: "the LLM prompt is constrained to
fill named slots only." It never sees free rein over the text — it receives
the same slot dict the deterministic path uses, is instructed to rephrase
slot values into flowing prose, and its output is run through
`validate_no_invented_numbers()` before being trusted. Any generated
sentence containing a number not present in the input objects is rejected,
and the caller falls back to the deterministic template — this validator is
what the guide says not to ship without.

No LLM client is wired in here (no API key assumed) — `fill_narrative_via_llm`
takes an injected `llm_call: Callable[[str], str]` so this module has zero
network dependency and stays testable offline, consistent with every other
module in this package.
"""
from __future__ import annotations

import re
from typing import Callable, Optional

from .schemas import EvidenceInput, Scorecard
from ..falsification_engine.schemas import FalsificationRunResult

_NUMBER_RE = re.compile(r"-?\d+\.?\d*")


def _fmt(x) -> str:
    if x is None:
        return "n/a"
    if isinstance(x, float):
        return f"{x:.3g}"
    return str(x)


def build_slots(
    evidence: EvidenceInput,
    falsification: FalsificationRunResult,
    scorecard: Scorecard,
    verdict: str,
    restricted_to: Optional[str],
) -> dict[str, str]:
    """Every value the narrative is allowed to mention, by name. This dict IS
    the contract: nothing outside these values may appear as a number in the
    final text."""
    testable = [c for c in falsification.checks if c.status in ("passed", "failed")]
    n_flipped = sum(1 for c in testable if c.verdict_flipped and c.significant_after_correction)

    return {
        "hypothesis_question": evidence.hypothesis_question,
        "cohort_description": evidence.cohort_description,
        "n_intervention": _fmt(evidence.n_intervention),
        "n_control": _fmt(evidence.n_control),
        "odds_ratio": _fmt(evidence.odds_ratio),
        "ci_low": _fmt(evidence.ci_low),
        "ci_high": _fmt(evidence.ci_high),
        "confidence_level": "95",
        "p_value": _fmt(evidence.p_value),
        "test_used": evidence.test_used.replace("_", " "),
        "n_checks_run": _fmt(len(testable)),
        "n_checks_flipped": _fmt(n_flipped),
        "verdict": verdict.replace("_", " "),
        "restricted_to": restricted_to or "no scope restriction identified",
        "evidence_strength": _fmt(scorecard.evidence_strength),
        "falsification_resistance": _fmt(scorecard.falsification_resistance),
        "generalizability": _fmt(scorecard.generalizability),
        "confounding_risk": _fmt(scorecard.confounding_risk),
    }


_TEMPLATES = {
    "supported": (
        "For the question \"{hypothesis_question}\", the cohort ({cohort_description}, "
        "n_intervention={n_intervention}, n_control={n_control}) showed an odds ratio of "
        "{odds_ratio} ({confidence_level}% CI {ci_low} to {ci_high}, {test_used}, p={p_value}). This association "
        "survived all {n_checks_run} applicable robustness checks ({n_checks_flipped} flipped "
        "direction after correction). Verdict: {verdict}."
    ),
    "fragile_support": (
        "For the question \"{hypothesis_question}\", the cohort ({cohort_description}, "
        "n_intervention={n_intervention}, n_control={n_control}) showed an odds ratio of "
        "{odds_ratio} ({confidence_level}% CI {ci_low} to {ci_high}, {test_used}, p={p_value}), but "
        "{n_checks_flipped} of {n_checks_run} robustness checks flipped its direction after "
        "correction. {restricted_to} Verdict: {verdict}."
    ),
    "contradicted_by_falsification": (
        "For the question \"{hypothesis_question}\", the cohort ({cohort_description}, "
        "n_intervention={n_intervention}, n_control={n_control}) showed an odds ratio of "
        "{odds_ratio} ({confidence_level}% CI {ci_low} to {ci_high}, {test_used}, p={p_value}), but a majority "
        "of robustness checks ({n_checks_flipped} of {n_checks_run}) flipped its direction "
        "after correction — the baseline association does not appear to hold generally. "
        "{restricted_to} Verdict: {verdict}."
    ),
    "no_significant_association": (
        "For the question \"{hypothesis_question}\", the cohort ({cohort_description}, "
        "n_intervention={n_intervention}, n_control={n_control}) showed an odds ratio of "
        "{odds_ratio} ({confidence_level}% CI {ci_low} to {ci_high}, {test_used}, p={p_value}), which does not "
        "clear conventional significance. No robustness checks were run against a "
        "non-significant baseline. Verdict: {verdict}."
    ),
    "insufficient_evidence": (
        "For the question \"{hypothesis_question}\", the cohort ({cohort_description}, "
        "n_intervention={n_intervention}, n_control={n_control}) was too small or too sparse "
        "to compute a reliable statistic or to run robustness checks against. Verdict: {verdict}."
    ),
}


def fill_narrative_deterministic(
    evidence: EvidenceInput,
    falsification: FalsificationRunResult,
    scorecard: Scorecard,
    verdict: str,
    restricted_to: Optional[str],
) -> str:
    slots = build_slots(evidence, falsification, scorecard, verdict, restricted_to)
    template = _TEMPLATES[verdict]
    return template.format(**slots)


def validate_no_invented_numbers(generated_text: str, slots: dict[str, str]) -> bool:
    """Rejects any generated sentence containing a number not present in the
    input slot values. This is the guardrail the guide says not to ship
    without — it's what stops an LLM rephrase from quietly inventing a
    different p-value or odds ratio."""
    allowed_numbers = set()
    for v in slots.values():
        allowed_numbers.update(_NUMBER_RE.findall(str(v)))

    found_numbers = _NUMBER_RE.findall(generated_text)
    for n in found_numbers:
        if n not in allowed_numbers:
            return False
    return True


def fill_narrative_via_llm(
    evidence: EvidenceInput,
    falsification: FalsificationRunResult,
    scorecard: Scorecard,
    verdict: str,
    restricted_to: Optional[str],
    llm_call: Callable[[str], str],
) -> str:
    """Constrained rephrase: the LLM receives ONLY the slot dict and an
    instruction to fill it into flowing prose — it is never given the
    templates above to imitate, and never allowed to introduce a number that
    isn't already in the slots. On any validation failure, falls back to the
    deterministic template rather than surfacing an unverified sentence.
    """
    slots = build_slots(evidence, falsification, scorecard, verdict, restricted_to)

    prompt = (
        "You are filling a clinical-evidence narrative from FIXED DATA SLOTS. "
        "Rephrase these slot values into 2-3 flowing sentences. "
        "Rules: (1) use ONLY the numbers given in the slots below, never compute, "
        "round differently, or introduce any other number; (2) do not add any claim, "
        "qualifier, or caveat not implied by the slots; (3) plain prose, no markdown.\n\n"
        f"SLOTS:\n{slots}\n\nNarrative:"
    )

    try:
        generated = llm_call(prompt).strip()
    except Exception:
        return fill_narrative_deterministic(evidence, falsification, scorecard, verdict, restricted_to)

    if not generated or not validate_no_invented_numbers(generated, slots):
        return fill_narrative_deterministic(evidence, falsification, scorecard, verdict, restricted_to)

    return generated
