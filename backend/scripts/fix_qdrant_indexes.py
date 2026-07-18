"""
One-time fix: add the payload indexes that ensure_collection() only ever
creates for a BRAND NEW collection. Since `case_fingerprints` already
existed before that indexing code was added, it's been skipping the
`if settings.QDRANT_COLLECTION_NAME in existing: return` early-out every
time the app starts, and the indexes were never actually created --
which is why filtering on `disease` fails with:
    "Index required but not found for 'disease' of one of the following
     types: [keyword]"

Safe to run against your live collection: this only ADDS indexes, it does
not touch, delete, or move any existing points/vectors/payloads.

Run from backend/:
    python -m scripts.fix_qdrant_indexes
"""

import os
import sys

sys.path.insert(0, os.getcwd())

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from qdrant_client.http import models as qmodels  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.qdrant_client import get_qdrant_client  # noqa: E402

# Same field list ensure_collection() would have created on a fresh collection.
FIELDS_TO_INDEX = [
    ("hospital_id", qmodels.PayloadSchemaType.KEYWORD),
    ("country", qmodels.PayloadSchemaType.KEYWORD),
    ("status", qmodels.PayloadSchemaType.KEYWORD),
    ("disease", qmodels.PayloadSchemaType.KEYWORD),
    ("medications", qmodels.PayloadSchemaType.KEYWORD),
    ("outcome", qmodels.PayloadSchemaType.KEYWORD),
    ("age_range", qmodels.PayloadSchemaType.KEYWORD),
]


def main():
    settings = get_settings()
    client = get_qdrant_client()

    collection = settings.QDRANT_COLLECTION_NAME
    print(f"Collection: {collection}")

    info = client.get_collection(collection)
    existing_indexes = set(info.payload_schema.keys()) if info.payload_schema else set()
    print(f"Currently indexed fields: {sorted(existing_indexes) or '(none)'}\n")

    for field_name, schema in FIELDS_TO_INDEX:
        if field_name in existing_indexes:
            print(f"  [skip]   {field_name} -- already indexed")
            continue
        try:
            client.create_payload_index(
                collection_name=collection,
                field_name=field_name,
                field_schema=schema,
            )
            print(f"  [added]  {field_name}")
        except Exception as e:
            print(f"  [FAILED] {field_name} -- {e}")

    print("\nDone. Filtering on disease/medications/outcome/age_range/country should work now.")


if __name__ == "__main__":
    main()