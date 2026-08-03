"""
medidata/privacy/generalizer.py

Layer 3 — generalization.

Exact age is already bucketed by field_mapping.py's `bucket_age` transform
(so it matches the schema's `age_range` column before validation even
runs). This layer handles what's left:

  - Absolute admission/discharge dates -> day_offset relative values,
    matching `case_timeline_events.day_offset` instead of leaking an exact
    calendar date.
  - Free-text outliers (values so rare within the batch they'd effectively
    re-identify a patient on their own) get coarsened.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, date

_DATE_FORMATS = ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%dT%H:%M:%S"]


def _parse_date(value) -> date | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def generalize_dates(record: dict) -> dict:
    """
    Replaces admission_date/discharge_date with a single relative
    day_offset (discharge relative to admission). Drops both absolute
    dates from the output — only the offset survives.
    """
    out = dict(record)
    admission = _parse_date(out.pop("admission_date", None))
    discharge = _parse_date(out.pop("discharge_date", None))

    if admission and discharge:
        out["length_of_stay_days"] = (discharge - admission).days
    else:
        out["length_of_stay_days"] = None

    return out


def coarsen_rare_values(records: list[dict], field: str, min_count: int = 3,
                         replacement: str = "other") -> list[dict]:
    """
    Any value in `field` that appears fewer than `min_count` times across
    the batch gets replaced with `replacement` — a value that's unique (or
    near-unique) to one patient in the batch is itself a re-identification
    risk, regardless of how well the rest of the record was generalized.
    """
    counts = Counter(r.get(field) for r in records if r.get(field))
    out = []
    for r in records:
        r2 = dict(r)
        value = r2.get(field)
        if value and counts[value] < min_count:
            r2[field] = replacement
        out.append(r2)
    return out


def apply_single(record: dict) -> dict:
    """Per-record generalization (dates). Rare-value coarsening runs batch-wide — see apply_batch."""
    return generalize_dates(record)


def apply_batch(records: list[dict], coarsen_fields: list[str] | None = None,
                 min_count: int = 3) -> list[dict]:
    coarsen_fields = coarsen_fields or ["disease"]
    out = [apply_single(r) for r in records]
    for field in coarsen_fields:
        out = coarsen_rare_values(out, field, min_count=min_count)
    return out
