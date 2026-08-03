"""
backend/app/routers/cli_sync.py

POST /api/cli/sync

Thin batch wrapper around the existing case_service.py — a case created
through the CLI goes through identical server-side validation as one
created via the web app. The only new logic here is auth resolution +
idempotency on `fingerprint_id`.

NOTE: adjust the `get_current_profile` import below to match your actual
auth dependency module (deps/auth.py) — this file assumes it returns a
dict with at least {id, hospital_id, verification_status}, the same shape
case_service.py's other callers already rely on.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

import logging

from app.db.supabase_client import get_supabase_admin
from app.deps.auth import get_current_user as get_current_profile
from app.schemas.cli_sync import (
    CLISyncRequest,
    CLISyncResponse,
    CLISyncResultItem,
    CLISyncLogRead,
)
from app.services import case_service
from app.services.deidentification_service import DeidentificationError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cli", tags=["cli-sync"])


@router.post("/sync", response_model=CLISyncResponse)
def sync_cases(payload: CLISyncRequest, profile: dict = Depends(get_current_profile)):
    if profile.get("verification_status") != "verified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only verified doctor accounts can sync cases through the CLI.",
        )

    hospital_id = profile["hospital_id"]
    submitted_by = profile["id"]
    if not hospital_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account has no associated hospital_id — cannot attribute cases.",
        )

    supabase = get_supabase_admin()

    accepted, duplicates, rejected = [], [], []

    for case_in in payload.cases:
        fp_id = case_in.fingerprint_id

        # Idempotency: same local record synced twice (e.g. after a retry)
        # is recognized here, before ever touching case_service.
        existing = (
            supabase.table("cases")
            .select("id")
            .eq("fingerprint_id", fp_id)
            .eq("hospital_id", hospital_id)
            .execute()
        )
        if existing.data:
            duplicates.append(CLISyncResultItem(fingerprint_id=fp_id, case_id=existing.data[0]["id"]))
            continue

        case_data = case_in.dict(exclude={"fingerprint_id"})

        try:
            case_row = case_service.create_case_with_fingerprint_id(
                case_data=case_data,
                hospital_id=hospital_id,
                submitted_by=submitted_by,
                fingerprint_id=fp_id,
            )
            accepted.append(CLISyncResultItem(fingerprint_id=fp_id, case_id=case_row["id"]))
        except DeidentificationError as e:
            rejected.append(CLISyncResultItem(fingerprint_id=fp_id, reason=str(e)))
        except HTTPException as e:
            rejected.append(CLISyncResultItem(fingerprint_id=fp_id, reason=str(e.detail)))

    # Log the privacy report alongside this sync for audit. If this fails,
    # the cases themselves are already committed above — don't fail the
    # whole request over an audit-log write, but DO surface the error
    # (this used to be a bare `except: pass`, which is why a missing
    # `cli_sync_logs` table failed silently instead of showing up here).
    try:
        supabase.table("cli_sync_logs").insert({
            "hospital_id": hospital_id,
            "submitted_by": submitted_by,
            "privacy_report": payload.privacy_report,
            "accepted_count": len(accepted),
            "duplicate_count": len(duplicates),
            "rejected_count": len(rejected),
        }).execute()
    except Exception:
        logger.exception(
            "Failed to write cli_sync_logs audit row for hospital_id=%s submitted_by=%s "
            "(cases above were still committed) — sync history will be missing this entry "
            "until this is fixed.", hospital_id, submitted_by,
        )

    return CLISyncResponse(accepted=accepted, duplicates=duplicates, rejected=rejected)


@router.get("/sync/history", response_model=list[CLISyncLogRead])
def get_sync_history(
    limit: int = Query(20, ge=1, le=100),
    profile: dict = Depends(get_current_profile),
):
    """
    Read-only: past `medidata sync` runs for the caller's hospital, most recent
    first. This does NOT expose any case data or an approval step — by the time
    a row exists here the doctor has already reviewed and approved that batch
    in their own terminal (see the CLI's Phase 8/9 preview + Y/N gate). This is
    purely an audit view so the web app can confirm "yes, that sync went through".
    """
    hospital_id = profile["hospital_id"]
    if not hospital_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account has no associated hospital_id.",
        )

    supabase = get_supabase_admin()
    resp = (
        supabase.table("cli_sync_logs")
        .select("*")
        .eq("hospital_id", hospital_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return resp.data or []