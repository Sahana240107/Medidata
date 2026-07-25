"""
service.py — Verdict Engine

Orchestrates: decision_rules -> scorecard -> narrative -> (on request)
audit_pack. One function the router calls, mirroring falsification_engine's
service.py shape.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Callable, Optional

from .decision_rules import apply_decision_rules
from .narrative_templates import fill_narrative_deterministic, fill_narrative_via_llm
from .scorecard import build_scorecard
from .schemas import EvidenceInput, VerdictResult
from ..falsification_engine.schemas import FalsificationRunResult


def compute_verdict(
    evidence: EvidenceInput,
    falsification: FalsificationRunResult,
    llm_call: Optional[Callable[[str], str]] = None,
) -> tuple[VerdictResult, list[dict]]:
    """Returns (verdict, verdict_computation_trace) — the trace is returned
    separately so router.py can hand it straight to audit_pack.py without
    recomputing anything."""
    trace: list[dict] = []
    ts = lambda: datetime.now(timezone.utc).isoformat()

    verdict_label, restricted_to, rule_fired = apply_decision_rules(evidence, falsification)
    trace.append(
        {
            "step": "apply_decision_rules",
            "library": "local",
            "function": "decision_rules.apply_decision_rules",
            "params": {"evidence": evidence.model_dump(), "falsification_run_id": falsification.run_id},
            "result": {"verdict": verdict_label, "restricted_to": restricted_to, "rule_fired": rule_fired},
            "timestamp": ts(),
        }
    )

    scorecard = build_scorecard(evidence, falsification)
    trace.append(
        {
            "step": "build_scorecard",
            "library": "local",
            "function": "scorecard.build_scorecard",
            "params": {"rubric_version": scorecard.rubric_version},
            "result": scorecard.model_dump(),
            "timestamp": ts(),
        }
    )

    if llm_call is not None:
        narrative = fill_narrative_via_llm(evidence, falsification, scorecard, verdict_label, restricted_to, llm_call)
        narrative_method = "llm_constrained_slot_fill"
    else:
        narrative = fill_narrative_deterministic(evidence, falsification, scorecard, verdict_label, restricted_to)
        narrative_method = "deterministic_template"

    trace.append(
        {
            "step": "fill_narrative",
            "library": "local",
            "function": f"narrative_templates.{narrative_method}",
            "params": {"verdict": verdict_label},
            "result": {"narrative": narrative},
            "timestamp": ts(),
        }
    )

    result = VerdictResult(
        verdict_id=str(uuid.uuid4()),
        verdict=verdict_label,
        restricted_to=restricted_to,
        rule_fired=rule_fired,
        scorecard=scorecard,
        narrative=narrative,
        evidence=evidence,
        falsification=falsification,
        computed_at=datetime.now(timezone.utc),
    )
    return result, trace
