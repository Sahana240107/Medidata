"""
cohort_builder.py

CohortFilters -> intervention/control case_id lists, built directly from
Supabase `cases` rows. Pure function over an injected iterable of CaseRow so
it is fully testable on day one against a hardcoded CohortFilters + a
hand-built list of CaseRow, with zero network calls.

Real fetch of CaseRow objects lives in `_fetch_case_rows()` below and talks
to Supabase directly — this engine never calls Member 2 or Member 3's code.

Public API:
    medication_match(medications_field, drug) -> bool
    build_cohort(filters, cases) -> CohortBuildResult
    fetch_cases_for_cohort(filters) -> list[CaseRow]   # the real Supabase read
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

from app.core.disease_domains import classify_domain
from app.db.supabase_client import get_supabase_admin

from .schemas import CohortFilters

CASE_FIELDS = (
    "id, disease, hospital_id, country, sex, age_range, medications, outcome, "
    "status, created_at"
)


@dataclass
class CaseRow:
    """Minimal shape this engine needs from a `cases` record. `domain` is not
    a real column — it's derived via app.core.disease_domains.classify_domain
    the same way the rest of the codebase (dataset_service, clustering_service)
    already does, so grouping stays consistent app-wide."""

    id: str
    disease: str
    domain: str
    hospital_id: str
    country: str
    sex: str
    age_range: str
    medications: list  # jsonb: list[dict] like {"name": "...", "response": "..."}
    outcome: str
    created_at: str


@dataclass
class CohortBuildResult:
    intervention_ids: list[str]
    control_ids: list[str]
    excluded_ids: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def _extract_medication_names(medications_field) -> list[str]:
    """`medications` is a jsonb list of dicts (e.g. {"name": "Pantoprazole",
    "response": "good response"}) in the real schema, but this helper also
    accepts a bare list of strings or a legacy ';'-delimited string so the
    engine degrades gracefully against odd rows instead of crashing."""
    if not medications_field:
        return []
    if isinstance(medications_field, str):
        return [p.strip() for p in medications_field.split(";") if p.strip()]
    names = []
    for item in medications_field:
        if isinstance(item, dict):
            name = item.get("name")
            if name:
                names.append(str(name).strip())
        elif isinstance(item, str) and item.strip():
            names.append(item.strip())
    return names


def medication_match(medications_field, drug: str) -> bool:
    """True if `drug` (case-insensitive substring) appears among the case's
    medication entries, regardless of whether the field arrived as jsonb
    dicts or a delimited string."""
    if not drug:
        return False
    drug_lower = drug.strip().lower()
    return any(drug_lower in entry.lower() for entry in _extract_medication_names(medications_field))


def _matches_disease_or_domain(row: CaseRow, filters: CohortFilters) -> bool:
    if filters.disease:
        if filters.disease.strip().lower() not in (row.disease or "").strip().lower():
            return False
    if filters.domain:
        if filters.domain.strip().lower() not in (row.domain or "").strip().lower():
            return False
    return True


def _matches_optional_filters(row: CaseRow, filters: CohortFilters) -> bool:
    if filters.country and filters.country.strip().lower() != (row.country or "").strip().lower():
        return False
    if filters.hospital_id and filters.hospital_id != row.hospital_id:
        return False
    if filters.sex and filters.sex.strip().lower() != (row.sex or "").strip().lower():
        return False
    if filters.age_range and filters.age_range.strip() != (row.age_range or "").strip():
        return False
    return True


def build_cohort(filters: CohortFilters, cases: Iterable[CaseRow]) -> CohortBuildResult:
    """CohortFilters -> intervention/control case_id lists.

    A case enters the base cohort if it matches disease/domain + optional
    demographic/site filters. Within that base cohort:
      - intervention arm: `medications` contains `intervention_medication`
      - control arm: contains `control_medication` if given, else "everyone
        else in the base cohort who does NOT contain the intervention drug"
      - a case matching neither definition (it doesn't have
        `control_medication` when one is specified, and isn't the
        intervention drug either) is excluded, not silently dropped into
        control — this avoids diluting the control arm with irrelevant cases.
    """
    intervention_ids: list[str] = []
    control_ids: list[str] = []
    excluded_ids: list[str] = []
    notes: list[str] = []

    base_cohort = [
        row
        for row in cases
        if _matches_disease_or_domain(row, filters) and _matches_optional_filters(row, filters)
    ]
    notes.append(f"base cohort size after disease/domain + demographic filters: {len(base_cohort)}")

    for row in base_cohort:
        is_intervention = medication_match(row.medications, filters.intervention_medication)
        if is_intervention:
            intervention_ids.append(row.id)
            continue
        if filters.control_medication:
            if medication_match(row.medications, filters.control_medication):
                control_ids.append(row.id)
            else:
                excluded_ids.append(row.id)
        else:
            control_ids.append(row.id)

    if not intervention_ids:
        notes.append(
            f"no cases in base cohort matched intervention_medication='{filters.intervention_medication}'"
        )
    if not control_ids:
        notes.append("control arm is empty")

    return CohortBuildResult(
        intervention_ids=intervention_ids,
        control_ids=control_ids,
        excluded_ids=excluded_ids,
        notes=notes,
    )


def fetch_cases_for_cohort(filters: CohortFilters) -> list[CaseRow]:
    """The real Supabase read. Pulls active cases with a coarse pre-filter
    (disease/country/sex/age_range/hospital_id pushed down as `.eq`/`.ilike`
    where present) then lets `build_cohort` do the exact matching in Python —
    keeps this function simple and lets `domain` matching (which has no real
    column) happen client-side via classify_domain.
    """
    supabase = get_supabase_admin()
    query = supabase.table("cases").select(CASE_FIELDS).eq("status", "active")

    if filters.disease:
        query = query.ilike("disease", f"%{filters.disease}%")
    if filters.country:
        query = query.eq("country", filters.country)
    if filters.sex:
        query = query.eq("sex", filters.sex)
    if filters.age_range:
        query = query.eq("age_range", filters.age_range)
    if filters.hospital_id:
        query = query.eq("hospital_id", filters.hospital_id)

    resp = query.execute()
    rows = resp.data or []

    return [
        CaseRow(
            id=row["id"],
            disease=row.get("disease") or "Unclassified",
            domain=classify_domain(row.get("disease")),
            hospital_id=row.get("hospital_id") or "",
            country=row.get("country") or "",
            sex=row.get("sex") or "",
            age_range=row.get("age_range") or "",
            medications=row.get("medications") or [],
            outcome=row.get("outcome") or "",
            created_at=row.get("created_at") or "",
        )
        for row in rows
    ]