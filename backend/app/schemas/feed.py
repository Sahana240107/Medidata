"""
Pydantic schemas for the Discovery Feed.

ResearchSignalRead — shape of a row from research_signals.
FeedSignalsPage    — paginated response for GET /feed/signals (list page).
FeedStats          — the 4 stat cards at the top of the dashboard.
ScanResult         — response for POST /feed/scan.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ResearchSignalRead(BaseModel):
    id: str
    signal_type: str  # 'emerging_syndrome' | 'drug_response' | 'biomarker' | 'research_opportunity'
    status: str        # 'active' | 'validating' | 'published' | 'archived'

    title: str
    summary: str

    confidence: float

    case_count: int = 0
    patient_count: Optional[int] = None
    hospital_count: int = 0
    countries: List[str] = []
    participating_hospitals: List[str] = []
    tags: List[str] = []

    evidence_score: Optional[float] = None
    reproducibility_score: Optional[float] = None
    hospital_diversity_score: Optional[float] = None
    data_quality_score: Optional[float] = None

    created_at: datetime
    updated_at: datetime


class FeedSignalsPage(BaseModel):
    items: List[ResearchSignalRead]
    total: int


class FeedStats(BaseModel):
    matched_cases_global: int
    active_signals: int
    active_collaborations: int
    hospital_name: Optional[str] = None
    hospital_rank: Optional[int] = None


class ScanResult(BaseModel):
    cases_scanned: int
    clusters_found: int
    signals_created: int
    signals_updated: int