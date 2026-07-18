"""
Supabase client module.
Uses the service-role key (admin) for server-side operations that bypass RLS.
Never expose this key to the frontend.
"""

import base64
import json
import logging
import os
from functools import lru_cache

from supabase import create_client, Client

logger = logging.getLogger("medidata.feed_stats")
logging.basicConfig(level=logging.INFO)


def _debug_decode_jwt_role(key: str, label: str) -> None:
    """Prints the 'role' claim baked into a Supabase key, so we can see
    at runtime whether we're really holding a service_role key or not."""
    try:
        parts = key.split(".")
        payload = parts[1]
        payload += "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload))
        logger.info(
            "KEY DEBUG -> %s role=%r ref=%r len=%d",
            label, data.get("role"), data.get("ref"), len(key),
        )
    except Exception as e:
        logger.warning("KEY DEBUG -> %s could not be decoded as a JWT: %r (len=%d)", label, e, len(key or ""))


@lru_cache(maxsize=1)
def get_supabase_admin() -> Client:
    """
    Returns a singleton Supabase admin client.
    Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from environment.
    """
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment."
        )

    logger.info("KEY DEBUG -> SUPABASE_URL=%r", url)
    _debug_decode_jwt_role(key, "SUPABASE_SERVICE_ROLE_KEY")

    return create_client(url, key)


def get_supabase_anon() -> Client:
    """
    Returns an anon-key Supabase client for operations that should respect RLS.
    Use this for user-facing queries after token validation.
    """
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")

    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_ANON_KEY must be set in the environment."
        )

    return create_client(url, key)