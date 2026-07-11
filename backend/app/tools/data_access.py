"""
Data access layer for the analytics tool functions.

IMPORTANT: this module reads from QDRANT, not Supabase.

Why: analytics_tools.py groups/filters everything by `disease`, but the
live Supabase `cases` table has no `disease` column at all (confirmed via
`column cases.disease does not exist`, Postgres error 42703) and the team
does not want to alter the schema right now. The `disease` value — along
with symptom names, medications, country, age_range, outcome — already
exists on every point's payload in the Qdrant `case_fingerprints`
collection (see app/services/case_service.py's qdrant_payload construction,
and the payload indexes created in app/db/qdrant_client.py:ensure_collection
for disease/medications/outcome/age_range/country). So instead of querying
Supabase, every helper below scrolls Qdrant with a payload filter.

Public API is unchanged on purpose — fetch_cases_for_disease(),
resolve_disease_name(), get_all_disease_names(), case_symptoms(),
case_medications(), get_disease_symptom_matrix() all keep the same
names/signatures/return shapes they had before, so analytics_tools.py
(symptom_frequency, compare_diseases, age_distribution, etc.) needed ZERO
changes.

  - fetching all cases for a disease: paginated Qdrant `scroll()` with a
    FieldCondition filter on the `disease` payload key (indexed, so this
    stays fast as the dataset grows)
  - fuzzy-matching a disease name the model passes in against what's
    actually in the dataset (the model will say "ALS" or "Behcet's" without
    knowing the exact stored spelling)
  - pulling flat symptom / medication name lists out of the payload, which
    is normally already a flat list of strings, but may occasionally be a
    list of dicts depending on how a given batch was loaded
  - a cached disease -> symptom-frequency matrix, so "what mimics X" and
    "differentiate X from Y" don't re-scan the whole collection on every call

This module has no knowledge of the model / tool-calling — it's pure data
access + shaping, which keeps analytics_tools.py focused on the actual
analytical logic and easy to unit test with a stub client.
"""

import difflib
import time
import unicodedata
from collections import Counter
from typing import Optional

from qdrant_client.http import models as qmodels

from app.core.config import get_settings
from app.core.constants import PRECOMPUTE_CACHE_TTL_SECONDS
from app.db.qdrant_client import get_qdrant_client

SCROLL_PAGE_SIZE = 1000

# Payload keys we read per point. Narrower selector = less data over the
# wire per scroll batch. See case_service.py's qdrant_payload dict for the
# authoritative list of what a point's payload actually contains.
PAYLOAD_FIELDS = [
    "case_id",
    "disease",
    "symptom_names",
    "medications",
    "age_range",
    "country",
    "outcome",
    "sex",
]


# ── low-level fetch ─────────────────────────────────────────────────────────

def _scroll_all(
    scroll_filter: Optional[qmodels.Filter] = None,
    with_payload=PAYLOAD_FIELDS,
) -> list[dict]:
    """Paginated scroll across the whole case_fingerprints collection (or a filtered slice)."""
    client = get_qdrant_client()
    settings = get_settings()
    rows: list[dict] = []
    next_offset = None

    while True:
        points, next_offset = client.scroll(
            collection_name=settings.QDRANT_COLLECTION_NAME,
            scroll_filter=scroll_filter,
            with_payload=with_payload,
            with_vectors=False,
            limit=SCROLL_PAGE_SIZE,
            offset=next_offset,
        )
        for point in points:
            payload = dict(point.payload or {})
            payload.setdefault("id", payload.get("case_id") or point.id)
            rows.append(payload)

        if next_offset is None:
            break

    return rows


def fetch_cases_for_disease(disease: str) -> list[dict]:
    """
    All cases whose `disease` payload field matches exactly (Qdrant-backed).
    `disease` here should already be the resolved/canonical name from
    resolve_disease_name() — this does an exact match, same as the old
    `.ilike("disease", disease)` behavior once the name is resolved.
    """
    scroll_filter = qmodels.Filter(
        must=[qmodels.FieldCondition(key="disease", match=qmodels.MatchValue(value=disease))]
    )
    rows = _scroll_all(scroll_filter=scroll_filter)

    # Normalise to the field name the rest of the tool layer expects
    # ("symptoms", matching the old Supabase column name) so
    # analytics_tools.py / case_symptoms() don't need to change.
    for row in rows:
        row["symptoms"] = row.get("symptom_names") or []

    return rows


# ── disease name resolution ─────────────────────────────────────────────────

_disease_cache: dict = {"names": None, "fetched_at": 0.0}


def get_all_disease_names(force_refresh: bool = False) -> list[str]:
    """Distinct disease names in the dataset, cached for PRECOMPUTE_CACHE_TTL_SECONDS."""
    now = time.time()
    if (
        not force_refresh
        and _disease_cache["names"] is not None
        and now - _disease_cache["fetched_at"] < PRECOMPUTE_CACHE_TTL_SECONDS
    ):
        return _disease_cache["names"]

    rows = _scroll_all(with_payload=["disease"])
    names = sorted({r["disease"] for r in rows if r.get("disease")})
    _disease_cache["names"] = names
    _disease_cache["fetched_at"] = now
    return names


def _fold(text: str) -> str:
    """Lowercase + strip accents, so 'Behcet' matches 'Beh\u00e7et's Disease'."""
    normalized = unicodedata.normalize("NFKD", text)
    without_accents = "".join(c for c in normalized if not unicodedata.combining(c))
    return without_accents.strip().lower()


def resolve_disease_name(raw: str) -> Optional[str]:
    """
    Map a free-text disease name (as the model passes it) to the exact string
    stored in the `disease` payload field. Tries an exact accent/case-
    insensitive match first, then substring, then fuzzy matching so "ALS" /
    "Behcet" / "Beh\u00e7et's Disease" all resolve correctly.
    Returns None if nothing close enough is found.
    """
    if not raw:
        return None

    names = get_all_disease_names()
    raw_folded = _fold(raw)
    folded_names = {name: _fold(name) for name in names}

    for name, folded in folded_names.items():
        if folded == raw_folded:
            return name

    # substring match (handles "ALS" -> "Amyotrophic Lateral Sclerosis (ALS)",
    # and "Behcet" -> "Beh\u00e7et's Disease" once accents are stripped)
    substring_hits = [
        name for name, folded in folded_names.items()
        if raw_folded in folded or folded in raw_folded
    ]
    if len(substring_hits) == 1:
        return substring_hits[0]
    if len(substring_hits) > 1:
        # prefer the shortest match (most likely the canonical short name)
        return min(substring_hits, key=len)

    close = difflib.get_close_matches(raw_folded, list(folded_names.values()), n=1, cutoff=0.6)
    if close:
        for name, folded in folded_names.items():
            if folded == close[0]:
                return name

    return None


# ── payload shape normalisation ─────────────────────────────────────────────

def extract_names(items, key_candidates=("name", "term", "symptom", "medication")) -> list[str]:
    """
    Symptoms/medications on the payload are normally already a flat list of
    strings (e.g. ["fever", "rash"]), but this stays defensive in case a
    given batch stored a list of dicts (e.g. [{"name": "fever"}, ...]) or a
    dict keyed by name — normalises all of that into a flat list of
    lowercase strings so counting/comparison is consistent.
    """
    if not items:
        return []

    if isinstance(items, dict):
        return [str(k).strip().lower() for k in items.keys()]

    out = []
    for item in items:
        if item is None:
            continue
        if isinstance(item, str):
            out.append(item.strip().lower())
        elif isinstance(item, dict):
            for key in key_candidates:
                if item.get(key):
                    out.append(str(item[key]).strip().lower())
                    break
    return out


def case_symptoms(case: dict) -> list[str]:
    return extract_names(case.get("symptoms"))


def case_medications(case: dict) -> list[str]:
    return extract_names(case.get("medications"), key_candidates=("name", "medication", "drug"))


# ── precomputed disease x symptom matrix ────────────────────────────────────

_matrix_cache: dict = {"matrix": None, "fetched_at": 0.0, "case_counts": None}


def get_disease_symptom_matrix(force_refresh: bool = False) -> tuple[dict[str, Counter], dict[str, int]]:
    """
    Returns (matrix, case_counts):
      matrix[disease]      -> Counter of symptom -> number of cases with that symptom
      case_counts[disease] -> total number of cases for that disease

    This is the precomputation layer for "what mimics X" / "differentiate X
    from Y": instead of looping live tool calls disease-by-disease, we scroll
    the Qdrant collection once, cache it for PRECOMPUTE_CACHE_TTL_SECONDS,
    and every comparison reads from memory. At ~1,100 cases this is fast
    (well under a second); if the dataset grows into the tens of thousands,
    this is the piece to move into a nightly job.
    """
    now = time.time()
    if (
        not force_refresh
        and _matrix_cache["matrix"] is not None
        and now - _matrix_cache["fetched_at"] < PRECOMPUTE_CACHE_TTL_SECONDS
    ):
        return _matrix_cache["matrix"], _matrix_cache["case_counts"]

    rows = _scroll_all(with_payload=["disease", "symptom_names"])
    matrix: dict[str, Counter] = {}
    case_counts: dict[str, int] = Counter()

    for row in rows:
        disease = row.get("disease")
        if not disease:
            continue
        case_counts[disease] += 1
        bucket = matrix.setdefault(disease, Counter())
        for symptom in set(extract_names(row.get("symptom_names"))):  # set() -> count each symptom once per case
            bucket[symptom] += 1

    _matrix_cache["matrix"] = matrix
    _matrix_cache["case_counts"] = dict(case_counts)
    _matrix_cache["fetched_at"] = now
    return matrix, dict(case_counts)