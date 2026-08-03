"""
medidata/privacy/pii_removal.py

Layer 1 — PII removal.

Strips name, DOB, address, phone, and raw patient identifier from the
extracted record. Only clinically relevant fields survive past this point.
These are exactly the `patient_*` keys field_mapping.py pulls out solely
so this layer (and the tokenizer, for patient_identifier) can consume them
— they are never part of the payload sent to MediData.

Also runs a cheap regex safety net over the remaining free-text fields
(disease, outcome, symptoms, medications) in case a stray identifier
leaked into a clinical column on the hospital's side — mirrors the
backend's own deidentification_service.py guard, applied here first so
nothing suspicious even leaves the hospital network.
"""

from __future__ import annotations

import re

DIRECT_IDENTIFIER_FIELDS = [
    "patient_name",
    "patient_dob",
    "patient_address",
    "patient_phone",
    # patient_identifier is popped separately by tokenizer.py — it's
    # consumed to produce local_patient_ref_hash, not simply discarded.
]

_EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
_PHONE_RE = re.compile(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b")
_LONG_DIGIT_RE = re.compile(r"\b\d{6,}\b")  # MRNs, SSNs, full DOBs, etc.

_FREE_TEXT_FIELDS = ["disease", "outcome"]


class PIIRemovalWarning(list):
    """Collected list of suspicious-field warnings — never raises, just flags."""


def strip_direct_identifiers(record: dict) -> tuple[dict, list[str]]:
    """
    Removes DIRECT_IDENTIFIER_FIELDS in place.
    Returns (cleaned_record, list_of_fields_that_were_present_and_removed) —
    the count feeds the privacy report.
    """
    out = dict(record)
    removed = []
    for field in DIRECT_IDENTIFIER_FIELDS:
        if out.pop(field, None) not in (None, ""):
            removed.append(field)
    return out, removed


def _scan_text(text, field_name: str, warnings: list[str]) -> None:
    if not text:
        return
    text = str(text)
    if _EMAIL_RE.search(text):
        warnings.append(f"{field_name}: looks like it contains an email address")
    if _PHONE_RE.search(text):
        warnings.append(f"{field_name}: looks like it contains a phone number")
    if _LONG_DIGIT_RE.search(text):
        warnings.append(f"{field_name}: looks like it contains a long numeric identifier")


def scan_for_leaked_pii(record: dict) -> list[str]:
    """
    Safety-net scan over clinical free-text fields. Returns warnings
    (non-fatal) — callers should surface these prominently in the preview
    and privacy report rather than silently uploading a flagged record.
    """
    warnings: list[str] = []
    for field in _FREE_TEXT_FIELDS:
        _scan_text(record.get(field), field, warnings)
    for symptom in record.get("symptoms") or []:
        _scan_text(symptom, "symptoms", warnings)
    for med in record.get("medications") or []:
        _scan_text(med, "medications", warnings)
    return warnings


def apply(record: dict) -> tuple[dict, dict]:
    """
    Runs Layer 1 end to end. Returns (cleaned_record, stats) where stats is
    {"removed_fields": [...], "warnings": [...]} for the privacy report.
    """
    cleaned, removed = strip_direct_identifiers(record)
    warnings = scan_for_leaked_pii(cleaned)
    return cleaned, {"removed_fields": removed, "warnings": warnings}
