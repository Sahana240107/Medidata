"""
Cross-node discovery broker schemas.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CrossNodeQueryRequest(BaseModel):
    query_text: str = Field(..., description="Natural-language description of the cohort, shown in the audit log.")
    diagnosis_icd: Optional[str] = None
    symptom: Optional[str] = None
    medication: Optional[str] = None
    outcome: Optional[str] = None


class NodeQueryResult(BaseModel):
    hospital_id: str
    hospital_name: str
    status: str  # "approved" | "denied"
    reason: str
    released_count: Optional[int] = None


class CrossNodeQueryResponse(BaseModel):
    id: str
    query_text: str
    filters: Dict[str, Any]
    node_results: List[NodeQueryResult]
    aggregate_count: int
    participating_nodes: int
    approved_nodes: int
    created_at: datetime


class AuditLogEntry(BaseModel):
    id: str
    query_text: str
    filters: Dict[str, Any]
    node_results: List[NodeQueryResult]
    aggregate_count: int
    created_at: datetime