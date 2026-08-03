"""
Hospital / Node schemas — the Multi-Node Simulator's node registry, plus
the richer "Hospital Insights" page schemas (network overview + the
caller's own hospital profile, stats, achievements, and recent activity).
"""

from typing import Optional, List

from pydantic import BaseModel


class HospitalNode(BaseModel):
    id: str
    name: str
    city: Optional[str] = None
    country: Optional[str] = None
    case_count: int = 0


# ── Hospital Insights page ───────────────────────────────────────────────────

class NetworkOverview(BaseModel):
    total_hospitals: int = 0
    verified_hospitals: int = 0
    total_cases: int = 0
    total_discoveries: int = 0          # sum of disease + syndrome discoveries, latest metrics
    total_collaborations: int = 0       # count of collaboration rows network-wide
    countries_count: int = 0


class LeaderboardEntry(BaseModel):
    rank: int
    id: str
    name: str
    country: Optional[str] = None
    discovery_score: float = 0
    case_count: int = 0
    is_mine: bool = False


class FootprintEntry(BaseModel):
    country: str
    hospital_count: int
    case_count: int
    is_mine: bool = False


class HospitalMetricsOut(BaseModel):
    disease_discoveries: int = 0
    published_collaborations: int = 0
    emerging_syndrome_identifications: int = 0
    collaboration_score: float = 0
    research_impact_score: float = 0
    validation_score: float = 0
    recorded_at: Optional[str] = None


class NetworkAverages(BaseModel):
    discovery_score: float = 0
    case_count: float = 0
    collaboration_score: float = 0
    research_impact_score: float = 0
    validation_score: float = 0


class Achievement(BaseModel):
    key: str
    label: str
    description: str
    icon: str
    unlocked: bool = False
    progress_label: Optional[str] = None  # e.g. "3 of 5" for near-miss badges


class ActivityItem(BaseModel):
    type: str            # "case" | "collaboration" | "validation"
    title: str
    detail: Optional[str] = None
    timestamp: str


class HospitalProfile(BaseModel):
    id: str
    name: str
    city: Optional[str] = None
    country: Optional[str] = None
    verification_status: Optional[str] = None
    discovery_score: float = 0
    global_rank: Optional[int] = None
    case_count: int = 0
    metrics: HospitalMetricsOut = HospitalMetricsOut()
    network_avg: NetworkAverages = NetworkAverages()
    achievements: List[Achievement] = []
    recent_activity: List[ActivityItem] = []


class HospitalInsightsResponse(BaseModel):
    network: NetworkOverview = NetworkOverview()
    leaderboard: List[LeaderboardEntry] = []
    footprint: List[FootprintEntry] = []
    hospital: Optional[HospitalProfile] = None