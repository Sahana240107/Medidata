"""
audit_pack.py

Assembles the full computation trace (step, library, function, params,
result, timestamp) into one chronological audit pack: falsification engine's
own trace, plus the verdict-computation steps this engine adds on top.
Exportable as downloadable JSON or a flattened CSV — flattened meaning each
trace entry's nested `params`/`result` dicts are JSON-stringified into single
CSV cells rather than exploded into ragged columns, so the CSV opens cleanly
in Excel/Sheets with one row per step.
"""
from __future__ import annotations

import csv
import io
import json
import uuid
from datetime import datetime, timezone

from .schemas import AuditPack, VerdictResult
from ..falsification_engine.schemas import FalsificationRunResult


def assemble_audit_pack(
    verdict: VerdictResult,
    verdict_trace: list[dict],
    evidence_trace: list[dict] | None = None,
) -> AuditPack:
    """Chronological order: evidence steps (if the caller supplied any —
    Member 1's engine may log its own trace the same shape as this one),
    then every falsification step, then verdict-computation steps."""
    trace: list[dict] = []
    if evidence_trace:
        trace.extend(evidence_trace)
    trace.extend(verdict.falsification.audit_trace)
    trace.extend(verdict_trace)

    return AuditPack(
        audit_pack_id=str(uuid.uuid4()),
        verdict_id=verdict.verdict_id,
        trace=trace,
        generated_at=datetime.now(timezone.utc),
    )


def audit_pack_to_json(pack: AuditPack) -> str:
    return pack.model_dump_json(indent=2)


def audit_pack_to_csv(pack: AuditPack) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["step", "library", "function", "params", "result", "timestamp"])
    for entry in pack.trace:
        writer.writerow(
            [
                entry.get("step", ""),
                entry.get("library", ""),
                entry.get("function", ""),
                json.dumps(entry.get("params", {}), default=str),
                json.dumps(entry.get("result", {}), default=str),
                entry.get("timestamp", ""),
            ]
        )
    return buf.getvalue()
