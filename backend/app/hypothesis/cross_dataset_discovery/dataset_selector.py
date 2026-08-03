"""
dataset_selector.py

Manual dataset selector: pick two or more disease/cohort groups by filter,
pull symptom/lab/medication sets for each directly from Supabase.

Reuses the same jsonb-extraction pattern already used elsewhere in this
codebase (app.services.clustering_service._extract_names) — symptoms/
lab_results/medications are jsonb lists of dicts with varying key names
(name/marker) depending on the field.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.db.supabase_client import get_supabase_admin

from .schemas import DatasetSelector, FieldType

_KEY_CANDIDATES: dict[FieldType, tuple[str, ...]] = {
    "symptoms": ("name",),
    "lab_results": ("marker",),
    "medications": ("name",),
}

CASE_FIELDS = "id, disease, hospital_id, country, symptoms, lab_results, medications, status"


@dataclass
class DatasetCase:
    id: str
    disease: str
    hospital_id: str
    country: str
    field_values: dict[FieldType, list[str]]  # e.g. {"symptoms": ["Fever", "Cough"], ...}


def _extract_values(case: dict, field_type: FieldType) -> list[str]:
    items = case.get(field_type) or []
    key_candidates = _KEY_CANDIDATES[field_type]
    values: list[str] = []
    for item in items:
        if isinstance(item, dict):
            for k in key_candidates:
                if item.get(k):
                    values.append(str(item[k]).strip())
                    break
        elif isinstance(item, str) and item.strip():
            values.append(item.strip())
    # de-dupe within a single case (a symptom listed twice shouldn't inflate
    # co-occurrence counts for that one case)
    seen = set()
    deduped = []
    for v in values:
        key = v.lower()
        if key not in seen:
            seen.add(key)
            deduped.append(v)
    return deduped


def fetch_dataset_cases(selector: DatasetSelector, field_types: list[FieldType]) -> list[DatasetCase]:
    """Pulls active cases matching one DatasetSelector and extracts the
    requested field types into name lists per case."""
    from app.core.disease_domains import classify_domain

    supabase = get_supabase_admin()
    query = supabase.table("cases").select(CASE_FIELDS).eq("status", "active")

    if selector.disease:
        query = query.ilike("disease", f"%{selector.disease}%")
    if selector.country:
        query = query.eq("country", selector.country)

    resp = query.execute()
    rows = resp.data or []

    if selector.domain and not selector.disease:
        rows = [r for r in rows if classify_domain(r.get("disease")) == selector.domain]

    return [
        DatasetCase(
            id=row["id"],
            disease=row.get("disease") or "Unclassified",
            hospital_id=row.get("hospital_id") or "",
            country=row.get("country") or "",
            field_values={ft: _extract_values(row, ft) for ft in field_types},
        )
        for row in rows
    ]


def fetch_baseline_distribution(field_types: list[FieldType]) -> tuple[dict[FieldType, dict[str, int]], int]:
    """Full-dataset (every active case, every disease) value -> case-count
    map per field type, plus the total case count — used as the denominator
    for `unusualness_score` in pattern_miner.py so a pattern's in-group
    frequency can be compared against how common it is dataset-wide."""
    supabase = get_supabase_admin()
    resp = supabase.table("cases").select(CASE_FIELDS).eq("status", "active").execute()
    rows = resp.data or []

    counts: dict[FieldType, dict[str, int]] = {ft: {} for ft in field_types}
    for row in rows:
        for ft in field_types:
            for value in set(v.lower() for v in _extract_values(row, ft)):
                counts[ft][value] = counts[ft].get(value, 0) + 1

    return counts, len(rows)