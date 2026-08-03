"""
router.py — Verdict Engine

Exposes the four Member 2 verdict/audit-pack endpoints from the guide's API
table:

    POST /api/verdict/compute            evidence-shaped + falsification-shaped input -> verdict
    GET  /api/verdict/{id}                stored verdict + scorecard
    GET  /api/audit-pack/{id}              full audit trail, JSON
    GET  /api/audit-pack/{id}/download     downloadable audit bundle
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response

from .audit_pack import assemble_audit_pack, audit_pack_to_csv, audit_pack_to_json
from .schemas import AuditPack, EvidenceInput, VerdictResult
from .service import compute_verdict
from ..falsification_engine.schemas import FalsificationRunResult

router = APIRouter(prefix="/api", tags=["verdict-engine"])

_VERDICT_CACHE: dict[str, VerdictResult] = {}
_AUDIT_CACHE: dict[str, AuditPack] = {}
_VERDICT_TO_AUDIT: dict[str, str] = {}


class VerdictComputeRequest(EvidenceInput):
    """Body shape for POST /verdict/compute: the evidence fields flattened at
    the top level, plus the falsification result nested under `falsification`."""


@router.post("/verdict/compute", response_model=VerdictResult)
def compute(evidence: EvidenceInput, falsification: FalsificationRunResult) -> VerdictResult:
    verdict, trace = compute_verdict(evidence, falsification)
    _VERDICT_CACHE[verdict.verdict_id] = verdict

    pack = assemble_audit_pack(verdict, verdict_trace=trace)
    _AUDIT_CACHE[pack.audit_pack_id] = pack
    _VERDICT_TO_AUDIT[verdict.verdict_id] = pack.audit_pack_id

    return verdict


@router.get("/verdict/{verdict_id}", response_model=VerdictResult)
def get_verdict(verdict_id: str) -> VerdictResult:
    result = _VERDICT_CACHE.get(verdict_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"no stored verdict for verdict_id={verdict_id}")
    return result


@router.get("/audit-pack/{verdict_id}", response_model=AuditPack)
def get_audit_pack(verdict_id: str) -> AuditPack:
    audit_pack_id = _VERDICT_TO_AUDIT.get(verdict_id)
    pack = _AUDIT_CACHE.get(audit_pack_id) if audit_pack_id else None
    if pack is None:
        raise HTTPException(status_code=404, detail=f"no audit pack for verdict_id={verdict_id}")
    return pack


@router.get("/audit-pack/{verdict_id}/download")
def download_audit_pack(verdict_id: str, format: str = "json") -> Response:
    audit_pack_id = _VERDICT_TO_AUDIT.get(verdict_id)
    pack = _AUDIT_CACHE.get(audit_pack_id) if audit_pack_id else None
    if pack is None:
        raise HTTPException(status_code=404, detail=f"no audit pack for verdict_id={verdict_id}")

    if format == "csv":
        return Response(
            content=audit_pack_to_csv(pack),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=audit_pack_{verdict_id}.csv"},
        )
    return Response(
        content=audit_pack_to_json(pack),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=audit_pack_{verdict_id}.json"},
    )
