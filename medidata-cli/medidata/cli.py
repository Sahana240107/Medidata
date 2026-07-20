"""
medidata/cli.py

Typer entrypoint for the MediData Connect CLI.

  medidata login        -> Phase 1
  medidata connect      -> Phase 2
  medidata map-doctor   -> Phase 3
  medidata status       -> convenience
  medidata sync         -> Phases 4-11: change detection, field mapping,
                            validation, the 6-layer privacy pipeline,
                            preview, privacy report + approval gate,
                            upload, sync log
  medidata sync history -> Phase 11, review past sync attempts
  medidata serve         -> starts the local HTTP server (local_server.py)
                            so the web app's Setup and Submit Cases pages
                            can drive steps 1-11 from the browser instead
                            of the terminal. 127.0.0.1-only, no exceptions.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import typer
from dotenv import load_dotenv

from medidata import state_db
from medidata import change_detection
from medidata import field_mapping
from medidata import validation
from medidata import preview
from medidata.api_client import MediDataClient, MediDataAPIError
from medidata.mysql_connector import MySQLConfig, resolve_password, test_connection, get_connection
from medidata.setup_commands import map_doctor_interactive
from medidata.privacy import pii_removal, tokenizer, generalizer, k_anonymity, encryption, report as privacy_report

load_dotenv()

app = typer.Typer(
    name="medidata",
    help="MediData Connect CLI — sync your hospital's local records into the "
         "MediData research network. Read-only against your MySQL DB; nothing "
         "raw ever leaves the hospital network.",
    no_args_is_help=True,
)

sync_app = typer.Typer(
    name="sync",
    help="Detect, anonymize, preview, and upload new local records.",
    invoke_without_command=True,
)
app.add_typer(sync_app, name="sync")

DEFAULT_BASE_URL = os.environ.get("MEDIDATA_API_URL", "http://localhost:8000")


# ─── medidata login ─────────────────────────────────────────────────────


@app.command()
def login(
    email: str = typer.Option(..., prompt=True),
    password: str = typer.Option(..., prompt=True, hide_input=True),
    base_url: str = typer.Option(DEFAULT_BASE_URL, help="MediData backend URL"),
):
    """Authenticate against the MediData backend and cache the session locally."""
    client = MediDataClient(base_url=base_url)

    try:
        profile = client.login(email, password)
    except MediDataAPIError as e:
        typer.secho(f"Login failed: {e.detail}", fg=typer.colors.RED)
        raise typer.Exit(code=1)
    except Exception as e:
        typer.secho(f"Could not reach {base_url}: {e}", fg=typer.colors.RED)
        raise typer.Exit(code=1)

    if profile.get("verification_status") != "verified":
        typer.secho(
            f"Login succeeded, but this account's verification_status is "
            f"'{profile.get('verification_status')}', not 'verified'. "
            f"An unverified doctor account cannot push clinical data through "
            f"the CLI. Ask your hospital admin to complete verification first.",
            fg=typer.colors.YELLOW,
        )
        raise typer.Exit(code=1)

    state_db.save_session(client.token, profile, base_url)

    typer.secho(
        f"Logged in as {profile.get('full_name')} "
        f"({profile.get('role')}, hospital_id={profile.get('hospital_id')}).",
        fg=typer.colors.GREEN,
    )


# ─── medidata connect ───────────────────────────────────────────────────


@app.command()
def connect(
    host: str = typer.Option(..., prompt=True),
    port: int = typer.Option(3306, prompt=True),
    database: str = typer.Option(..., prompt="Database name"),
    user: str = typer.Option(..., prompt="MySQL user (SELECT-only recommended)"),
    doctors_table: str = typer.Option("doctors", prompt="Doctors table name"),
):
    """
    Verify connectivity to the hospital's local MySQL instance and save the
    (non-secret) connection details. The password is never stored — it's
    read from MEDIDATA_MYSQL_PASSWORD every time the CLI needs it.
    """
    try:
        password = resolve_password()
    except ConnectionError as e:
        typer.secho(str(e), fg=typer.colors.RED)
        raise typer.Exit(code=1)

    cfg = MySQLConfig(host=host, port=port, database=database, user=user, password=password)

    try:
        test_connection(cfg)
    except ConnectionError as e:
        typer.secho(str(e), fg=typer.colors.RED)
        raise typer.Exit(code=1)

    state_db.save_mysql_config(
        host=host, port=port, database_name=database, user=user, doctors_table=doctors_table
    )

    typer.secho(
        f"Connected to {user}@{host}:{port}/{database}. "
        f"Config saved (password was NOT stored — export MEDIDATA_MYSQL_PASSWORD "
        f"before every run).",
        fg=typer.colors.GREEN,
    )
    typer.echo(
        "Reminder: grant this MySQL user SELECT-only privileges on the "
        "relevant tables at the DB level. The CLI never writes to your schema."
    )


# ─── medidata map-doctor ────────────────────────────────────────────────


@app.command(name="map-doctor")
def map_doctor():
    """
    One-time interactive link between your logged-in MediData account and
    your record in the hospital's local `doctors` table.
    """
    session = state_db.load_session()
    if not session:
        typer.secho("Not logged in. Run `medidata login` first.", fg=typer.colors.RED)
        raise typer.Exit(code=1)

    mysql_cfg = state_db.load_mysql_config()
    if not mysql_cfg:
        typer.secho("MySQL not configured. Run `medidata connect` first.", fg=typer.colors.RED)
        raise typer.Exit(code=1)

    existing = state_db.get_mapping_for_profile(session["profile_id"])
    if existing:
        typer.echo(
            f"This account is already mapped to local doctor "
            f"#{existing['local_doctor_id']} (confirmed {existing['confirmed_at']})."
        )
        if not typer.confirm("Remap anyway?", default=False):
            raise typer.Exit(code=0)

    try:
        password = resolve_password()
    except ConnectionError as e:
        typer.secho(str(e), fg=typer.colors.RED)
        raise typer.Exit(code=1)

    cfg = MySQLConfig(
        host=mysql_cfg["host"], port=mysql_cfg["port"],
        database=mysql_cfg["database_name"], user=mysql_cfg["user"], password=password,
    )

    try:
        conn = get_connection(cfg)
    except ConnectionError as e:
        typer.secho(str(e), fg=typer.colors.RED)
        raise typer.Exit(code=1)

    logged_in_profile = {
        "id": session["profile_id"],
        "full_name": session["full_name"],
        "email": session["email"],
    }

    try:
        mapping = map_doctor_interactive(
            logged_in_profile, conn, doctors_table=mysql_cfg["doctors_table"]
        )
    except ValueError as e:
        typer.secho(str(e), fg=typer.colors.RED)
        raise typer.Exit(code=1)
    finally:
        conn.close()

    typer.secho(
        f"Saved mapping: local doctor #{mapping['local_doctor_id']} -> "
        f"profile {mapping['supabase_profile_id']}.",
        fg=typer.colors.GREEN,
    )


# ─── medidata status ────────────────────────────────────────────────────


@app.command()
def status():
    """Show what's currently configured locally (session, MySQL, doctor mapping)."""
    session = state_db.load_session()
    mysql_cfg = state_db.load_mysql_config()

    if session:
        typer.echo(f"Logged in: {session['full_name']} <{session['email']}> "
                    f"(profile_id={session['profile_id']}, base_url={session['base_url']})")
        mapping = state_db.get_mapping_for_profile(session["profile_id"])
        if mapping:
            typer.echo(f"Doctor mapping: local_doctor_id={mapping['local_doctor_id']}")
        else:
            typer.echo("Doctor mapping: not set — run `medidata map-doctor`")
    else:
        typer.echo("Logged in: no — run `medidata login`")

    if mysql_cfg:
        typer.echo(
            f"MySQL: {mysql_cfg['user']}@{mysql_cfg['host']}:{mysql_cfg['port']}"
            f"/{mysql_cfg['database_name']} (doctors_table={mysql_cfg['doctors_table']})"
        )
    else:
        typer.echo("MySQL: not configured — run `medidata connect`")

    watermark = state_db.get_watermark(session["profile_id"]) if session else None
    if watermark:
        typer.echo(
            f"Last sync watermark: {watermark['source_table']} @ "
            f"{watermark['last_watermark_value']} (synced {watermark['last_synced_at']})"
        )


# ─── shared preflight ───────────────────────────────────────────────────


def _require_ready() -> tuple[dict, dict, dict]:
    session = state_db.load_session()
    if not session:
        typer.secho("Not logged in. Run `medidata login` first.", fg=typer.colors.RED)
        raise typer.Exit(code=1)

    mysql_cfg = state_db.load_mysql_config()
    if not mysql_cfg:
        typer.secho("MySQL not configured. Run `medidata connect` first.", fg=typer.colors.RED)
        raise typer.Exit(code=1)

    doctor_mapping = state_db.get_mapping_for_profile(session["profile_id"])
    if not doctor_mapping:
        typer.secho("No doctor mapping. Run `medidata map-doctor` first.", fg=typer.colors.RED)
        raise typer.Exit(code=1)

    return session, mysql_cfg, doctor_mapping


# ─── medidata sync ──────────────────────────────────────────────────────


@sync_app.callback(invoke_without_command=True)
def sync(
    ctx: typer.Context,
    mapping_path: str = typer.Option("mapping.yaml", "--mapping", help="Path to the field mapping YAML."),
    limit: int = typer.Option(change_detection.MAX_BATCH_SIZE, "--limit", help="Max records to process this run."),
    k: int = typer.Option(k_anonymity.DEFAULT_K, "--k", help="k-anonymity threshold."),
):
    """
    Detect new local records, anonymize them locally, preview + get
    approval, then upload. Runs Phases 4-11 end to end. This is the
    default action of `medidata sync` — `medidata sync history` is a
    separate subcommand.
    """
    if ctx.invoked_subcommand is not None:
        return  # a subcommand (e.g. `history`) was invoked instead

    session, mysql_cfg, doctor_mapping = _require_ready()

    try:
        mapping = field_mapping.load_mapping(mapping_path)
    except (FileNotFoundError, ValueError) as e:
        typer.secho(str(e), fg=typer.colors.RED)
        raise typer.Exit(code=1)

    try:
        mysql_password = resolve_password()
    except ConnectionError as e:
        typer.secho(str(e), fg=typer.colors.RED)
        raise typer.Exit(code=1)

    cfg = MySQLConfig(
        host=mysql_cfg["host"], port=mysql_cfg["port"],
        database=mysql_cfg["database_name"], user=mysql_cfg["user"], password=mysql_password,
    )
    try:
        conn = get_connection(cfg)
    except ConnectionError as e:
        typer.secho(str(e), fg=typer.colors.RED)
        raise typer.Exit(code=1)

    log_id = state_db.start_sync_log()

    try:
        _run_sync(session, doctor_mapping, mapping, conn, limit, k, log_id)
    except Exception as e:
        state_db.finish_sync_log(
            log_id, records_found=0, records_valid=0, records_uploaded=0,
            records_duplicate=0, records_rejected=0, status="failed", error=str(e),
        )
        typer.secho(f"Sync failed: {e}", fg=typer.colors.RED)
        raise typer.Exit(code=1)
    finally:
        conn.close()


def _run_sync(session: dict, doctor_mapping: dict, mapping: dict, conn, limit: int, k: int, log_id: int) -> None:
    profile_id = session["profile_id"]
    source_table = mapping["source_table"]
    id_column = mapping["id_column"]
    watermark_column = mapping.get("watermark_column", id_column)
    doctor_column = mapping.get("doctor_column")

    watermark = state_db.get_watermark(profile_id)
    last_value = watermark["last_watermark_value"] if watermark else None

    # ── Phase 4: change detection ──────────────────────────────────────
    raw_rows = change_detection.get_new_records(
        conn, source_table, id_column, watermark_column, last_value,
        doctor_column=doctor_column, doctor_value=doctor_mapping["local_doctor_id"], limit=limit,
    )

    if not raw_rows:
        typer.echo("No new records since last sync.")
        state_db.finish_sync_log(log_id, 0, 0, 0, 0, 0, status="success")
        return

    typer.echo(f"Found {len(raw_rows)} new record(s) in `{source_table}`.")

    # ── Phase 5: field mapping ─────────────────────────────────────────
    extracted = [field_mapping.extract_record(row, mapping) for row in raw_rows]

    # ── Phase 6: validation ────────────────────────────────────────────
    valid, rejected = validation.validate_batch(extracted)
    if rejected:
        typer.secho(f"{len(rejected)} record(s) failed validation and will be excluded:", fg=typer.colors.YELLOW)
        for r in rejected[:10]:
            typer.secho(f"  - {r['errors']}", fg=typer.colors.YELLOW)

    if not valid:
        typer.secho("No records passed validation — nothing to upload.", fg=typer.colors.YELLOW)
        state_db.finish_sync_log(log_id, len(raw_rows), 0, 0, 0, len(rejected), status="success")
        return

    # ── Phase 7: 6-layer privacy pipeline ──────────────────────────────
    hospital_secret = tokenizer.get_or_create_hospital_secret()

    cleaned_records = []
    pii_stats = []
    for record in valid:
        cleaned, stats = pii_removal.apply(record)          # Layer 1
        cleaned = tokenizer.apply(cleaned, hospital_secret)  # Layer 2
        cleaned_records.append(cleaned)
        pii_stats.append(stats)

    generalized_records = generalizer.apply_batch(cleaned_records)  # Layer 3

    k_summary = k_anonymity.summarize(generalized_records, k=k)     # Layer 4

    # Build final upload payloads with a deterministic per-record fingerprint_id
    # (source_table:source_id, HMAC'd) for upload idempotency.
    case_payloads = []
    for row, record in zip(raw_rows[:len(generalized_records)], generalized_records):
        source_id = str(row.get(id_column))
        fingerprint_id = tokenizer.deterministic_record_key(hospital_secret, source_table, source_id)
        case_payloads.append(field_mapping.to_case_payload(record, fingerprint_id))

    # Layer 5 — encrypt the staged batch at rest while awaiting approval.
    staged_path = Path(tempfile.gettempdir()) / f"medidata_staged_{log_id}.enc"
    encryption.write_staged_batch(staged_path, case_payloads, hospital_secret)

    # ── Phase 8: preview ────────────────────────────────────────────────
    preview.show_before_after(dict(raw_rows[0]), case_payloads[0])
    preview.show_batch_summary(len(valid), len(rejected), k_summary["flagged"])

    # ── Phase 9: privacy report + approval gate ─────────────────────────
    report = privacy_report.build_privacy_report(
        records_found=len(raw_rows),
        valid_records=valid,
        rejected_records=rejected,
        pii_removal_stats=pii_stats,
        tokenized_count=len(cleaned_records),
        k_anonymity_summary=k_summary,
        encrypted=True,
    )
    privacy_report.print_report(report)

    if not typer.confirm(f"Upload {len(case_payloads)} anonymized record(s) to MediData?", default=False):
        typer.echo("Aborted — nothing uploaded. Watermark not advanced.")
        staged_path.unlink(missing_ok=True)
        state_db.finish_sync_log(
            log_id, len(raw_rows), len(valid), 0, 0, len(rejected), status="aborted_by_user",
        )
        return

    # ── Phase 10: upload ─────────────────────────────────────────────────
    decrypted = encryption.read_staged_batch(staged_path, hospital_secret)
    client = MediDataClient(base_url=session["base_url"], token=session["access_token"])

    try:
        result = client.sync(cases=decrypted, privacy_report=report)
    except MediDataAPIError as e:
        typer.secho(f"Upload failed: {e.detail}", fg=typer.colors.RED)
        state_db.finish_sync_log(
            log_id, len(raw_rows), len(valid), 0, 0, len(rejected),
            status="failed", error=e.detail,
        )
        raise typer.Exit(code=1)
    finally:
        staged_path.unlink(missing_ok=True)

    accepted = result.get("accepted", [])
    duplicates = result.get("duplicates", [])
    server_rejected = result.get("rejected", [])

    typer.secho(
        f"Uploaded: {len(accepted)} accepted, {len(duplicates)} duplicate(s), "
        f"{len(server_rejected)} rejected by server.",
        fg=typer.colors.GREEN,
    )

    # ── Advance watermark only after confirmed success ───────────────────
    last_record_id, last_watermark_value = change_detection.max_watermark(raw_rows, id_column, watermark_column)
    state_db.set_watermark(profile_id, source_table, last_record_id, last_watermark_value)

    # ── Phase 11: sync log ────────────────────────────────────────────────
    state_db.finish_sync_log(
        log_id, len(raw_rows), len(valid), len(accepted), len(duplicates),
        len(rejected) + len(server_rejected), status="success",
    )


# ─── medidata sync history ──────────────────────────────────────────────


@sync_app.command("history")
def sync_history(limit: int = typer.Option(20, help="How many past sync attempts to show.")):
    """Review past sync attempts — the audit trail of what left the hospital network and when."""
    rows = state_db.list_sync_log(limit=limit)
    if not rows:
        typer.echo("No sync attempts recorded yet.")
        return

    for row in rows:
        typer.echo(
            f"[{row['id']}] {row['started_at']} -> {row.get('finished_at') or 'in progress'} "
            f"status={row['status']} found={row.get('records_found')} "
            f"valid={row.get('records_valid')} uploaded={row.get('records_uploaded')} "
            f"duplicate={row.get('records_duplicate')} rejected={row.get('records_rejected')}"
            + (f" error={row['error']}" if row.get("error") else "")
        )


def main():
    app()


# ─── medidata serve ──────────────────────────────────────────────────────


@app.command()
def serve(
    host: str = typer.Option("127.0.0.1", help="Bind address. Refuses anything but loopback."),
    port: int = typer.Option(8787, help="Local port the web app's Setup/Submit Cases pages talk to."),
    frontend_origin: str = typer.Option(
        os.environ.get("MEDIDATA_FRONTEND_ORIGIN", "http://localhost:3000"),
        help="Only this origin is allowed via CORS — set to your web app's URL.",
    ),
):
    """
    Start the local-only HTTP server so the web app's Setup and Submit
    Cases pages can drive login, MySQL connect, doctor mapping, and
    sync preview/approve directly from your browser — the exact same
    phase functions the typed commands above use, just reachable over
    loopback HTTP instead of typed one at a time.

    Keep this running in a terminal window while you use those pages.
    It binds to 127.0.0.1 only and is never reachable from another
    machine on the network. Your MySQL password is held in this
    process's memory only for as long as it keeps running.
    """
    if host not in ("127.0.0.1", "localhost"):
        typer.echo(
            "Refusing to bind to a non-loopback address — this server has no "
            "authentication of its own and must never be reachable off this machine.",
            err=True,
        )
        raise typer.Exit(code=1)

    import uvicorn
    from medidata.local_server import create_app

    web_app = create_app(frontend_origin=frontend_origin)
    typer.echo(f"MediData local server running at http://{host}:{port} (this machine only)")
    typer.echo(f"Allowing requests from: {frontend_origin}")
    typer.echo("Leave this running, then continue in the web app. Ctrl+C to stop.")
    uvicorn.run(web_app, host=host, port=port, log_level="warning")


if __name__ == "__main__":
    main()
