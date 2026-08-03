"""
medidata/api_client.py

Thin wrapper around the existing FastAPI backend. The CLI never talks to
Supabase or Qdrant directly (see architecture note in the implementation
guide) — it authenticates and uploads through the backend's own endpoints
so every case goes through identical server-side validation regardless of
whether it came from the web app or the CLI.

Real backend routes used here:
  POST /auth/login    -> { access_token, refresh_token, token_type, user: {...} }
  POST /auth/refresh   -> { access_token, refresh_token, token_type, user: {...} }
  POST /api/cli/sync   -> { accepted: [...], duplicates: [...], rejected: [...] }

Token lifetime note:
  Supabase access tokens are short-lived (~1 hour by default). `medidata
  serve` is a long-running process — a doctor can log in, spend a while
  configuring MySQL / mapping their account / previewing a batch, and only
  click Submit well after the access token has expired. Rather than
  surfacing "Invalid or expired token" at that point, this client holds
  onto the refresh_token from login and transparently exchanges it for a
  new access token the first time any request comes back 401, then
  retries that request once before giving up.
"""

from __future__ import annotations

from typing import Callable, Optional

import httpx


class MediDataAPIError(Exception):
    """Raised when the backend returns an error response."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"[{status_code}] {detail}")


class MediDataClient:
    def __init__(
        self,
        base_url: str,
        token: str | None = None,
        refresh_token: str | None = None,
        timeout: float = 30.0,
        on_token_refresh: Optional[Callable[[str, str | None], None]] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.refresh_token = refresh_token
        self.timeout = timeout
        self.current_profile: dict | None = None
        # Called with (new_access_token, new_refresh_token) right after a
        # successful silent refresh, so long-lived callers (local_server.py,
        # cli.py) can persist the new tokens to state_db instead of losing
        # them the moment this client object goes out of scope.
        self.on_token_refresh = on_token_refresh

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

    def _is_token_error(self, r: httpx.Response) -> bool:
        if r.status_code != 401:
            return False
        try:
            detail = str(r.json().get("detail", "")).lower()
        except Exception:
            detail = r.text.lower()
        return "token" in detail

    def _try_silent_refresh(self) -> bool:
        """Attempts one refresh using the stored refresh_token. Returns True on success."""
        if not self.refresh_token:
            return False
        try:
            r = httpx.post(
                f"{self.base_url}/auth/refresh",
                json={"refresh_token": self.refresh_token},
                timeout=self.timeout,
            )
        except Exception:
            return False

        if r.status_code >= 400:
            return False

        data = r.json()
        self.token = data["access_token"]
        self.refresh_token = data.get("refresh_token") or self.refresh_token

        if self.on_token_refresh:
            self.on_token_refresh(self.token, self.refresh_token)

        return True

    def _request(self, method: str, path: str, retry_on_expired: bool = True, **kwargs) -> httpx.Response:
        r = httpx.request(method, f"{self.base_url}{path}", headers=self._headers(),
                           timeout=self.timeout, **kwargs)

        if retry_on_expired and self._is_token_error(r) and self._try_silent_refresh():
            r = httpx.request(method, f"{self.base_url}{path}", headers=self._headers(),
                               timeout=self.timeout, **kwargs)

        self._raise_for_backend_error(r)
        return r

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
        self.refresh_token = data.get("refresh_token")
        profile = data["user"]
        profile.setdefault("email", email)
        self.current_profile = profile
        return profile

    def get(self, path: str, **kwargs) -> httpx.Response:
        return self._request("GET", path, **kwargs)

    def post(self, path: str, json: dict | None = None, **kwargs) -> httpx.Response:
        return self._request("POST", path, json=json, **kwargs)

    # ─── sync (Phase 10) ──────────────────────────────────────────────

    def sync(self, cases: list[dict], privacy_report: dict) -> dict:
        """
        POST /api/cli/sync — the only network egress point in the whole
        pipeline, and by the time this is called nothing sensitive remains
        in `cases`: only tokenized, generalized, validated payloads.
        """
        r = self.post("/api/cli/sync", json={"cases": cases, "privacy_report": privacy_report})
        return r.json()  # { accepted: [...], duplicates: [...], rejected: [...] }
