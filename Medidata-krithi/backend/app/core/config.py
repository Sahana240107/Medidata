"""
Central application settings.
Reads everything from environment variables (loaded via python-dotenv in main.py).
Kept dependency-free (no pydantic-settings) to match the rest of the codebase's style.
"""

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()
class Settings:
    # --- Supabase ---
    SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.environ.get("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    # --- Qdrant ---
    QDRANT_URL: str = os.environ.get("QDRANT_URL", "")
    QDRANT_API_KEY: str = os.environ.get("QDRANT_API_KEY", "")
    QDRANT_COLLECTION_NAME: str = os.environ.get("QDRANT_COLLECTION_NAME", "case_fingerprints")

    # --- Embedding model ---
    # all-MiniLM-L6-v2 -> 384-dim, fast, free, runs locally via sentence-transformers.
    EMBEDDING_MODEL_NAME: str = os.environ.get("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")
    EMBEDDING_DIM: int = int(os.environ.get("EMBEDDING_DIM", "384"))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
