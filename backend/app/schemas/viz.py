"""
Visualization schemas.
"""

from typing import List, Optional

from pydantic import BaseModel


class FingerprintPoint(BaseModel):
    id: str
    x: float
    y: float
    label: str
    hospital_id: Optional[str] = None
    age_range: Optional[str] = None
    outcome: Optional[str] = None


class ClusterSummary(BaseModel):
    label: str
    count: int


class FingerprintSpaceResponse(BaseModel):
    points: List[FingerprintPoint]
    clusters: List[ClusterSummary]
    total: int
    explained_variance: List[float] = []