"""
Discovery pipeline — turns real case data into real `research_signals` rows.

run_discovery_scan():
  1. Pull every active case's structured fields from Supabase (`cases`:
     symptoms, lab_results, medications, ...) — the same fields fingerprint_service
     already turns into embedding text at intake time, reused here verbatim.
  2. Batch-embed all of them (app.ml.embedder.embed_texts).
  3. HDBSCAN-cluster the vectors (app.ml.clustering).
  4. For each cluster (min 3 cases): compute the 4 consensus scores +
     confidence (app.services.scoring_service), an LLM-generated title/summary/
     signal_type/tags (app.agents.discovery_agent), and per-case similarity to
     the cluster centroid.
  5. Upsert into `research_signals` + `research_signal_cases`, keyed by a
     stable hash of the case-id set (`cluster_key`) so re-running the scan
     updates existing signals instead of duplicating them.

Safe to call repeatedly — e.g. from a scheduled task or an on-demand
"Run Discovery Scan" button (POST /feed/scan).
"""

import hashlib
import logging
from collections import Counter
from datetime import datetime, timezone
from typing import List

from app.agents.discovery_agent import generate_signal_narrative
from app.db.supabase_client import get_supabase_admin
from app.ml import clustering
from app.ml.embedder import embed_texts
from app.services import scoring_service
from app.services.fingerprint_service import build_fingerprint_text

logger = logging.getLogger("medidata.feed_stats")

MIN_CLUSTER_SIZE = 3

CASE_FIELDS = (
    "id, hospital_id, country, age_range, sex, symptoms, lab_results, "
    "medications, procedures, imaging_metadata, genomic_metadata, "
    "clinical_notes_summary, outcome, local_patient_ref_hash, created_at"
)


def _fetch_active_cases() -> List[dict]:
    supabase = get_supabase_admin()
    resp = supabase.table("cases").select(CASE_FIELDS).eq("status", "active").execute()
    logger.info("SCAN DEBUG -> raw resp.data length = %r", len(resp.data or []))
    logger.info("SCAN DEBUG -> resp has 'error' attr? %r", getattr(resp, "error", "NO ERROR ATTR"))
    if resp.data:
        logger.info("SCAN DEBUG -> first case id = %r", resp.data[0].get("id"))
    return resp.data or []


def _hospital_name_map(hospital_ids: List[str]) -> dict:
    if not hospital_ids:
        return {}
    supabase = get_supabase_admin()
    resp = supabase.table("hospitals").select("id, name").in_("id", list(set(hospital_ids))).execute()
    return {row["id"]: row["name"] for row in (resp.data or [])}


def _cluster_key(case_ids: List[str]) -> str:
    joined = "|".join(sorted(str(c) for c in case_ids))
    return hashlib.sha256(joined.encode()).hexdigest()[:32]


def _top_n(counter: Counter, n: int = 5) -> List[str]:
    return [item for item, _ in counter.most_common(n) if item]


def _extract_names(case: dict, field: str, key_candidates: tuple) -> List[str]:
    """symptoms/lab_results/medications are jsonb lists of dicts with varying
    key names (name/marker) depending on the field — pull whichever is present."""
    items = case.get(field) or []
    names = []
    for item in items:
        if isinstance(item, dict):
            for k in key_candidates:
                if item.get(k):
                    names.append(str(item[k]).strip())
                    break
        elif isinstance(item, str):
            names.append(item.strip())
    return [n for n in names if n]


async def run_discovery_scan() -> dict:
    supabase = get_supabase_admin()
    cases = _fetch_active_cases()

    if len(cases) < MIN_CLUSTER_SIZE:
        return {"cases_scanned": len(cases), "clusters_found": 0, "signals_created": 0, "signals_updated": 0}

    texts = [build_fingerprint_text(c) for c in cases]
    vectors = embed_texts(texts)

    labels = clustering.cluster_vectors(vectors, min_cluster_size=MIN_CLUSTER_SIZE)
    items = [{"case": c, "vector": v} for c, v in zip(cases, vectors)]
    groups = clustering.group_by_label(items, labels)

    all_hospital_ids = [c.get("hospital_id") for c in cases if c.get("hospital_id")]
    hospital_names = _hospital_name_map(all_hospital_ids)

    created, updated = 0, 0

    for cluster_items in groups.values():
        cluster_cases = [ci["case"] for ci in cluster_items]
        cluster_vectors_ = [ci["vector"] for ci in cluster_items]
        case_ids = [c["id"] for c in cluster_cases]

        if len(case_ids) < MIN_CLUSTER_SIZE:
            continue

        countries = Counter(c.get("country") for c in cluster_cases if c.get("country"))
        hospital_ids = Counter(c.get("hospital_id") for c in cluster_cases if c.get("hospital_id"))
        patient_hashes = {c.get("local_patient_ref_hash") for c in cluster_cases if c.get("local_patient_ref_hash")}

        symptoms = Counter(n for c in cluster_cases for n in _extract_names(c, "symptoms", ("name",)))
        labs = Counter(n for c in cluster_cases for n in _extract_names(c, "lab_results", ("marker",)))
        meds = Counter(n for c in cluster_cases for n in _extract_names(c, "medications", ("name",)))

        top_symptoms = _top_n(symptoms)
        top_labs = _top_n(labs)
        top_meds = _top_n(meds)

        cohesion = clustering.cluster_cohesion(cluster_vectors_)
        similarities = clustering.cosine_similarities_to_centroid(cluster_vectors_)
        case_dates = [c.get("created_at") for c in cluster_cases]

        scores = scoring_service.compute_scores(
            n_cases=len(case_ids),
            n_countries=len(countries),
            n_hospitals=len(hospital_ids),
            cohesion=cohesion,
            hospital_case_counts=list(hospital_ids.values()),
            cases=cluster_cases,
            case_dates=case_dates,
        )

        narrative = await generate_signal_narrative(
            symptom_pattern=top_symptoms, lab_pattern=top_labs, med_pattern=top_meds,
            countries=list(countries.keys()), n_cases=len(case_ids), domain=None,
        )

        key = _cluster_key(case_ids)
        participating_hospital_names = [hospital_names.get(hid, str(hid)) for hid in hospital_ids.keys()]

        row = {
            "cluster_key": key,
            "signal_type": narrative["signal_type"],
            "status": "active",
            "title": narrative["title"],
            "summary": narrative["summary"],
            "confidence": scores["confidence"],
            "case_count": len(case_ids),
            "patient_count": len(patient_hashes) if patient_hashes else len(case_ids),
            "hospital_count": len(hospital_ids),
            "countries": list(countries.keys()),
            "participating_hospitals": participating_hospital_names,
            "tags": narrative.get("tags") or [],
            "evidence_score": scores["evidence_score"],
            "reproducibility_score": scores["reproducibility_score"],
            "hospital_diversity_score": scores["hospital_diversity_score"],
            "data_quality_score": scores["data_quality_score"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        existing = supabase.table("research_signals").select("id").eq("cluster_key", key).execute()

        if existing.data:
            signal_id = existing.data[0]["id"]
            supabase.table("research_signals").update(row).eq("id", signal_id).execute()
            supabase.table("research_signal_cases").delete().eq("research_signal_id", signal_id).execute()
            updated += 1
        else:
            insert_resp = supabase.table("research_signals").insert(row).execute()
            signal_id = insert_resp.data[0]["id"]
            created += 1

        join_rows = [
            {"research_signal_id": signal_id, "case_id": cid, "similarity_score": round(sim, 4)}
            for cid, sim in zip(case_ids, similarities)
        ]
        if join_rows:
            supabase.table("research_signal_cases").insert(join_rows).execute()

    return {
        "cases_scanned": len(cases),
        "clusters_found": len(groups),
        "signals_created": created,
        "signals_updated": updated,
    }