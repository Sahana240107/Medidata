# Hypothesis engines — wiring guide (post member2 removal)

## What changed

- `app/hypothesis/member2/falsification_engine/` → `app/hypothesis/falsification_engine/`
- `app/hypothesis/member2/verdict_engine/` → `app/hypothesis/verdict_engine/`
- `app/hypothesis/shared_config/` unchanged (was already outside `member2/`)
- Router prefixes changed to match the frontend's existing API clients exactly:
  - Falsification: `/api/member2/falsification/*` → **`/api/falsification/*`**
  - Verdict:       `/api/member2/verdict/*`       → **`/api/verdict/*`**
  - Audit pack:    `/api/member2/audit-pack/*`    → **`/api/audit-pack/*`**
- Fixed a latent off-by-one path bug in `local_cohort_builder.py` — it located
  `shared_config/outcome_mapping.json` via `Path(__file__).resolve().parents[2]`,
  which was only correct while `falsification_engine/` sat two levels under
  `member2/`. Now one level shallower, so it uses `parents[1]`. Verified with
  the full test suite (21/21 passing) after the move.
- All `member2` references cleaned from READMEs, docstrings, and router prefix
  strings.

## Mount the routers in `main.py`

```python
from app.hypothesis.falsification_engine.router import router as falsification_router
from app.hypothesis.verdict_engine.router import router as verdict_router

app.include_router(falsification_router)
app.include_router(verdict_router)
```

This exposes exactly:

```
POST /api/falsification/run
GET  /api/falsification/checks/{run_id}
POST /api/verdict/compute
GET  /api/verdict/{verdict_id}
GET  /api/audit-pack/{verdict_id}
GET  /api/audit-pack/{verdict_id}/download
```

which is what `frontend/lib/api/falsification.js` and `frontend/lib/api/verdict.js`
already call.

## Wire `get_case_source()` to Supabase

`falsification_engine/router.py` ships with a stub that raises
`NotImplementedError` (surfaced to the frontend as a 501) so the package can be
imported/tested without a live DB. Point it at the real `cases` table
(columns confirmed against the schema — note there is no `domain` column, so
we synthesize it as `"Unclassified"`; `CohortFilters` already treats `domain`
as a fallback grouping):

```python
# app/hypothesis/falsification_engine/router.py
from app.db.supabase_client import supabase
from .local_cohort_builder import CaseRow

def get_case_source():
    def _load():
        resp = (
            supabase.table("cases")
            .select("id,disease,hospital_id,country,sex,age_range,medications,outcome,created_at")
            .execute()
        )
        return [
            CaseRow(
                id=row["id"],
                disease=row.get("disease") or "Unclassified",
                domain=row.get("disease") or "Unclassified",  # no domain column in schema
                hospital=row.get("hospital_id") or "",
                country=row.get("country") or "",
                sex=row.get("sex") or "",
                age_range=row.get("age_range") or "",
                medications=row.get("medications") or "",
                outcome=row.get("outcome") or "",
                created_at=row.get("created_at") or "",
            )
            for row in resp.data
        ]
    return _load
```

`medications` is stored as `jsonb` in Supabase — if `resp.data` returns it as a
list rather than a string, join it before passing to `CaseRow` (`", ".join(...)`),
since `medication_match()` in `local_cohort_builder.py` does a substring match.

## Add to `requirements.txt`

The falsification engine's statistics core needs:

```
scipy
```

(numpy comes in as a transitive dependency of scipy; both were used
successfully in the test run.)
