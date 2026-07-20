"""
Hospital / Node registry service — backs the Multi-Node Simulator.

Each hospital in the network is a "Medidata Node": it has its own local
dataset (rows scoped to its hospital_id) and its own local view of the
case pipeline. This service is the read-side of that concept — it lists
the participating nodes and exposes each node's *local* dataset only.
It never merges or returns another node's row-level data; cross-node
aggregate access goes through app.services.discovery_broker_service.
"""

from fastapi import HTTPException, status

from app.core.constants import DEMO_NODES
from app.db.supabase_client import get_supabase_admin


def _count_cases(hospital_id: str) -> int:
    supabase = get_supabase_admin()
    try:
        resp = (
            supabase.table("cases")
            .select("id", count="exact")
            .eq("hospital_id", hospital_id)
            .execute()
        )
        return resp.count or 0
    except Exception:
        return 0


def list_hospitals() -> list:
    """
    Returns every hospital ("node") participating in the network, each
    annotated with its local case count. Falls back to three fixed demo
    nodes if the `hospitals` table is empty or unreachable (e.g. before
    supabase/seed/002_node_simulator.sql has been run in this environment).
    """
    supabase = get_supabase_admin()
    try:
        resp = supabase.table("hospitals").select("*").execute()
        hospitals = resp.data or []
    except Exception:
        hospitals = []

    if not hospitals:
        hospitals = [dict(n) for n in DEMO_NODES]

    for h in hospitals:
        h["case_count"] = _count_cases(h["id"])

    return hospitals


def get_hospital(hospital_id: str) -> dict:
    for h in list_hospitals():
        if h["id"] == hospital_id:
            return h
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Node not found.")


def get_hospital_cases(hospital_id: str, limit: int = 50, offset: int = 0) -> list:
    """
    The node's local dataset — cases physically scoped to this hospital_id
    only. This is what a doctor sees "inside" the node; it is never merged
    with another node's rows. (This is exactly what /cases already returns
    for the caller's own hospital — exposed here per-node so the Simulator
    can show any node's local view when demoing the architecture.)
    """
    supabase = get_supabase_admin()
    try:
        resp = (
            supabase.table("cases")
            .select("*")
            .eq("hospital_id", hospital_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return resp.data or []
    except Exception:
        return []