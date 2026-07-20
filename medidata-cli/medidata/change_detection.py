"""
medidata/change_detection.py

Phase 4 — change detection.

Doesn't assume every hospital has an `updated_at` column: mapping.yaml
declares which column to use as the watermark. If a hospital's schema has
no reliable timestamp, point `watermark_column` at the auto-increment id
column instead — the query works identically either way since it's just
"> last_value ORDER BY watermark_column ASC".

Batch size is capped (default 500) — anonymizing and reviewing tens of
thousands of records in one CLI run is not a workflow anyone wants.
"""

from __future__ import annotations

MAX_BATCH_SIZE = 500


def get_new_records(
    mysql_conn,
    table: str,
    id_column: str,
    watermark_column: str,
    last_value: str | None,
    doctor_column: str | None = None,
    doctor_value: str | None = None,
    limit: int = MAX_BATCH_SIZE,
) -> list[dict]:
    """
    Fetches up to `limit` rows from `table`, scoped to the mapped doctor
    (if `doctor_column`/`doctor_value` are given) and newer than
    `last_value` on `watermark_column`. Read-only SELECT — this module
    never issues writes against the hospital's schema.
    """
    cursor = mysql_conn.cursor(dictionary=True)

    where_clauses = []
    params: list = []

    if doctor_column and doctor_value is not None:
        where_clauses.append(f"{doctor_column} = %s")
        params.append(doctor_value)

    if last_value is not None:
        where_clauses.append(f"{watermark_column} > %s")
        params.append(last_value)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    query = (
        f"SELECT * FROM {table} {where_sql} "
        f"ORDER BY {watermark_column} ASC LIMIT %s"
    )
    params.append(limit)

    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    cursor.close()
    return rows


def max_watermark(records: list[dict], id_column: str, watermark_column: str) -> tuple[str | None, str | None]:
    """
    Returns (last_record_id, last_watermark_value) from the newest record in
    this batch — used to advance sync_watermark, but only after the caller
    has confirmed the upload succeeded.
    """
    if not records:
        return None, None
    last = records[-1]  # already ORDER BY watermark_column ASC
    return str(last.get(id_column)), str(last.get(watermark_column))
