"""
Search service.
Core logic for the Global Case Search feature (POST /search).

Pipeline:
  1. Parse the free-text query into structured entities (Groq — best-effort).
  2. Embed the raw query text and run a vector search against Qdrant
     (broad recall set, capped, soft relevance floor).
  3. Enrich hits with Supabase data (submitting doctor + specialty, hospital
     name, and — for the representative case per cluster — its timeline).
  4. Score each hit: match% = 0.6 * vector similarity + 0.4 * structured
     field overlap (falls back to pure vector similarity if Groq gave us
     no structured terms to overlap against).
  5. Compute facets (confidence / region / specialty / outcome) over the
     FULL unfiltered hit set, then apply any requested filters. Every hit
     that survives filtering becomes its own result card — no hospital-level
     clustering/collapsing — so the frontend can list and paginate all of a
     person's matched cases individually.
  6. Aggregate the "Shared Clinical Signature" and "Outcome Intelligence"
     panels from the filtered hit set.

Nothing here is LLM-generated prose — this is a structured data view, so
there is nothing to hallucinate. Groq is only used once, to parse intent
out of the query text; every number shown to the user is computed directly
from Qdrant + Supabase data.
"""

import logging
import uuid
from collections import Counter, defaultdict
from typing import Optional

from fastapi import HTTPException

from app.db.qdrant_client import search_similar, upsert_fingerprint, ensure_collection
from app.db.supabase_client import get_supabase_admin
from app.ml.embedder import embed_text
from app.services import fingerprint_service
from app.services.deidentification_service import check_case_payload
from app.services.groq_service import extract_query_entities
from app.schemas.search import (
    SearchRequest,
    SearchResponse,
    CaseClusterResult,
    TimelineEvent,
    SharedSignature,
    OutcomeIntelligence,
    OutcomeBreakdown,
    SearchFacets,
    FacetCount,
)

logger = logging.getLogger(__name__)

# ── Tunables ─────────────────────────────────────────────────────────────────

RECALL_LIMIT = 200         # how many raw Qdrant hits we pull before filtering —
                            # this (not `limit`) is what caps how many cases can show up
                            # in results, since every hit that survives filtering is now
                            # returned to the frontend for client-side pagination
SCORE_FLOOR = 0.15         # drop hits below this cosine similarity — pure noise
POSITIVE_OUTCOMES = {"recovered", "improved", "resolved", "stable"}
NEGATIVE_OUTCOMES = {"deteriorated", "worsened", "deceased"}

REGION_MAP = {
    # Asia Pacific
    "india": "Asia Pacific", "japan": "Asia Pacific", "china": "Asia Pacific",
    "australia": "Asia Pacific", "south korea": "Asia Pacific", "singapore": "Asia Pacific",
    "indonesia": "Asia Pacific", "thailand": "Asia Pacific", "vietnam": "Asia Pacific",
    "new zealand": "Asia Pacific", "philippines": "Asia Pacific", "malaysia": "Asia Pacific",
    "pakistan": "Asia Pacific", "bangladesh": "Asia Pacific",
    # Europe
    "germany": "Europe", "france": "Europe", "united kingdom": "Europe", "uk": "Europe",
    "italy": "Europe", "spain": "Europe", "netherlands": "Europe", "sweden": "Europe",
    "switzerland": "Europe", "poland": "Europe", "belgium": "Europe", "austria": "Europe",
    "portugal": "Europe", "ireland": "Europe", "norway": "Europe", "denmark": "Europe",
    # North America
    "united states": "North America", "usa": "North America", "us": "North America",
    "canada": "North America", "mexico": "North America",
    # Latin America
    "brazil": "Latin America", "argentina": "Latin America", "chile": "Latin America",
    "colombia": "Latin America", "peru": "Latin America",
    # Middle East & Africa
    "south africa": "Middle East & Africa", "nigeria": "Middle East & Africa",
    "egypt": "Middle East & Africa", "uae": "Middle East & Africa",
    "united arab emirates": "Middle East & Africa", "saudi arabia": "Middle East & Africa",
    "israel": "Middle East & Africa", "kenya": "Middle East & Africa",
    "morocco": "Middle East & Africa", "qatar": "Middle East & Africa",
}

COUNTRY_CODE_MAP = {
    "india": "IN", "japan": "JP", "china": "CN", "australia": "AU", "south korea": "KR",
    "singapore": "SG", "germany": "DE", "france": "FR", "united kingdom": "GB", "uk": "GB",
    "italy": "IT", "spain": "ES", "netherlands": "NL", "sweden": "SE", "switzerland": "CH",
    "united states": "US", "usa": "US", "us": "US", "canada": "CA", "mexico": "MX",
    "brazil": "BR", "argentina": "AR", "south africa": "ZA", "nigeria": "NG", "egypt": "EG",
    "uae": "AE", "united arab emirates": "AE", "saudi arabia": "SA", "israel": "IL",
    "poland": "PL", "belgium": "BE", "austria": "AT", "portugal": "PT", "ireland": "IE",
    "norway": "NO", "denmark": "DK", "indonesia": "ID", "thailand": "TH", "vietnam": "VN",
    "new zealand": "NZ", "philippines": "PH", "malaysia": "MY", "pakistan": "PK",
    "bangladesh": "BD", "chile": "CL", "colombia": "CO", "peru": "PE", "kenya": "KE",
    "morocco": "MA", "qatar": "QA",
}


def _region_of(country: Optional[str]) -> str:
    if not country:
        return "Other"
    return REGION_MAP.get(country.strip().lower(), "Other")


def _country_code_of(country: Optional[str]) -> str:
    if not country:
        return ""
    key = country.strip().lower()
    if key in COUNTRY_CODE_MAP:
        return COUNTRY_CODE_MAP[key]
    return country.strip()[:2].upper()


def _confidence_tier(pct: float) -> str:
    if pct > 90:
        return "very_high"
    if pct >= 75:
        return "high"
    if pct >= 60:
        return "moderate"
    return "low"


CONFIDENCE_LABELS = {
    "very_high": "Very High (>90%)",
    "high": "High (75–90%)",
    "moderate": "Moderate (60–75%)",
    "low": "Low (<60%)",
}


def _norm_list(values) -> list:
    """Lowercase, strip, dedupe a list of strings — tolerant of None/non-list input."""
    if not values:
        return []
    out = []
    for v in values:
        if isinstance(v, str) and v.strip():
            out.append(v.strip().lower())
    return list(dict.fromkeys(out))


def _overlap_ratio(query_terms: list, payload_terms: list) -> Optional[float]:
    """
    Fraction of query_terms that appear (substring match, case-insensitive)
    somewhere in payload_terms. Returns None if there are no query_terms to
    check — callers should fall back to pure vector similarity in that case.
    """
    if not query_terms:
        return None
    haystack = " | ".join(payload_terms)
    if not haystack:
        return 0.0
    hits = 0
    for term in query_terms:
        if term in haystack or any(term in p or p in term for p in payload_terms):
            hits += 1
    return hits / len(query_terms)


def _outcome_color(outcome: str) -> str:
    o = (outcome or "").strip().lower()
    if o in POSITIVE_OUTCOMES:
        return "green"
    if o in NEGATIVE_OUTCOMES:
        return "red"
    if o:
        return "orange"
    return "lavender"


# ─────────────────────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────────────────────

def _recall_limit_for(body: SearchRequest) -> int:
    """
    Widen the recall pool when the caller has filters active — filters are
    applied in Python after clustering, so a filtered search needs a bigger
    raw pool to still surface `limit` clusters after narrowing.
    """
    has_filters = any([body.regions, body.specialties, body.outcomes, body.confidence_tiers])
    return min(RECALL_LIMIT * 2, 400) if has_filters else RECALL_LIMIT


async def run_search(body: SearchRequest, current_user: dict) -> SearchResponse:
    entities = await extract_query_entities(body.query)

    query_terms = _norm_list(
        entities["symptoms"] + entities["lab_markers"] + entities["medications"]
        + ([entities["disease_hint"]] if entities.get("disease_hint") else [])
    )

    vector = embed_text(body.query)
    # exclude_inactive=True (the default) pushes the archived/deleted filter
    # down to Qdrant so RECALL_LIMIT is spent entirely on live cases.
    raw_hits = search_similar(
        vector=vector,
        limit=_recall_limit_for(body),
        score_threshold=SCORE_FLOOR,
    )

    if not raw_hits:
        return _empty_response(body.query, entities["intent"])

    case_ids = [h.payload.get("case_id") for h in raw_hits if h.payload.get("case_id")]
    enriched_map = _fetch_enrichment(case_ids)

    my_hospital_id = current_user.get("hospital_id")

    # Build the per-hit enriched record used for everything downstream.
    hits = []
    for h in raw_hits:
        payload = h.payload or {}
        case_id = payload.get("case_id")
        enrich = enriched_map.get(case_id, {})

        payload_terms = _norm_list(
            (payload.get("symptom_names") or [])
            + (payload.get("lab_markers") or [])
            + (payload.get("medications") or [])
            + ([payload.get("disease")] if payload.get("disease") else [])
        )
        overlap = _overlap_ratio(query_terms, payload_terms)
        vector_score = max(0.0, min(1.0, h.score))
        pct = (
            vector_score * 100
            if overlap is None
            else (0.6 * vector_score + 0.4 * overlap) * 100
        )
        pct = round(min(pct, 99.0), 1)

        hits.append({
            "case_id": case_id,
            "hospital_id": payload.get("hospital_id"),
            "country": payload.get("country"),
            "outcome": payload.get("outcome") or "unknown",
            "status": payload.get("status") or "active",
            "disease": payload.get("disease") or payload.get("diagnosis_icd"),
            "symptom_names": payload.get("symptom_names") or [],
            "lab_markers": payload.get("lab_markers") or [],
            "medications": payload.get("medications") or [],
            "procedures": payload.get("procedures") or [],
            "match_pct": pct,
            "confidence_tier": _confidence_tier(pct),
            "region": _region_of(payload.get("country")),
            "specialty": enrich.get("specialty") or "General Medicine",
            "doctor_name": enrich.get("doctor_name") or "Attending physician",
            "hospital_name": enrich.get("hospital_name") or "Partner hospital",
        })

    facets = _compute_facets(hits)
    filtered = _apply_filters(hits, body)

    if not filtered:
        return SearchResponse(
            query=body.query,
            interpreted_intent=entities["intent"],
            total_cases_found=0,
            countries_count=0,
            results=[],
            shared_signature=SharedSignature(),
            outcome_intelligence=OutcomeIntelligence(matched_case_count=0),
            facets=facets,
        )

    # Every matched case gets its own card — best match first. We no longer
    # collapse same-hospital cases into a single aggregate "cluster" card;
    # the person searching wants to see (and page through) every individual
    # case, not a hospital-level rollup. `filtered` already carries every
    # hit that survived the score floor + facet filters, so nothing here
    # truncates the list — the frontend paginates the full set client-side.
    ordered_hits = sorted(filtered, key=lambda x: x["match_pct"], reverse=True)
    all_case_ids = [h["case_id"] for h in ordered_hits]
    timelines = _fetch_timelines(all_case_ids)
    case_details = _fetch_case_details(all_case_ids)

    # Still useful for the "N cases at this hospital" badge without merging
    # rows together — count occurrences per hospital across the filtered set.
    hospital_case_counts = Counter(h["hospital_id"] or "unknown" for h in ordered_hits)

    results = []
    for hit in ordered_hits:
        tags = [hit["status"].title()]
        if hit["outcome"] and hit["outcome"] != "unknown":
            tags.append(hit["outcome"].title())
        if hit.get("disease"):
            tags.append("Diagnosis confirmed")

        is_own = bool(my_hospital_id) and hit["hospital_id"] == my_hospital_id

        detail = case_details.get(hit["case_id"], {})
        # Real symptom/lab names from Qdrant payload (always present) as the
        # baseline; Supabase row (when reachable) adds onset day / units /
        # flags on top for a richer detail-panel view.
        symptoms = detail.get("symptoms") or [s.title() for s in hit["symptom_names"] if s]
        lab_results = detail.get("lab_results") or [l.upper() for l in hit["lab_markers"] if l]
        procedures = detail.get("procedures") or [p for p in hit["procedures"] if p]

        results.append(CaseClusterResult(
            cluster_id=f"#{_country_code_of(hit['country']) or 'XX'}-{str(hit['case_id'])[:8]}",
            match_score=hit["match_pct"],
            confidence_tier=hit["confidence_tier"],
            hospital_name=hit["hospital_name"],
            country=hit["country"],
            country_code=_country_code_of(hit["country"]),
            specialty=hit["specialty"],
            managing_doctor=hit["doctor_name"],
            case_count=hospital_case_counts.get(hit["hospital_id"] or "unknown", 1),
            outcome_tags=tags[:4],
            timeline=timelines.get(hit["case_id"], []),
            is_own_hospital=is_own,
            representative_case_id=hit["case_id"],
            disease_name=hit.get("disease"),
            symptoms=symptoms,
            lab_results=lab_results,
            procedures=procedures,
        ))

    shared_signature = _build_shared_signature(filtered)
    outcome_intelligence = _build_outcome_intelligence(filtered)

    countries = {h["country"] for h in filtered if h["country"]}

    return SearchResponse(
        query=body.query,
        interpreted_intent=entities["intent"],
        total_cases_found=len(filtered),
        countries_count=len(countries),
        results=results,
        shared_signature=shared_signature,
        outcome_intelligence=outcome_intelligence,
        facets=facets,
    )


def _empty_response(query: str, intent: str) -> SearchResponse:
    return SearchResponse(
        query=query,
        interpreted_intent=intent,
        total_cases_found=0,
        countries_count=0,
        results=[],
        shared_signature=SharedSignature(),
        outcome_intelligence=OutcomeIntelligence(matched_case_count=0),
        facets=SearchFacets(),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Supabase enrichment
# ─────────────────────────────────────────────────────────────────────────────

def _fetch_enrichment(case_ids: list) -> dict:
    """
    case_id -> { doctor_name, specialty, hospital_name }
    Three bounded batch queries (cases -> submitted_by, profiles, hospitals)
    instead of N+1 per-hit lookups.
    """
    if not case_ids:
        return {}

    supabase = get_supabase_admin()
    out = {}

    try:
        cases_resp = (
            supabase.table("cases")
            .select("id, hospital_id, submitted_by")
            .in_("id", case_ids)
            .execute()
        )
        case_rows = cases_resp.data or []
    except Exception:
        case_rows = []

    submitted_by_ids = list({r["submitted_by"] for r in case_rows if r.get("submitted_by")})
    hospital_ids = list({r["hospital_id"] for r in case_rows if r.get("hospital_id")})

    profile_map = {}
    if submitted_by_ids:
        try:
            presp = (
                supabase.table("profiles")
                .select("id, full_name, specialty")
                .in_("id", submitted_by_ids)
                .execute()
            )
            profile_map = {p["id"]: p for p in (presp.data or [])}
        except Exception:
            profile_map = {}

    hospital_map = {}
    if hospital_ids:
        try:
            hresp = (
                supabase.table("hospitals")
                .select("id, name")
                .in_("id", hospital_ids)
                .execute()
            )
            hospital_map = {h["id"]: h for h in (hresp.data or [])}
        except Exception:
            hospital_map = {}

    for row in case_rows:
        profile = profile_map.get(row.get("submitted_by"), {})
        hospital = hospital_map.get(row.get("hospital_id"), {})
        doctor_name = profile.get("full_name")
        out[row["id"]] = {
            "doctor_name": f"Dr. {doctor_name}" if doctor_name and not doctor_name.lower().startswith("dr") else doctor_name,
            "specialty": profile.get("specialty"),
            "hospital_name": hospital.get("name"),
        }

    return out


def _format_lab_result(item: dict) -> Optional[str]:
    """{marker, value, flag} -> 'CRP 42 mg/L (High)' style display string."""
    if not isinstance(item, dict):
        return None
    marker = item.get("marker")
    if not marker:
        return None
    value = item.get("value")
    flag = (item.get("flag") or "").strip()
    label = f"{marker} {value}".strip() if value not in (None, "") else marker
    if flag and flag.lower() != "normal":
        label += f" ({flag.title()})"
    return label


def _fetch_case_details(case_ids: list) -> dict:
    """
    case_id -> { symptoms: [str], lab_results: [str], procedures: [str] }
    Real per-case detail (not mock data) for the cards' detail panel —
    one bounded batch query against Supabase, same pattern as _fetch_timelines.
    """
    if not case_ids:
        return {}

    supabase = get_supabase_admin()
    try:
        resp = (
            supabase.table("cases")
            .select("id, symptoms, lab_results, procedures")
            .in_("id", case_ids)
            .execute()
        )
        rows = resp.data or []
    except Exception:
        rows = []

    out = {}
    for row in rows:
        symptoms_raw = row.get("symptoms") or []
        symptoms = [
            s.get("name") for s in symptoms_raw
            if isinstance(s, dict) and s.get("name")
        ] or [s for s in symptoms_raw if isinstance(s, str) and s]

        lab_raw = row.get("lab_results") or []
        lab_results = [
            l for l in (_format_lab_result(item) for item in lab_raw) if l
        ]

        procedures = [p for p in (row.get("procedures") or []) if p]

        out[row["id"]] = {
            "symptoms": symptoms,
            "lab_results": lab_results,
            "procedures": procedures,
        }
    return out


def _fetch_timelines(case_ids: list) -> dict:
    """case_id -> [TimelineEvent, ...] ordered by day_offset."""
    if not case_ids:
        return {}

    supabase = get_supabase_admin()
    try:
        resp = (
            supabase.table("case_timeline_events")
            .select("case_id, day_offset, event_label, event_category")
            .in_("case_id", case_ids)
            .order("day_offset")
            .execute()
        )
        rows = resp.data or []
    except Exception as e:
        import logging
        logging.exception(f"case_timeline_events fetch failed for {len(case_ids)} case_ids: {e}")
        rows = []

    grouped = defaultdict(list)
    for r in rows:
        grouped[r["case_id"]].append(
            TimelineEvent(
                # day_offset is 0-based (0 = day of admission), so the
                # human-facing day number is always offset + 1.
                day=r["day_offset"] + 1,
                label=r["event_label"],
                category=r.get("event_category"),
                source="recorded",
            )
        )
    return dict(grouped)


# ─────────────────────────────────────────────────────────────────────────────
# Filtering, clustering, facets
# ─────────────────────────────────────────────────────────────────────────────

def _apply_filters(hits: list, body: SearchRequest) -> list:
    out = hits
    if body.regions:
        wanted = set(body.regions)
        out = [h for h in out if h["region"] in wanted]
    if body.specialties:
        wanted = {s.lower() for s in body.specialties}
        out = [h for h in out if (h["specialty"] or "").lower() in wanted]
    if body.outcomes:
        wanted = {o.lower() for o in body.outcomes}
        out = [h for h in out if (h["outcome"] or "").lower() in wanted]
    if body.confidence_tiers:
        wanted = set(body.confidence_tiers)
        out = [h for h in out if h["confidence_tier"] in wanted]
    return out


def _compute_facets(hits: list) -> SearchFacets:
    conf_counts = Counter(h["confidence_tier"] for h in hits)
    region_counts = Counter(h["region"] for h in hits)
    specialty_counts = Counter(h["specialty"] for h in hits if h["specialty"])
    outcome_counts = Counter(h["outcome"] for h in hits if h["outcome"] and h["outcome"] != "unknown")

    tier_order = ["very_high", "high", "moderate", "low"]

    return SearchFacets(
        confidence=[
            FacetCount(value=t, label=CONFIDENCE_LABELS[t], count=conf_counts.get(t, 0))
            for t in tier_order
        ],
        region=[
            FacetCount(value=r, label=r, count=c)
            for r, c in sorted(region_counts.items(), key=lambda kv: -kv[1])
        ],
        specialty=[
            FacetCount(value=s, label=s, count=c)
            for s, c in sorted(specialty_counts.items(), key=lambda kv: -kv[1])
        ],
        outcome=[
            FacetCount(value=o, label=o.title(), count=c)
            for o, c in sorted(outcome_counts.items(), key=lambda kv: -kv[1])
        ],
    )


# ─────────────────────────────────────────────────────────────────────────────
# Shared Clinical Signature + Outcome Intelligence
# ─────────────────────────────────────────────────────────────────────────────

def _build_shared_signature(hits: list) -> SharedSignature:
    n = len(hits)
    if n == 0:
        return SharedSignature()

    symptom_counter = Counter()
    lab_counter = Counter()
    med_outcome = defaultdict(lambda: {"total": 0, "positive": 0})

    for h in hits:
        for s in h["symptom_names"]:
            if s:
                symptom_counter[s] += 1
        for l in h["lab_markers"]:
            if l:
                lab_counter[l] += 1
        for m in h["medications"]:
            if not m:
                continue
            med_outcome[m]["total"] += 1
            if (h["outcome"] or "").lower() in POSITIVE_OUTCOMES:
                med_outcome[m]["positive"] += 1

    threshold = max(1, int(n * 0.3))  # appears in at least ~30% of matches

    symptoms = [s for s, c in symptom_counter.most_common(6) if c >= threshold][:5]
    labs = [l for l, c in lab_counter.most_common(6) if c >= threshold][:5]

    treatment_outcomes = []
    for med, stats in sorted(med_outcome.items(), key=lambda kv: -kv[1]["total"]):
        if stats["total"] < 2:
            continue
        rate = round((stats["positive"] / stats["total"]) * 100)
        treatment_outcomes.append(f"{med} {rate}% response")
        if len(treatment_outcomes) >= 3:
            break

    return SharedSignature(symptoms=symptoms, lab_findings=labs, treatment_outcomes=treatment_outcomes)


def _build_outcome_intelligence(hits: list) -> OutcomeIntelligence:
    n = len(hits)
    if n == 0:
        return OutcomeIntelligence(matched_case_count=0)

    outcome_counter = Counter((h["outcome"] or "unknown").title() for h in hits)
    breakdown = [
        OutcomeBreakdown(label=label, count=count, color=_outcome_color(label))
        for label, count in sorted(outcome_counter.items(), key=lambda kv: -kv[1])
    ]

    med_outcome = defaultdict(lambda: {"total": 0, "positive": 0, "hospitals": set()})
    for h in hits:
        for m in h["medications"]:
            if not m:
                continue
            med_outcome[m]["total"] += 1
            med_outcome[m]["hospitals"].add(h["hospital_id"])
            if (h["outcome"] or "").lower() in POSITIVE_OUTCOMES:
                med_outcome[m]["positive"] += 1

    best_drug, best_rate, best_hosp_count = None, None, None
    for med, stats in med_outcome.items():
        if stats["total"] < 2:
            continue
        rate = stats["positive"] / stats["total"]
        if best_rate is None or rate > best_rate:
            best_drug, best_rate, best_hosp_count = med, rate, len(stats["hospitals"])

    return OutcomeIntelligence(
        matched_case_count=n,
        breakdown=breakdown,
        most_effective_drug=best_drug,
        most_effective_drug_success_rate=round(best_rate * 100, 0) if best_rate is not None else None,
        most_effective_drug_hospital_count=best_hosp_count,
    )


# ── CLI sync case creation ───────────────────────────────────────────────────
#
# This is what cli_sync.py's POST /api/cli/sync router calls for every
# non-duplicate case in a batch. It didn't exist at all before, so every
# sync that got past auth was crashing with an AttributeError before a
# single row reached Supabase or Qdrant. Mirrors the dual-write pattern
# used for the web app's case intake (Supabase row -> Qdrant fingerprint),
# but keyed on the CLI's own deterministic fingerprint_id instead of a
# freshly generated one, since that's what makes a retried sync of the
# same local record a no-op duplicate rather than a second case.


def _qdrant_point_id_for(fingerprint_id: str) -> str:
    """
    Qdrant point IDs must be an unsigned int or a UUID string. The CLI's
    fingerprint_id is a sha256 hex digest (see tokenizer.deterministic_
    record_key), which Qdrant rejects outright — so derive a stable UUID5
    from it instead. Same fingerprint_id always maps to the same point,
    which keeps a retried sync idempotent on the Qdrant side too.
    """
    return str(uuid.uuid5(uuid.NAMESPACE_OID, fingerprint_id))


def create_case_with_fingerprint_id(
    case_data: dict,
    hospital_id: str,
    submitted_by: str,
    fingerprint_id: str,
) -> dict:
    """
    Persists one CLI-synced case: inserts the Supabase row, then embeds and
    upserts its fingerprint into Qdrant. Raises DeidentificationError (from
    deidentification_service) or HTTPException on failure — both are
    already handled by cli_sync.py's caller.
    """
    # Last line of defense against obvious PII, same guard the web app's
    # /cases/submit runs before anything is embedded or stored.
    check_case_payload(case_data)

    supabase = get_supabase_admin()

    insert_row = {
        **case_data,
        "hospital_id": hospital_id,
        "submitted_by": submitted_by,
        "fingerprint_id": fingerprint_id,
        "status": "active",
    }

    try:
        insert_resp = supabase.table("cases").insert(insert_row).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save case to Supabase: {e}")

    if not insert_resp.data:
        raise HTTPException(status_code=500, detail="Case insert to Supabase returned no row.")

    case_row = insert_resp.data[0]
    case_id = case_row["id"]

    qdrant_point_id = _qdrant_point_id_for(fingerprint_id)
    text = fingerprint_service.build_fingerprint_text(case_data)
    vector = embed_text(text)

    qdrant_payload = {
        "case_id": case_id,
        "hospital_id": hospital_id,
        "country": case_data.get("country"),
        "outcome": case_data.get("outcome"),
        "status": "active",
        "disease": case_data.get("disease") or case_data.get("diagnosis_icd"),
        "diagnosis_icd": case_data.get("diagnosis_icd"),
        "age_range": case_data.get("age_range"),
        "symptom_names": [s.get("name") for s in case_data.get("symptoms", []) if s.get("name")],
        "lab_markers": [l.get("marker") for l in case_data.get("lab_results", []) if l.get("marker")],
        "medications": [m.get("name") for m in case_data.get("medications", []) if m.get("name")],
        "procedures": case_data.get("procedures", []),
    }

    try:
        ensure_collection()
        upsert_fingerprint(fingerprint_id=qdrant_point_id, vector=vector, payload=qdrant_payload)
    except Exception as e:
        # Don't leave a case sitting in Supabase that's permanently
        # invisible to every Qdrant-backed search — roll it back and fail
        # the whole case so the CLI reports it as rejected and the user's
        # next sync attempt retries it cleanly.
        try:
            supabase.table("cases").delete().eq("id", case_id).execute()
        except Exception:
            logger.exception(
                "Qdrant upsert failed AND rollback of cases row id=%s also failed — "
                "this row now exists in Supabase with no Qdrant fingerprint.", case_id,
            )
        raise HTTPException(status_code=502, detail=f"Case saved but failed to index for search: {e}")

    return case_row