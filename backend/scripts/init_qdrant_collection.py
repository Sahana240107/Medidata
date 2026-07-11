"""
One-off script: creates the Qdrant `case_fingerprints` collection (with the
right vector size/distance + payload indexes) if it doesn't already exist.

Run manually after setting up a Qdrant Cloud cluster and filling in
backend/.env:

    python scripts/init_qdrant_collection.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv

load_dotenv()

from app.core.config import get_settings
from app.db.qdrant_client import ensure_collection, get_qdrant_client


def main():
    settings = get_settings()
    ensure_collection()

    client = get_qdrant_client()
    info = client.get_collection(settings.QDRANT_COLLECTION_NAME)
    print(f"Collection '{settings.QDRANT_COLLECTION_NAME}' is ready.")
    print(f"  vector size: {settings.EMBEDDING_DIM}")
    print(f"  points count: {info.points_count}")


if __name__ == "__main__":
    main()
