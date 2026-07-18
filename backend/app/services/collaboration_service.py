"""
Collaboration service — connection requests, accept/decline, progress
tracking, and the per-collaboration personal chat thread.

Assumes `collaborations.status` enum includes at least these labels (matches
what dashboard/layout.jsx already queries with `?status=requested`):
"""

from typing import Optional

from fastapi import HTTPException, status as http_status

from app.db.supabase_client import get_supabase_admin

REQUESTED_STATUS = "requested"
ACCEPTED_STATUS = "accepted"
DECLINED_STATUS = "declined"

DEFAULT_MESSAGES = {
    "connect": "I'd like to connect with you on MediData.",
    "collaborate": "I'd like to propose a research collaboration.",
    "invite_to_study": "I'd like to invite you to join a study.",
}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _fetch_profiles_by_id(ids: set[str]) -> dict[str, dict]:
    if not ids:
        return {}
    supabase = get_supabase_admin()
    resp = (
        supabase.table("profiles")
        .select("id, full_name, avatar_url, specialty, country, hospital_id")
        .in_("id", list(ids))
        .execute()
    )
    return {p["id"]: p for p in (resp.data or [])}


def _fetch_hospitals_by_id(ids: set[str]) -> dict[str, dict]:
    if not ids:
        return {}
    supabase = get_supabase_admin()
    resp = supabase.table("hospitals").select("id, name").in_("id", list(ids)).execute()
    return {h["id"]: h for h in (resp.data or [])}


def _notify(recipient_id: str, title: str, body: str, related_entity_id: str, notif_type: str = "collaboration") -> None:
    """
    Best-effort notification insert. `notifications.type` is a DB enum whose
    exact allowed labels we don't have visibility into from here, so this is
    wrapped defensively -- a failed notification should never block the
    actual collaboration action.
    """
    try:
        supabase = get_supabase_admin()
        supabase.table("notifications").insert({
            "recipient_id": recipient_id,
            "type": notif_type,
            "title": title,
            "body": body,
            "related_entity_type": "collaboration",
            "related_entity_id": related_entity_id,
            "is_read": False,
        }).execute()
    except Exception:
        pass


def _to_read_model(row: dict, current_user_id: str, profiles: dict, hospitals: dict) -> dict:
    is_outgoing = row["requested_by"] == current_user_id
    other_id = row["requested_to"] if is_outgoing else row["requested_by"]
    other_profile = profiles.get(other_id, {})
    hospital = hospitals.get(other_profile.get("hospital_id"))

    return {
        "id": row["id"],
        "status": row["status"],
        "message": row.get("message"),
        "project_title": row.get("project_title"),
        "progress_percent": row.get("progress_percent") or 0,
        "related_case_id": row.get("related_case_id"),
        "related_signal_id": row.get("related_signal_id"),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "direction": "outgoing" if is_outgoing else "incoming",
        "counterpart": {
            "id": other_id,
            "full_name": other_profile.get("full_name", "Unknown"),
            "avatar_url": other_profile.get("avatar_url"),
            "specialty": other_profile.get("specialty"),
            "country": other_profile.get("country"),
            "hospital_name": hospital.get("name") if hospital else None,
        },
    }


def _get_collaboration_or_404(collaboration_id: str) -> dict:
    supabase = get_supabase_admin()
    resp = (
        supabase.table("collaborations")
        .select("*")
        .eq("id", collaboration_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Collaboration not found.")
    return resp.data


def _assert_participant(collab: dict, user_id: str) -> None:
    if user_id not in (collab["requested_by"], collab["requested_to"]):
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Not a participant in this collaboration.")


# ─────────────────────────────────────────────────────────────────────────────
# Public API — requests
# ─────────────────────────────────────────────────────────────────────────────

def create_collaboration(
    requested_by: str,
    requested_by_name: str,
    requested_to: str,
    message: Optional[str],
    kind: str,
    related_case_id: Optional[str] = None,
    related_signal_id: Optional[str] = None,
    project_title: Optional[str] = None,
) -> dict:
    if requested_by == requested_to:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Cannot collaborate with yourself.")

    supabase = get_supabase_admin()

    final_message = message or DEFAULT_MESSAGES.get(kind, DEFAULT_MESSAGES["connect"])

    insert_row = {
        "requested_by": requested_by,
        "requested_to": requested_to,
        "message": final_message,
        "status": REQUESTED_STATUS,
    }
    if related_case_id:
        insert_row["related_case_id"] = related_case_id
    if related_signal_id:
        insert_row["related_signal_id"] = related_signal_id
    if project_title:
        insert_row["project_title"] = project_title

    resp = supabase.table("collaborations").insert(insert_row).execute()
    if not resp.data:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not create collaboration request.")

    row = resp.data[0]

    _notify(
        recipient_id=requested_to,
        title="New collaboration request",
        body=f"{requested_by_name} sent you a request: {final_message}",
        related_entity_id=row["id"],
        notif_type="collaboration_request",
    )

    profiles = _fetch_profiles_by_id({requested_by, requested_to})
    hospitals = _fetch_hospitals_by_id({p["hospital_id"] for p in profiles.values() if p.get("hospital_id")})
    return _to_read_model(row, requested_by, profiles, hospitals)


def list_collaborations(current_user_id: str, box: str = "active") -> list[dict]:
    """box: 'incoming' | 'outgoing' | 'active'"""
    supabase = get_supabase_admin()

    if box == "incoming":
        resp = (
            supabase.table("collaborations")
            .select("*")
            .eq("requested_to", current_user_id)
            .eq("status", REQUESTED_STATUS)
            .order("created_at", desc=True)
            .execute()
        )
        rows = resp.data or []
    elif box == "outgoing":
        resp = (
            supabase.table("collaborations")
            .select("*")
            .eq("requested_by", current_user_id)
            .eq("status", REQUESTED_STATUS)
            .order("created_at", desc=True)
            .execute()
        )
        rows = resp.data or []
    else:  # active
        sent = (
            supabase.table("collaborations")
            .select("*")
            .eq("requested_by", current_user_id)
            .eq("status", ACCEPTED_STATUS)
            .execute()
        )
        received = (
            supabase.table("collaborations")
            .select("*")
            .eq("requested_to", current_user_id)
            .eq("status", ACCEPTED_STATUS)
            .execute()
        )
        rows = (sent.data or []) + (received.data or [])
        rows.sort(key=lambda r: r["updated_at"], reverse=True)

    other_ids = {
        (r["requested_to"] if r["requested_by"] == current_user_id else r["requested_by"])
        for r in rows
    }
    profiles = _fetch_profiles_by_id(other_ids)
    hospitals = _fetch_hospitals_by_id({p["hospital_id"] for p in profiles.values() if p.get("hospital_id")})

    return [_to_read_model(r, current_user_id, profiles, hospitals) for r in rows]


def respond_to_collaboration(collaboration_id: str, current_user_id: str, action: str) -> dict:
    if action not in ("accept", "decline"):
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="action must be 'accept' or 'decline'.")

    collab = _get_collaboration_or_404(collaboration_id)
    if collab["requested_to"] != current_user_id:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Only the recipient can respond to this request.")
    if collab["status"] != REQUESTED_STATUS:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="This request has already been responded to.")

    new_status = ACCEPTED_STATUS if action == "accept" else DECLINED_STATUS

    supabase = get_supabase_admin()
    resp = (
        supabase.table("collaborations")
        .update({"status": new_status})
        .eq("id", collaboration_id)
        .execute()
    )
    row = resp.data[0] if resp.data else {**collab, "status": new_status}

    profiles = _fetch_profiles_by_id({collab["requested_by"], collab["requested_to"]})
    responder_name = profiles.get(current_user_id, {}).get("full_name", "A colleague")

    _notify(
        recipient_id=collab["requested_by"],
        title=f"Collaboration request {new_status}",
        body=f"{responder_name} {new_status} your collaboration request.",
        related_entity_id=collaboration_id,
        notif_type="collaboration_response",
    )

    hospitals = _fetch_hospitals_by_id({p["hospital_id"] for p in profiles.values() if p.get("hospital_id")})
    return _to_read_model(row, current_user_id, profiles, hospitals)


def update_progress(collaboration_id: str, current_user_id: str, progress_percent: int, project_title: Optional[str]) -> dict:
    collab = _get_collaboration_or_404(collaboration_id)
    _assert_participant(collab, current_user_id)
    if collab["status"] != ACCEPTED_STATUS:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Only active collaborations can be updated.")

    update_payload = {"progress_percent": progress_percent}
    if project_title is not None:
        update_payload["project_title"] = project_title

    supabase = get_supabase_admin()
    resp = supabase.table("collaborations").update(update_payload).eq("id", collaboration_id).execute()
    row = resp.data[0] if resp.data else {**collab, **update_payload}

    profiles = _fetch_profiles_by_id({collab["requested_by"], collab["requested_to"]})
    hospitals = _fetch_hospitals_by_id({p["hospital_id"] for p in profiles.values() if p.get("hospital_id")})
    return _to_read_model(row, current_user_id, profiles, hospitals)


# ─────────────────────────────────────────────────────────────────────────────
# Public API — personal chat
# ─────────────────────────────────────────────────────────────────────────────

def list_messages(collaboration_id: str, current_user_id: str) -> list[dict]:
    collab = _get_collaboration_or_404(collaboration_id)
    _assert_participant(collab, current_user_id)

    supabase = get_supabase_admin()
    resp = (
        supabase.table("collaboration_messages")
        .select("*")
        .eq("collaboration_id", collaboration_id)
        .order("created_at", desc=False)
        .execute()
    )
    rows = resp.data or []
    for r in rows:
        r["is_mine"] = r["sender_id"] == current_user_id
    return rows


def send_message(collaboration_id: str, current_user_id: str, content: str) -> dict:
    collab = _get_collaboration_or_404(collaboration_id)
    _assert_participant(collab, current_user_id)
    if collab["status"] != ACCEPTED_STATUS:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Chat is only available for accepted collaborations.")

    supabase = get_supabase_admin()
    resp = (
        supabase.table("collaboration_messages")
        .insert({
            "collaboration_id": collaboration_id,
            "sender_id": current_user_id,
            "content": content,
        })
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not send message.")

    row = resp.data[0]
    row["is_mine"] = True

    other_id = collab["requested_to"] if collab["requested_by"] == current_user_id else collab["requested_by"]
    profiles = _fetch_profiles_by_id({current_user_id})
    sender_name = profiles.get(current_user_id, {}).get("full_name", "Your collaborator")
    _notify(
        recipient_id=other_id,
        title=f"New message from {sender_name}",
        body=content[:140],
        related_entity_id=collaboration_id,
        notif_type="collaboration_message",
    )

    return row