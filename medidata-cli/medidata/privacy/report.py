"""
medidata/privacy/report.py

Aggregates counts from every layer into one summary object — printed
before the Phase 9 approval gate, and uploaded alongside the batch so the
backend/audit trail can see exactly what was done to it locally.
"""

from __future__ import annotations

from datetime import datetime, timezone


def build_privacy_report(
    *,
    records_found: int,
    valid_records: list[dict],
    rejected_records: list[dict],
    pii_removal_stats: list[dict],
    tokenized_count: int,
    k_anonymity_summary: dict,
    encrypted: bool,
) -> dict:
    removed_field_counts: dict[str, int] = {}
    all_warnings: list[str] = []
    for stats in pii_removal_stats:
        for field in stats.get("removed_fields", []):
            removed_field_counts[field] = removed_field_counts.get(field, 0) + 1
        all_warnings.extend(stats.get("warnings", []))

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "records_found": records_found,
        "records_valid": len(valid_records),
        "records_rejected": len(rejected_records),
        "rejected_reasons": [
            {"errors": r["errors"]} for r in rejected_records
        ],
        "layer1_pii_removal": {
            "identifiers_removed_by_field": removed_field_counts,
            "leaked_pii_warnings": all_warnings,
        },
        "layer2_tokenization": {
            "records_tokenized": tokenized_count,
        },
        "layer3_generalization": {
            "applied": True,
        },
        "layer4_k_anonymity": k_anonymity_summary,
        "layer5_encryption_at_rest": {
            "applied": encrypted,
        },
        "layer6_secure_transmission": {
            "protocol": "https",
        },
    }


def print_report(report: dict) -> None:
    import typer

    typer.echo("\n── Privacy report ──────────────────────────────────────")
    typer.echo(f"Records found:           {report['records_found']}")
    typer.echo(f"Records valid:           {report['records_valid']}")
    typer.echo(f"Records rejected:        {report['records_rejected']}")

    removed = report["layer1_pii_removal"]["identifiers_removed_by_field"]
    if removed:
        typer.echo("Direct identifiers stripped:")
        for field, count in removed.items():
            typer.echo(f"  - {field}: {count} record(s)")

    warnings = report["layer1_pii_removal"]["leaked_pii_warnings"]
    if warnings:
        typer.secho(f"⚠ {len(warnings)} possible leaked-PII warning(s) in clinical free text:",
                     fg=typer.colors.YELLOW)
        for w in warnings[:10]:
            typer.secho(f"  - {w}", fg=typer.colors.YELLOW)

    typer.echo(f"Records tokenized:       {report['layer2_tokenization']['records_tokenized']}")

    k = report["layer4_k_anonymity"]
    typer.echo(f"k-anonymity (k={k['k']}):        {k['passed']}/{k['total']} passed, {k['flagged']} flagged")

    typer.echo(f"Encrypted at rest:       {report['layer5_encryption_at_rest']['applied']}")
    typer.echo(f"Transmission:            {report['layer6_secure_transmission']['protocol']}")
    typer.echo("─────────────────────────────────────────────────────────\n")
