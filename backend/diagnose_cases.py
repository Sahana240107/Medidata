"""
Standalone diagnostic — run this directly:

    python diagnose_cases.py

It loads your .env exactly like the app does, then makes a RAW http request
to Supabase (bypassing the supabase-py library entirely) to see if the
problem is in that library or in Supabase itself.
"""

import os
import httpx
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

print(f"URL loaded: {url}")
print(f"Key length: {len(key) if key else 'MISSING'}")
print()

endpoint = f"{url}/rest/v1/cases?select=id&limit=5"
headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
}

print(f"Requesting: {endpoint}")
resp = httpx.get(endpoint, headers=headers)

print(f"Status code: {resp.status_code}")
print(f"Content-Range header: {resp.headers.get('content-range')}")
print(f"Response body: {resp.text[:1000]}")

print()
print("--- Now testing with count=exact, like get_stats() does ---")
endpoint2 = f"{url}/rest/v1/cases?select=id"
headers2 = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Prefer": "count=exact",
}
resp2 = httpx.get(endpoint2, headers=headers2)
print(f"Status code: {resp2.status_code}")
print(f"Content-Range header: {resp2.headers.get('content-range')}")
print(f"Response body length: {len(resp2.text)}")
print(f"Response body (first 500 chars): {resp2.text[:500]}")