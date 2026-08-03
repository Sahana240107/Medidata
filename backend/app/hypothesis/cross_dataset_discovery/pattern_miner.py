"""
pattern_miner.py

Overlap computation: shared symptoms/labs/medications across the selected
groups, ranked by frequency and by how unusual the overlap is versus the
full-dataset baseline.

unusualness_score = (average in-group frequency) / (baseline frequency),
i.e. "how many times more common is this value inside the selected groups
than across the whole dataset". A value present in every selected dataset
but also common everywhere (e.g. "Fatigue") scores low; a value shared
across groups but rare dataset-wide scores high — that's the actually
interesting cross-dataset signal.
"""
from __future__ import annotations

from collections import defaultdict

from .dataset_selector import DatasetCase
from .schemas import DatasetSelector, FieldType, OverlapItem

# Baseline frequency floor so a value that happens to be baseline-absent
# doesn't produce a divide-by-zero / infinite unusualness score.
_BASELINE_FLOOR = 1e-4


def compute_overlaps(
    datasets: list[DatasetSelector],
    cases_by_dataset: dict[str, list[DatasetCase]],
    field_types: list[FieldType],
    baseline_counts: dict[FieldType, dict[str, int]],
    baseline_total: int,
    min_datasets_sharing: int,
    top_n: int,
) -> list[OverlapItem]:
    labels = [d.display_label() for d in datasets]
    overlaps: list[OverlapItem] = []

    for field_type in field_types:
        # value(lower) -> {label: {case_ids}}
        presence: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
        # value(lower) -> original-cased display value (first seen wins)
        display_value: dict[str, str] = {}

        for label, cases in cases_by_dataset.items():
            for case in cases:
                for value in case.field_values.get(field_type, []):
                    key = value.lower()
                    display_value.setdefault(key, value)
                    presence[key][label].add(case.id)

        for key, per_dataset_case_ids in presence.items():
            datasets_present = [lbl for lbl in labels if lbl in per_dataset_case_ids]
            if len(datasets_present) < min_datasets_sharing:
                continue

            case_counts_by_dataset = {lbl: len(per_dataset_case_ids[lbl]) for lbl in datasets_present}
            total_supporting_cases = sum(case_counts_by_dataset.values())

            frequency_in_dataset = {}
            for lbl in datasets_present:
                dataset_size = len(cases_by_dataset[lbl])
                frequency_in_dataset[lbl] = (
                    case_counts_by_dataset[lbl] / dataset_size if dataset_size else 0.0
                )

            baseline_freq = max(
                baseline_counts.get(field_type, {}).get(key, 0) / baseline_total if baseline_total else 0.0,
                _BASELINE_FLOOR,
            )
            avg_in_group_freq = sum(frequency_in_dataset.values()) / len(frequency_in_dataset)
            unusualness_score = round(avg_in_group_freq / baseline_freq, 3)

            overlaps.append(
                OverlapItem(
                    field_type=field_type,
                    value=display_value[key],
                    datasets_present=datasets_present,
                    case_counts_by_dataset=case_counts_by_dataset,
                    total_supporting_cases=total_supporting_cases,
                    frequency_in_dataset={k: round(v, 4) for k, v in frequency_in_dataset.items()},
                    baseline_frequency=round(baseline_freq, 6),
                    unusualness_score=unusualness_score,
                )
            )

    overlaps.sort(key=lambda o: (o.unusualness_score, o.total_supporting_cases), reverse=True)
    return overlaps[:top_n]