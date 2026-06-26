"""
Pydantic schemas for the case intake + read endpoints.
Field shapes mirror the `cases` table jsonb columns exactly
(see supabase/migrations — symptoms/lab_results/medications/etc).
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class SymptomItem(BaseModel):
    name: str
    onset_day: Optional[int] = None


class LabResultItem(BaseModel):
    marker: str
    value: str
    flag: Optional[str] = None  # e.g. 'elevated' | 'low' | 'normal'


class MedicationItem(BaseModel):
    name: str
    response: Optional[str] = None  # e.g. 'partial' | 'none' | 'full'


class CaseCreate(BaseModel):
    age_range: Optional[str] = Field(None, description="Bucketed, e.g. '30-40' — never an exact DOB.")
    sex: Optional[str] = None
    country: Optional[str] = None

    symptoms: List[SymptomItem] = []
    lab_results: List[LabResultItem] = []
    medications: List[MedicationItem] = []
    procedures: List[str] = []
    imaging_metadata: List[dict] = []
    genomic_metadata: Optional[List[dict]] = []
    clinical_notes_summary: Optional[str] = None

    outcome: Optional[str] = None  # 'recovered' | 'deteriorated' | 'unresolved'
    local_patient_ref_hash: Optional[str] = Field(
        None,
        description="Hashed local pointer the hospital can map back to a patient internally. Never a raw ID.",
    )


class CaseRead(BaseModel):
    id: str
    hospital_id: str
    submitted_by: str
    fingerprint_id: str
    local_patient_ref_hash: Optional[str] = None

    age_range: Optional[str] = None
    sex: Optional[str] = None
    country: Optional[str] = None

    symptoms: List[SymptomItem] = []
    lab_results: List[LabResultItem] = []
    medications: List[MedicationItem] = []
    procedures: List[str] = []
    imaging_metadata: List[dict] = []
    genomic_metadata: Optional[List[dict]] = []
    clinical_notes_summary: Optional[str] = None

    outcome: Optional[str] = None
    status: str

    created_at: datetime
    updated_at: datetime
