"""
Research signal service — read-side queries for the Discovery Feed.

Signals are populated by the clustering pipeline (app/tasks/discovery_scan_task.py,
not yet implemented) or seeded manually. This service only reads them.
"""

from fastapi import HTTPException, status

from app.db.supabase_client import get_supabase_admin

ALLOWED_SORT = {"recent": "updated_at", "confidence": "confidence"}


def list_signals(
    limit: int = 20,
    offset: int = 0,
    signal_type: str | None = None,
    min_confidence: float | None = None,
    status_filter: str | None = "active",
    sort: str = "recent",
) -> tuple[list, int]:
    supabase = get_supabase_admin()

    query = supabase.table("research_signals").select("*", count="exact")

    if signal_type:
        query = query.eq("signal_type", signal_type)
    if min_confidence is not None:
        query = query.gte("confidence", min_confidence)
    if status_filter:
        query = query.eq("status", status_filter)

    order_col = ALLOWED_SORT.get(sort, "updated_at")
    query = query.order(order_col, desc=True).range(offset, offset + limit - 1)

    resp = query.execute()
    return resp.data or [], resp.count or 0


def get_signal(signal_id: str) -> dict:
    supabase = get_supabase_admin()
    resp = (
        supabase.table("research_signals")
        .select("*")
        .eq("id", signal_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found.")
    return resp.data
