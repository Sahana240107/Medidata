"""
Case service.
Orchestrates the full intake chain:
  1. PII guard on the incoming payload
  2. Insert the case row into Supabase (with a freshly generated fingerprint_id)
  3. Build the fingerprint text, embed it, upsert the vector into Qdrant
  4. Roll back the Supabase row if the Qdrant step fails, so we never end up
     with a `cases` row whose fingerprint_id doesn't actually exist as a vector.
"""

from fastapi import HTTPException, status

from app.db.supabase_client import get_supabase_admin
from app.services import fingerprint_service
from app.services.deidentification_service import check_case_payload, DeidentificationError


def _case_dict(case_in) -> dict:
    """Pydantic model -> plain dict with nested items as plain dicts too."""
    data = case_in.dict()
    return data


def create_case(case_in, hospital_id: str, submitted_by: str) -> dict:
    case_data = _case_dict(case_in)

    # 1. PII guard
    try:
        check_case_payload(case_data)
    except DeidentificationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    supabase = get_supabase_admin()

    # 2. Reserve a fingerprint_id and insert the Supabase row first.
    fingerprint_id = fingerprint_service.generate_fingerprint_id()

    insert_row = {
        "hospital_id": hospital_id,
        "submitted_by": submitted_by,
        "fingerprint_id": fingerprint_id,
        "local_patient_ref_hash": case_data.get("local_patient_ref_hash"),
        "age_range": case_data.get("age_range"),
        "sex": case_data.get("sex"),
        "country": case_data.get("country"),
        "symptoms": case_data.get("symptoms", []),
        "lab_results": case_data.get("lab_results", []),
        "medications": case_data.get("medications", []),
        "procedures": case_data.get("procedures", []),
        "imaging_metadata": case_data.get("imaging_metadata", []),
        "genomic_metadata": case_data.get("genomic_metadata", []),
        "clinical_notes_summary": case_data.get("clinical_notes_summary"),
        "outcome": case_data.get("outcome"),
    }

    try:
        insert_resp = supabase.table("cases").insert(insert_row).execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Could not save case: {e}")

    if not insert_resp.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Case insert returned no data.")

    case_row = insert_resp.data[0]

    # 3. Build + embed the fingerprint, upsert into Qdrant.
    qdrant_payload = {
        "case_id": case_row["id"],
        "hospital_id": hospital_id,
        "country": case_data.get("country"),
        "age_range": case_data.get("age_range"),
        "sex": case_data.get("sex"),
        "status": case_row.get("status", "active"),
        "outcome": case_data.get("outcome"),
        "symptom_names": [s.get("name") for s in case_data.get("symptoms", [])],
    }

    try:
        fingerprint_service.create_fingerprint(
            case_data=case_data,
            payload=qdrant_payload,
        )
    except Exception as e:
        # Roll back the Supabase row so we never have an orphaned fingerprint_id.
        try:
            supabase.table("cases").delete().eq("id", case_row["id"]).execute()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Case saved but vectorization failed, change rolled back: {e}",
        )

    return case_row


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
