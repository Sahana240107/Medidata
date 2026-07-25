"""
medidata/setup_commands.py

Phase 3 — doctor mapping.

One-time interactive setup per doctor: the hospital's local MySQL `doctors`
table uses its own auto-increment ids, which have nothing to do with the
Supabase `profiles.id` UUID the doctor logs in with. This module builds
that link and stores it in `doctor_mapping`, in state.db — never in the
hospital's MySQL schema, which stays untouched and read-only.

The suggested match (by email) is just a hint. It is never auto-confirmed —
a human always picks the row explicitly.
"""

from __future__ import annotations

from medidata import state_db


def fetch_local_doctors(mysql_conn, doctors_table: str, id_col: str = "id",
                         name_col: str = "full_name", email_col: str = "email") -> list[dict]:
    cursor = mysql_conn.cursor(dictionary=True)
    cursor.execute(f"SELECT {id_col}, {name_col}, {email_col} FROM {doctors_table}")
    rows = cursor.fetchall()
    cursor.close()
    # Normalize keys so the rest of this module doesn't care about the
    # hospital's actual column names.
    return [
        {"id": r[id_col], "name": r[name_col], "email": r[email_col]}
        for r in rows
    ]


def suggest_match(local_doctors: list[dict], logged_in_email: str | None) -> dict | None:
    if not logged_in_email:
        return None
    target = logged_in_email.lower()
    return next(
        (d for d in local_doctors if (d.get("email") or "").lower() == target),
        None,
    )


def map_doctor_interactive(logged_in_profile: dict, mysql_conn, doctors_table: str,
                            id_col: str = "id", name_col: str = "full_name",
                            email_col: str = "email") -> dict:
    """
    Runs the interactive prompt flow and persists the mapping.
    Returns the saved mapping dict.

    If the hospital's schema doesn't have a clean doctors table (e.g. the
    doctor's name is a free-text column on the encounter table itself),
    callers can skip fetch_local_doctors entirely and call
    state_db.save_doctor_mapping() directly with whatever string/id value
    identifies that doctor's records — the mapping mechanism doesn't care
    what the value *means*, only that it round-trips into a WHERE clause.
    """
    local_doctors = fetch_local_doctors(mysql_conn, doctors_table, id_col, name_col, email_col)
    suggested = suggest_match(local_doctors, logged_in_profile.get("email"))

    print(f"\nLogged in as: {logged_in_profile.get('full_name')} <{logged_in_profile.get('email')}>")
    if suggested:
        print(f"Suggested match: local record #{suggested['id']} — {suggested['name']} "
              f"<{suggested.get('email') or '—'}>  (best-effort email match, confirm below)")
    else:
        print("No local record's email matched your login email — pick manually below.")

    print(f"\nLocal doctors in `{doctors_table}`:")
    for d in local_doctors:
        marker = " *" if suggested and d["id"] == suggested["id"] else ""
        print(f"  [{d['id']}] {d['name']} <{d.get('email') or '—'}>{marker}")

    chosen_id = input("\nEnter the local doctor ID that corresponds to this account: ").strip()
    if not chosen_id:
        raise ValueError("No doctor ID entered — mapping not saved.")

    valid_ids = {str(d["id"]) for d in local_doctors}
    if chosen_id not in valid_ids:
        raise ValueError(f"'{chosen_id}' is not one of the ids listed above.")

    state_db.save_doctor_mapping(
        local_doctor_id=chosen_id,
        supabase_profile_id=logged_in_profile["id"],
        local_email=logged_in_profile.get("email"),
    )

    return {
        "local_doctor_id": chosen_id,
        "supabase_profile_id": logged_in_profile["id"],
    }
