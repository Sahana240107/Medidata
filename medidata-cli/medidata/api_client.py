"""
medidata/api_client.py

Thin wrapper around the existing FastAPI backend. The CLI never talks to
Supabase or Qdrant directly (see architecture note in the implementation
guide) — it authenticates and uploads through the backend's own endpoints
so every case goes through identical server-side validation regardless of
whether it came from the web app or the CLI.

Real backend routes used here:
  POST /auth/login    -> { access_token, token_type, user: {...} }
  POST /api/cli/sync   -> { accepted: [...], duplicates: [...], rejected: [...] }
"""

from __future__ import annotations

import httpx


class MediDataAPIError(Exception):
    """Raised when the backend returns an error response."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"[{status_code}] {detail}")


class MediDataClient:
    def __init__(self, base_url: str, token: str | None = None, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout
        self.current_profile: dict | None = None

    # ─── internal helpers ─────────────────────────────────────────────

    def _headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _raise_for_backend_error(self, r: httpx.Response) -> None:
        if r.status_code >= 400:
            try:
                detail = r.json().get("detail", r.text)
            except Exception:
                detail = r.text
            raise MediDataAPIError(r.status_code, str(detail))

    # ─── auth ───────────────────────────────────────────────────────────

    def login(self, email: str, password: str) -> dict:
        """
        Calls the backend's real /auth/login endpoint.
        Returns the `user` profile dict: {id, full_name, role, specialty,
        country, bio, orcid_id, hospital_id, verification_status}.
        Note: the backend's /auth/login response does not currently include
        email, so we stitch it back in locally from what the caller typed.
        """
        r = httpx.post(
            f"{self.base_url}/auth/login",
            json={"email": email, "password": password},
            timeout=self.timeout,
        )
        self._raise_for_backend_error(r)
        data = r.json()

        self.token = data["access_token"]
        profile = data["user"]
        profile.setdefault("email", email)
        self.current_profile = profile
        return profile

    def get(self, path: str, **kwargs) -> httpx.Response:
        r = httpx.get(f"{self.base_url}{path}", headers=self._headers(),
                       timeout=self.timeout, **kwargs)
        self._raise_for_backend_error(r)
        return r

    def post(self, path: str, json: dict | None = None, **kwargs) -> httpx.Response:
        r = httpx.post(f"{self.base_url}{path}", headers=self._headers(),
                        json=json, timeout=self.timeout, **kwargs)
        self._raise_for_backend_error(r)
        return r

    # ─── sync (Phase 10) ──────────────────────────────────────────────

    def sync(self, cases: list[dict], privacy_report: dict) -> dict:
        """
        POST /api/cli/sync — the only network egress point in the whole
        pipeline, and by the time this is called nothing sensitive remains
        in `cases`: only tokenized, generalized, validated payloads.
        """
        r = self.post("/api/cli/sync", json={"cases": cases, "privacy_report": privacy_report})
        return r.json()  # { accepted: [...], duplicates: [...], rejected: [...] }
