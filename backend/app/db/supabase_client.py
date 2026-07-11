"""
Supabase client module.
Uses the service-role key (admin) for server-side operations that bypass RLS.
Never expose this key to the frontend.
"""

import os
from functools import lru_cache

from supabase import create_client, Client


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