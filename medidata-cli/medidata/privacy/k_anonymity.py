"""
medidata/privacy/k_anonymity.py

Layer 4 — k-anonymity verification.

Checks that the combination of quasi-identifiers (age_range, sex, country,
disease) appears at least *k* times within the batch being synced.
Records below the threshold are flagged for further generalization or
exclusion — never silently uploaded as-is.
"""

from __future__ import annotations

from collections import Counter

QUASI_IDENTIFIERS = ["age_range", "sex", "country", "disease"]
DEFAULT_K = 5


def _key_for(record: dict) -> tuple:
    return tuple(record.get(f) for f in QUASI_IDENTIFIERS)


def check_k_anonymity(records: list[dict], k: int = DEFAULT_K) -> dict[int, bool]:
    """Returns {record_index: passes_k_anonymity} for the given batch."""
    keys = [_key_for(r) for r in records]
    counts = Counter(keys)
    return {i: counts[key] >= k for i, key in enumerate(keys)}


def split_batch(records: list[dict], k: int = DEFAULT_K) -> tuple[list[dict], list[dict]]:
    """Splits into (passes_k_anonymity, flagged) using the current batch as the population."""
    results = check_k_anonymity(records, k=k)
    passed, flagged = [], []
    for i, record in enumerate(records):
        (passed if results[i] else flagged).append(record)
    return passed, flagged


def summarize(records: list[dict], k: int = DEFAULT_K) -> dict:
    results = check_k_anonymity(records, k=k)
    passed = sum(1 for ok in results.values() if ok)
    return {
        "k": k,
        "quasi_identifiers": QUASI_IDENTIFIERS,
        "total": len(records),
        "passed": passed,
        "flagged": len(records) - passed,
    }
