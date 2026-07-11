"""
Privacy pipeline — 6 layers applied to raw extracted case data.

Layer 1: Suppression       — drop direct identifiers (name, dob, address, patient_id)
Layer 2: K-anonymity       — generalise DOB → age_bucket, address → city/region/country
Layer 3: Split-key token   — HMAC patient_id into token_H (hospital) + token_M (MediData)
Layer 4: Differential priv — add Laplace noise to numeric lab values
Layer 5: ICD-10 mapping    — symptoms + diagnosis → ICD-10 codes via Groq
Layer 6: Temporal fuzzing  — admission_date → week bucket; onset → ±1 day range
"""

import hmac
import hashlib
import json
import os
import re
from datetime import datetime

import numpy as np
import httpx

# ── ICD-10 static map (extend as needed) ─────────────────────────────────────
ICD10_MAP = {
    "chest pain": "R07.9",
    "acute chest pain": "R07.9",
    "shortness of breath": "R06.0",
    "diaphoresis": "R61",
    "nausea": "R11.0",
    "dizziness": "R42",
    "lightheadedness": "R42",
    "hypertension": "I10",
    "type 2 diabetes mellitus": "E11.9",
    "diabetes": "E11.9",
    "stemi": "I21.9",
    "myocardial infarction": "I21.9",
    "progressive muscle weakness": "M62.81",
    "fever": "R50.9",
    "fatigue": "R53.83",
    "headache": "R51",
    "cough": "R05",
    "dyspnea": "R06.0",
}


# ─────────────────────────────────────────────────────────────────────────────
# Layer 1 — Suppression
# ─────────────────────────────────────────────────────────────────────────────

def layer1_suppress(raw: dict) -> dict:
    """Remove direct PII fields. Keep dob/address/patient_id temporarily for layers 2 & 3."""
    out = dict(raw)
    out.pop("name", None)
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Layer 2 — K-anonymity / Generalisation
# ─────────────────────────────────────────────────────────────────────────────

def _dob_to_bucket(dob: str) -> str:
    try:
        dt = datetime.strptime(dob.strip(), "%d/%m/%Y")
        age = (datetime.now() - dt).days // 365
    except Exception:
        return "unknown"
    buckets = [
        (0, 12, "0-12"), (13, 17, "13-17"), (18, 34, "18-34"),
        (35, 44, "35-44"), (45, 54, "45-54"), (55, 64, "55-64"), (65, 200, "65+"),
    ]
    return next((b[2] for b in buckets if b[0] <= age <= b[1]), "65+")


def _address_to_geo(address: str) -> dict:
    if not address:
        return {"city": "", "region": "", "country": ""}
    parts = [p.strip() for p in address.split(",")]
    return {
        "city":    parts[-3] if len(parts) >= 3 else parts[0],
        "region":  parts[-2] if len(parts) >= 2 else "",
        "country": parts[-1] if len(parts) >= 1 else "",
    }


def layer2_generalise(raw: dict) -> dict:
    out = dict(raw)
    dob     = out.pop("dob", "") or ""
    address = out.pop("address", "") or ""

    age_bucket = _dob_to_bucket(dob)
    out["age_bucket"] = age_bucket

    if address:
        # Full address supplied (e.g. from PDF autofill) — split into geo fields.
        geo = _address_to_geo(address)
        out.update(geo)          # sets city, region, country
    # If no address, leave whatever country/region the caller already set intact.
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Layer 3 — Split-key tokenisation
# ─────────────────────────────────────────────────────────────────────────────

def layer3_tokenise(raw: dict, hospital_id: str) -> tuple[dict, str]:
    """
    Returns (updated_raw_without_patient_id, token_H).
    token_M is stored in raw["token_M"]; token_H is returned separately
    for the hospital to persist locally.
    """
    patient_id = raw.pop("patient_id", "") or ""
    h_secret = os.environ.get("HOSPITAL_SECRET_H", "demo-hospital-secret")
    m_secret = os.environ.get("MEDIDATA_SECRET_M", "demo-medidata-secret")

    token_H = hmac.new(
        h_secret.encode(),
        (hospital_id + patient_id).encode(),
        hashlib.sha256,
    ).hexdigest()

    token_M = hmac.new(
        m_secret.encode(),
        token_H.encode(),
        hashlib.sha256,
    ).hexdigest()

    raw["token_M"] = token_M
    return raw, token_H


# ─────────────────────────────────────────────────────────────────────────────
# Layer 4 — Differential privacy (Laplace noise on labs)
# ─────────────────────────────────────────────────────────────────────────────

def layer4_differential_privacy(raw: dict) -> dict:
    out = dict(raw)
    lab_results = out.get("lab_results")

    # Frontend sends [{ marker, value, flag }]; pipeline internal format is
    # { marker: value }.  Handle both shapes.
    if isinstance(lab_results, list):
        lab_dict = {item["marker"]: item["value"] for item in lab_results if "marker" in item}
    elif isinstance(lab_results, dict):
        lab_dict = lab_results
    else:
        return out

    noised = {}
    for marker, value in lab_dict.items():
        try:
            v = float(value)
            sensitivity = max(0.1 * v, 0.01)
            noise = np.random.laplace(0, sensitivity)
            noised[marker] = round(v + noise, 2)
        except (TypeError, ValueError):
            noised[marker] = value

    out["lab_results"] = noised
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Layer 5 — ICD-10 mapping
# ─────────────────────────────────────────────────────────────────────────────

def _groq_map_icd(term: str) -> str:
    """Fallback: ask Groq for the ICD-10 code."""
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        return "unknown"
    try:
        import httpx as _httpx
        resp = _httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.3-70b-versatile",
                "max_tokens": 20,
                "temperature": 0,
                "messages": [
                    {"role": "system", "content": "Return only the ICD-10 code for the given medical term, nothing else."},
                    {"role": "user", "content": term},
                ],
            },
            timeout=15,
        )
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        return "unknown"


def layer5_icd_mapping(raw: dict) -> dict:
    out = dict(raw)
    symptoms = out.get("symptoms", [])
    if isinstance(symptoms, list):
        icd_symptoms = []
        for s in symptoms:
            # Symptoms may arrive as plain strings ("fever") or dicts
            # ({ "name": "fever", "onset_day": null }) depending on the
            # entry path (manual form vs PDF autofill).
            term = s["name"] if isinstance(s, dict) else s
            key = term.lower().strip()
            code = ICD10_MAP.get(key) or _groq_map_icd(term)
            icd_symptoms.append({"term": term, "icd10": code})
        out["symptoms_icd"] = icd_symptoms
    diagnosis = out.get("diagnosis", "")
    if diagnosis:
        out["diagnosis_icd"] = ICD10_MAP.get(diagnosis.lower().strip()) or _groq_map_icd(diagnosis)
    out.pop("clinical_notes", None)  # drop raw clinical notes — never stored
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Layer 6 — Temporal fuzzing
# ─────────────────────────────────────────────────────────────────────────────

def layer6_temporal_fuzz(raw: dict) -> dict:
    out = dict(raw)
    admission_date = out.pop("admission_date", "") or ""
    discharge_date = out.pop("discharge_date", "") or ""
    try:
        dt = datetime.strptime(admission_date.strip(), "%d/%m/%Y")
        week_num = (dt.day - 1) // 7 + 1
        out["week_admitted"] = f"Week {week_num}, {dt.strftime('%B %Y')}"
    except Exception:
        out["week_admitted"] = None
    try:
        dt2 = datetime.strptime(discharge_date.strip(), "%d/%m/%Y")
        week_num2 = (dt2.day - 1) // 7 + 1
        out["week_discharged"] = f"Week {week_num2}, {dt2.strftime('%B %Y')}"
    except Exception:
        out["week_discharged"] = None
    out.pop("secondary_diagnoses", None)
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Orchestrator
# ─────────────────────────────────────────────────────────────────────────────

def run_pipeline(raw: dict, hospital_id: str) -> dict:
    """
    Runs all 6 layers in order.
    Returns a dict with:
        fingerprint    — the de-identified record ready for storage
        token_H        — hospital keeps this locally for traceback
        layers_applied — ordered list of layer names for the preview UI
    """
    data = dict(raw)

    data = layer1_suppress(data)
    data = layer2_generalise(data)
    data, token_H = layer3_tokenise(data, hospital_id)
    data = layer4_differential_privacy(data)
    data = layer5_icd_mapping(data)
    data = layer6_temporal_fuzz(data)

    return {
        "fingerprint": data,
        "token_H": token_H,
        "layers_applied": [
            "suppression",
            "k-anonymity",
            "split-key-tokenisation",
            "differential-privacy",
            "icd-10-mapping",
            "temporal-fuzzing",
        ],
    }