"""
Scoring for the "Scientific Consensus Engine" — the 4-axis radar on a
signal's detail page, plus the overall `confidence` shown everywhere else.

Each axis answers a different question, deliberately kept independent so
a cluster can't max out `confidence` on volume alone:

  evidence_score              How much data backs this? (case count, log-scaled
                               so 3 cases is a start and 50+ is already strong)
  reproducibility_score       Does the pattern hold together, and does it
                               recur per-hospital rather than come from one
                               hospital's documentation habits? (cohesion +
                               spread of cases across contributing hospitals)
  hospital_diversity_score    How many distinct hospitals/countries contributed,
                               relative to a reasonable "this is global" bar
  data_quality_score          How complete are the underlying records? (labs,
                               medications, notes, outcome present or not)

`confidence` is a weighted blend of the four, rounded to an int 0-100 to
satisfy the `research_signals.confidence` check constraint. Weights are
deliberately conservative — this is a discovery aid for doctors, not a
diagnosis, so under-claiming confidence is safer than over-claiming it.
"""

import math
from datetime import datetime, timezone
from typing import List, Optional


def _evidence_score(n_cases: int, cohesion: float) -> float:
    size_component = min(1.0, math.log(n_cases + 1, 30))
    tightness_component = max(0.0, min(1.0, cohesion))
    return round((0.7 * size_component + 0.3 * tightness_component) * 100, 1)


def _reproducibility_score(hospital_case_counts: List[int], cohesion: float) -> float:
    """Rewards the pattern showing up more than once per hospital (not just
    a single case each), and rewards tight clusters (consistent presentation)."""
    if not hospital_case_counts:
        return 0.0
    repeat_hospitals = sum(1 for c in hospital_case_counts if c >= 2)
    repeat_ratio = repeat_hospitals / len(hospital_case_counts)
    tightness_component = max(0.0, min(1.0, cohesion))
    return round((0.5 * repeat_ratio + 0.5 * tightness_component) * 100, 1)


def _hospital_diversity_score(n_countries: int, n_hospitals: int) -> float:
    country_component = min(1.0, n_countries / 5)
    hospital_component = min(1.0, n_hospitals / 6)
    return round((0.5 * country_component + 0.5 * hospital_component) * 100, 1)


def _data_quality_score(cases: List[dict]) -> float:
    """Fraction of contributing cases with meaningfully complete records —
    lab results, medications, a clinical notes summary, and a recorded outcome."""
    if not cases:
        return 0.0
    fields = ["lab_results", "medications", "clinical_notes_summary", "outcome"]
    total_possible = len(cases) * len(fields)
    filled = 0
    for c in cases:
        for f in fields:
            v = c.get(f)
            if isinstance(v, list):
                filled += 1 if len(v) > 0 else 0
            else:
                filled += 1 if v else 0
    return round((filled / total_possible) * 100, 1) if total_possible else 0.0


def _recency_weight(case_dates: List[Optional[str]]) -> float:
    """Fraction of cases submitted in the last 30 days — used as a light
    multiplier on confidence so stale clusters don't stay maximally confident forever."""
    if not case_dates:
        return 0.85
    now = datetime.now(timezone.utc)
    recent, total = 0, 0
    for d in case_dates:
        if not d:
            continue
        try:
            dt = datetime.fromisoformat(d.replace("Z", "+00:00"))
        except Exception:
            continue
        total += 1
        if (now - dt).days <= 30:
            recent += 1
    if not total:
        return 0.85
    ratio = recent / total
    return 0.85 + 0.15 * ratio  # recency nudges confidence, never tanks it


def compute_scores(
    n_cases: int,
    n_countries: int,
    n_hospitals: int,
    cohesion: float,
    hospital_case_counts: List[int],
    cases: List[dict],
    case_dates: List[Optional[str]],
) -> dict:
    """Returns the 4 axis scores (0-100) plus the overall confidence (0-100 int)."""
    evidence = _evidence_score(n_cases, cohesion)
    reproducibility = _reproducibility_score(hospital_case_counts, cohesion)
    diversity = _hospital_diversity_score(n_countries, n_hospitals)
    quality = _data_quality_score(cases)

    raw_confidence = 0.35 * evidence + 0.25 * reproducibility + 0.20 * diversity + 0.20 * quality
    confidence = round(raw_confidence * _recency_weight(case_dates))
    confidence = max(0, min(100, confidence))

    return {
        "evidence_score": evidence,
        "reproducibility_score": reproducibility,
        "hospital_diversity_score": diversity,
        "data_quality_score": quality,
        "confidence": confidence,
    }