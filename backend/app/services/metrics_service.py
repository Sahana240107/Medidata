"""
Metrics engine for the Hospital Insights page.

Why this exists: `hospital_metrics.*` and `hospitals.discovery_score` are
plain columns — nothing in the schema keeps them in sync with what's
actually happening in `cases`, `collaborations`, `research_signals`, and
`validation_requests`. Left alone they just sit at their DEFAULT 0, which
is why the Insights page showed zeroes everywhere.

This module is the write side: it derives every score from real rows,
inserts a fresh `hospital_metrics` snapshot, and updates
`hospitals.discovery_score` / `hospitals.global_rank`. `hospital_service`
calls `recompute_hospital_metrics()` for the caller's own hospital on
every Insights page load, so the numbers shown are never more than one
request stale. `recompute_all_hospital_metrics()` does the same for every
node in the network and is meant to be run on a schedule (see
backend/scripts/recompute_metrics.py) so leaderboard ranks stay current
even for hospitals nobody is actively viewing.

Scoring model (all scores are 0-100):
  disease_discoveries               = count of *published* research
                                       signals traced back to this
                                       hospital's cases
  emerging_syndrome_identifications = count of 'emerging_syndrome'
                                       signals traced back to this
                                       hospital's cases (any status)
  published_collaborations          = collaborations involving one of
                                       this hospital's doctors that have
                                       reached 'completed' or 'active'
  collaboration_score   = min(100, published_collaborations * 12
                                    + active_doctor_count * 2)
  research_impact_score = min(100, disease_discoveries * 20
                                    + emerging_syndrome_ids * 15
                                    + published_collaborations * 4
                                    + case_count * 0.5)
  validation_score      = % of this hospital's validation_requests that
                           were answered and confirmed
  discovery_score        = min(100, case_count * 1.5
                                     + disease_discoveries * 12
                                     + emerging_syndrome_ids * 10
                                     + published_collaborations * 4
                                     + validation_score * 0.15)

These weights are intentionally simple and documented here so they're
easy to retune later — nothing about the shape of the pipeline depends
on the exact numbers.
"""

from app.db.supabase_client import get_supabase_admin

COMPLETED_COLLAB_STATUSES = ("completed", "active")
CONFIRMED_VALIDATION_STATUSES = ("confirmed",)
RESPONDED_VALIDATION_STATUSES = ("confirmed", "refuted", "responded")


def _case_count(supabase, hospital_id: str) -> int:
    resp = (
        supabase.table("cases")
        .select("id", count="exact")
        .eq("hospital_id", hospital_id)
        .execute()
    )
    return resp.count or 0


def _case_ids(supabase, hospital_id: str) -> list:
    resp = supabase.table("cases").select("id").eq("hospital_id", hospital_id).execute()
    return [c["id"] for c in (resp.data or [])]


def _profile_ids(supabase, hospital_id: str) -> list:
    resp = supabase.table("profiles").select("id").eq("hospital_id", hospital_id).execute()
    return [p["id"] for p in (resp.data or [])]


def _signal_counts(supabase, case_ids: list) -> tuple:
    """
    Walks research_signal_cases -> research_signals for this hospital's
    cases and returns (disease_discoveries, emerging_syndrome_count),
    counting each distinct signal once.
    """
    if not case_ids:
        return 0, 0
    try:
        resp = (
            supabase.table("research_signal_cases")
            .select("research_signal_id, research_signals(signal_type, status)")
            .in_("case_id", case_ids)
            .execute()
        )
        rows = resp.data or []
    except Exception:
        rows = []

    seen_signal_ids = set()
    published_signal_ids = set()
    emerging_signal_ids = set()
    for row in rows:
        sid = row.get("research_signal_id")
        if not sid or sid in seen_signal_ids:
            continue
        seen_signal_ids.add(sid)
        signal = row.get("research_signals") or {}
        if signal.get("status") == "published":
            published_signal_ids.add(sid)
        if signal.get("signal_type") == "emerging_syndrome":
            emerging_signal_ids.add(sid)

    return len(published_signal_ids), len(emerging_signal_ids)


def _published_collaborations(supabase, profile_ids: list) -> int:
    if not profile_ids:
        return 0
    try:
        resp = (
            supabase.table("collaborations")
            .select("id, status")
            .or_(
                f"requested_by.in.({','.join(profile_ids)}),"
                f"requested_to.in.({','.join(profile_ids)})"
            )
            .execute()
        )
        rows = resp.data or []
    except Exception:
        rows = []
    return sum(1 for r in rows if r.get("status") in COMPLETED_COLLAB_STATUSES)


def _validation_score(supabase, hospital_id: str) -> float:
    try:
        resp = (
            supabase.table("validation_requests")
            .select("status")
            .eq("hospital_id", hospital_id)
            .execute()
        )
        rows = resp.data or []
    except Exception:
        rows = []

    responded = [r for r in rows if r.get("status") in RESPONDED_VALIDATION_STATUSES]
    if not responded:
        return 0.0
    confirmed = sum(1 for r in responded if r.get("status") in CONFIRMED_VALIDATION_STATUSES)
    return round((confirmed / len(responded)) * 100, 1)


def compute_hospital_metrics(hospital_id: str) -> dict:
    """Pure computation (no writes) — every number derived live from Supabase."""
    supabase = get_supabase_admin()

    case_count = _case_count(supabase, hospital_id)
    case_ids = _case_ids(supabase, hospital_id)
    profile_ids = _profile_ids(supabase, hospital_id)

    disease_discoveries, emerging_syndrome_identifications = _signal_counts(supabase, case_ids)
    published_collaborations = _published_collaborations(supabase, profile_ids)
    validation_score = _validation_score(supabase, hospital_id)

    collaboration_score = round(
        min(100, published_collaborations * 12 + len(profile_ids) * 2), 1
    )
    research_impact_score = round(
        min(
            100,
            disease_discoveries * 20
            + emerging_syndrome_identifications * 15
            + published_collaborations * 4
            + case_count * 0.5,
        ),
        1,
    )
    discovery_score = round(
        min(
            100,
            case_count * 1.5
            + disease_discoveries * 12
            + emerging_syndrome_identifications * 10
            + published_collaborations * 4
            + validation_score * 0.15,
        ),
        1,
    )

    return {
        "hospital_id": hospital_id,
        "case_count": case_count,
        "disease_discoveries": disease_discoveries,
        "published_collaborations": published_collaborations,
        "emerging_syndrome_identifications": emerging_syndrome_identifications,
        "collaboration_score": collaboration_score,
        "research_impact_score": research_impact_score,
        "validation_score": validation_score,
        "discovery_score": discovery_score,
    }


def recompute_hospital_metrics(hospital_id: str) -> dict:
    """
    Computes fresh metrics for one hospital and persists them:
      - inserts a new `hospital_metrics` row (the table is a time series,
        so history of past snapshots is preserved)
      - updates `hospitals.discovery_score`

    Returns the computed metrics dict so callers can use them immediately
    without a second round-trip to Supabase.
    """
    supabase = get_supabase_admin()
    metrics = compute_hospital_metrics(hospital_id)

    try:
        supabase.table("hospital_metrics").insert({
            "hospital_id": hospital_id,
            "disease_discoveries": metrics["disease_discoveries"],
            "published_collaborations": metrics["published_collaborations"],
            "emerging_syndrome_identifications": metrics["emerging_syndrome_identifications"],
            "collaboration_score": metrics["collaboration_score"],
            "research_impact_score": metrics["research_impact_score"],
            "validation_score": metrics["validation_score"],
        }).execute()
    except Exception:
        pass  # insights page still works off the computed dict even if the write fails

    try:
        supabase.table("hospitals").update({
            "discovery_score": metrics["discovery_score"],
        }).eq("id", hospital_id).execute()
    except Exception:
        pass

    return metrics


def recompute_all_hospital_metrics() -> list:
    """
    Recomputes and persists metrics for every hospital in the network,
    then re-ranks all of them by discovery_score and writes
    `hospitals.global_rank` for each. Meant to run on a schedule (cron /
    background worker) — see backend/scripts/recompute_metrics.py — since
    doing this for every hospital on every page load would be wasteful.
    """
    supabase = get_supabase_admin()
    try:
        hospitals = (supabase.table("hospitals").select("id").execute()).data or []
    except Exception:
        hospitals = []

    all_metrics = [recompute_hospital_metrics(h["id"]) for h in hospitals]

    ranked = sorted(all_metrics, key=lambda m: m["discovery_score"], reverse=True)
    for idx, m in enumerate(ranked, start=1):
        try:
            supabase.table("hospitals").update({"global_rank": idx}).eq(
                "id", m["hospital_id"]
            ).execute()
        except Exception:
            pass
        m["global_rank"] = idx

    return ranked
