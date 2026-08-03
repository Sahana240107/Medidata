"""
query_parser.py

LLM query parser: free-text hypothesis question -> CohortFilters, validated
against the Pydantic schema before it ever reaches cohort_builder.py. On a
schema validation failure, re-prompts the model once with the validation
error appended, so a bad first attempt gets a real chance to self-correct
before the caller sees a 422.

Uses the existing app.services.groq_service wrapper (shared infra already
used by search/discovery, not another member's feature code) — no new LLM
plumbing invented here.
"""
from __future__ import annotations

import json
import logging

from pydantic import ValidationError

from app.services.groq_service import call_groq_json

from .schemas import CohortFilters

logger = logging.getLogger("medidata.evidence_engine")

MAX_ATTEMPTS = 2

_SYSTEM_PROMPT = """You are a clinical hypothesis parser for a medical research platform.

Given a free-text research question comparing an intervention against a control
(e.g. "Do patients on metformin have better outcomes than those on insulin for
type 2 diabetes?"), extract a structured cohort definition.

Return ONLY valid JSON with exactly these keys (omit a key or use null if not
mentioned in the question):

{
  "disease": string or null,        // specific disease/condition name mentioned
  "domain": string or null,         // broader clinical area, ONLY if disease is unclear
  "intervention_medication": string,  // REQUIRED - the drug/treatment being tested
  "control_medication": string or null,  // the comparison drug, if one is named
  "country": string or null,
  "sex": string or null,            // "male" or "female", only if explicitly mentioned
  "age_range": string or null,      // e.g. "31-40", only if explicitly mentioned
  "min_arm_size": integer or null   // only if the question specifies a minimum sample size
}

Rules:
- At least one of "disease" or "domain" MUST be non-null. If the question names
  a specific condition, put it in "disease". Only use "domain" (e.g. "Oncology",
  "Cardiovascular", "Respiratory", "Endocrine & Metabolic") if no specific
  disease is named.
- "intervention_medication" is required and must be a single drug/treatment name,
  never a list.
- Do not invent values that are not implied by the question.
- No markdown fences, no commentary — JSON only.
"""


class QueryParseError(Exception):
    """Raised when the LLM output cannot be turned into a valid CohortFilters
    after MAX_ATTEMPTS re-prompts."""


def _to_cohort_filters(raw: dict) -> CohortFilters:
    # Drop keys the model may hallucinate that aren't part of the schema, and
    # coerce empty-string "null-ish" values the model sometimes emits.
    cleaned = {}
    for key in (
        "disease", "domain", "intervention_medication", "control_medication",
        "country", "sex", "age_range", "min_arm_size",
    ):
        value = raw.get(key)
        if value in ("", "null", "None"):
            value = None
        cleaned[key] = value
    if cleaned.get("min_arm_size") is None:
        cleaned.pop("min_arm_size")
    return CohortFilters(**cleaned)


async def parse_question(question: str) -> tuple[CohortFilters, dict, list[str], int]:
    """Returns (filters, raw_llm_output, warnings, retries_used).

    Raises QueryParseError if the model still fails schema validation after
    MAX_ATTEMPTS attempts.
    """
    warnings: list[str] = []
    user_prompt = f'Research question: "{question}"'
    last_error: ValidationError | Exception | None = None
    last_raw: dict = {}

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            raw = await call_groq_json(_SYSTEM_PROMPT, user_prompt, temperature=0)
            last_raw = raw
            filters = _to_cohort_filters(raw)
            return filters, raw, warnings, attempt - 1
        except (ValidationError, ValueError, json.JSONDecodeError) as exc:
            last_error = exc
            warnings.append(f"attempt {attempt} failed schema validation: {exc}")
            logger.warning("query_parser attempt %d failed: %r", attempt, exc)
            user_prompt = (
                f'Research question: "{question}"\n\n'
                f"Your previous JSON output was invalid: {exc}\n"
                "Return corrected JSON only, following the schema exactly."
            )

    raise QueryParseError(
        f"could not parse question into a valid CohortFilters after {MAX_ATTEMPTS} attempts: "
        f"{last_error!r}; last raw output: {last_raw!r}"
    )