"""
Cases router — doctor case intake.

POST /cases/extract-pdf  -> extract & structure a case PDF using Groq, returns raw JSON for autofill
POST /cases/process      -> run the 6-layer privacy pipeline on raw extracted data, returns fingerprint preview
POST /cases/submit       -> persist a pre-processed fingerprint (Supabase + Qdrant)
POST /cases              -> (legacy) create a de-identified case in one shot
GET  /cases              -> list cases for the caller's hospital
GET  /cases/{id}         -> fetch one case (scoped to the caller's hospital)
"""

import os
import json
import io

import httpx

from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException

from app.deps.auth import get_current_user
from app.schemas.case import CaseCreate, CaseRead, ProcessRequest, ProcessResponse, SubmitRequest
from app.services import case_service

router = APIRouter(prefix="/cases", tags=["cases"])

EXTRACT_PROMPT = """You are a clinical data extraction assistant.
Extract structured information from the following medical discharge summary / clinical record.

Return ONLY a valid JSON object with exactly these keys (use null for missing fields):
{
  "name": "<patient full name>",
  "dob": "<DD/MM/YYYY>",
  "sex": "<Male|Female|Other>",
  "address": "<full address as a single string>",
  "patient_id": "<MRN or patient ID>",
  "admission_date": "<DD/MM/YYYY>",
  "discharge_date": "<DD/MM/YYYY>",
  "symptoms": ["<symptom 1>", "<symptom 2>"],
  "diagnosis": "<primary diagnosis>",
  "secondary_diagnoses": ["<secondary diagnosis>"],
  "lab_results": {"<marker name>": <numeric value>},
  "medications": ["<medication name>"],
  "procedures": ["<procedure name>"],
  "imaging": "<imaging findings as plain text>",
  "genomic": "<genomic findings or null>",
  "outcome": "<recovered|deteriorated|unresolved>",
  "clinical_notes": "<brief de-identified clinical summary>"
}

Do not include markdown, code fences, or any text outside the JSON object.

Medical document text:
"""


# ── helpers ───────────────────────────────────────────────────────────────────

def _strip_markdown_fences(text: str) -> str:
    clean = text.strip()
    if clean.startswith("```"):
        clean = clean.split("```")[1]
        if clean.startswith("json"):
            clean = clean[4:]
    return clean.strip().rstrip("`").strip()


async def _call_groq(payload: dict, api_key: str) -> dict:
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Groq API error: {resp.text}")
    return resp.json()


# ── /extract-pdf ──────────────────────────────────────────────────────────────

@router.post("/extract-pdf")
async def extract_pdf(file: UploadFile = File(...)):
    """
    Accept a PDF, extract text via pdfplumber, send to Groq, return structured JSON for autofill.
    No auth required so the form can call it before submit.
    """
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")

    pdf_bytes = await file.read()
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
        raw_text = "\n".join(pages).strip()
    except ImportError:
        raise HTTPException(status_code=500, detail="pdfplumber not installed. Run: pip install pdfplumber")

    if not raw_text:
        raise HTTPException(status_code=422, detail="Could not extract text from PDF.")

    data = await _call_groq(
        {
            "model": "llama-3.3-70b-versatile",
            "max_tokens": 1500,
            "temperature": 0,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a clinical data extraction assistant. Return only valid JSON, no markdown, no explanation.",
                },
                {"role": "user", "content": EXTRACT_PROMPT + raw_text},
            ],
        },
        api_key,
    )

    text_block = data["choices"][0]["message"]["content"]
    try:
        extracted = json.loads(_strip_markdown_fences(text_block))
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Groq returned non-JSON response")

    return {"extracted": extracted}


# ── /process ──────────────────────────────────────────────────────────────────

@router.post("/process", response_model=ProcessResponse)
async def process_case(body: ProcessRequest, user: dict = Depends(get_current_user)):
    """
    Run the 6-layer privacy pipeline on raw extracted data.
    Returns the de-identified fingerprint for the doctor to preview before confirming.
    Nothing is persisted at this stage.
    """
    result = case_service.process_case(
        raw=body.raw,
        hospital_id=user["hospital_id"],
    )
    return result


# ── /submit ───────────────────────────────────────────────────────────────────

@router.post("/submit", response_model=CaseRead, status_code=201)
async def submit_case(body: SubmitRequest, user: dict = Depends(get_current_user)):
    """
    Persist a pre-processed fingerprint produced by /process.
    Inserts into Supabase and upserts the vector into Qdrant.
    """
    case_row = case_service.submit_processed_case(
        fingerprint=body.fingerprint,
        token_H=body.token_H,
        hospital_id=user["hospital_id"],
        submitted_by=user["id"],
    )
    return case_row


# ── /cases (legacy one-shot) ──────────────────────────────────────────────────

@router.post("", response_model=CaseRead, status_code=201)
async def create_case(body: CaseCreate, user: dict = Depends(get_current_user)):
    """Legacy single-step intake: PII-guard → insert → vectorise."""
    case_row = case_service.create_case(
        case_in=body,
        hospital_id=user["hospital_id"],
        submitted_by=user["id"],
    )
    return case_row


# ── GET /cases ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[CaseRead])
async def list_my_hospital_cases(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
):
    return case_service.list_cases(hospital_id=user["hospital_id"], limit=limit, offset=offset)


@router.get("/{case_id}", response_model=CaseRead)
async def get_case(case_id: str, user: dict = Depends(get_current_user)):
    return case_service.get_case(case_id=case_id, hospital_id=user["hospital_id"])