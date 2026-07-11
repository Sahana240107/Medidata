"""
Search schemas.
Request/response contracts for POST /search — the Global Case Search feature.

One endpoint, multiple "tabs" (result_type): similar_cases (default/"all"),
matching_experts, research_signals, clinical_trials, biomarkers. The
response always echoes result_type so the frontend knows which panel's
fields are populated — the rest are left as empty defaults rather than
using separate endpoints/response shapes per tab.
"""

from typing import Optional, List
from pydantic import BaseModel, Field


# ── Request ──────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    result_type: Optional[str] = "all"
    # all | similar_cases | matching_experts | research_signals | clinical_trials | biomarkers
    regions: Optional[List[str]] = None
    specialties: Optional[List[str]] = None
    outcomes: Optional[List[str]] = None
    confidence_tiers: Optional[List[str]] = None  # very_high | high | moderate | low
    limit: Optional[int] = 5   # how many case-cluster cards to return on the search page
    offset: Optional[int] = 0  # used by the "all cases" full-list page for pagination


# ── Shared sub-objects (cases tab) ───────────────────────────────────────────

class TimelineEvent(BaseModel):
    day: int
    label: str
    category: Optional[str] = None
    source: Optional[str] = None  # "recorded" | "estimated" — recorded = case_timeline_events row


class CaseClusterResult(BaseModel):
    cluster_id: str
    match_score: float
    confidence_tier: str
    hospital_name: str
    country: Optional[str] = None
    country_code: Optional[str] = None
    specialty: Optional[str] = None
    managing_doctor: Optional[str] = None
    case_count: int
    outcome_tags: List[str] = []
    timeline: List[TimelineEvent] = []
    is_own_hospital: bool = False
    representative_case_id: Optional[str] = None

    # Real per-case detail for the card detail panel (timeline / symptom /
    # lab / procedure tabs) — sourced from the representative case's Qdrant
    # payload + Supabase row, not mocked on the frontend.
    disease_name: Optional[str] = None
    symptoms: List[str] = []
    lab_results: List[str] = []
    procedures: List[str] = []


class SharedSignature(BaseModel):
    symptoms: List[str] = []
    lab_findings: List[str] = []
    treatment_outcomes: List[str] = []


class OutcomeBreakdown(BaseModel):
    label: str
    count: int
    color: str = "lavender"


class OutcomeIntelligence(BaseModel):
    matched_case_count: int = 0
    breakdown: List[OutcomeBreakdown] = []
    most_effective_drug: Optional[str] = None
    most_effective_drug_success_rate: Optional[float] = None
    most_effective_drug_hospital_count: Optional[int] = None


class FacetCount(BaseModel):
    value: str
    label: str
    count: int


class SearchFacets(BaseModel):
    confidence: List[FacetCount] = []
    region: List[FacetCount] = []
    specialty: List[FacetCount] = []
    outcome: List[FacetCount] = []


# ── Matching Experts tab ─────────────────────────────────────────────────────

class ExpertResult(BaseModel):
    doctor_name: str
    specialty: Optional[str] = None
    hospital_name: Optional[str] = None
    country: Optional[str] = None
    matched_case_count: int
    is_own_hospital: bool = False


# ── Research Signals tab ─────────────────────────────────────────────────────

class ResearchSignalResult(BaseModel):
    id: str
    title: str
    signal_type: Optional[str] = None
    description: Optional[str] = None
    matching_case_count: int = 0
    participating_hospital_count: int = 0
    countries: List[str] = []
    confidence_score: Optional[float] = None
    status: Optional[str] = None


# ── Clinical Trials tab (live ClinicalTrials.gov lookup) ────────────────────

class ClinicalTrialResult(BaseModel):
    nct_id: str
    title: str
    status: Optional[str] = None
    phase: Optional[str] = None
    conditions: List[str] = []
    locations: List[str] = []
    url: str


# ── Biomarkers tab ───────────────────────────────────────────────────────────

class BiomarkerResult(BaseModel):
    marker: str
    frequency: int
    matched_case_percentage: float
    associated_diseases: List[str] = []


# ── Response ─────────────────────────────────────────────────────────────────

class SearchResponse(BaseModel):
    query: str
    result_type: str = "all"
    interpreted_intent: str
    total_cases_found: int = 0
    total_clusters: int = 0
    countries_count: int = 0

    results: List[CaseClusterResult] = []
    shared_signature: SharedSignature = SharedSignature()
    outcome_intelligence: OutcomeIntelligence = OutcomeIntelligence()
    facets: SearchFacets = SearchFacets()

    experts: List[ExpertResult] = []
    research_signals_list: List[ResearchSignalResult] = []
    clinical_trials: List[ClinicalTrialResult] = []
    clinical_trials_error: Optional[str] = None
    biomarkers: List[BiomarkerResult] = []