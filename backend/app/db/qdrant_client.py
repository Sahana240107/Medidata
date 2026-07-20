"""
Qdrant client module.
Mirrors the supabase_client.py pattern: a cached singleton client, plus a
helper to make sure the case_fingerprints collection exists before use.
"""

from functools import lru_cache

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_qdrant_client() -> QdrantClient:
    """
    Returns a singleton Qdrant client (Qdrant Cloud or self-hosted).
    Reads QDRANT_URL and QDRANT_API_KEY from environment via Settings.
    """
    settings = get_settings()

    if not settings.QDRANT_URL:
        raise RuntimeError("QDRANT_URL must be set in the environment.")

    return QdrantClient(
        url=settings.QDRANT_URL,
        api_key=settings.QDRANT_API_KEY or None,
    )


def ensure_collection() -> None:
    """
    Creates the case fingerprint collection if it doesn't already exist.
    Safe to call repeatedly (e.g. on app startup) — it's a no-op if present.
    """
    settings = get_settings()
    client = get_qdrant_client()

    existing = {c.name for c in client.get_collections().collections}
    if settings.QDRANT_COLLECTION_NAME in existing:
        return

    client.create_collection(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        vectors_config=qmodels.VectorParams(
            size=settings.EMBEDDING_DIM,
            distance=qmodels.Distance.COSINE,
        ),
    )

    # Payload indexes for the filters we'll want on search (hospital scoping,
    # country breakdowns, excluding archived cases).
    for field_name, schema in [
        ("hospital_id", qmodels.PayloadSchemaType.KEYWORD),
        ("country", qmodels.PayloadSchemaType.KEYWORD),
        ("status", qmodels.PayloadSchemaType.KEYWORD),
    ]:
        client.create_payload_index(
            collection_name=settings.QDRANT_COLLECTION_NAME,
            field_name=field_name,
            field_schema=schema,
        )


def upsert_fingerprint(fingerprint_id: str, vector: list, payload: dict) -> None:
    """Upsert a single case fingerprint vector + payload into Qdrant."""
    settings = get_settings()
    client = get_qdrant_client()

    client.upsert(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        points=[
            qmodels.PointStruct(
                id=fingerprint_id,
                vector=vector,
                payload=payload,
            )
        ],
    )


def delete_fingerprint(fingerprint_id: str) -> None:
    """Remove a fingerprint point — used to roll back if a later step fails."""
    settings = get_settings()
    client = get_qdrant_client()

    client.delete(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        points_selector=qmodels.PointIdsList(points=[fingerprint_id]),
    )


EXCLUDED_STATUSES = ["archived", "deleted"]


def build_exclude_inactive_filter() -> qmodels.Filter:
    """
    Hard filter pushed down to Qdrant so archived/deleted cases never even
    enter the recall set — cheaper than pulling them back and dropping them
    in Python, and it means RECALL_LIMIT is spent entirely on live cases.
    """
    return qmodels.Filter(
        must_not=[
            qmodels.FieldCondition(
                key="status",
                match=qmodels.MatchAny(any=EXCLUDED_STATUSES),
            )
        ]
    )


def _merge_filters(*filters) -> qmodels.Filter:
    """Combine several Filter objects (each already AND-ed internally) with AND."""
    present = [f for f in filters if f is not None]
    if not present:
        return None
    if len(present) == 1:
        return present[0]

    must = []
    must_not = []
    should = []
    for f in present:
        must.extend(f.must or [])
        must_not.extend(f.must_not or [])
        should.extend(f.should or [])
    return qmodels.Filter(must=must or None, must_not=must_not or None, should=should or None)


def scroll_all(limit: int = 300, hospital_id: str = None):
    """
    Fetches up to `limit` fingerprint points (vector + de-identified
    payload), optionally scoped to one node's hospital_id. Backs the
    fingerprint-space projection (PCA scatter) — it only ever touches the
    same de-identified payload already stored for search, never raw
    patient data, and no patient identifiers are present in it.
    """
    settings = get_settings()
    client = get_qdrant_client()

    query_filter = None
    if hospital_id:
        query_filter = qmodels.Filter(
            must=[qmodels.FieldCondition(key="hospital_id", match=qmodels.MatchValue(value=hospital_id))]
        )

    points, _next_offset = client.scroll(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        scroll_filter=_merge_filters(query_filter, build_exclude_inactive_filter()),
        limit=limit,
        with_payload=True,
        with_vectors=True,
    )
    return points


def search_similar(
    vector: list,
    limit: int = 10,
    query_filter: qmodels.Filter = None,
    score_threshold: float = None,
    exclude_inactive: bool = True,
):
    """
    Run a similarity search against the case fingerprint collection.

    By default this excludes archived/deleted cases at the Qdrant level
    (exclude_inactive=True) — pass an extra `query_filter` for anything else
    the caller wants AND-ed in (e.g. hospital scoping, outcome match).
    """
    settings = get_settings()
    client = get_qdrant_client()

    effective_filter = (
        _merge_filters(query_filter, build_exclude_inactive_filter())
        if exclude_inactive
        else query_filter
    )

    return client.search(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        query_vector=vector,
        limit=limit,
        query_filter=effective_filter,
        score_threshold=score_threshold,
        with_payload=True,
    )