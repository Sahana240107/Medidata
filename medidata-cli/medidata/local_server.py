"""
medidata/local_server.py

Started by `medidata serve`. A thin HTTP wrapper around the exact same
phase functions `medidata sync` already uses (change_detection,
field_mapping, validation, the 6-layer privacy pipeline, api_client) — no
business logic is duplicated, just re-exposed over loopback HTTP so the
web app's setup wizard can drive it with forms instead of typed commands.

Security model:
  - Binds to 127.0.0.1 only (see `serve` in cli.py) — never reachable from
    another machine on the network, only from a browser on THIS machine.
  - CORS is restricted to the one frontend origin you configure — not `*`.
  - The MySQL password submitted via POST /setup/mysql is kept ONLY in
    this process's memory for as long as `medidata serve` keeps running —
    same lifetime as exporting MEDIDATA_MYSQL_PASSWORD for a terminal
    session, just supplied via a form instead of a shell. It is never
    written to state.db, never logged, and is gone the moment this
    process exits.
  - Case data itself is still never fetched, previewed, or approved by
    the backend or by any network call — /sync/preview runs entirely
    against the local MySQL DB and stages an encrypted batch on local
    disk; nothing is uploaded until POST /sync/approve, which is the
    exact same Phase 10 upload `medidata sync`'s Y/N prompt guards today.
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from medidata import state_db
from medidata import change_detection
from medidata import field_mapping
from medidata import validation
from medidata.api_client import MediDataClient, MediDataAPIError
from medidata.mysql_connector import MySQLConfig, test_connection, get_connection
from medidata.privacy import pii_removal, tokenizer, generalizer, k_anonymity, encryption, report as privacy_report

log = logging.getLogger("medidata.local_server")

# Where staged (already-anonymized, already-encrypted) batches live on disk
# while they wait for a frontend approve/discard call.
#
# Deliberately NOT the system temp dir: on Windows, files that suddenly
# appear in %TEMP% with an "encrypted-looking" extension (like the old
# `.enc`) are a classic pattern antivirus / Windows Defender heuristics
# flag as ransomware activity, and get quarantined or silently deleted
# without any error surfacing to this process. %TEMP% is also subject to
# Windows Storage Sense's automatic cleanup on a timer. Using our own
# namespaced folder with a boring extension avoids both.
STAGED_DIR = Path.home() / ".medidata" / "staged_batches"

# Password lives only here — this process's memory, never state.db, never disk.
_runtime = {"mysql_password": None}

# Staged (already-anonymized, already-encrypted) batches awaiting a
# frontend approve/discard call. Keyed by batch_id (= sync_log id).
_staged_batches: dict[str, dict] = {}


def _safe_profile(session: dict) -> dict:
    return {
        "full_name": session.get("full_name"),
        "email": session.get("email"),
        "role": session.get("role"),
        "hospital_id": session.get("hospital_id"),
        "verification_status": session.get("verification_status"),
        "base_url": session.get("base_url"),
    }


def _require_session() -> dict:
    session = state_db.load_session()
    if not session:
        raise HTTPException(status_code=401, detail="Not logged in. Complete setup step 1 first.")
    return session


def _require_mysql_cfg() -> tuple[dict, str]:
    cfg = state_db.load_mysql_config()
    if not cfg:
        raise HTTPException(status_code=400, detail="MySQL not configured yet. Complete setup step 2 first.")
    password = _runtime["mysql_password"]
    if not password:
        raise HTTPException(
            status_code=400,
            detail="MySQL password isn't set for this server session — resubmit step 2 "
                   "(it's kept in memory only and is cleared whenever `medidata serve` restarts).",
        )
    return cfg, password


def _require_doctor_mapping(session: dict) -> dict:
    mapping = state_db.get_mapping_for_profile(session["profile_id"])
    if not mapping:
        raise HTTPException(status_code=400, detail="No doctor mapping yet. Complete setup step 3 first.")
    return mapping


# ─── request bodies ─────────────────────────────────────────────────────

class LoginBody(BaseModel):
    email: str
    password: str
    base_url: str = "http://localhost:8000"


class MySQLBody(BaseModel):
    host: str
    port: int = 3306
    database: str
    user: str
    password: str
    doctors_table: str = "doctors"


class MapDoctorBody(BaseModel):
    local_doctor_id: str


class SyncPreviewBody(BaseModel):
    mapping_path: str = "mapping.yaml"
    limit: int = change_detection.MAX_BATCH_SIZE
    k: int = k_anonymity.DEFAULT_K


class SyncApproveBody(BaseModel):
    batch_id: str
    approve: bool


# ─── app factory ─────────────────────────────────────────────────────────

def create_app(frontend_origin: str = "http://localhost:3000") -> FastAPI:
    app = FastAPI(title="MediData CLI local server")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[frontend_origin],
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    # ── health / status ───────────────────────────────────────────────

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/setup/status")
    def setup_status():
        session = state_db.load_session()
        mysql_cfg = state_db.load_mysql_config()
        doctor_mapping = state_db.get_mapping_for_profile(session["profile_id"]) if session else None
        return {
            "logged_in": bool(session),
            "profile": _safe_profile(session) if session else None,
            "mysql_configured": bool(mysql_cfg),
            "mysql_password_set_this_session": bool(_runtime["mysql_password"]),
            "mysql_config": {
                "host": mysql_cfg["host"], "port": mysql_cfg["port"],
                "database": mysql_cfg["database_name"], "user": mysql_cfg["user"],
                "doctors_table": mysql_cfg["doctors_table"],
            } if mysql_cfg else None,
            "doctor_mapped": bool(doctor_mapping),
            "doctor_mapping": doctor_mapping,
        }

    # ── step 1: login ─────────────────────────────────────────────────

    @app.post("/setup/login")
    def setup_login(body: LoginBody):
        client = MediDataClient(base_url=body.base_url)
        try:
            profile = client.login(body.email, body.password)
        except MediDataAPIError as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Could not reach {body.base_url}: {e}")

        if profile.get("verification_status") != "verified":
            raise HTTPException(
                status_code=403,
                detail=f"Account verification_status is '{profile.get('verification_status')}', "
                       f"not 'verified'. Ask your hospital admin to complete verification first.",
            )

        state_db.save_session(client.token, profile, body.base_url, refresh_token=client.refresh_token)
        return {"profile": _safe_profile(state_db.load_session())}

    # ── step 2: mysql connect ────────────────────────────────────────

    @app.post("/setup/mysql")
    def setup_mysql(body: MySQLBody):
        cfg = MySQLConfig(host=body.host, port=body.port, database=body.database,
                           user=body.user, password=body.password)
        try:
            test_connection(cfg)
        except ConnectionError as e:
            raise HTTPException(status_code=400, detail=str(e))

        state_db.save_mysql_config(
            host=body.host, port=body.port, database_name=body.database,
            user=body.user, doctors_table=body.doctors_table,
        )
        _runtime["mysql_password"] = body.password
        return {"ok": True}

    # ── step 3: doctor mapping ───────────────────────────────────────

    @app.get("/setup/doctors")
    def list_local_doctors():
        session = _require_session()
        cfg, password = _require_mysql_cfg()

        mysql_cfg = MySQLConfig(host=cfg["host"], port=cfg["port"], database=cfg["database_name"],
                                 user=cfg["user"], password=password)
        conn = get_connection(mysql_cfg)
        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(f"SELECT * FROM {cfg['doctors_table']}")
            rows = cursor.fetchall()
            cursor.close()
        finally:
            conn.close()

        email = (session.get("email") or "").lower()
        suggested = next((d for d in rows if str(d.get("email", "")).lower() == email), None)
        return {"doctors": jsonable_encoder(rows), "suggested_id": suggested.get("id") if suggested else None}

    @app.post("/setup/map-doctor")
    def map_doctor(body: MapDoctorBody):
        session = _require_session()
        state_db.save_doctor_mapping(body.local_doctor_id, session["profile_id"], session.get("email"))
        return {"ok": True}

    # ── sync: preview (Phases 4-9, no upload) ────────────────────────

    @app.post("/sync/preview")
    def sync_preview(body: SyncPreviewBody):
        session = _require_session()
        cfg, password = _require_mysql_cfg()
        doctor_mapping = _require_doctor_mapping(session)

        try:
            mapping = field_mapping.load_mapping(body.mapping_path)
        except (FileNotFoundError, ValueError) as e:
            raise HTTPException(status_code=400, detail=str(e))

        source_table = mapping["source_table"]
        id_column = mapping["id_column"]
        watermark_column = mapping.get("watermark_column", id_column)
        doctor_column = mapping.get("doctor_column")

        mysql_cfg = MySQLConfig(host=cfg["host"], port=cfg["port"], database=cfg["database_name"],
                                 user=cfg["user"], password=password)
        log_id = state_db.start_sync_log()

        try:
            conn = get_connection(mysql_cfg)
        except ConnectionError as e:
            state_db.finish_sync_log(log_id, 0, 0, 0, 0, 0, status="failed", error=str(e))
            raise HTTPException(status_code=400, detail=str(e))

        try:
            watermark = state_db.get_watermark(session["profile_id"])
            last_value = watermark["last_watermark_value"] if watermark else None

            raw_rows = change_detection.get_new_records(
                conn, source_table, id_column, watermark_column, last_value,
                doctor_column=doctor_column, doctor_value=doctor_mapping["local_doctor_id"],
                limit=body.limit,
            )
        finally:
            conn.close()

        if not raw_rows:
            state_db.finish_sync_log(log_id, 0, 0, 0, 0, 0, status="success")
            return {"batch_id": None, "records_found": 0, "message": "No new records since last sync."}

        extracted = [field_mapping.extract_record(row, mapping) for row in raw_rows]
        valid, rejected = validation.validate_batch(extracted)

        if not valid:
            state_db.finish_sync_log(log_id, len(raw_rows), 0, 0, 0, len(rejected), status="success")
            return {
                "batch_id": None,
                "records_found": len(raw_rows),
                "valid_count": 0,
                "rejected": [{"errors": r["errors"]} for r in rejected],
                "message": "No records passed validation — nothing to upload.",
            }

        hospital_secret = tokenizer.get_or_create_hospital_secret()

        cleaned_records, pii_stats = [], []
        for record in valid:
            cleaned, stats = pii_removal.apply(record)
            cleaned = tokenizer.apply(cleaned, hospital_secret)
            cleaned_records.append(cleaned)
            pii_stats.append(stats)

        generalized_records = generalizer.apply_batch(cleaned_records)
        k_summary = k_anonymity.summarize(generalized_records, k=body.k)

        case_payloads = []
        for row, record in zip(raw_rows[: len(generalized_records)], generalized_records):
            source_id = str(row.get(id_column))
            fingerprint_id = tokenizer.deterministic_record_key(hospital_secret, source_table, source_id)
            case_payloads.append(field_mapping.to_case_payload(record, fingerprint_id))

        STAGED_DIR.mkdir(parents=True, exist_ok=True)
        staged_path = STAGED_DIR / f"batch_{log_id}_{uuid.uuid4().hex[:8]}.medidata"
        encryption.write_staged_batch(staged_path, case_payloads, hospital_secret)

        if not staged_path.exists():
            # Something outside our process (AV real-time protection, an
            # endpoint-protection agent, etc.) removed the file the instant
            # it was written. Surface this clearly now, at preview time,
            # rather than letting it fail confusingly later at approve time.
            log.warning(
                "Staged batch file disappeared immediately after writing: %s "
                "(commonly caused by antivirus/EDR software on this machine). "
                "Add %s to your antivirus's exclusion list.",
                staged_path, STAGED_DIR,
            )
            state_db.finish_sync_log(log_id, len(raw_rows), len(valid), 0, 0, len(rejected), status="failed",
                                      error="Staged batch file was removed by another process immediately after being written.")
            raise HTTPException(
                status_code=500,
                detail=(
                    "The encrypted batch file was deleted from disk the instant it was written, "
                    "before this server could use it. This is almost always antivirus or endpoint "
                    f"protection software quarantining files in {STAGED_DIR}. Please add that folder "
                    "to your antivirus's exclusion list and try again."
                ),
            )

        report = privacy_report.build_privacy_report(
            records_found=len(raw_rows),
            valid_records=valid,
            rejected_records=rejected,
            pii_removal_stats=pii_stats,
            tokenized_count=len(cleaned_records),
            k_anonymity_summary=k_summary,
            encrypted=True,
        )

        batch_id = str(log_id)
        _staged_batches[batch_id] = {
            "staged_path": staged_path,
            "raw_rows": raw_rows,
            "id_column": id_column,
            "watermark_column": watermark_column,
            "source_table": source_table,
            "profile_id": session["profile_id"],
            "log_id": log_id,
            "records_found": len(raw_rows),
            "valid_count": len(valid),
            "rejected_count": len(rejected),
            "report": report,
        }

        return {
            "batch_id": batch_id,
            "records_found": len(raw_rows),
            "valid_count": len(valid),
            "rejected": [{"errors": r["errors"]} for r in rejected],
            "sample_before": jsonable_encoder(dict(raw_rows[0])),
            "sample_after": case_payloads[0],
            "privacy_report": report,
        }

    # ── sync: approve / discard (Phase 10-11) ────────────────────────

    @app.post("/sync/approve")
    def sync_approve(body: SyncApproveBody):
        session = _require_session()
        staged = _staged_batches.get(body.batch_id)
        if not staged:
            raise HTTPException(status_code=404, detail="Unknown or already-resolved batch_id.")

        if not body.approve:
            Path(staged["staged_path"]).unlink(missing_ok=True)
            state_db.finish_sync_log(
                staged["log_id"], staged["records_found"], staged["valid_count"],
                0, 0, staged["rejected_count"], status="aborted_by_user",
            )
            del _staged_batches[body.batch_id]
            return {"status": "aborted"}

        hospital_secret = tokenizer.get_or_create_hospital_secret()

        try:
            decrypted = encryption.read_staged_batch(staged["staged_path"], hospital_secret)
        except FileNotFoundError:
            # The file existed when we wrote it (we verify that in
            # sync_preview) but is gone now — most likely antivirus/EDR
            # software on this machine quarantined or deleted it in the
            # meantime, or Windows Storage Sense swept the folder. Either
            # way there's no batch left to upload: clear the stale state
            # so the user isn't stuck, and tell them to just re-run preview.
            log.warning("Staged batch file missing at approve time: %s", staged["staged_path"])
            state_db.finish_sync_log(
                staged["log_id"], staged["records_found"], staged["valid_count"],
                0, 0, staged["rejected_count"], status="failed",
                error="Staged batch file was missing on disk at approve time.",
            )
            del _staged_batches[body.batch_id]
            raise HTTPException(
                status_code=410,
                detail=(
                    "The encrypted batch for this preview is no longer on disk, so it can't be "
                    "uploaded. This is usually antivirus/endpoint-protection software removing it "
                    f"after it was staged in {STAGED_DIR} — try adding that folder to your antivirus's "
                    "exclusion list. Please run Sync Preview again to re-stage the batch, then approve."
                ),
            )

        def _persist_refreshed_token(new_access_token: str, new_refresh_token: str | None) -> None:
            profile_like = {
                "id": session.get("profile_id"),
                "full_name": session.get("full_name"),
                "email": session.get("email"),
                "role": session.get("role"),
                "hospital_id": session.get("hospital_id"),
                "verification_status": session.get("verification_status"),
            }
            state_db.save_session(new_access_token, profile_like, session["base_url"], refresh_token=new_refresh_token)

        client = MediDataClient(
            base_url=session["base_url"],
            token=session["access_token"],
            refresh_token=session.get("refresh_token"),
            on_token_refresh=_persist_refreshed_token,
        )

        try:
            result = client.sync(cases=decrypted, privacy_report=staged["report"])
        except MediDataAPIError as e:
            state_db.finish_sync_log(
                staged["log_id"], staged["records_found"], staged["valid_count"],
                0, 0, staged["rejected_count"], status="failed", error=e.detail,
            )
            raise HTTPException(status_code=502, detail=e.detail)
        finally:
            Path(staged["staged_path"]).unlink(missing_ok=True)

        accepted = result.get("accepted", [])
        duplicates = result.get("duplicates", [])
        server_rejected = result.get("rejected", [])

        last_record_id, last_watermark_value = change_detection.max_watermark(
            staged["raw_rows"], staged["id_column"], staged["watermark_column"]
        )
        state_db.set_watermark(session["profile_id"], staged["source_table"], last_record_id, last_watermark_value)

        state_db.finish_sync_log(
            staged["log_id"], staged["records_found"], staged["valid_count"],
            len(accepted), len(duplicates), staged["rejected_count"] + len(server_rejected),
            status="success",
        )
        del _staged_batches[body.batch_id]

        return {"status": "success", "accepted": accepted, "duplicates": duplicates, "rejected": server_rejected}

    # ── sync history ──────────────────────────────────────────────────

    @app.get("/sync/history")
    def sync_history(limit: int = 20):
        return state_db.list_sync_log(limit=limit)

    return app