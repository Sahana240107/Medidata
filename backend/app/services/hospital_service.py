"""
Hospital / Node registry service — backs the Multi-Node Simulator.

Each hospital in the network is a "Medidata Node": it has its own local
dataset (rows scoped to its hospital_id) and its own local view of the
case pipeline. This service is the read-side of that concept — it lists
the participating nodes and exposes each node's *local* dataset only.
It never merges or returns another node's row-level data; cross-node
aggregate access goes through app.services.discovery_broker_service.

It also backs the "Hospital Insights" page (get_hospital_insights): a
network-wide overview plus the caller's own hospital's stats, a
leaderboard placement, achievement badges, and a recent-activity feed.
Nothing here is LLM-generated — every number is computed directly from
Supabase rows.
"""

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from app.db.supabase_client import get_supabase_admin
from app.services.metrics_service import recompute_hospital_metrics

# How long a hospital_metrics snapshot is trusted before we recompute it
# from live Supabase data. Keeps the Insights page numbers real without
# re-querying every table on every single page view.
METRICS_STALE_AFTER = timedelta(minutes=15)


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


# ─────────────────────────────────────────────────────────────────────────────
# Hospital Insights page
# ─────────────────────────────────────────────────────────────────────────────

ACHIEVEMENT_DEFS = [
    {
        "key": "verified_node",
        "label": "Verified Node",
        "description": "Hospital identity and credentials verified by the MediData network.",
        "icon": "🛡️",
        "check": lambda ctx: ctx["hospital"].get("verification_status") == "verified",
    },
    {
        "key": "first_case",
        "label": "First Contribution",
        "description": "Submitted your first case to the global network.",
        "icon": "🌱",
        "check": lambda ctx: ctx["case_count"] >= 1,
        "progress": lambda ctx: (ctx["case_count"], 1),
    },
    {
        "key": "century_club",
        "label": "Century Club",
        "description": "Contributed 100 or more cases to the network.",
        "icon": "💯",
        "check": lambda ctx: ctx["case_count"] >= 100,
        "progress": lambda ctx: (ctx["case_count"], 100),
    },
    {
        "key": "first_discovery",
        "label": "First Discovery",
        "description": "Linked to at least one confirmed disease discovery.",
        "icon": "🔬",
        "check": lambda ctx: ctx["metrics"]["disease_discoveries"] >= 1,
        "progress": lambda ctx: (ctx["metrics"]["disease_discoveries"], 1),
    },
    {
        "key": "syndrome_spotter",
        "label": "Syndrome Spotter",
        "description": "Helped identify an emerging syndrome cluster.",
        "icon": "🧬",
        "check": lambda ctx: ctx["metrics"]["emerging_syndrome_identifications"] >= 1,
        "progress": lambda ctx: (ctx["metrics"]["emerging_syndrome_identifications"], 1),
    },
    {
        "key": "prolific_collaborator",
        "label": "Prolific Collaborator",
        "description": "Published 5 or more cross-hospital collaborations.",
        "icon": "🤝",
        "check": lambda ctx: ctx["metrics"]["published_collaborations"] >= 5,
        "progress": lambda ctx: (ctx["metrics"]["published_collaborations"], 5),
    },
    {
        "key": "high_impact",
        "label": "High Impact",
        "description": "Research impact score of 75 or higher.",
        "icon": "⚡",
        "check": lambda ctx: ctx["metrics"]["research_impact_score"] >= 75,
        "progress": lambda ctx: (round(ctx["metrics"]["research_impact_score"]), 75),
    },
    {
        "key": "top_ten",
        "label": "Top 10 Global",
        "description": "Ranked among the top 10 hospitals network-wide by discovery score.",
        "icon": "🏆",
        "check": lambda ctx: bool(ctx["global_rank"]) and ctx["global_rank"] <= 10,
    },
]


def _latest_metrics_by_hospital() -> dict:
    """hospital_id -> most recent hospital_metrics row (or {} if none)."""
    supabase = get_supabase_admin()
    try:
        resp = (
            supabase.table("hospital_metrics")
            .select("*")
            .order("recorded_at", desc=True)
            .execute()
        )
        rows = resp.data or []
    except Exception:
        rows = []

    latest = {}
    for row in rows:
        hid = row.get("hospital_id")
        if hid and hid not in latest:  # first hit per hospital = most recent (already sorted desc)
            latest[hid] = row
    return latest


def _profile_ids_for_hospital(hospital_id: str) -> list:
    supabase = get_supabase_admin()
    try:
        resp = supabase.table("profiles").select("id").eq("hospital_id", hospital_id).execute()
        return [p["id"] for p in (resp.data or [])]
    except Exception:
        return []


def _recent_cases(hospital_id: str, n: int = 4) -> list:
    supabase = get_supabase_admin()
    try:
        resp = (
            supabase.table("cases")
            .select("id, disease, diagnosis_icd, status, created_at")
            .eq("hospital_id", hospital_id)
            .order("created_at", desc=True)
            .limit(n)
            .execute()
        )
        return resp.data or []
    except Exception:
        return []


def _recent_collaborations(profile_ids: list, n: int = 4) -> list:
    if not profile_ids:
        return []
    supabase = get_supabase_admin()
    try:
        resp = (
            supabase.table("collaborations")
            .select("id, project_title, message, status, created_at, requested_by, requested_to")
            .or_(
                f"requested_by.in.({','.join(profile_ids)}),"
                f"requested_to.in.({','.join(profile_ids)})"
            )
            .order("created_at", desc=True)
            .limit(n)
            .execute()
        )
        return resp.data or []
    except Exception:
        return []


def _build_achievements(ctx: dict) -> list:
    out = []
    for definition in ACHIEVEMENT_DEFS:
        unlocked = bool(definition["check"](ctx))
        progress_label = None
        if not unlocked and "progress" in definition:
            current, target = definition["progress"](ctx)
            progress_label = f"{current} of {target}"
        out.append({
            "key": definition["key"],
            "label": definition["label"],
            "description": definition["description"],
            "icon": definition["icon"],
            "unlocked": unlocked,
            "progress_label": progress_label,
        })
    return out


def _build_activity_feed(hospital_id: str) -> list:
    profile_ids = _profile_ids_for_hospital(hospital_id)
    items = []

    for c in _recent_cases(hospital_id):
        label = (c.get("disease") or c.get("diagnosis_icd") or "Unlabeled case").title()
        items.append({
            "type": "case",
            "title": f"New case submitted — {label}",
            "detail": f"Status: {(c.get('status') or 'active').title()}",
            "timestamp": c.get("created_at"),
        })

    for c in _recent_collaborations(profile_ids):
        title = c.get("project_title") or "Collaboration request"
        items.append({
            "type": "collaboration",
            "title": title,
            "detail": f"Status: {(c.get('status') or 'requested').title()}",
            "timestamp": c.get("created_at"),
        })

    items = [i for i in items if i.get("timestamp")]
    items.sort(key=lambda i: i["timestamp"], reverse=True)
    return items[:6]


def _is_stale(recorded_at) -> bool:
    if not recorded_at:
        return True
    try:
        recorded = datetime.fromisoformat(str(recorded_at).replace("Z", "+00:00"))
    except ValueError:
        return True
    return datetime.now(timezone.utc) - recorded > METRICS_STALE_AFTER


def get_hospital_insights(current_user: dict) -> dict:
    """
    Assembles the Hospital Insights page: a network-wide overview, a
    leaderboard placement, and the caller's own hospital's stats,
    achievement badges, and recent activity — all computed live from
    Supabase, no mock data.
    """
    hospitals = list_hospitals()
    metrics_by_id = _latest_metrics_by_hospital()

    # Real, non-zero scores instead of the DEFAULT 0 sitting in the tables:
    # if the caller's own hospital has no metrics snapshot yet, or its
    # snapshot is older than METRICS_STALE_AFTER, recompute it live from
    # cases/collaborations/research_signals/validation_requests and write
    # the result back to Supabase (`hospital_metrics` + `hospitals.
    # discovery_score`) before we build the response.
    my_hospital_id = current_user.get("hospital_id")
    if my_hospital_id:
        cached = metrics_by_id.get(my_hospital_id)
        if cached is None or _is_stale(cached.get("recorded_at")):
            fresh = recompute_hospital_metrics(my_hospital_id)
            metrics_by_id[my_hospital_id] = {
                "disease_discoveries": fresh["disease_discoveries"],
                "published_collaborations": fresh["published_collaborations"],
                "emerging_syndrome_identifications": fresh["emerging_syndrome_identifications"],
                "collaboration_score": fresh["collaboration_score"],
                "research_impact_score": fresh["research_impact_score"],
                "validation_score": fresh["validation_score"],
                "recorded_at": datetime.now(timezone.utc).isoformat(),
            }
            for h in hospitals:
                if h["id"] == my_hospital_id:
                    h["discovery_score"] = fresh["discovery_score"]
                    break

    # ── Network overview ─────────────────────────────────────────────────
    countries = {h.get("country") for h in hospitals if h.get("country")}
    verified_count = sum(1 for h in hospitals if h.get("verification_status") == "verified")
    total_discoveries = sum(
        (m.get("disease_discoveries") or 0) + (m.get("emerging_syndrome_identifications") or 0)
        for m in metrics_by_id.values()
    )

    supabase = get_supabase_admin()
    try:
        total_cases = (supabase.table("cases").select("id", count="exact").execute()).count or 0
    except Exception:
        total_cases = sum(h.get("case_count", 0) for h in hospitals)
    try:
        total_collaborations = (
            supabase.table("collaborations").select("id", count="exact").execute()
        ).count or 0
    except Exception:
        total_collaborations = 0

    network = {
        "total_hospitals": len(hospitals),
        "verified_hospitals": verified_count,
        "total_cases": total_cases,
        "total_discoveries": total_discoveries,
        "total_collaborations": total_collaborations,
        "countries_count": len(countries),
    }

    # ── Leaderboard (ranked by discovery_score, falls back to case_count) ──
    def _score(h):
        return h.get("discovery_score") or 0

    ranked = sorted(hospitals, key=lambda h: (_score(h), h.get("case_count", 0)), reverse=True)

    leaderboard_full = []
    for idx, h in enumerate(ranked, start=1):
        leaderboard_full.append({
            "rank": h.get("global_rank") or idx,
            "id": h["id"],
            "name": h.get("name") or "Unnamed hospital",
            "country": h.get("country"),
            "discovery_score": _score(h),
            "case_count": h.get("case_count", 0),
            "is_mine": h["id"] == my_hospital_id,
        })

    my_index = next((i for i, h in enumerate(leaderboard_full) if h["is_mine"]), None)
    top_slice = leaderboard_full[:5]
    if my_index is not None and my_index >= 5:
        window = leaderboard_full[max(0, my_index - 1): my_index + 2]
        leaderboard = top_slice + window
    else:
        leaderboard = top_slice

    # ── Global footprint (by country) ───────────────────────────────────
    country_hospitals = Counter(h.get("country") for h in hospitals if h.get("country"))
    country_cases = defaultdict(int)
    for h in hospitals:
        if h.get("country"):
            country_cases[h["country"]] += h.get("case_count", 0)

    my_country = None
    if my_hospital_id:
        my_h = next((h for h in hospitals if h["id"] == my_hospital_id), None)
        my_country = my_h.get("country") if my_h else None

    footprint = [
        {
            "country": country,
            "hospital_count": count,
            "case_count": country_cases.get(country, 0),
            "is_mine": country == my_country,
        }
        for country, count in country_hospitals.most_common(6)
    ]

    # ── Caller's own hospital profile ───────────────────────────────────
    hospital_out = None
    if my_hospital_id:
        my_hospital = next((h for h in hospitals if h["id"] == my_hospital_id), None)
        if my_hospital:
            raw_metrics = metrics_by_id.get(my_hospital_id, {})
            metrics = {
                "disease_discoveries": raw_metrics.get("disease_discoveries") or 0,
                "published_collaborations": raw_metrics.get("published_collaborations") or 0,
                "emerging_syndrome_identifications": raw_metrics.get("emerging_syndrome_identifications") or 0,
                "collaboration_score": raw_metrics.get("collaboration_score") or 0,
                "research_impact_score": raw_metrics.get("research_impact_score") or 0,
                "validation_score": raw_metrics.get("validation_score") or 0,
                "recorded_at": raw_metrics.get("recorded_at"),
            }

            all_scores = [_score(h) for h in hospitals] or [0]
            all_case_counts = [h.get("case_count", 0) for h in hospitals] or [0]
            all_collab = [m.get("collaboration_score") or 0 for m in metrics_by_id.values()] or [0]
            all_impact = [m.get("research_impact_score") or 0 for m in metrics_by_id.values()] or [0]
            all_validation = [m.get("validation_score") or 0 for m in metrics_by_id.values()] or [0]

            network_avg = {
                "discovery_score": round(sum(all_scores) / len(all_scores), 1),
                "case_count": round(sum(all_case_counts) / len(all_case_counts), 1),
                "collaboration_score": round(sum(all_collab) / len(all_collab), 1),
                "research_impact_score": round(sum(all_impact) / len(all_impact), 1),
                "validation_score": round(sum(all_validation) / len(all_validation), 1),
            }

            global_rank = my_hospital.get("global_rank") or (
                (my_index + 1) if my_index is not None else None
            )

            ctx = {
                "hospital": my_hospital,
                "case_count": my_hospital.get("case_count", 0),
                "metrics": metrics,
                "global_rank": global_rank,
            }

            hospital_out = {
                "id": my_hospital["id"],
                "name": my_hospital.get("name") or "Your hospital",
                "city": my_hospital.get("city"),
                "country": my_hospital.get("country"),
                "verification_status": my_hospital.get("verification_status"),
                "discovery_score": _score(my_hospital),
                "global_rank": global_rank,
                "case_count": my_hospital.get("case_count", 0),
                "metrics": metrics,
                "network_avg": network_avg,
                "achievements": _build_achievements(ctx),
                "recent_activity": _build_activity_feed(my_hospital_id),
            }

    return {
        "network": network,
        "leaderboard": leaderboard,
        "footprint": footprint,
        "hospital": hospital_out,
    }