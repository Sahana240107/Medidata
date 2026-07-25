"""
medidata/privacy/encryption.py

Layer 5 — encryption at rest.

Once a record has passed Layers 1-4, it's encrypted before it sits on disk
waiting for the doctor's approval (Phase 9). Decrypted only in memory at
upload time. The Fernet key is derived from the same local hospital secret
as the tokenizer (Layer 2) — one local keystore, two derived uses.
"""

from __future__ import annotations

import base64
import hashlib
import json

from cryptography.fernet import Fernet


def _derive_fernet_key(hospital_secret: bytes) -> bytes:
    """Fernet needs a 32-byte urlsafe-base64 key; derive it from the hospital secret."""
    digest = hashlib.sha256(hospital_secret + b"medidata-cli-encryption-at-rest").digest()
    return base64.urlsafe_b64encode(digest)


def get_fernet(hospital_secret: bytes) -> Fernet:
    return Fernet(_derive_fernet_key(hospital_secret))


def encrypt_records(records: list[dict], hospital_secret: bytes) -> bytes:
    """Serializes + encrypts a whole staged batch into one opaque blob."""
    fernet = get_fernet(hospital_secret)
    payload = json.dumps(records).encode("utf-8")
    return fernet.encrypt(payload)


def decrypt_records(token: bytes, hospital_secret: bytes) -> list[dict]:
    fernet = get_fernet(hospital_secret)
    payload = fernet.decrypt(token)
    return json.loads(payload.decode("utf-8"))


def write_staged_batch(path, records: list[dict], hospital_secret: bytes) -> None:
    token = encrypt_records(records, hospital_secret)
    with open(path, "wb") as f:
        f.write(token)


def read_staged_batch(path, hospital_secret: bytes) -> list[dict]:
    with open(path, "rb") as f:
        token = f.read()
    return decrypt_records(token, hospital_secret)
