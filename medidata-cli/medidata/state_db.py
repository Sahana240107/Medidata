"""
medidata/state_db.py

CLI-owned local state, kept entirely separate from the hospital's MySQL
schema. The CLI never writes to the hospital DB — everything the CLI needs
to remember between runs lives here instead, in ~/.medidata/state.db.

Tables:
  auth_session    - cached JWT + profile info from `medidata login`
  mysql_config    - non-secret connection info from `medidata connect`
                    (host/port/database/user only — password always comes
                    from the environment at runtime, never stored here)
  doctor_mapping  - local_doctor_id -> supabase_profile_id, set once via
                    `medidata map-doctor`
  sync_watermark  - last synced id/timestamp per source table, per doctor
                    (Phase 4 — change detection)
  sync_log        - audit trail of every sync attempt (Phase 11)
"""

import sqlite3
from pathlib import Path
from contextlib import contextmanager
from datetime import datetime, timezone

STATE_DIR = Path.home() / ".medidata"
STATE_PATH = STATE_DIR / "state.db"


def get_conn() -> sqlite3.Connection:
    STATE_DIR.mkdir(exist_ok=True, mode=0o700)
    conn = sqlite3.connect(STATE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")

    conn.execute(
        """CREATE TABLE IF NOT EXISTS auth_session (
            id INTEGER PRIMARY KEY CHECK (id = 1),  -- single-row table, one logged-in doctor at a time
            access_token TEXT NOT NULL,
            profile_id TEXT NOT NULL,
            full_name TEXT,
            email TEXT,
            role TEXT,
            hospital_id TEXT,
            verification_status TEXT,
            base_url TEXT NOT NULL,
            logged_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )"""
    )

    conn.execute(
        """CREATE TABLE IF NOT EXISTS mysql_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),  -- single-row table, one hospital DB per install
            host TEXT NOT NULL,
            port INTEGER NOT NULL DEFAULT 3306,
            database_name TEXT NOT NULL,
            user TEXT NOT NULL,
            doctors_table TEXT NOT NULL DEFAULT 'doctors',
            configured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )"""
    )

    conn.execute(
        """CREATE TABLE IF NOT EXISTS doctor_mapping (
            local_doctor_id TEXT PRIMARY KEY,
            supabase_profile_id TEXT NOT NULL,
            local_email TEXT,
            confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )"""
    )

    conn.execute(
        """CREATE TABLE IF NOT EXISTS sync_watermark (
            doctor_profile_id TEXT PRIMARY KEY,
            source_table TEXT,
            last_record_id TEXT,
            last_watermark_value TEXT,
            last_synced_at TIMESTAMP
        )"""
    )

    conn.execute(
        """CREATE TABLE IF NOT EXISTS sync_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TIMESTAMP,
            finished_at TIMESTAMP,
            records_found INTEGER,
            records_valid INTEGER,
            records_uploaded INTEGER,
            records_duplicate INTEGER,
            records_rejected INTEGER,
            status TEXT,
            error TEXT
        )"""
    )

    conn.commit()
    return conn


@contextmanager
def state_conn():
    """Context-managed connection — commits on success, closes always."""
    conn = get_conn()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


# ─── auth_session helpers ────────────────────────────────────────────────


def save_session(access_token: str, profile: dict, base_url: str) -> None:
    with state_conn() as conn:
        conn.execute("DELETE FROM auth_session")
        conn.execute(
            """INSERT INTO auth_session
               (id, access_token, profile_id, full_name, email, role,
                hospital_id, verification_status, base_url)
               VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                access_token,
                profile.get("id"),
                profile.get("full_name"),
                profile.get("email"),
                profile.get("role"),
                profile.get("hospital_id"),
                profile.get("verification_status"),
                base_url,
            ),
        )


def load_session() -> dict | None:
    with state_conn() as conn:
        row = conn.execute("SELECT * FROM auth_session WHERE id = 1").fetchone()
        return dict(row) if row else None


def clear_session() -> None:
    with state_conn() as conn:
        conn.execute("DELETE FROM auth_session")


# ─── mysql_config helpers ────────────────────────────────────────────────


def save_mysql_config(host: str, port: int, database_name: str, user: str,
                       doctors_table: str = "doctors") -> None:
    with state_conn() as conn:
        conn.execute("DELETE FROM mysql_config")
        conn.execute(
            """INSERT INTO mysql_config
               (id, host, port, database_name, user, doctors_table)
               VALUES (1, ?, ?, ?, ?, ?)""",
            (host, port, database_name, user, doctors_table),
        )


def load_mysql_config() -> dict | None:
    with state_conn() as conn:
        row = conn.execute("SELECT * FROM mysql_config WHERE id = 1").fetchone()
        return dict(row) if row else None


# ─── doctor_mapping helpers ──────────────────────────────────────────────


def save_doctor_mapping(local_doctor_id: str, supabase_profile_id: str,
                         local_email: str | None) -> None:
    with state_conn() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO doctor_mapping
               (local_doctor_id, supabase_profile_id, local_email)
               VALUES (?, ?, ?)""",
            (str(local_doctor_id), supabase_profile_id, local_email),
        )


def get_mapping_for_profile(supabase_profile_id: str) -> dict | None:
    """Given the currently logged-in doctor's profile id, find their local_doctor_id."""
    with state_conn() as conn:
        row = conn.execute(
            "SELECT * FROM doctor_mapping WHERE supabase_profile_id = ? "
            "ORDER BY confirmed_at DESC LIMIT 1",
            (supabase_profile_id,),
        ).fetchone()
        return dict(row) if row else None


# ─── sync_watermark helpers (Phase 4) ────────────────────────────────────


def get_watermark(doctor_profile_id: str) -> dict | None:
    with state_conn() as conn:
        row = conn.execute(
            "SELECT * FROM sync_watermark WHERE doctor_profile_id = ?",
            (doctor_profile_id,),
        ).fetchone()
        return dict(row) if row else None


def set_watermark(doctor_profile_id: str, source_table: str,
                   last_record_id: str | None, last_watermark_value: str | None) -> None:
    """
    Only call this AFTER the backend has confirmed the upload succeeded —
    advancing the watermark before that risks silently skipping records
    whose upload actually failed.
    """
    now = datetime.now(timezone.utc).isoformat()
    with state_conn() as conn:
        conn.execute(
            """INSERT INTO sync_watermark
               (doctor_profile_id, source_table, last_record_id, last_watermark_value, last_synced_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(doctor_profile_id) DO UPDATE SET
                 source_table=excluded.source_table,
                 last_record_id=excluded.last_record_id,
                 last_watermark_value=excluded.last_watermark_value,
                 last_synced_at=excluded.last_synced_at""",
            (doctor_profile_id, source_table, last_record_id, last_watermark_value, now),
        )


# ─── sync_log helpers (Phase 11) ─────────────────────────────────────────


def start_sync_log() -> int:
    """Creates an in-progress sync_log row and returns its id."""
    now = datetime.now(timezone.utc).isoformat()
    with state_conn() as conn:
        cur = conn.execute(
            """INSERT INTO sync_log (started_at, status) VALUES (?, 'in_progress')""",
            (now,),
        )
        return cur.lastrowid


def finish_sync_log(log_id: int, records_found: int, records_valid: int,
                     records_uploaded: int, records_duplicate: int,
                     records_rejected: int, status: str, error: str | None = None) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with state_conn() as conn:
        conn.execute(
            """UPDATE sync_log SET
                 finished_at=?, records_found=?, records_valid=?, records_uploaded=?,
                 records_duplicate=?, records_rejected=?, status=?, error=?
               WHERE id=?""",
            (now, records_found, records_valid, records_uploaded,
             records_duplicate, records_rejected, status, error, log_id),
        )


def list_sync_log(limit: int = 20) -> list[dict]:
    with state_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM sync_log ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
