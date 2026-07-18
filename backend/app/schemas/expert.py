"""Pydantic response schemas for the Experts page."""

from typing import Optional

from pydantic import BaseModel, Field


class HospitalBrief(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None


class ExpertCard(BaseModel):
    id: str
    full_name: str
    avatar_url: Optional[str] = None
    specialty: Optional[str] = None
    country: Optional[str] = None
    bio: Optional[str] = None
    orcid_id: Optional[str] = None
    verification_status: str
    hospital: Optional[HospitalBrief] = None

    cases_managed: int = 0
    publications: int = 0
    topics: list[str] = Field(default_factory=list)

    # Relative to the caller: 'none' | 'pending_sent' | 'pending_received' | 'connected'
    connection_status: str = "none"
    collaboration_id: Optional[str] = None


class ExpertDetail(ExpertCard):
    pass


class ExpertListResponse(BaseModel):
    items: list[ExpertCard]
    total: int


class ExpertFilterOptionsResponse(BaseModel):
    specialties: list[str]
    countries: list[str]


class NetworkActivityRow(BaseModel):
    doctor_id: str
    full_name: str
    hospital_name: Optional[str] = None
    focus_area: str
    cases_managed: int
    signal_strength_pct: int  # 0-100, normalised against the top contributor
    status: str  # profile verification_status, used as the badge in the table