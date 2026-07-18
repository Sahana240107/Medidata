"""
Embedding wrapper around sentence-transformers.
Single place where the model lives, so swapping it later (e.g. for a
clinical-domain model) only means changing this file + EMBEDDING_DIM in .env.
"""

from functools import lru_cache
from typing import List

from sentence_transformers import SentenceTransformer

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    """Lazily loads (and caches) the sentence-transformers model."""
    settings = get_settings()
    return SentenceTransformer(settings.EMBEDDING_MODEL_NAME)


def embed_text(text: str) -> List[float]:
    """Embeds a single piece of text into a fixed-size vector."""
    model = get_embedding_model()
    vector = model.encode(text, normalize_embeddings=True)
    return vector.tolist()


def embed_texts(texts: List[str]) -> List[List[float]]:
    """Batch version — encodes many texts in one model.encode() call.
    Used by the discovery clustering pipeline, which embeds every active
    case at once; batching is meaningfully faster than looping embed_text()."""
    if not texts:
        return []
    model = get_embedding_model()
    vectors = model.encode(texts, normalize_embeddings=True)
    return vectors.tolist()