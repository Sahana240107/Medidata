"""
backend/app/schemas/cli_sync.py

Request/response models for POST /api/cli/sync.

CLICaseIn mirrors CaseCreate but adds `fingerprint_id`, which the CLI
generates deterministically (HMAC of source_table:source_id, keyed by a
secret that never leaves the hospital) so the same local record synced
twice — e.g. after a retry — is recognized as a duplicate instead of
creating a second case. hospital_id/submitted_by are deliberately absent:
those are always resolved from the caller's JWT, never trusted from the
client payload.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from app.schemas.case import SymptomItem, LabResultItem, MedicationItem


class CLICaseIn(BaseModel):
    fingerprint_id: str

    age_range: Optional[str] = None
    sex: Optional[str] = None
    country: Optional[str] = None
    disease: Optional[str] = None
    diagnosis_icd: Optional[str] = None
    outcome: Optional[str] = None

    symptoms: List[SymptomItem] = []
    medications: List[MedicationItem] = []
    lab_results: List[LabResultItem] = []
    procedures: List[str] = []
    imaging_metadata: List[dict] = []
    genomic_metadata: Optional[List[dict]] = []
    clinical_notes_summary: Optional[str] = None

    local_patient_ref_hash: Optional[str] = None


class CLISyncRequest(BaseModel):
    cases: List[CLICaseIn]
    privacy_report: Dict[str, Any] = {}


class CLISyncResultItem(BaseModel):
    fingerprint_id: str
    case_id: Optional[str] = None
    reason: Optional[str] = None  # populated for rejected entries


class CLISyncResponse(BaseModel):
    accepted: List[CLISyncResultItem] = []
    duplicates: List[CLISyncResultItem] = []
    rejected: List[CLISyncResultItem] = []


class CLISyncLogRead(BaseModel):
    """One row of `cli_sync_logs` — a past `medidata sync` run for this hospital."""
    id: str
    submitted_by: str
    accepted_count: int = 0
    duplicate_count: int = 0
    rejected_count: int = 0
    created_at: str