"""
outcome_mapping.py

Member 1's OWN copy of the free-text `outcome` -> favorable/unfavorable/ongoing
normalizer. Deliberately duplicated rather than imported from Member 2's
falsification_engine — per the Independence Checklist, every member reads
shared_config/outcome_mapping.json independently and never imports another
member's package.

Public API:
    normalize_outcome(raw: str) -> "favorable" | "unfavorable" | "ongoing" | "unclassified"
"""
from __future__ import annotations

import json
from pathlib import Path

# evidence_engine/ sits directly under app/hypothesis/, same depth as
# falsification_engine/, so shared_config is exactly one level up.
_SHARED_CONFIG_PATH = (
    Path(__file__).resolve().parents[1] / "shared_config" / "outcome_mapping.json"
)


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