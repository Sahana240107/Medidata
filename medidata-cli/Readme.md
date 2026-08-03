# MediData Connect CLI

Syncs a hospital's local MySQL encounter records into the MediData research
network — anonymized locally, uploaded through the same backend code path
(`case_service.py`) the web app uses.

This build covers **Phases 1-3** of the implementation guide:

| Command | Phase | What it does |
|---|---|---|
| `medidata login` | 1 | Authenticate against the real backend (`POST /auth/login`), cache the session |
| `medidata connect` | 2 | Verify + save read-only MySQL connectivity |
| `medidata map-doctor` | 3 | One-time link between your MediData account and your local `doctors` row |
| `medidata status` | — | Show what's currently configured |

Phases 4-11 (change detection, field mapping, the 6-layer privacy pipeline,
preview, upload, sync log) are **not implemented yet** — this CLI
intentionally stops after doctor mapping.

## Trust model

- **Zero writes to the hospital's MySQL schema.** Every query the CLI runs
  is a `SELECT`. Grant the CLI's MySQL user SELECT-only privileges at the
  database level too — don't rely on the app alone.
- **Nothing hospital-specific lives in the CLI's install directory except
  `~/.medidata/state.db`**, which holds your cached session, MySQL
  host/port/db/user (never the password), and the local-doctor mapping.
- **MySQL password is never persisted.** It's read from
  `MEDIDATA_MYSQL_PASSWORD` (env var or local `.env`) every time it's
  needed, and is not written to `state.db`.

## Install

```bash
cd medidata-cli
pip install -e .
cp .env.example .env   # fill in MEDIDATA_API_URL and MEDIDATA_MYSQL_PASSWORD
```

## Usage

```bash
# Phase 1 — login (rejects unverified accounts)
medidata login --email ana.ferreira@hospital.example

# Phase 2 — verify + save MySQL connectivity (password from env, not a flag)
medidata connect --host 127.0.0.1 --port 3306 --database medidata_local \
                  --user medidata_cli --doctors-table doctors

# Phase 3 — link your account to your row in the local doctors table
medidata map-doctor

# anytime — see what's configured
medidata status
```

Against the sample `localdb.sql` schema in this repo, `doctors_table` is
`doctors` with columns `id`, `full_name`, `email` — the defaults already
match it.

## Why the CLI never touches Supabase or Qdrant directly

See the implementation guide's architecture note: the CLI is a thin,
read-only-on-the-hospital-side client of the existing FastAPI backend. This
avoids (a) distributing a Supabase service-role key to every hospital
laptop, and (b) maintaining a second copy of the embedding/validation logic
that already lives in `case_service.py` / `embedding_service.py`. The only
new backend surface Phase 10 adds later is `POST /api/cli/sync`; nothing in
Phases 1-3 requires backend changes — `login` uses the existing
`POST /auth/login`.