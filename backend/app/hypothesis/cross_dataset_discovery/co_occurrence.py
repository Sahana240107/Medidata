"""
co_occurrence.py

Symptom (or lab, or medication) co-occurrence stats across the selected
datasets: for every pair of values that appear together within the same
case, how often does that pairing happen, and in how many of the selected
datasets does it show up at all.

Deliberately independent of pattern_miner.py's single-value overlap logic —
a pair can be a strong co-occurrence signal even if neither value alone
clears the overlap threshold.
"""
from __future__ import annotations

from collections import defaultdict
from itertools import combinations

from .dataset_selector import DatasetCase
from .schemas import CoOccurrencePair, DatasetSelector, FieldType


def compute_co_occurrences(
    datasets: list[DatasetSelector],
    cases_by_dataset: dict[str, list[DatasetCase]],
    field_types: list[FieldType],
    min_datasets_sharing: int,
    top_n: int,
) -> list[CoOccurrencePair]:
    labels = [d.display_label() for d in datasets]
    pairs: list[CoOccurrencePair] = []

    for field_type in field_types:
        # (value_a_lower, value_b_lower) -> {label: set(case_ids)}
        pair_presence: dict[tuple[str, str], dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
        # value_lower -> {label: set(case_ids)} — needed for the denominator
        single_presence: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
        display_value: dict[str, str] = {}

        for label, cases in cases_by_dataset.items():
            for case in cases:
                values = case.field_values.get(field_type, [])
                for v in values:
                    key = v.lower()
                    display_value.setdefault(key, v)
                    single_presence[key][label].add(case.id)

                for a, b in combinations(sorted(set(v.lower() for v in values)), 2):
                    pair_presence[(a, b)][label].add(case.id)

        for (key_a, key_b), per_dataset_case_ids in pair_presence.items():
            datasets_present = [lbl for lbl in labels if lbl in per_dataset_case_ids]
            if len(datasets_present) < min_datasets_sharing:
                continue

            co_occurring_case_count = sum(len(ids) for ids in per_dataset_case_ids.values())

            # denominator: cases where at least one of the pair appears, across the same datasets
            either_case_ids = set()
            for lbl in datasets_present:
                either_case_ids |= single_presence[key_a].get(lbl, set())
                either_case_ids |= single_presence[key_b].get(lbl, set())
            denom = len(either_case_ids) or 1
            co_occurrence_rate = round(co_occurring_case_count / denom, 4)

            pairs.append(
                CoOccurrencePair(
                    field_type=field_type,
                    value_a=display_value[key_a],
                    value_b=display_value[key_b],
                    datasets_present=datasets_present,
                    co_occurring_case_count=co_occurring_case_count,
                    co_occurrence_rate=co_occurrence_rate,
                )
            )

    pairs.sort(key=lambda p: (p.co_occurrence_rate, p.co_occurring_case_count), reverse=True)
    return pairs[:top_n]