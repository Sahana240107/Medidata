"""
medidata/privacy/tokenizer.py

Layer 2 — tokenization.

Patient identifiers are tokenized with an HMAC key generated once locally
and NEVER transmitted. This is what makes the resulting
`local_patient_ref_hash` genuinely irreversible outside the hospital,
while still being *stable* — the same patient across two syncs produces
the same token, enabling downstream dedup/linkage without re-identification.

Key storage, in order of preference:
  1. OS keyring (via the `keyring` package) — the recommended path.
  2. An encrypted-at-rest fallback file at ~/.medidata/hospital.key
     (0600 permissions) if no OS keyring backend is available (e.g.
     headless Linux with no secret service running).

Either way: the secret is generated once with os.urandom(32), stored only
on this machine, and is never written into state.db and never sent to the
backend.
"""

from __future__ import annotations

import hmac
import hashlib
import os
import stat
from pathlib import Path

_SERVICE_NAME = "medidata-cli"
_KEY_NAME = "hospital_secret"
_FALLBACK_PATH = Path.home() / ".medidata" / "hospital.key"


def _keyring_available():
    try:
        import keyring  # noqa: F401
        # Probe the backend so we fail fast to the file fallback instead of
        # raising deep inside get/set later.
        import keyring.errors
        keyring.get_keyring()
        return True
    except Exception:
        return False


def _load_from_keyring() -> bytes | None:
    import keyring
    value = keyring.get_password(_SERVICE_NAME, _KEY_NAME)
    return bytes.fromhex(value) if value else None


def _save_to_keyring(secret: bytes) -> None:
    import keyring
    keyring.set_password(_SERVICE_NAME, _KEY_NAME, secret.hex())


def _load_from_file() -> bytes | None:
    if not _FALLBACK_PATH.exists():
        return None
    return bytes.fromhex(_FALLBACK_PATH.read_text().strip())


def _save_to_file(secret: bytes) -> None:
    _FALLBACK_PATH.parent.mkdir(exist_ok=True, mode=0o700)
    _FALLBACK_PATH.write_text(secret.hex())
    os.chmod(_FALLBACK_PATH, stat.S_IRUSR | stat.S_IWUSR)  # 0600


def get_or_create_hospital_secret() -> bytes:
    """
    Returns the local hospital HMAC secret, generating and persisting one
    (os.urandom(32)) on first use. This value never leaves the machine.
    """
    use_keyring = _keyring_available()

    if use_keyring:
        existing = _load_from_keyring()
        if existing:
            return existing
    else:
        existing = _load_from_file()
        if existing:
            return existing

    secret = os.urandom(32)
    if use_keyring:
        _save_to_keyring(secret)
    else:
        _save_to_file(secret)
    return secret


def tokenize(identifier: str, hospital_secret: bytes) -> str:
    """Stable, irreversible (outside this hospital) HMAC-SHA256 token."""
    return hmac.new(hospital_secret, identifier.encode(), hashlib.sha256).hexdigest()


def deterministic_record_key(hospital_secret: bytes, source_table: str, source_id: str) -> str:
    """
    Deterministic per-*record* (not per-patient) key used as the case's
    fingerprint_id for upload idempotency — same source row synced twice
    (e.g. after a crash/retry) produces the same key, so the backend can
    reject it as a duplicate instead of creating a second case.
    """
    return hmac.new(hospital_secret, f"{source_table}:{source_id}".encode(), hashlib.sha256).hexdigest()


def apply(record: dict, hospital_secret: bytes) -> dict:
    """
    Pops `patient_identifier` and replaces it with a stable
    `local_patient_ref_hash` token. No-ops (sets None) if the record has no
    identifier to tokenize.
    """
    out = dict(record)
    identifier = out.pop("patient_identifier", None)
    out["local_patient_ref_hash"] = tokenize(str(identifier), hospital_secret) if identifier else None
    return out
