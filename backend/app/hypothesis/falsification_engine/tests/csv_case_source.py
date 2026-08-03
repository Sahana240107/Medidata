"""
csv_case_source.py (tests/ only — NOT part of the production module list)

Loads the uploaded `medidata_dataset.csv` into CaseRow objects using the
exact same field names as the real `cases` table, so it's a drop-in stand-in
for `get_case_source()` in router.py during local development and for the
tests in this folder. Swapping this for a real Supabase read is the only
change needed anywhere in the engine.
"""
from __future__ import annotations

import csv
from pathlib import Path

from ..local_cohort_builder import CaseRow


def load_cases_from_csv(csv_path: str | Path) -> list[CaseRow]:
    rows: list[CaseRow] = []
    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(
                CaseRow(
                    id=r["id"],
                    disease=r.get("disease", ""),
                    domain=r.get("domain", ""),
                    hospital=r.get("hospital", ""),
                    country=r.get("country", ""),
                    sex=r.get("sex", ""),
                    age_range=r.get("age_range", ""),
                    medications=r.get("medications", ""),
                    outcome=r.get("outcome", ""),
                    created_at=r.get("created_at", ""),
                )
            )
    return rows
