"""
Feed service.
Powers the dashboard's Discovery Feed cards, the /feed list page, and the
/feed/[signalId] detail page.
"""

import logging

from fastapi import HTTPException, status

from app.db.supabase_client import get_supabase_admin

logger = logging.getLogger("medidata.feed_stats")
logging.basicConfig(level=logging.INFO)


# ─────────────────────────────────────────────────────────────────────────────
# Discovery Feed — list (paginated, filterable, sortable)
# ─────────────────────────────────────────────────────────────────────────────

def list_signals(
    limit: int = 12,
    offset: int = 0,
    signal_type: str | None = None,
    sort: str = "recent",
    signal_status: str | None = "active",
) -> dict:
    """
    Returns {"items": [...], "total": N}. `sort` is 'recent' (default,
    updated_at desc) or 'confidence' (confidence desc).
    """
    supabase = get_supabase_admin()

    order_col = "confidence" if sort == "confidence" else "updated_at"

    query = (
        supabase.table("research_signals")
        .select("*", count="exact")
        .order(order_col, desc=True)
    )
    if signal_status:
        query = query.eq("status", signal_status)
    if signal_type:
        query = query.eq("signal_type", signal_type)

    query = query.range(offset, offset + limit - 1)

    try:
        resp = query.execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch research signals: {e}",
        )

    return {"items": resp.data or [], "total": resp.count or 0}


# ─────────────────────────────────────────────────────────────────────────────
# Discovery Feed — single signal (detail page)
# ─────────────────────────────────────────────────────────────────────────────

def get_signal(signal_id: str) -> dict:
    supabase = get_supabase_admin()

    try:
        resp = (
            supabase.table("research_signals")
            .select("*")
            .eq("id", signal_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found.")

    if not resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found.")

    return resp.data


# ─────────────────────────────────────────────────────────────────────────────
# Stats
# ─────────────────────────────────────────────────────────────────────────────

def get_stats(hospital_id: str | None = None) -> dict:
    supabase = get_supabase_admin()

    # NOTE: supabase-py mishandles the count="exact" response for tables
    # whose row count exceeds PostgREST's page size (returns 206 Partial
    # Content instead of 200 OK) -- it was silently returning 0 rows for
    # `cases` once that table passed 1000 rows. We bypass the library for
    # this one count and hit the REST API directly, which handles the
    # 206 response correctly.
    import os
    import httpx

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    resp = httpx.get(
        f"{url}/rest/v1/cases?select=id",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Prefer": "count=exact",
        },
    )
    content_range = resp.headers.get("content-range", "")
    matched_cases_global = int(content_range.split("/")[-1]) if "/" in content_range else 0

    signals_resp = (
        supabase.table("research_signals")
        .select("id", count="exact")
        .eq("status", "active")
        .execute()
    )
    active_signals = signals_resp.count or 0

    # Adjust the status value below if your `collaboration_status` enum
    # uses something other than 'accepted'.
    collab_resp = (
        supabase.table("collaborations")
        .select("id", count="exact")
        .eq("status", "accepted")
        .execute()
    )
    active_collaborations = collab_resp.count or 0

    hospital_name = None
    hospital_rank = None
    if hospital_id:
        hosp_resp = (
            supabase.table("hospitals")
            .select("name, global_rank")
            .eq("id", hospital_id)
            .single()
            .execute()
        )
        if hosp_resp.data:
            hospital_name = hosp_resp.data.get("name")
            hospital_rank = hosp_resp.data.get("global_rank")

    return {
        "matched_cases_global": matched_cases_global,
        "active_signals": active_signals,
        "active_collaborations": active_collaborations,
        "hospital_name": hospital_name,
        "hospital_rank": hospital_rank,
    }