"""
Analytics tool layer.

Every function here is a pure, self-contained analytical pattern that the
research chat agent can call. Rules that apply to ALL of them:

  - Return structured JSON (dict) only. Never prose. The LLM turns this
    into an answer; these functions just compute numbers.
  - Always include `case_count` (or per-group counts) so the agent can
    state "based on N cases" and the frontend can show the evidence panel.
  - Always include `low_confidence` (bool) using MIN_CONFIDENT_CASE_COUNT,
    so the agent is forced to see when it's about to generalize from a
    handful of cases.
  - Unknown disease names resolve via data_access.resolve_disease_name and
    return an explicit `error` key instead of silently returning zeros —
    an LLM given `{"case_count": 0}` for a typo'd disease will confidently
    report "0% of patients", which is worse than surfacing the typo.
"""

from collections import Counter
from typing import Optional

from app.core.constants import (
    AGE_BUCKET_MIDPOINTS,
    DEFAULT_EVIDENCE_TOP_K,
    DEFAULT_MIMIC_TOP_N,
    DEFAULT_TOP_N_SYMPTOMS,
    MIN_CONFIDENT_CASE_COUNT,
)
from app.db.qdrant_client import search_similar
from app.ml.embedder import embed_text
from app.tools import data_access as da


def _unknown_disease_error(raw: str) -> dict:
    known = da.get_all_disease_names()
    suggestions = [n for n in known if raw.lower()[:4] in n.lower()][:5]
    return {
        "error": f"No disease matching '{raw}' found in the dataset.",
        "did_you_mean": suggestions or known[:10],
    }


def _pct(n: int, total: int) -> float:
    return round(100 * n / total, 1) if total else 0.0


# ── 1. Frequency / aggregation tools ────────────────────────────────────────

def symptom_frequency(disease: str, top_n: int = DEFAULT_TOP_N_SYMPTOMS) -> dict:
    """Most common symptoms for a disease, with counts and percentages."""
    resolved = da.resolve_disease_name(disease)
    if not resolved:
        return _unknown_disease_error(disease)

    cases = da.fetch_cases_for_disease(resolved)
    total = len(cases)
    counter: Counter = Counter()
    for case in cases:
        for symptom in set(da.case_symptoms(case)):
            counter[symptom] += 1

    top = counter.most_common(top_n)
    return {
        "disease": resolved,
        "case_count": total,
        "low_confidence": total < MIN_CONFIDENT_CASE_COUNT,
        "symptoms": [
            {"symptom": s, "case_count": c, "pct_of_cases": _pct(c, total)}
            for s, c in top
        ],
    }


def medication_frequency(disease: str, top_n: int = DEFAULT_TOP_N_SYMPTOMS) -> dict:
    """
    Most common medications recorded for a disease, with case counts and
    percentages. Mirrors symptom_frequency() but over the medications
    field. Powers open-ended "what medications/drugs are used for X"
    questions, as distinct from compare_drug_outcomes() which needs two
    specific drug names already in hand.
    """
    resolved = da.resolve_disease_name(disease)
    if not resolved:
        return _unknown_disease_error(disease)

    cases = da.fetch_cases_for_disease(resolved)
    total = len(cases)
    counter: Counter = Counter()
    for case in cases:
        for medication in set(da.case_medications(case)):
            counter[medication] += 1

    top = counter.most_common(top_n)
    return {
        "disease": resolved,
        "case_count": total,
        "low_confidence": total < MIN_CONFIDENT_CASE_COUNT,
        "medications": [
            {"medication": m, "case_count": c, "pct_of_cases": _pct(c, total)}
            for m, c in top
        ],
    }


def country_distribution(disease: str) -> dict:
    """Case counts by country for a disease, sorted descending."""
    resolved = da.resolve_disease_name(disease)
    if not resolved:
        return _unknown_disease_error(disease)

    cases = da.fetch_cases_for_disease(resolved)
    total = len(cases)
    counter = Counter(c["country"] for c in cases if c.get("country"))

    return {
        "disease": resolved,
        "case_count": total,
        "low_confidence": total < MIN_CONFIDENT_CASE_COUNT,
        "countries": [
            {"country": country, "case_count": n, "pct_of_cases": _pct(n, total)}
            for country, n in counter.most_common()
        ],
    }


def age_distribution(disease: str) -> dict:
    """Age-bucket distribution + an approximate average age (bucket midpoints)."""
    resolved = da.resolve_disease_name(disease)
    if not resolved:
        return _unknown_disease_error(disease)

    cases = da.fetch_cases_for_disease(resolved)
    total = len(cases)
    counter = Counter(c["age_range"] for c in cases if c.get("age_range"))

    weighted_sum, weighted_n = 0, 0
    for bucket, n in counter.items():
        midpoint = AGE_BUCKET_MIDPOINTS.get(bucket)
        if midpoint is not None:
            weighted_sum += midpoint * n
            weighted_n += n
    approx_average_age = round(weighted_sum / weighted_n, 1) if weighted_n else None

    return {
        "disease": resolved,
        "case_count": total,
        "low_confidence": total < MIN_CONFIDENT_CASE_COUNT,
        "age_buckets": [
            {"age_range": bucket, "case_count": n, "pct_of_cases": _pct(n, total)}
            for bucket, n in sorted(counter.items())
        ],
        "approx_average_age": approx_average_age,
        "note": "age_range is a bucketed field (e.g. '30-40'); average is estimated from bucket midpoints, not exact ages.",
    }


def outcome_stats(disease: str) -> dict:
    """Outcome breakdown (recovered / deteriorated / unresolved / ...) for a disease."""
    resolved = da.resolve_disease_name(disease)
    if not resolved:
        return _unknown_disease_error(disease)

    cases = da.fetch_cases_for_disease(resolved)
    total = len(cases)
    counter = Counter(c["outcome"] for c in cases if c.get("outcome"))

    return {
        "disease": resolved,
        "case_count": total,
        "low_confidence": total < MIN_CONFIDENT_CASE_COUNT,
        "outcomes": [
            {"outcome": outcome, "case_count": n, "pct_of_cases": _pct(n, total)}
            for outcome, n in counter.most_common()
        ],
    }


# ── 2. Comparison tool ───────────────────────────────────────────────────────

def compare_diseases(disease_a: str, disease_b: str, top_n: int = 15) -> dict:
    """
    Symptom-profile overlap between two diseases: shared vs. distinctive
    symptoms. Powers "differentiate X from Y" and "what mimics X" style
    questions when the two candidates are already known.
    """
    resolved_a = da.resolve_disease_name(disease_a)
    resolved_b = da.resolve_disease_name(disease_b)
    if not resolved_a:
        return _unknown_disease_error(disease_a)
    if not resolved_b:
        return _unknown_disease_error(disease_b)

    matrix, case_counts = da.get_disease_symptom_matrix()
    freq_a = matrix.get(resolved_a, Counter())
    freq_b = matrix.get(resolved_b, Counter())
    n_a = case_counts.get(resolved_a, 0)
    n_b = case_counts.get(resolved_b, 0)

    symptoms_a = set(freq_a)
    symptoms_b = set(freq_b)
    shared = symptoms_a & symptoms_b
    only_a = symptoms_a - symptoms_b
    only_b = symptoms_b - symptoms_a

    def _entry(symptom, freq, n):
        c = freq[symptom]
        return {"symptom": symptom, "case_count": c, "pct_of_cases": _pct(c, n)}

    shared_sorted = sorted(shared, key=lambda s: freq_a[s] + freq_b[s], reverse=True)[:top_n]

    return {
        "disease_a": {"name": resolved_a, "case_count": n_a, "low_confidence": n_a < MIN_CONFIDENT_CASE_COUNT},
        "disease_b": {"name": resolved_b, "case_count": n_b, "low_confidence": n_b < MIN_CONFIDENT_CASE_COUNT},
        "shared_symptoms": [
            {
                "symptom": s,
                "in_disease_a": _entry(s, freq_a, n_a),
                "in_disease_b": _entry(s, freq_b, n_b),
            }
            for s in shared_sorted
        ],
        "distinctive_to_disease_a": sorted(
            [_entry(s, freq_a, n_a) for s in only_a], key=lambda e: e["case_count"], reverse=True
        )[:top_n],
        "distinctive_to_disease_b": sorted(
            [_entry(s, freq_b, n_b) for s in only_b], key=lambda e: e["case_count"], reverse=True
        )[:top_n],
    }


def diseases_that_mimic(disease: str, top_n: int = DEFAULT_MIMIC_TOP_N) -> dict:
    """
    Ranks other diseases in the dataset by symptom-profile overlap
    (Jaccard similarity on symptom sets) with the target disease. Powers
    "what mimics X" / "what resembles X" / "possible diagnoses" questions.
    """
    resolved = da.resolve_disease_name(disease)
    if not resolved:
        return _unknown_disease_error(disease)

    matrix, case_counts = da.get_disease_symptom_matrix()
    target_symptoms = set(matrix.get(resolved, Counter()))
    n_target = case_counts.get(resolved, 0)

    if not target_symptoms:
        return {
            "disease": resolved,
            "case_count": n_target,
            "error": "No symptom data recorded for this disease.",
        }

    scored = []
    for other, freq in matrix.items():
        if other == resolved:
            continue
        other_symptoms = set(freq)
        union = target_symptoms | other_symptoms
        if not union:
            continue
        intersection = target_symptoms & other_symptoms
        jaccard = len(intersection) / len(union)
        if not intersection:
            continue
        scored.append({
            "disease": other,
            "case_count": case_counts.get(other, 0),
            "overlap_score": round(jaccard, 3),
            "shared_symptom_count": len(intersection),
            "shared_symptoms": sorted(intersection, key=lambda s: freq[s], reverse=True)[:8],
        })

    scored.sort(key=lambda e: e["overlap_score"], reverse=True)

    return {
        "disease": resolved,
        "case_count": n_target,
        "low_confidence": n_target < MIN_CONFIDENT_CASE_COUNT,
        "similar_diseases": scored[:top_n],
        "note": "overlap_score is Jaccard similarity of symptom sets across all dataset cases for each disease, not a clinical differential.",
    }


# ── 3. Evidence / retrieval tool ────────────────────────────────────────────

def evidence_search(
    query_text: str,
    top_k: int = DEFAULT_EVIDENCE_TOP_K,
    disease: Optional[str] = None,
) -> dict:
    """
    Vector search over case fingerprints in Qdrant + matched-symptom
    extraction. Powers "why is this diagnosis", "which symptoms matched",
    and "what are the possible diagnoses" for a free-text symptom
    description.
    """
    query_terms = set(t.strip().lower() for t in query_text.replace(",", " ").split() if len(t) > 2)

    vector = embed_text(query_text)
    query_filter = None
    if disease:
        resolved = da.resolve_disease_name(disease)
        if not resolved:
            return _unknown_disease_error(disease)
        from qdrant_client.http import models as qmodels
        query_filter = qmodels.Filter(
            must=[qmodels.FieldCondition(key="disease", match=qmodels.MatchValue(value=resolved))]
        )

    hits = search_similar(vector=vector, limit=top_k, query_filter=query_filter)

    matches = []
    disease_votes: Counter = Counter()
    for hit in hits:
        payload = hit.payload or {}
        case_symptoms = [s.lower() for s in (payload.get("symptom_names") or [])]
        matched = sorted(set(case_symptoms) & query_terms) or [
            s for s in case_symptoms if any(term in s or s in term for term in query_terms)
        ]
        hit_disease = payload.get("disease")
        if hit_disease:
            disease_votes[hit_disease] += 1
        matches.append({
            "case_id": payload.get("case_id"),
            "disease": hit_disease,
            "similarity": round(hit.score, 3),
            "matched_symptoms": matched,
            "country": payload.get("country"),
            "outcome": payload.get("outcome"),
        })

    return {
        "query": query_text,
        "case_count": len(matches),
        "low_confidence": len(matches) < MIN_CONFIDENT_CASE_COUNT,
        "possible_diagnoses": [
            {"disease": d, "matching_cases_in_results": n}
            for d, n in disease_votes.most_common()
        ],
        "matched_cases": matches,
    }


# ── 4. Filter + count tool ──────────────────────────────────────────────────

def compare_drug_outcomes(disease: str, drug_a: str, drug_b: str) -> dict:
    """
    Exact-match filtering on medications for a disease: how many cases
    were treated with drug A vs. drug B, and their outcome breakdowns.
    Powers "which is better, drug A or drug B".
    """
    resolved = da.resolve_disease_name(disease)
    if not resolved:
        return _unknown_disease_error(disease)

    cases = da.fetch_cases_for_disease(resolved)
    a_lower, b_lower = drug_a.strip().lower(), drug_b.strip().lower()

    def _group(drug_lower: str) -> dict:
        matching = [c for c in cases if drug_lower in da.case_medications(c)]
        n = len(matching)
        outcomes = Counter(c["outcome"] for c in matching if c.get("outcome"))
        return {
            "drug": drug_lower,
            "case_count": n,
            "low_confidence": n < MIN_CONFIDENT_CASE_COUNT,
            "outcomes": [
                {"outcome": o, "case_count": c, "pct_of_cases": _pct(c, n)}
                for o, c in outcomes.most_common()
            ],
        }

    return {
        "disease": resolved,
        "total_cases_for_disease": len(cases),
        "drug_a": _group(a_lower),
        "drug_b": _group(b_lower),
        "note": "Counts are exact string matches against recorded medication names in this dataset; a drug not listed for a case may still have been given but not recorded.",
    }