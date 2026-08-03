"""
service.py

Orchestrates Cross-Dataset Discovery: fetch each selected dataset's cases,
fetch the full-dataset baseline, compute overlaps + co-occurrences, and
surface both as ranked "discovery cards" ready for direct frontend
rendering (pattern + supporting case count + datasets involved).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from .co_occurrence import compute_co_occurrences
from .dataset_selector import fetch_baseline_distribution, fetch_dataset_cases
from .pattern_miner import compute_overlaps
from .schemas import CompareRequest, CompareResult, DiscoveryCard, OverlapItem, CoOccurrencePair

# In-memory store of every discovery card ever produced, so GET /discoveries
# can return a ranked list without re-running every prior comparison. Fine
# for this build's scope (same trade-off Member 2 made for its result cache).
_DISCOVERY_STORE: list[DiscoveryCard] = []


def _overlap_to_card(item: OverlapItem, rank: int) -> DiscoveryCard:
    dataset_list = ", ".join(item.datasets_present)
    pattern = (
        f"{item.value} ({item.field_type.replace('_', ' ')}) shared across "
        f"{len(item.datasets_present)} datasets [{dataset_list}] — "
        f"{item.unusualness_score}x more common in these groups than dataset-wide"
    )
    return DiscoveryCard(
        id=f"overlap-{uuid.uuid4().hex[:12]}",
        kind="overlap",
        pattern=pattern,
        field_type=item.field_type,
        supporting_case_count=item.total_supporting_cases,
        datasets_involved=item.datasets_present,
        unusualness_score=item.unusualness_score,
        rank=rank,
    )


def _co_occurrence_to_card(pair: CoOccurrencePair, rank: int) -> DiscoveryCard:
    dataset_list = ", ".join(pair.datasets_present)
    pattern = (
        f"{pair.value_a} + {pair.value_b} ({pair.field_type.replace('_', ' ')}) co-occur in "
        f"{pair.co_occurring_case_count} cases across [{dataset_list}] "
        f"(co-occurrence rate {pair.co_occurrence_rate})"
    )
    return DiscoveryCard(
        id=f"cooc-{uuid.uuid4().hex[:12]}",
        kind="co_occurrence",
        pattern=pattern,
        field_type=pair.field_type,
        supporting_case_count=pair.co_occurring_case_count,
        datasets_involved=pair.datasets_present,
        unusualness_score=pair.co_occurrence_rate,
        rank=rank,
    )


def run_compare(request: CompareRequest) -> CompareResult:
    labels = [d.display_label() for d in request.datasets]

    cases_by_dataset = {
        d.display_label(): fetch_dataset_cases(d, request.field_types) for d in request.datasets
    }
    baseline_counts, baseline_total = fetch_baseline_distribution(request.field_types)

    overlaps = compute_overlaps(
        datasets=request.datasets,
        cases_by_dataset=cases_by_dataset,
        field_types=request.field_types,
        baseline_counts=baseline_counts,
        baseline_total=baseline_total,
        min_datasets_sharing=request.min_datasets_sharing,
        top_n=request.top_n,
    )
    co_occurrences = compute_co_occurrences(
        datasets=request.datasets,
        cases_by_dataset=cases_by_dataset,
        field_types=request.field_types,
        min_datasets_sharing=request.min_datasets_sharing,
        top_n=request.top_n,
    )

    cards: list[DiscoveryCard] = []
    for rank, item in enumerate(overlaps, start=1):
        cards.append(_overlap_to_card(item, rank))
    for rank, pair in enumerate(co_occurrences, start=1):
        cards.append(_co_occurrence_to_card(pair, rank))

    cards.sort(key=lambda c: c.unusualness_score, reverse=True)
    for i, card in enumerate(cards, start=1):
        card.rank = i

    _DISCOVERY_STORE.extend(cards)

    return CompareResult(
        compare_id=str(uuid.uuid4()),
        datasets=labels,
        overlaps=overlaps,
        co_occurrences=co_occurrences,
        discovery_cards=cards,
        computed_at=datetime.now(timezone.utc),
    )


def list_discoveries(limit: int = 50) -> list[DiscoveryCard]:
    ranked = sorted(_DISCOVERY_STORE, key=lambda c: c.unusualness_score, reverse=True)
    return ranked[:limit]