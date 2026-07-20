"""
Cross-node discovery broker router.

POST /discovery/query      -> issue a cross-institution cohort query; each
                               node approves/denies releasing its own
                               aggregate count — nothing row-level crosses
                               a node boundary.
GET  /discovery/audit-log  -> full history of cross-node queries and each
                               node's decision, for inspection.
"""

from typing import List

from fastapi import APIRouter, Depends, Query

from app.deps.auth import get_current_user
from app.schemas.discovery import AuditLogEntry, CrossNodeQueryRequest, CrossNodeQueryResponse
from app.services import discovery_broker_service

router = APIRouter(prefix="/discovery", tags=["discovery"])


@router.post("/query", response_model=CrossNodeQueryResponse)
async def cross_node_query(body: CrossNodeQueryRequest, user: dict = Depends(get_current_user)):
    return discovery_broker_service.run_cross_node_query(body, requested_by=user.get("id"))


@router.get("/audit-log", response_model=List[AuditLogEntry])
async def audit_log(limit: int = Query(50, ge=1, le=200), user: dict = Depends(get_current_user)):
    return discovery_broker_service.get_audit_log(limit=limit)