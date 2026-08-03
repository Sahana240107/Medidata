"""
medidata/preview.py

Phase 8 — preview.

Shows one sample record before/after the privacy pipeline, side by side,
before asking for approval. A trust-building UX step — not strictly
required for correctness, but don't skip it.
"""

from __future__ import annotations

from rich.console import Console
from rich.table import Table

console = Console()


def show_before_after(raw_record: dict, cleaned_record: dict, title: str = "Sample record — before / after") -> None:
    table = Table(title=title, show_lines=True)
    table.add_column("Field", style="bold")
    table.add_column("Before (local, never leaves hospital)", style="red")
    table.add_column("After (uploaded to MediData)", style="green")

    all_fields = sorted(set(raw_record.keys()) | set(cleaned_record.keys()))
    for field in all_fields:
        before_val = raw_record.get(field, "—")
        after_val = cleaned_record.get(field, "— removed —")
        table.add_row(field, str(before_val), str(after_val))

    console.print(table)


def show_batch_summary(valid_count: int, rejected_count: int, k_flagged_count: int) -> None:
    table = Table(title="Batch summary")
    table.add_column("Metric")
    table.add_column("Count", justify="right")
    table.add_row("Valid records", str(valid_count))
    table.add_row("Rejected (validation)", str(rejected_count))
    table.add_row("Flagged (k-anonymity)", str(k_flagged_count))
    console.print(table)
