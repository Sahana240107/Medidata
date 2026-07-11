"""
Auth router — handles /auth/register and /auth/login.
Stores users in Supabase via the supabase-py client (auth + profiles + hospitals tables).
Returns a JWT access token from Supabase on success.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.db.supabase_client import get_supabase_admin

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
    user: dict


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

        # 4. Sign in to get a real JWT for the user
        sign_in = supabase.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
        access_token = sign_in.session.access_token

    except Exception as e:
        # Roll back auth user if profile creation fails
        try:
            supabase.auth.admin.delete_user(user_id)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Account setup failed: {str(e)}")

    return AuthResponse(
        access_token=access_token,
        user=_safe_user(profile),
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    """
    Sign in with email + password via Supabase Auth.
    Returns the session JWT + profile data.
    """
    supabase = get_supabase_admin()

    try:
        sign_in = supabase.auth.sign_in_with_password(
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

    # Fetch profile
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
        user=_safe_user(profile),
    )


@router.get("/me")
async def me_placeholder():
    """Placeholder — protected /me endpoint will use JWT dependency."""
    raise HTTPException(status_code=501, detail="Use the JWT token to decode user identity.")