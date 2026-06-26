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


def search_similar(vector: list, limit: int = 10, query_filter: qmodels.Filter = None):
    """Run a similarity search against the case fingerprint collection."""
    settings = get_settings()
    client = get_qdrant_client()

    return client.search(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        query_vector=vector,
        limit=limit,
        query_filter=query_filter,
        with_payload=True,
    )
