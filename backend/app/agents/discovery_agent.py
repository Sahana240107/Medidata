"""
Discovery agent — turns a raw cluster (shared symptoms, shared lab findings,
shared medications, hospitals, countries) into:
  - a plain-English title + summary a doctor can scan in seconds
  - a `signal_type` classification matching the DB enum exactly:
      'emerging_syndrome' | 'drug_response' | 'biomarker' | 'research_opportunity'
  - a handful of `tags` for the chips on the detail page

Falls back to templated/heuristic output if Groq is unavailable, so a
discovery scan never fails just because an LLM call did — clustering real
cases into a signal is the valuable part; the narrative is a nice-to-have
layer on top of it.
"""

from app.services.groq_service import call_groq_json

VALID_SIGNAL_TYPES = {"emerging_syndrome", "drug_response", "biomarker", "research_opportunity"}

SYSTEM_PROMPT = """You are a medical research assistant summarising a cluster of
similar de-identified patient cases detected across hospitals. Given the
cluster's shared symptoms, lab findings, medications, and geographic spread,
return ONLY valid JSON (no markdown, no preamble) with this exact shape:

{
  "title": "short clinical title, max 12 words, specific, no hype words like breakthrough",
  "summary": "2-3 sentences a doctor could scan in seconds",
  "signal_type": "one of: emerging_syndrome, drug_response, biomarker, research_opportunity",
  "tags": ["3-5 short lowercase keyword tags"]
}"""


def _heuristic_signal_type(symptom_pattern, lab_pattern, med_pattern) -> str:
    """Fallback classification used if Groq is unavailable."""
    if med_pattern:
        return "drug_response"
    if lab_pattern and not symptom_pattern:
        return "biomarker"
    if lab_pattern and symptom_pattern:
        return "biomarker"
    if symptom_pattern:
        return "emerging_syndrome"
    return "research_opportunity"


def _template_fallback(symptom_pattern, lab_pattern, med_pattern, countries, n_cases, domain) -> dict:
    top_symptoms = ", ".join(symptom_pattern[:3]) if symptom_pattern else "shared clinical features"
    country_str = ", ".join(countries[:3]) + ("…" if len(countries) > 3 else "") if countries else "multiple sites"
    title = f"{domain or 'Cross-hospital'} cluster: {top_symptoms}"[:90]
    summary = (
        f"{n_cases} cases sharing {top_symptoms} identified across {country_str}. "
        f"{('Notable lab pattern: ' + ', '.join(lab_pattern[:3]) + '.') if lab_pattern else ''}"
    ).strip()
    tags = list({t.lower() for t in (symptom_pattern[:3] + lab_pattern[:2]) if t})[:5]
    return {
        "title": title,
        "summary": summary,
        "signal_type": _heuristic_signal_type(symptom_pattern, lab_pattern, med_pattern),
        "tags": tags,
    }


async def generate_signal_narrative(
    symptom_pattern: list,
    lab_pattern: list,
    med_pattern: list,
    countries: list,
    n_cases: int,
    domain: str | None,
) -> dict:
    user_prompt = (
        f"Cluster size: {n_cases} cases\n"
        f"Countries: {', '.join(countries) if countries else 'unspecified'}\n"
        f"Shared symptoms: {', '.join(symptom_pattern) if symptom_pattern else 'none recorded'}\n"
        f"Shared lab findings: {', '.join(lab_pattern) if lab_pattern else 'none recorded'}\n"
        f"Shared medications: {', '.join(med_pattern) if med_pattern else 'none recorded'}\n"
    )
    try:
        result = await call_groq_json(SYSTEM_PROMPT, user_prompt)
        if "title" in result and "summary" in result:
            if result.get("signal_type") not in VALID_SIGNAL_TYPES:
                result["signal_type"] = _heuristic_signal_type(symptom_pattern, lab_pattern, med_pattern)
            if not isinstance(result.get("tags"), list):
                result["tags"] = []
            return result
    except Exception:
        pass

    return _template_fallback(symptom_pattern, lab_pattern, med_pattern, countries, n_cases, domain)