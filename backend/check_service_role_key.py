"""
Run this from backend/ (where your .env lives):
    python check_service_role_key.py

Decodes the JWT's payload locally to confirm SUPABASE_SERVICE_ROLE_KEY
actually has role="service_role" — WITHOUT printing the key itself.
This is a plain base64 decode (JWTs aren't encrypted), so it's safe to
run offline; no network calls, no secrets logged.
"""

import base64
import json
import os

from dotenv import load_dotenv

load_dotenv()


def decode_jwt_payload(token: str) -> dict:
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Doesn't look like a JWT (expected 3 dot-separated parts).")
    payload_b64 = parts[1]
    padding = "=" * (-len(payload_b64) % 4)
    decoded = base64.urlsafe_b64decode(payload_b64 + padding)
    return json.loads(decoded)


def check(var_name: str):
    key = os.environ.get(var_name, "")
    if not key:
        print(f"❌ {var_name} is not set in your .env at all.")
        return
    try:
        payload = decode_jwt_payload(key)
    except Exception as e:
        print(f"❌ {var_name} doesn't look like a valid JWT: {e}")
        return

    role = payload.get("role", "<no role claim>")
    ref = payload.get("ref", "<no ref claim>")
    print(f"{var_name}: role='{role}', project ref='{ref}'")
    if var_name == "SUPABASE_SERVICE_ROLE_KEY" and role != "service_role":
        print("   ⚠️  This is NOT a service_role key. Go to Supabase Dashboard →")
        print("       Settings → API → copy the 'service_role' (secret) key,")
        print("       not the 'anon' (public) one, into SUPABASE_SERVICE_ROLE_KEY.")


url = os.environ.get("SUPABASE_URL", "")
if url:
    ref_from_url = url.replace("https://", "").split(".")[0]
    print(f"SUPABASE_URL project ref: '{ref_from_url}'  (compare this against 'ref' below)")
else:
    print("❌ SUPABASE_URL is not set in your .env at all.")

check("SUPABASE_ANON_KEY")
check("SUPABASE_SERVICE_ROLE_KEY")