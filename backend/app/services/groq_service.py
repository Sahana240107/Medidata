"""
Groq service.
Thin, reusable wrapper around Groq's chat-completions endpoint for tasks
that need a fast JSON-structured extraction (not a chat conversation).

Used today by:
  - search_service.extract_query_entities()  — parsing free-text search queries

Mirrors the inline _call_groq() helper in routers/cases.py, generalised so
it isn't duplicated per-feature.
"""

import os
import json
from typing import Optional

import httpx

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.3-70b-versatile"


def _strip_markdown_fences(text: str) -> str:
    clean = text.strip()
    if clean.startswith("```"):
        clean = clean.split("```")[1]
        if clean.startswith("json"):
            clean = clean[4:]
    return clean.strip().rstrip("`").strip()


async def call_groq_json(system_prompt: str, user_prompt: str, max_tokens: int = 400) -> Optional[dict]:
    """
    Calls Groq with a system+user prompt and expects a single JSON object back.
    Returns None (never raises) on any failure — missing API key, network error,
    non-200 response, or non-JSON content — so callers can fall back gracefully
    instead of breaking search when Groq is unavailable.
    """
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        return None

    payload = {
        "model": DEFAULT_MODEL,
        "max_tokens": max_tokens,
        "temperature": 0,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                GROQ_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if resp.status_code != 200:
            return None

        text_block = resp.json()["choices"][0]["message"]["content"]
        cleaned = _strip_markdown_fences(text_block)
        return json.loads(cleaned)
    except Exception:
        return None


ENTITY_EXTRACTION_SYSTEM_PROMPT = """You are a clinical search query parser for a medical case-matching system.
A doctor types a free-text query. Extract structured search entities from it.

Return ONLY a valid JSON object with exactly these keys:
{
  "symptoms": ["<symptom / clinical finding phrases mentioned, lowercase, normalized>"],
  "lab_markers": ["<lab test or marker names mentioned, e.g. ferritin, ESR, CRP, ANA, EMG, ferritin>"],
  "medications": ["<drug / treatment names mentioned, e.g. steroids>"],
  "disease_hint": "<a specific disease name if explicitly named in the query, else null>",
  "intent": "<one of: similarity | symptom_lookup | lab_filter | treatment_outcome | timeline | rare_disease | text_search>"
}

Do not include markdown, code fences, or any text outside the JSON object.
If the query is a plain clinical case description (symptoms/labs listed together), intent is "similarity".
If the query asks "what diseases cause X", intent is "symptom_lookup".
If the query asks about drug response / treatment effectiveness, intent is "treatment_outcome".
If the query asks about order/progression of symptoms or time-to-diagnosis, intent is "timeline".
If the query explicitly asks about rare disease matching, intent is "rare_disease".
If the query asks to find notes/cases "mentioning" or "containing" a specific term, intent is "text_search".
"""


async def extract_query_entities(query: str) -> dict:
    """
    Parses a free-text search query into structured entities used to boost
    the vector search with exact-match signal (see search_service.py).
    Falls back to an empty structured extraction (pure vector search still
    works fine) if Groq is unavailable.
    """
    result = await call_groq_json(ENTITY_EXTRACTION_SYSTEM_PROMPT, query, max_tokens=300)

    fallback = {
        "symptoms": [],
        "lab_markers": [],
        "medications": [],
        "disease_hint": None,
        "intent": "similarity",
    }

    if not isinstance(result, dict):
        return fallback

    return {
        "symptoms": [s for s in result.get("symptoms", []) if isinstance(s, str)] or [],
        "lab_markers": [s for s in result.get("lab_markers", []) if isinstance(s, str)] or [],
        "medications": [s for s in result.get("medications", []) if isinstance(s, str)] or [],
        "disease_hint": result.get("disease_hint") if isinstance(result.get("disease_hint"), str) else None,
        "intent": result.get("intent") if isinstance(result.get("intent"), str) else "similarity",
    }