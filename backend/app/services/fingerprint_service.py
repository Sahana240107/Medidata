"""
Fingerprint service.
Turns a de-identified case's structured fields into one canonical text blob,
embeds it, and manages the corresponding point in Qdrant.

This is the one place that defines what "similar" means for case search —
the text built here is exactly what gets embedded, so changes to this
function change search behaviour.
"""

import uuid
from typing import Optional

from app.db.qdrant_client import upsert_fingerprint, delete_fingerprint
from app.ml.embedder import embed_text


def generate_fingerprint_id() -> str:
    return str(uuid.uuid4())


def build_fingerprint_text(case_data: dict) -> str:
    """
    Builds one normalized text representation of a case from its
    structured fields, in a fixed order, so similar cases produce
    similar text -> similar embeddings.
    """
    parts = []

    age_range = case_data.get("age_range")
    sex = case_data.get("sex")
    country = case_data.get("country")
    demo_bits = []
    if age_range:
        demo_bits.append(f"age {age_range}")
    if sex:
        demo_bits.append(f"sex {sex}")
    if country:
        demo_bits.append(f"country {country}")
    if demo_bits:
        parts.append("Patient: " + ", ".join(demo_bits) + ".")

    symptoms = case_data.get("symptoms") or []
    if symptoms:
        bits = []
        for s in symptoms:
            name = s.get("name", "")
            onset = s.get("onset_day")
            bits.append(f"{name} (onset day {onset})" if onset is not None else name)
        parts.append("Symptoms: " + "; ".join(bits) + ".")

    labs = case_data.get("lab_results") or []
    if labs:
        bits = []
        for lab in labs:
            marker = lab.get("marker", "")
            value = lab.get("value", "")
            flag = lab.get("flag")
            bit = f"{marker} {value}"
            if flag:
                bit += f" ({flag})"
            bits.append(bit)
        parts.append("Lab results: " + "; ".join(bits) + ".")

    meds = case_data.get("medications") or []
    if meds:
        bits = []
        for med in meds:
            name = med.get("name", "")
            response = med.get("response")
            bits.append(f"{name} (response: {response})" if response else name)
        parts.append("Medications: " + "; ".join(bits) + ".")

    procedures = case_data.get("procedures") or []
    if procedures:
        bits = [p if isinstance(p, str) else p.get("name", "") for p in procedures]
        parts.append("Procedures: " + "; ".join(bits) + ".")

    imaging = case_data.get("imaging_metadata") or []
    if imaging:
        bits = [
            i if isinstance(i, str) else i.get("finding", i.get("modality", ""))
            for i in imaging
        ]
        parts.append("Imaging: " + "; ".join(bits) + ".")

    genomic = case_data.get("genomic_metadata") or []
    if genomic:
        bits = [
            g if isinstance(g, str) else g.get("marker", g.get("gene", ""))
            for g in genomic
        ]
        parts.append("Genomic markers: " + "; ".join(bits) + ".")

    notes = case_data.get("clinical_notes_summary")
    if notes:
        parts.append("Clinical notes: " + notes)

    outcome = case_data.get("outcome")
    if outcome:
        parts.append(f"Outcome: {outcome}.")

    return "\n".join(parts)


def create_fingerprint(case_data: dict, payload: dict) -> tuple:
    """
    Builds the fingerprint text, embeds it, and upserts it into Qdrant.
    Returns (fingerprint_id, vector) so the caller can store fingerprint_id
    in Supabase and reuse the vector if needed (e.g. logging/debugging).

    Caller is responsible for rolling back the Supabase row if this raises.
    """
    text = build_fingerprint_text(case_data)
    vector = embed_text(text)
    fingerprint_id = generate_fingerprint_id()

    upsert_fingerprint(fingerprint_id=fingerprint_id, vector=vector, payload=payload)

    return fingerprint_id, vector


def delete_fingerprint_by_id(fingerprint_id: Optional[str]) -> None:
    """Best-effort cleanup — used when a Supabase write fails after Qdrant succeeded, or vice versa."""
    if not fingerprint_id:
        return
    try:
        delete_fingerprint(fingerprint_id)
    except Exception:
        pass
