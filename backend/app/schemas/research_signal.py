"""
Pydantic schemas for the Discovery Feed (research_signals table).
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ResearchSignalRead(BaseModel):
    id: str
    signal_type: str           # 'emerging_syndrome' | 'drug_response' | 'biomarker' | 'research_opportunity'
    status: str                 # 'active' | 'validating' | 'published' | 'archived'

    title: str
    summary: str
    confidence: float

    case_count: int
    patient_count: Optional[int] = None
    hospital_count: int
    countries: List[str] = []
    participating_hospitals: List[str] = []
    tags: List[str] = []

    evidence_score: Optional[float] = None
    reproducibility_score: Optional[float] = None
    hospital_diversity_score: Optional[float] = None
    data_quality_score: Optional[float] = None

    created_at: datetime
    updated_at: datetime


class FeedListResponse(BaseModel):
    items: List[ResearchSignalRead]
    total: int
    limit: int
    offset: int
