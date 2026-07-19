"""
Case service.
Orchestrates the full intake chain.

Two-step flow (new):
  process_case()          — run the 6-layer privacy pipeline, return fingerprint for preview
  submit_processed_case() — persist a confirmed fingerprint into Supabase + Qdrant

One-step flow (legacy):
  create_case()           — PII guard → insert → vectorise in a single call

Both flows roll back the Supabase row if the Qdrant step fails, so we never
end up with a `cases` row whose fingerprint_id doesn't exist as a vector.
"""

from fastapi import HTTPException, status

from app.db.supabase_client import get_supabase_admin
from app.services import fingerprint_service
from app.services.deidentification_service import check_case_payload, DeidentificationError
from app.services.privacy_pipeline import run_pipeline


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _case_dict(case_in) -> dict:
    """Pydantic model → plain dict."""
    return case_in.dict()


def _build_insert_row(case_data: dict, hospital_id: str, submitted_by: str, fingerprint_id: str) -> dict:
    return {
        "hospital_id": hospital_id,
        "submitted_by": submitted_by,
        "fingerprint_id": fingerprint_id,
        "local_patient_ref_hash": case_data.get("local_patient_ref_hash"),
        "age_range": case_data.get("age_range"),
        "sex": case_data.get("sex"),
        "country": case_data.get("country"),
        "disease": case_data.get("disease") or case_data.get("diagnosis"),
        "symptoms": case_data.get("symptoms", []),
        "lab_results": case_data.get("lab_results", []),
        "medications": case_data.get("medications", []),
        "procedures": case_data.get("procedures", []),
        "imaging_metadata": case_data.get("imaging_metadata", []),
        "genomic_metadata": case_data.get("genomic_metadata", []),
        "clinical_notes_summary": case_data.get("clinical_notes_summary"),
        "outcome": case_data.get("outcome"),
    }


def _persist(insert_row: dict, case_data: dict, hospital_id: str) -> dict:
    """Insert into Supabase, then upsert vector into Qdrant. Rolls back on failure."""
    supabase = get_supabase_admin()

    try:
        insert_resp = supabase.table("cases").insert(insert_row).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save case: {e}",
        )

    if not insert_resp.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Case insert returned no data.",
        )

    case_row = insert_resp.data[0]

    # Build Qdrant payload — everything useful for filtering / similarity search.
    lab_results = case_data.get("lab_results", [])
    qdrant_payload = {
        "case_id":        case_row["id"],
        "hospital_id":    hospital_id,
        "country":        case_data.get("country"),
        "age_range":      case_data.get("age_range") or case_data.get("age_bucket"),
        "sex":            case_data.get("sex"),
        "status":         case_row.get("status", "active"),
        "outcome":        case_data.get("outcome"),
        # Symptoms — prefer ICD-mapped version, fall back to raw names
        "symptom_names":  [
            s.get("term") or s.get("name")
            for s in (case_data.get("symptoms_icd") or case_data.get("symptoms", []))
        ],
        "icd_codes": [
            s.get("icd10") for s in case_data.get("symptoms_icd", [])
            if s.get("icd10") and s.get("icd10") != "unknown"
        ],
        "diagnosis_icd":  case_data.get("diagnosis_icd"),
        # Lab markers (names only — values are noised floats, not useful for filtering)
        "lab_markers": (
            [item["marker"] for item in lab_results if isinstance(item, dict)]
            if isinstance(lab_results, list)
            else list(lab_results.keys()) if isinstance(lab_results, dict)
            else []
        ),
        "medications":    [
            m.get("name") if isinstance(m, dict) else m
            for m in case_data.get("medications", [])
        ],
        "procedures":     case_data.get("procedures", []),
        "week_admitted":  case_data.get("week_admitted"),
        "disease":        case_data.get("disease") or case_data.get("diagnosis"),
    }

    try:
        fingerprint_service.create_fingerprint(
            case_data=case_data,
            payload=qdrant_payload,
        )
    except Exception as e:
        try:
            supabase.table("cases").delete().eq("id", case_row["id"]).execute()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Case saved but vectorisation failed, change rolled back: {e}",
        )

    return case_row


# ─────────────────────────────────────────────────────────────────────────────
# Two-step flow
# ─────────────────────────────────────────────────────────────────────────────

def process_case(raw: dict, hospital_id: str) -> dict:
    """
    Run the privacy pipeline on raw extracted data.
    Returns { fingerprint, token_H, layers_applied } — nothing is persisted.
    """
    return run_pipeline(raw=raw, hospital_id=hospital_id)


def submit_processed_case(
    fingerprint: dict,
    token_H: str,
    hospital_id: str,
    submitted_by: str,
) -> dict:
    """
    Persist a fingerprint that was already produced by process_case().
    Also records token_H in the case_fingerprints table for traceback.
    """
    # After the privacy pipeline, lab_results is { marker: noised_value }.
    # Normalise back to [{ marker, value, flag }] so the PII check and the
    # Supabase insert see the shape they expect.
    fp = dict(fingerprint)
    if isinstance(fp.get("lab_results"), dict):
        fp["lab_results"] = [
            {"marker": k, "value": str(v), "flag": None}
            for k, v in fp["lab_results"].items()
        ]

    # PII guard — run on a copy that excludes lab_results.
    # Lab values are already Laplace-noised numerics from layer 4 and will
    # false-positive on patterns like MRN/SSN (e.g. WBC=13200, Platelets=210000).
    fp_for_pii_check = {k: v for k, v in fp.items() if k != "lab_results"}
    try:
        check_case_payload(fp_for_pii_check)
    except DeidentificationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    supabase = get_supabase_admin()
    fp_id = fingerprint_service.generate_fingerprint_id()

    insert_row = _build_insert_row(fp, hospital_id, submitted_by, fp_id)
    case_row = _persist(insert_row, fp, hospital_id)

    # Record token_H in case_fingerprints for future traceback
    try:
        supabase.table("case_fingerprints").insert({
            "case_id": case_row["id"],
            "fingerprint_id": fp_id,
            "hospital_id": hospital_id,
            "token_H": token_H,
        }).execute()
    except Exception:
        # Non-fatal — the case itself is already stored
        pass

    return case_row


# ─────────────────────────────────────────────────────────────────────────────
# Legacy one-step flow
# ─────────────────────────────────────────────────────────────────────────────

def create_case(case_in, hospital_id: str, submitted_by: str) -> dict:
    case_data = _case_dict(case_in)

    try:
        check_case_payload(case_data)
    except DeidentificationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    fp_id = fingerprint_service.generate_fingerprint_id()
    insert_row = _build_insert_row(case_data, hospital_id, submitted_by, fp_id)
    return _persist(insert_row, case_data, hospital_id)


# ─────────────────────────────────────────────────────────────────────────────
# Read helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_case(case_id: str, hospital_id: str) -> dict:
    supabase = get_supabase_admin()
    resp = (
        supabase.table("cases")
        .select("*")
        .eq("id", case_id)
        .eq("hospital_id", hospital_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found.")
    return resp.data


def list_cases(hospital_id: str, limit: int = 50, offset: int = 0) -> list:
    supabase = get_supabase_admin()
    resp = (
        supabase.table("cases")
        .select("*")
        .eq("hospital_id", hospital_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return resp.data or []