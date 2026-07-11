"""
Run this against your real Supabase + Qdrant instances before wiring up
the chat feature. It checks the assumptions analytics_tools.py makes about
your data and prints a pass/fail report instead of letting a bad shape
show up as a silent wrong answer later.

Usage (from backend/):
    python -m scripts.verify_data_shape
"""

import sys

from app.db.qdrant_client import get_qdrant_client
from app.core.config import get_settings
from app.tools import data_access as da


def _ok(msg):
    print(f"  [OK]   {msg}")


def _warn(msg):
    print(f"  [WARN] {msg}")


def _fail(msg):
    print(f"  [FAIL] {msg}")


def check_supabase() -> bool:
    print("\n== Supabase `cases` table ==")
    all_ok = True

    try:
        rows = da._fetch_all(select="id,disease,symptoms,medications,country,age_range,outcome")
    except Exception as exc:
        _fail(f"Could not query `cases`: {exc}")
        return False

    if not rows:
        _fail("`cases` table returned 0 rows. Nothing to check against.")
        return False
    _ok(f"Fetched {len(rows)} rows.")

    # disease column
    with_disease = [r for r in rows if r.get("disease")]
    if not with_disease:
        _fail("No rows have a non-null `disease` value. All analytics tools filter on this column.")
        all_ok = False
    else:
        distinct = len({r["disease"] for r in with_disease})
        _ok(f"{len(with_disease)}/{len(rows)} rows have `disease` set ({distinct} distinct diseases).")
        if len(with_disease) < len(rows):
            _warn(f"{len(rows) - len(with_disease)} rows have no `disease` value and won't be counted by any tool.")

    # symptoms shape
    sample = next((r for r in rows if r.get("symptoms")), None)
    if not sample:
        _fail("No row has a non-empty `symptoms` value.")
        all_ok = False
    else:
        extracted = da.case_symptoms(sample)
        if extracted:
            _ok(f"`symptoms` parses into names correctly, e.g. {extracted[:3]}")
        else:
            _fail(
                f"`symptoms` on a sample row didn't parse into any names. "
                f"Raw value: {sample['symptoms']!r}. Check extract_names() key_candidates in data_access.py."
            )
            all_ok = False

    # medications shape
    sample = next((r for r in rows if r.get("medications")), None)
    if sample:
        extracted = da.case_medications(sample)
        if extracted:
            _ok(f"`medications` parses into names correctly, e.g. {extracted[:3]}")
        else:
            _warn(f"`medications` on a sample row didn't parse. Raw value: {sample['medications']!r}")
    else:
        _warn("No row has a non-empty `medications` value (compare_drug_outcomes will always return 0).")

    # country / age_range / outcome presence
    for field in ("country", "age_range", "outcome"):
        present = sum(1 for r in rows if r.get(field))
        if present == 0:
            _warn(f"No rows have `{field}` set — that tool will always return an empty result.")
        else:
            _ok(f"`{field}` present on {present}/{len(rows)} rows.")

    return all_ok


def check_qdrant() -> bool:
    print("\n== Qdrant collection ==")
    settings = get_settings()
    client = get_qdrant_client()
    all_ok = True

    try:
        collections = {c.name for c in client.get_collections().collections}
    except Exception as exc:
        _fail(f"Could not reach Qdrant: {exc}")
        return False

    if settings.QDRANT_COLLECTION_NAME not in collections:
        _fail(f"Collection '{settings.QDRANT_COLLECTION_NAME}' does not exist.")
        return False
    _ok(f"Collection '{settings.QDRANT_COLLECTION_NAME}' exists.")

    points, _ = client.scroll(
        collection_name=settings.QDRANT_COLLECTION_NAME, limit=5, with_payload=True, with_vectors=False
    )
    if not points:
        _fail("Collection has 0 points.")
        return False
    _ok(f"Sampled {len(points)} points.")

    expected_keys = ["case_id", "disease", "symptom_names", "country", "outcome"]
    payload = points[0].payload or {}
    for key in expected_keys:
        if key in payload:
            _ok(f"payload['{key}'] present, e.g. {str(payload[key])[:60]!r}")
        else:
            _fail(
                f"payload['{key}'] missing (found keys: {sorted(payload.keys())}). "
                f"evidence_search in analytics_tools.py reads this key — update it if your payload uses a different name."
            )
            all_ok = False

    return all_ok


if __name__ == "__main__":
    supabase_ok = check_supabase()
    qdrant_ok = check_qdrant()

    print("\n== Summary ==")
    if supabase_ok and qdrant_ok:
        print("All checks passed — the analytics tools should work against this data as written.")
        sys.exit(0)
    else:
        print("Some checks failed — fix the flagged issues (or adjust the key names in tools/data_access.py / tools/analytics_tools.py) before using the chat feature.")
        sys.exit(1)
