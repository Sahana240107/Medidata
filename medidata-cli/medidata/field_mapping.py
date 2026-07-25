"""
medidata/field_mapping.py

Phase 5 — schema-agnostic extraction.

Every hospital's MySQL schema differs, so column names are never hardcoded
here. A per-hospital YAML mapping (see mapping.example.yaml) drives
extraction, so onboarding a new hospital is a config change, not a code
change.
"""

from __future__ import annotations

from pathlib import Path
from datetime import datetime, date

import yaml


# ─── transforms ─────────────────────────────────────────────────────────

import json as _json


def _bucket_age(value) -> str | None:
    if value in (None, ""):
        return None
    try:
        age = int(value)
    except (TypeError, ValueError):
        return None
    buckets = [(0, 10), (11, 20), (21, 30), (31, 40), (41, 50), (51, 60), (61, 70), (71, 120)]
    for lo, hi in buckets:
        if lo <= age <= hi:
            return f"{lo}-{hi}"
    return "unknown"


def _coerce_json_list(value):
    """
    mysql-connector-python returns JSON columns as raw text, not parsed
    Python lists — so a JSON array column arrives here as e.g.
    '["Rituximab","Daunorubicin"]', not ["Rituximab","Daunorubicin"]. Parse
    it if it looks like JSON; otherwise leave as-is for the caller to
    fall back on comma-splitting a genuinely plain string column.
    """
    if isinstance(value, (list, tuple)):
        return list(value)
    if isinstance(value, str):
        text = value.strip()
        if text.startswith("[") or text.startswith("{"):
            try:
                parsed = _json.loads(text)
                return parsed if isinstance(parsed, list) else [parsed]
            except (ValueError, TypeError):
                return None
    return None


def _split_csv(value) -> list[str]:
    if value in (None, ""):
        return []
    parsed = _coerce_json_list(value)
    if parsed is not None:
        return [str(v).strip() for v in parsed if str(v).strip()]
    return [part.strip() for part in str(value).split(",") if part.strip()]


def _extract_names(value) -> list[str]:
    """
    For JSON-array-of-objects columns like
    [{"name": "Weight loss", "icd_code": "R63.4"}, ...] — pulls out just
    the `.name` of each object. Falls back to `_split_csv` if the column
    turns out to be a flat list/CSV string instead.
    """
    if value in (None, ""):
        return []
    parsed = _coerce_json_list(value)
    if parsed is None:
        return _split_csv(value)
    out = []
    for item in parsed:
        if isinstance(item, dict):
            name = item.get("name")
            if name:
                out.append(str(name))
        elif item:
            out.append(str(item))
    return out


def _to_iso_date(value) -> str | None:
    if value in (None, ""):
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def _identity(value):
    return value


TRANSFORMS = {
    "bucket_age": _bucket_age,
    "split_csv": _split_csv,
    "extract_names": _extract_names,
    "to_iso_date": _to_iso_date,
    "identity": _identity,
}


# ─── mapping load + extract ─────────────────────────────────────────────

def load_mapping(path: str | Path) -> dict:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(
            f"Field mapping file not found: {path}. Copy mapping.example.yaml "
            f"and adjust it to your hospital's schema."
        )
    with open(path, "r") as f:
        mapping = yaml.safe_load(f)

    if "source_table" not in mapping or "field_map" not in mapping:
        raise ValueError("mapping file must define at least source_table and field_map")

    return mapping


def extract_record(raw_row: dict, mapping: dict) -> dict:
    """
    Applies mapping["field_map"] to a raw MySQL row, returning a dict keyed
    by MediData field names. Fields that don't appear in the source row are
    simply absent from the output (validation, Phase 6, catches anything
    required that's missing).
    """
    out: dict = {}
    for target_field, spec in mapping["field_map"].items():
        val = raw_row.get(spec["source"])
        transform_name = spec.get("transform")
        if transform_name:
            transform = TRANSFORMS.get(transform_name, _identity)
            val = transform(val)
        out[target_field] = val
    return out


def to_case_payload(record: dict, fingerprint_id: str) -> dict:
    """
    Reshapes a fully privacy-processed record into the shape the backend's
    /api/cli/sync endpoint (and case_service.py) expects — matching
    CaseCreate/SymptomItem/MedicationItem in the existing schema.
    Structured lab_results/procedures/imaging aren't sourced from most
    hospital MySQL schemas, so they default empty unless mapping.yaml adds
    them later.
    """
    symptoms = record.get("symptoms") or []
    medications = record.get("medications") or []

    return {
        "fingerprint_id": fingerprint_id,
        "age_range": record.get("age_range"),
        "sex": record.get("sex"),
        "country": record.get("country"),
        "disease": record.get("disease"),
        "diagnosis_icd": record.get("diagnosis_icd"),
        "outcome": record.get("outcome"),
        "symptoms": [{"name": s} for s in symptoms],
        "medications": [{"name": m} for m in medications],
        "lab_results": [],
        "procedures": [],
        "imaging_metadata": [],
        "genomic_metadata": [],
        "clinical_notes_summary": None,
        "local_patient_ref_hash": record.get("local_patient_ref_hash"),
        "length_of_stay_days": record.get("length_of_stay_days"),
    }