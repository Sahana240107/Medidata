"""
dataset_store.py

Lets a user drag-and-drop a CSV/Excel file of cases and immediately run the
falsification/verdict engines against it, instead of the (still-unwired)
Supabase `cases` table.

Two responsibilities:
  1. `parse_uploaded_file()` — bytes in, `list[CaseRow]` out. Accepts .csv,
     .xls, .xlsx. Column names are matched case-insensitively against the
     `cases` schema (`id, disease, domain, hospital, country, sex, age_range,
     medications, outcome, created_at`); anything missing is filled with a
     sane default rather than rejecting the row, since most hand-built
     spreadsheets won't have every column.
  2. An in-memory `{dataset_id: ...}` store (same pattern as the falsification
     `_RESULT_CACHE` in router.py — fine for a beginner-scope build, swap for
     Redis/Supabase storage if this needs to survive a process restart) so the
     frontend can upload once and then reference the dataset by id across the
     upload preview, the run call, and (optionally) a follow-up run with
     different filters.
"""
from __future__ import annotations

import io
import uuid
from datetime import datetime, timezone
from typing import BinaryIO

import pandas as pd

from .local_cohort_builder import CaseRow

# Canonical column -> accepted header aliases (case-insensitive, spaces/underscores
# ignored) so common variants ("Age Range", "age-range", "AgeRange") all match.
_COLUMN_ALIASES: dict[str, list[str]] = {
    "id": ["id", "case_id", "patient_id"],
    "disease": ["disease", "diagnosis", "condition"],
    "domain": ["domain", "category", "specialty"],
    "hospital": ["hospital", "hospital_id", "institution", "site"],
    "country": ["country", "location"],
    "sex": ["sex", "gender"],
    "age_range": ["age_range", "agerange", "age_group", "age"],
    "medications": ["medications", "medication", "drugs", "treatment"],
    "outcome": ["outcome", "status", "result"],
    "created_at": ["created_at", "date", "recorded_at", "timestamp"],
}

MAX_PREVIEW_ROWS = 10
_MAX_FILE_BYTES = 25 * 1024 * 1024  # 25 MB


class DatasetParseError(ValueError):
    """Raised for any problem turning the uploaded bytes into CaseRow objects."""


def _normalize_header(h: str) -> str:
    return str(h).strip().lower().replace(" ", "_").replace("-", "_")


def _build_column_map(columns: list[str]) -> dict[str, str]:
    """Returns {canonical_field: actual_dataframe_column_name}."""
    normalized = {_normalize_header(c): c for c in columns}
    mapping: dict[str, str] = {}
    for canonical, aliases in _COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in normalized:
                mapping[canonical] = normalized[alias]
                break
    return mapping


def _read_dataframe(filename: str, content: bytes) -> pd.DataFrame:
    lower = (filename or "").lower()
    buf: BinaryIO = io.BytesIO(content)
    try:
        if lower.endswith(".csv"):
            return pd.read_csv(buf, dtype=str, keep_default_na=False, encoding="utf-8-sig")
        if lower.endswith((".xlsx", ".xls")):
            return pd.read_excel(buf, dtype=str, engine=None).fillna("")
        raise DatasetParseError("Unsupported file type — please upload a .csv, .xlsx, or .xls file.")
    except DatasetParseError:
        raise
    except Exception as exc:  # pandas raises many different error types
        raise DatasetParseError(f"Could not read '{filename}': {exc}") from exc


def parse_uploaded_file(filename: str, content: bytes) -> tuple[list[CaseRow], list[str]]:
    """Returns (case_rows, original_columns). Raises DatasetParseError on bad input."""
    if not content:
        raise DatasetParseError("The uploaded file is empty.")
    if len(content) > _MAX_FILE_BYTES:
        raise DatasetParseError("File is too large — please upload a file under 25 MB.")

    df = _read_dataframe(filename, content)
    if df.empty:
        raise DatasetParseError("The uploaded file has no data rows.")

    original_columns = [str(c) for c in df.columns]
    col_map = _build_column_map(original_columns)

    if "medications" not in col_map and "outcome" not in col_map:
        raise DatasetParseError(
            "Couldn't find a 'medications' or 'outcome' column — the engines need at least one "
            "to build intervention/control arms. Found columns: " + ", ".join(original_columns)
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    rows: list[CaseRow] = []
    for i, record in enumerate(df.to_dict(orient="records")):
        def get(field: str, default: str = "") -> str:
            src_col = col_map.get(field)
            if not src_col:
                return default
            val = record.get(src_col, default)
            return "" if val is None else str(val).strip()

        row_id = get("id") or f"row-{i + 1}-{uuid.uuid4().hex[:8]}"
        disease = get("disease")
        domain = get("domain") or disease or "Unclassified"

        rows.append(
            CaseRow(
                id=row_id,
                disease=disease or "Unclassified",
                domain=domain,
                hospital=get("hospital"),
                country=get("country"),
                sex=get("sex"),
                age_range=get("age_range"),
                medications=get("medications"),
                outcome=get("outcome"),
                created_at=get("created_at") or now_iso,
            )
        )

    return rows, original_columns


# ── In-memory dataset store ──────────────────────────────────────────────
_DATASETS: dict[str, dict] = {}


def store_dataset(filename: str, cases: list[CaseRow], columns: list[str]) -> str:
    dataset_id = str(uuid.uuid4())
    _DATASETS[dataset_id] = {
        "dataset_id": dataset_id,
        "filename": filename,
        "columns": columns,
        "cases": cases,
        "row_count": len(cases),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    return dataset_id


def get_dataset_cases(dataset_id: str) -> list[CaseRow] | None:
    entry = _DATASETS.get(dataset_id)
    return entry["cases"] if entry else None


def get_dataset_meta(dataset_id: str) -> dict | None:
    entry = _DATASETS.get(dataset_id)
    if not entry:
        return None
    return {k: v for k, v in entry.items() if k != "cases"}


def preview_rows(dataset_id: str, limit: int = MAX_PREVIEW_ROWS) -> list[dict]:
    entry = _DATASETS.get(dataset_id)
    if not entry:
        return []
    return [
        {
            "id": c.id,
            "disease": c.disease,
            "domain": c.domain,
            "hospital": c.hospital,
            "country": c.country,
            "sex": c.sex,
            "age_range": c.age_range,
            "medications": c.medications,
            "outcome": c.outcome,
            "created_at": c.created_at,
        }
        for c in entry["cases"][:limit]
    ]


def delete_dataset(dataset_id: str) -> bool:
    return _DATASETS.pop(dataset_id, None) is not None