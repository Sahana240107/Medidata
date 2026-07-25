"""
medidata/validation.py

Phase 6 — validation & standardization.

Records failing validation are excluded from the batch and logged — never
silently dropped. Counts feed straight into the privacy report (Phase 9).
"""

from __future__ import annotations

import re

REQUIRED = ["age_range", "sex", "country", "disease", "diagnosis_icd"]

ICD10_PATTERN = re.compile(r"^[A-TV-Z][0-9][0-9AB](?:\.[0-9A-TV-Z]{1,4})?$", re.IGNORECASE)

VALID_SEX_VALUES = {"male", "female", "other", "unknown", "m", "f"}


def validate_record(record: dict) -> list[str]:
    errors = []

    for field in REQUIRED:
        if not record.get(field):
            errors.append(f"missing required field: {field}")

    diagnosis_icd = record.get("diagnosis_icd")
    if diagnosis_icd and not ICD10_PATTERN.match(str(diagnosis_icd).strip()):
        errors.append(f"diagnosis_icd '{diagnosis_icd}' is not valid ICD-10 format")

    age_range = record.get("age_range")
    if age_range and age_range == "unknown":
        errors.append("age_range could not be bucketed from source data (patient_age missing/invalid)")

    sex = record.get("sex")
    if sex and str(sex).strip().lower() not in VALID_SEX_VALUES:
        errors.append(f"sex '{sex}' is not one of the recognised values")

    return errors


def validate_batch(records: list[dict]) -> tuple[list[dict], list[dict]]:
    """
    Splits records into (valid, rejected). Each rejected entry is
    {"record": ..., "errors": [...]} so the privacy report can show exactly
    why each one was excluded.
    """
    valid, rejected = [], []
    for record in records:
        errors = validate_record(record)
        if errors:
            rejected.append({"record": record, "errors": errors})
        else:
            valid.append(record)
    return valid, rejected
