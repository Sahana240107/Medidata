"""
Pydantic schemas for the case intake + read endpoints.

New schemas for the two-step process → preview → submit flow:
  ProcessRequest   — raw extracted dict sent to POST /cases/process
  ProcessResponse  — de-identified fingerprint + pipeline metadata returned for preview
  SubmitRequest    — confirmed fingerprint sent to POST /cases/submit

Legacy schema:
  CaseCreate       — one-shot de-identified payload for POST /cases
  CaseRead         — shape of a stored case row
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# Shared sub-models
# ─────────────────────────────────────────────────────────────────────────────

class SymptomItem(BaseModel):
    name: str
    onset_day: Optional[int] = None


class LabResultItem(BaseModel):
    marker: str
    value: str
    flag: Optional[str] = None  # 'elevated' | 'low' | 'normal'


class MedicationItem(BaseModel):
    name: str
    response: Optional[str] = None  # 'partial' | 'none' | 'full'


# ─────────────────────────────────────────────────────────────────────────────
# Pipeline transform step (Multi-Node Simulator — visible privacy pipeline)
# ─────────────────────────────────────────────────────────────────────────────

class PipelineStepDiff(BaseModel):
    removed: List[str] = []
    added: List[str] = []
    changed: List[str] = []


class PipelineStep(BaseModel):
    """One layer of the 6-layer privacy pipeline, with a before/after snapshot."""
    layer: str
    label: str
    before: Dict[str, Any]
    after: Dict[str, Any]
    diff: PipelineStepDiff


# ─────────────────────────────────────────────────────────────────────────────
# Two-step flow schemas
# ─────────────────────────────────────────────────────────────────────────────

class ProcessRequest(BaseModel):
    """
    Raw data from the autofill step (may still contain PII like name, dob, address).
    The privacy pipeline strips / generalises everything before returning the preview.
    """
    raw: Dict[str, Any] = Field(..., description="Raw extracted case data from /extract-pdf or manual entry.")
    node_id: Optional[str] = Field(
        None,
        description="Hospital/node context to process this case as, for the Multi-Node Simulator. "
                    "Defaults to the caller's own hospital.",
    )


class ProcessResponse(BaseModel):
    """Returned by POST /cases/process — shown to the doctor before they confirm."""
    fingerprint: Dict[str, Any] = Field(..., description="De-identified record ready for storage.")
    token_H: str = Field(..., description="Hospital-side split key for future traceback. Store locally — never sent to MediData.")
    layers_applied: List[str] = Field(..., description="Ordered list of privacy layers that were applied.")
    steps: List[PipelineStep] = Field(
        default_factory=list,
        description="Step-by-step before/after snapshot for each privacy layer, for the transform-view UI.",
    )


class SubmitRequest(BaseModel):
    """
    Sent by the frontend after the doctor reviews the fingerprint preview and clicks Confirm.
    Contains the exact fingerprint returned by /process plus the token_H.
    """
    fingerprint: Dict[str, Any]
    token_H: str
    node_id: Optional[str] = Field(
        None,
        description="Hospital/node context to submit this case into, for the Multi-Node Simulator. "
                    "Defaults to the caller's own hospital.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Legacy one-shot schema
# ─────────────────────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────────────────────
# Read schema
# ─────────────────────────────────────────────────────────────────────────────

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