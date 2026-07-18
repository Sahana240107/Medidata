"""
Expert service — powers the Experts page cards, filters, and the Network
Activity table.

Deliberately does manual joins (fetch profiles, then fetch related
expert_stats/hospitals by id, merge in Python) rather than relying on
PostgREST's automatic FK-embedding syntax. `profiles` has two incoming FKs
from `collaborations` (requested_by / requested_to) and hospitals has a
back-reference to profiles too, so embed queries are ambiguous without very
exact constraint-name hints. Manual joins are more verbose but predictable.
"""

from collections import defaultdict
from typing import Optional

from fastapi import HTTPException, status

from app.db.supabase_client import get_supabase_admin

PROFILE_COLUMNS = (
    "id, full_name, avatar_url, bio, country, specialty, orcid_id, "
    "hospital_id, verification_status, role"
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _fetch_hospitals_by_id(hospital_ids: set[str]) -> dict[str, dict]:
    if not hospital_ids:
        return {}
    supabase = get_supabase_admin()
    resp = (
        supabase.table("hospitals")
        .select("id, name, country, city")
        .in_("id", list(hospital_ids))
        .execute()
    )
    return {h["id"]: h for h in (resp.data or [])}


def _fetch_expert_stats_by_doctor(doctor_ids: set[str]) -> dict[str, list[dict]]:
    if not doctor_ids:
        return {}
    supabase = get_supabase_admin()
    resp = (
        supabase.table("expert_stats")
        .select("doctor_id, topic, similar_cases_managed, publications")
        .in_("doctor_id", list(doctor_ids))
        .execute()
    )
    by_doctor: dict[str, list[dict]] = defaultdict(list)
    for row in resp.data or []:
        by_doctor[row["doctor_id"]].append(row)
    return by_doctor


def _fetch_connection_map(current_user_id: str, other_ids: set[str]) -> dict[str, dict]:
    """
    For each `other_id`, find any existing collaboration row between them and
    the caller. Returns {other_id: {"status": "...", "collaboration_id": "...", "direction": "..."}}
    """
    if not other_ids:
        return {}
    supabase = get_supabase_admin()

    sent = (
        supabase.table("collaborations")
        .select("id, requested_by, requested_to, status")
        .eq("requested_by", current_user_id)
        .in_("requested_to", list(other_ids))
        .execute()
    )
    received = (
        supabase.table("collaborations")
        .select("id, requested_by, requested_to, status")
        .eq("requested_to", current_user_id)
        .in_("requested_by", list(other_ids))
        .execute()
    )

    out: dict[str, dict] = {}
    for row in (sent.data or []):
        out[row["requested_to"]] = {
            "collaboration_id": row["id"],
            "status": "connected" if row["status"] == "accepted" else "pending_sent",
        }
    for row in (received.data or []):
        # Don't let an older "sent" row get clobbered if both directions somehow exist.
        out.setdefault(row["requested_by"], {
            "collaboration_id": row["id"],
            "status": "connected" if row["status"] == "accepted" else "pending_received",
        })
    return out


def _stats_summary(rows: list[dict]) -> tuple[int, int, list[str]]:
    cases = sum(r.get("similar_cases_managed") or 0 for r in rows)
    pubs = sum(r.get("publications") or 0 for r in rows)
    topics = [r["topic"] for r in rows if r.get("topic")]
    return cases, pubs, topics


def _to_card(profile: dict, hospitals: dict, stats_by_doctor: dict, connections: dict) -> dict:
    hospital = hospitals.get(profile.get("hospital_id"))
    cases, pubs, topics = _stats_summary(stats_by_doctor.get(profile["id"], []))
    conn = connections.get(profile["id"], {})

    return {
        "id": profile["id"],
        "full_name": profile["full_name"],
        "avatar_url": profile.get("avatar_url"),
        "specialty": profile.get("specialty"),
        "country": profile.get("country"),
        "bio": profile.get("bio"),
        "orcid_id": profile.get("orcid_id"),
        "verification_status": profile.get("verification_status", "pending"),
        "hospital": {
            "id": hospital.get("id") if hospital else None,
            "name": hospital.get("name") if hospital else None,
            "country": hospital.get("country") if hospital else None,
            "city": hospital.get("city") if hospital else None,
        } if hospital else None,
        "cases_managed": cases,
        "publications": pubs,
        "topics": topics,
        "connection_status": conn.get("status", "none"),
        "collaboration_id": conn.get("collaboration_id"),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def list_experts(
    current_user_id: str,
    specialty: Optional[str] = None,
    country: Optional[str] = None,
    search: Optional[str] = None,
    verification_status: Optional[str] = None,
    sort: str = "cases",  # 'cases' | 'publications' | 'name'
    limit: int = 24,
    offset: int = 0,
) -> dict:
    supabase = get_supabase_admin()

    query = supabase.table("profiles").select(PROFILE_COLUMNS, count="exact").neq("id", current_user_id)

    if specialty:
        query = query.ilike("specialty", f"%{specialty}%")
    if country:
        query = query.eq("country", country)
    if verification_status:
        query = query.eq("verification_status", verification_status)
    if search:
        # PostgREST `or` filter across a couple of free-text columns.
        query = query.or_(f"full_name.ilike.%{search}%,specialty.ilike.%{search}%,bio.ilike.%{search}%")

    resp = query.execute()
    profiles = resp.data or []
    total = resp.count if resp.count is not None else len(profiles)

    hospital_ids = {p["hospital_id"] for p in profiles if p.get("hospital_id")}
    doctor_ids = {p["id"] for p in profiles}

    hospitals = _fetch_hospitals_by_id(hospital_ids)
    stats_by_doctor = _fetch_expert_stats_by_doctor(doctor_ids)
    connections = _fetch_connection_map(current_user_id, doctor_ids)

    cards = [_to_card(p, hospitals, stats_by_doctor, connections) for p in profiles]

    if sort == "publications":
        cards.sort(key=lambda c: -c["publications"])
    elif sort == "name":
        cards.sort(key=lambda c: c["full_name"].lower())
    else:
        cards.sort(key=lambda c: -c["cases_managed"])

    # Apply pagination after in-Python sort (profile count is expected to be
    # modest for a hospital network; revisit with DB-side sort if it grows).
    page = cards[offset: offset + limit]

    return {"items": page, "total": total}


def get_expert(current_user_id: str, expert_id: str) -> dict:
    supabase = get_supabase_admin()
    resp = supabase.table("profiles").select(PROFILE_COLUMNS).eq("id", expert_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expert not found.")

    profile = resp.data
    hospitals = _fetch_hospitals_by_id({profile["hospital_id"]} if profile.get("hospital_id") else set())
    stats_by_doctor = _fetch_expert_stats_by_doctor({expert_id})
    connections = _fetch_connection_map(current_user_id, {expert_id})

    return _to_card(profile, hospitals, stats_by_doctor, connections)


def get_filter_options() -> dict:
    supabase = get_supabase_admin()
    resp = supabase.table("profiles").select("specialty, country").execute()
    rows = resp.data or []
    specialties = sorted({r["specialty"] for r in rows if r.get("specialty")})
    countries = sorted({r["country"] for r in rows if r.get("country")})
    return {"specialties": specialties, "countries": countries}


def get_network_activity(limit: int = 10) -> list[dict]:
    """
    "Network Activity" table: top contributing experts by case volume, with
    their leading topic as the focus area and verification_status as the
    status badge. Grounded entirely in expert_stats + profiles + hospitals --
    no dependency on the not-yet-built research_signals -> PI linkage.
    """
    supabase = get_supabase_admin()
    stats_resp = (
        supabase.table("expert_stats")
        .select("doctor_id, topic, similar_cases_managed, publications")
        .execute()
    )
    stats_rows = stats_resp.data or []
    if not stats_rows:
        return []

    by_doctor: dict[str, list[dict]] = defaultdict(list)
    for row in stats_rows:
        by_doctor[row["doctor_id"]].append(row)

    doctor_ids = set(by_doctor.keys())
    profiles_resp = (
        supabase.table("profiles")
        .select("id, full_name, hospital_id, verification_status")
        .in_("id", list(doctor_ids))
        .execute()
    )
    profiles = {p["id"]: p for p in (profiles_resp.data or [])}
    hospital_ids = {p["hospital_id"] for p in profiles.values() if p.get("hospital_id")}
    hospitals = _fetch_hospitals_by_id(hospital_ids)

    rows = []
    for doctor_id, entries in by_doctor.items():
        profile = profiles.get(doctor_id)
        if not profile:
            continue
        cases, _, topics = _stats_summary(entries)
        top_topic = max(entries, key=lambda e: e.get("similar_cases_managed") or 0).get("topic") or "General"
        hospital = hospitals.get(profile.get("hospital_id"))
        rows.append({
            "doctor_id": doctor_id,
            "full_name": profile["full_name"],
            "hospital_name": hospital.get("name") if hospital else None,
            "focus_area": top_topic,
            "cases_managed": cases,
            "status": profile.get("verification_status", "pending"),
        })

    rows.sort(key=lambda r: -r["cases_managed"])
    rows = rows[:limit]

    max_cases = max((r["cases_managed"] for r in rows), default=0) or 1
    for r in rows:
        r["signal_strength_pct"] = round((r["cases_managed"] / max_cases) * 100)

    return rows