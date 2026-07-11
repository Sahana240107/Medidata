"""
De-identification guard.
The case schema only accepts bucketed/structured fields (age_range, not DOB;
no name fields at all), but this is a last line of defense against obvious
PII slipping into clinical_notes_summary or other free-text fields before
anything gets embedded or stored.
"""

import re

# Cheap heuristics — not a substitute for real PII detection, just a safety net.
_EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
_PHONE_RE = re.compile(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b")
_LONG_DIGIT_RE = re.compile(r"\b\d{6,}\b")  # MRNs, SSNs, full DOBs, etc.


class DeidentificationError(ValueError):
    pass


def check_text_for_pii(text: str, field_name: str = "field") -> None:
    """Raises DeidentificationError if obvious PII patterns are found."""
    if not text:
        return

    if _EMAIL_RE.search(text):
        raise DeidentificationError(f"{field_name} appears to contain an email address.")
    if _PHONE_RE.search(text):
        raise DeidentificationError(f"{field_name} appears to contain a phone number.")
    if _LONG_DIGIT_RE.search(text):
        raise DeidentificationError(
            f"{field_name} appears to contain a long numeric identifier "
            "(e.g. MRN, SSN, full date of birth)."
        )


def check_case_payload(case_data: dict) -> None:
    """Runs the PII guard over every free-text field of an incoming case."""
    check_text_for_pii(case_data.get("clinical_notes_summary"), "clinical_notes_summary")
    check_text_for_pii(case_data.get("local_patient_ref_hash"), "local_patient_ref_hash")

    for symptom in case_data.get("symptoms", []):
        check_text_for_pii(symptom.get("name", ""), "symptoms")
    for lab in case_data.get("lab_results", []):
        check_text_for_pii(lab.get("marker", ""), "lab_results")
        check_text_for_pii(str(lab.get("value", "")), "lab_results")
    for med in case_data.get("medications", []):
        check_text_for_pii(med.get("name", ""), "medications")
