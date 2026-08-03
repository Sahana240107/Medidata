"""
Schemas for Cross-Dataset Discovery.

Independent of Member 1's own evidence_engine schemas on purpose — this
feature compares symptom/lab/medication SETS across two or more
disease/domain groups; it never derives an intervention/control split, so it
does not need CohortFilters at all.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

FieldType = Literal["symptoms", "lab_results", "medications"]


class DatasetSelector(BaseModel):
    """One disease/cohort group to include in the comparison. `label` is a
    free display name; falls back to disease/domain if not given."""

    disease: Optional[str] = None
    domain: Optional[str] = None
    country: Optional[str] = None
    label: Optional[str] = None

    @model_validator(mode="after")
    def _require_one_grouping(self):
        if not self.disease and not self.domain:
            raise ValueError("DatasetSelector requires at least one of `disease` or `domain`.")
        return self

    def display_label(self) -> str:
        return self.label or self.disease or self.domain or "unnamed dataset"


class CompareRequest(BaseModel):
    datasets: list[DatasetSelector] = Field(..., min_length=2, description="Two or more groups to compare.")
    field_types: list[FieldType] = Field(default_factory=lambda: ["symptoms", "lab_results", "medications"])
    top_n: int = Field(default=15, ge=1, le=100)
    min_datasets_sharing: int = Field(
        default=2, ge=2, description="A value must appear in at least this many selected datasets to count as an overlap."
    )


class OverlapItem(BaseModel):
    """One shared symptom/lab/medication value across two or more selected datasets."""

    field_type: FieldType
    value: str
    datasets_present: list[str]
    case_counts_by_dataset: dict[str, int]
    total_supporting_cases: int
    frequency_in_dataset: dict[str, float]  # value's prevalence within each dataset (0-1)
    baseline_frequency: float  # prevalence of this value across the FULL dataset (all diseases)
    unusualness_score: float  # how much higher the in-group frequency is vs. baseline


class CoOccurrencePair(BaseModel):
    """Two symptoms (or two labs) that co-occur within the same case, ranked
    by how often that pairing shows up across the selected datasets."""

    field_type: FieldType
    value_a: str
    value_b: str
    datasets_present: list[str]
    co_occurring_case_count: int
    co_occurrence_rate: float  # co-occurring cases / cases where at least one appears


class DiscoveryCard(BaseModel):
    """Ranked, frontend-ready surface of one cross-dataset pattern."""

    id: str
    kind: Literal["overlap", "co_occurrence"]
    pattern: str  # human-readable, e.g. "Elevated CRP shared across 3 datasets"
    field_type: FieldType
    supporting_case_count: int
    datasets_involved: list[str]
    unusualness_score: float
    rank: int


class CompareResult(BaseModel):
    compare_id: str
    datasets: list[str]
    overlaps: list[OverlapItem]
    co_occurrences: list[CoOccurrencePair]
    discovery_cards: list[DiscoveryCard]
    computed_at: datetime


class DiscoveryListResponse(BaseModel):
    discoveries: list[DiscoveryCard]