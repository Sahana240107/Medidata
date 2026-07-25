"""
Auth router — handles /auth/register and /auth/login.
Stores users in Supabase via the supabase-py client (auth + profiles + hospitals tables).
Returns a JWT access token from Supabase on success.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.db.supabase_client import get_supabase_admin, get_supabase_anon

router = APIRouter(prefix="/auth", tags=["auth"])


# ─── Schemas ────────────────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str  # "doctor" | "researcher" | "hospital_admin"
    hospital_name: str
    hospital_country: str
    hospital_city: Optional[str] = None
    specialty: Optional[str] = None
    orcid_id: Optional[str] = None
    bio: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


# ─── Helpers ────────────────────────────────────────────────────────────────


ALLOWED_ROLES = {"doctor", "researcher", "hospital_admin"}


def _safe_user(profile: dict) -> dict:
    """Return a safe user dict for the frontend (no password, no sensitive data)."""
    return {
        "id": profile.get("id"),
        "full_name": profile.get("full_name"),
        "role": profile.get("role"),
        "specialty": profile.get("specialty"),
        "country": profile.get("country"),
        "bio": profile.get("bio"),
        "orcid_id": profile.get("orcid_id"),
        "hospital_id": profile.get("hospital_id"),
        "verification_status": profile.get("verification_status"),
    }


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    """
    1. Validate role.
    2. Create Supabase Auth user.
    3. Upsert hospital row (by name + country).
    4. Insert profile row linked to the auth user + hospital.
    5. Return access token + safe user.
    """
    if body.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(ALLOWED_ROLES)}")

    supabase = get_supabase_admin()

    # 1. Create auth user
    try:
        auth_resp = supabase.auth.admin.create_user(
            {
                "email": body.email,
                "password": body.password,
                "email_confirm": True,  # skip email confirmation for now
            }
        )
    except Exception as e:
        detail = str(e)
        if "already registered" in detail.lower() or "already exists" in detail.lower():
            raise HTTPException(status_code=409, detail="An account with this email already exists.")
        raise HTTPException(status_code=400, detail=f"Could not create account: {detail}")

    user_id = auth_resp.user.id

    try:
        # 2. Upsert hospital
        hospital_resp = (
            supabase.table("hospitals")
            .upsert(
                {
                    "name": body.hospital_name,
                    "country": body.hospital_country,
                    "city": body.hospital_city,
                    "verification_status": "pending",
                },
                on_conflict="name,country",
                ignore_duplicates=False,
            )
            .execute()
        )
        hospital_id = hospital_resp.data[0]["id"] if hospital_resp.data else None

        # 3. Insert profile
        profile_data = {
            "id": user_id,
            "full_name": body.full_name,
            "role": body.role,
            "specialty": body.specialty,
            "orcid_id": body.orcid_id,
            "bio": body.bio,
            "country": body.hospital_country,
            "hospital_id": hospital_id,
            "verification_status": "pending",
        }
        profile_resp = supabase.table("profiles").insert(profile_data).execute()
        profile = profile_resp.data[0] if profile_resp.data else profile_data

        # 4. Sign in to get a real JWT for the user.
        # IMPORTANT: this must run on a fresh anon client, never on the
        # cached get_supabase_admin() singleton — calling sign_in_with_password
        # on that client would overwrite its session, so every later
        # request in the process that calls get_supabase_admin() would
        # silently start running as this user (and their RLS restrictions)
        # instead of the service role. See the same note in deps/auth.py.
        sign_in = get_supabase_anon().auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
        access_token = sign_in.session.access_token
        refresh_token = sign_in.session.refresh_token

    except Exception as e:
        # Roll back auth user if profile creation fails
        try:
            supabase.auth.admin.delete_user(user_id)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Account setup failed: {str(e)}")

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_safe_user(profile),
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    """
    Sign in with email + password via Supabase Auth.
    Returns the session JWT + profile data.
    """
    # Sign-in happens on a fresh anon client, NOT the cached admin
    # singleton from get_supabase_admin(). That singleton is shared by
    # every request in the process; calling an auth method that sets a
    # session on it (sign_in_with_password / refresh_session) would
    # silently swap its service-role identity for whichever user last
    # logged in, and every later admin/service-role query anywhere else
    # in the app — including this CLI's own profile lookups on
    # /api/cli/sync — would start running as that user (subject to RLS)
    # instead of the service role. This is exactly the failure mode
    # deps/auth.py's get_current_user avoids by using get_supabase_anon()
    # for token validation.
    try:
        sign_in = get_supabase_anon().auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    if not sign_in.session:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user_id = sign_in.user.id
    access_token = sign_in.session.access_token
    refresh_token = sign_in.session.refresh_token

    # Profile lookup uses the real admin client — untouched by the sign-in
    # above, always the actual service-role key, always bypasses RLS.
    supabase = get_supabase_admin()
    try:
        profile_resp = (
            supabase.table("profiles")
            .select("*")
            .eq("id", user_id)
            .single()
            .execute()
        )
        profile = profile_resp.data
    except Exception:
        profile = {"id": user_id}

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_safe_user(profile),
    )


@router.post("/refresh", response_model=AuthResponse)
async def refresh(body: RefreshRequest):
    """
    Exchanges a refresh_token for a new access_token (+ rotated refresh_token).

    Supabase access tokens are short-lived (~1 hour by default). Long-running
    clients — like `medidata serve`, which can sit open through MySQL setup,
    doctor mapping, and sync preview before the user finally clicks Submit —
    need this to avoid hitting "Invalid or expired token" on an otherwise
    successful session just because time passed.

    Like sign-in, this runs on a fresh anon client rather than the cached
    admin singleton — refresh_session() sets a session on whichever client
    calls it, and doing that on get_supabase_admin() would silently
    replace its service-role identity with this doctor's session for
    every other request sharing that singleton. In a long-running `medidata
    serve` process this endpoint gets hit repeatedly (once per expired
    access token), so without this fix the admin client's identity keeps
    getting overwritten and any concurrent request depending on the real
    service-role key — including the very next POST /api/cli/sync, and
    other users' profile lookups in get_current_user — can start failing
    with auth errors that look unrelated to their actual cause.
    """
    try:
        refreshed = get_supabase_anon().auth.refresh_session(body.refresh_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token. Please log in again.")

    if not refreshed or not refreshed.session:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token. Please log in again.")

    user_id = refreshed.user.id
    access_token = refreshed.session.access_token
    new_refresh_token = refreshed.session.refresh_token

    # Profile lookup uses the real admin client — untouched by the refresh
    # above, always the actual service-role key, always bypasses RLS.
    supabase = get_supabase_admin()
    try:
        profile_resp = (
            supabase.table("profiles")
            .select("*")
            .eq("id", user_id)
            .single()
            .execute()
        )
        profile = profile_resp.data
    except Exception:
        profile = {"id": user_id}

    return AuthResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=_safe_user(profile),
    )


@router.get("/me")
async def me_placeholder():
    """Placeholder — protected /me endpoint will use JWT dependency."""
    raise HTTPException(status_code=501, detail="Use the JWT token to decode user identity.")