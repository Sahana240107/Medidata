"""
local_cohort_builder.py

Member 2's OWN copy of cohort-building logic. Deliberately duplicated rather
than imported from Member 1 — per the Independence Checklist, Member 2 pulls
its own cohort directly from Supabase (here: from whatever `case_source`
callable is injected) so this engine never blocks on, or breaks because of,
Member 1's code.

Public API:
    normalize_outcome(raw: str) -> "favorable" | "unfavorable" | "ongoing" | "unclassified"
    medication_match(medications_field: str, drug: str) -> bool
    build_cohort(filters, cases) -> CohortBuildResult
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Iterable

from .schemas import CohortFilters

_SHARED_CONFIG_PATH = (
    # NOTE: this engine now lives at app/hypothesis/falsification_engine/
    # (the old app/hypothesis/member2/ level was removed), so shared_config
    # is one level up, not two. parents[0]=falsification_engine, parents[1]=hypothesis.
    Path(__file__).resolve().parents[1] / "shared_config" / "outcome_mapping.json"
)


@dataclass
class CaseRow:
    """Minimal shape this engine needs from a `cases` record. Field names match
    the Supabase schema exactly so swapping the data source is a non-event."""

    id: str
    disease: str
    domain: str
    hospital: str
    country: str
    sex: str
    age_range: str
    medications: str
    outcome: str
    created_at: str  # ISO 8601 string; parsed lazily where needed


@dataclass
class CohortBuildResult:
    intervention_ids: list[str]
    control_ids: list[str]
    excluded_ids: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def _load_outcome_mapping() -> dict:
    with open(_SHARED_CONFIG_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)
    # Sort each bucket's patterns longest-first so specific phrases
    # ("stable after cycle") are checked before generic ones ("stable").
    mapping = {}
    for bucket in ("favorable", "unfavorable", "ongoing"):
        patterns = sorted(raw[bucket]["patterns"], key=len, reverse=True)
        mapping[bucket] = patterns
    return mapping


_OUTCOME_MAPPING = _load_outcome_mapping()


def normalize_outcome(raw: str) -> str:
    """Bucket a free-text outcome string into favorable/unfavorable/ongoing/unclassified.

    Matching is case-insensitive substring, checked longest-pattern-first
    within each bucket, favorable/unfavorable/ongoing checked in that fixed
    order per shared_config/outcome_mapping.json.
    """
    if not raw:
        return "unclassified"
    text = raw.strip().lower()
    for bucket in ("favorable", "unfavorable", "ongoing"):
        for pattern in _OUTCOME_MAPPING[bucket]:
            if pattern in text:
                return bucket
    return "unclassified"


_PAREN_SUFFIX = re.compile(r"\s*\([^)]*\)\s*$")


def _split_delimited_field(field_value: str) -> list[str]:
    """Splits a `;`-delimited field and strips trailing ' (unit/dose/status)' suffixes."""
    if not field_value:
        return []
    parts = [p.strip() for p in field_value.split(";") if p.strip()]
    return [_PAREN_SUFFIX.sub("", p).strip() for p in parts]


def medication_match(medications_field: str, drug: str) -> bool:
    """True if `drug` (case-insensitive substring) appears among the case's
    semicolon-delimited medication entries, ignoring dose/status parentheticals."""
    if not drug:
        return False
    drug_lower = drug.strip().lower()
    for entry in _split_delimited_field(medications_field):
        if drug_lower in entry.lower():
            return True
    return False


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
    if filters.hospital and filters.hospital.strip().lower() not in (row.hospital or "").strip().lower():
        return False
    if filters.sex and filters.sex.strip().lower() != (row.sex or "").strip().lower():
        return False
    if filters.age_range and filters.age_range.strip() != (row.age_range or "").strip():
        return False
    return True


def build_cohort(
    filters: CohortFilters,
    cases: Iterable[CaseRow],
) -> CohortBuildResult:
    """CohortFilters -> intervention/control case_id lists.

    A case enters the base cohort if it matches disease/domain + optional
    demographic/site filters. Within that base cohort:
      - intervention arm: `medications` contains `intervention_medication`
      - control arm: contains `control_medication` if given, else "everyone
        else in the base cohort who does NOT contain the intervention drug"
      - a case matching neither definition (e.g. it doesn't have
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
