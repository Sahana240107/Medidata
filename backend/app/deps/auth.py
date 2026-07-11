"""
Auth dependency.
Verifies the Supabase access token sent as `Authorization: Bearer <token>`
and loads the corresponding profile row (so routers know hospital_id/role).
"""

from fastapi import Depends, Header, HTTPException, status

from app.db.supabase_client import get_supabase_admin


async def get_current_user(authorization: str = Header(None)) -> dict:
    """
    FastAPI dependency: validates the bearer token via Supabase Auth and
    returns the caller's profile dict (id, role, hospital_id, ...).
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header.",
        )

    token = authorization.split(" ", 1)[1].strip()
    supabase = get_supabase_admin()

    try:
        user_resp = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.")

    user = getattr(user_resp, "user", None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.")

    try:
        profile_resp = (
            supabase.table("profiles")
            .select("*")
            .eq("id", user.id)
            .single()
            .execute()
        )
        profile = profile_resp.data
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found for this user.")

    if not profile.get("hospital_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Profile is not linked to a hospital.",
        )

    return profile


async def require_doctor(user: dict = Depends(get_current_user)) -> dict:
    """Optional stricter dependency for endpoints that only doctors should hit."""
    if user.get("role") not in ("doctor", "hospital_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Doctor role required.")
    return user
