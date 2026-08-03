"""
Groq service.

Reusable wrapper around Groq's Chat Completions API.

Used by:
- Search service (extract_query_entities)
- Discovery feed / discovery agent
- Any future feature needing structured JSON from Groq
"""

import json
import os
from typing import Optional

import httpx

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.3-70b-versatile"


def strip_markdown_fences(text: str) -> str:
    """
    Removes ```json ... ``` wrappers if Groq returns fenced JSON.
    """
    clean = text.strip()

    if clean.startswith("```"):
        clean = clean.split("```")[1]
        if clean.startswith("json"):
            clean = clean[4:]

    return clean.strip().rstrip("`").strip()


async def call_groq_json(
    system_prompt: str,
    user_prompt: str,
    model: str = DEFAULT_MODEL,
    max_tokens: int = 400,
    temperature: float = 0,
) -> dict:
    """
    Calls Groq and returns the parsed JSON response.

    Raises:
        RuntimeError
        httpx.HTTPError
        json.JSONDecodeError
    """

    api_key = os.environ.get("GROQ_API_KEY", "")

    if not api_key:
        raise RuntimeError("GROQ_API_KEY not configured")

    payload = {
        "model": model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            GROQ_CHAT_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    response.raise_for_status()

    data = response.json()
    text = data["choices"][0]["message"]["content"]

    return json.loads(strip_markdown_fences(text))


ENTITY_EXTRACTION_SYSTEM_PROMPT = """
You are a clinical search query parser for a medical case-matching system.

Return ONLY valid JSON with exactly these keys:

{
  "symptoms": [],
  "lab_markers": [],
  "medications": [],
  "disease_hint": null,
  "intent": ""
}

Possible intents:

similarity
symptom_lookup
lab_filter
treatment_outcome
timeline
rare_disease
text_search

Never return markdown.
"""


async def extract_query_entities(query: str) -> dict:
    """
    Extract structured entities from a doctor's search query.

    Falls back to empty entities if Groq fails.
    """

    fallback = {
        "symptoms": [],
        "lab_markers": [],
        "medications": [],
        "disease_hint": None,
        "intent": "similarity",
    }

    try:
        result = await call_groq_json(
            ENTITY_EXTRACTION_SYSTEM_PROMPT,
            query,
            max_tokens=300,
        )

    except Exception:
        return fallback

    if not isinstance(result, dict):
        return fallback

    return {
        "symptoms": [
            s for s in result.get("symptoms", [])
            if isinstance(s, str)
        ],
        "lab_markers": [
            s for s in result.get("lab_markers", [])
            if isinstance(s, str)
        ],
        "medications": [
            s for s in result.get("medications", [])
            if isinstance(s, str)
        ],
        "disease_hint": (
            result.get("disease_hint")
            if isinstance(result.get("disease_hint"), str)
            else None
        ),
        "intent": (
            result.get("intent")
            if isinstance(result.get("intent"), str)
            else "similarity"
        ),
    }