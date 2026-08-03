# Falsification Engine — Member 2, MediData Hypothesis Engine

Pure-algorithm robustness testing for a hypothesis's odds ratio. No LLM
anywhere in this package. Built to the spec in
`MediData_Hypothesis_Engine_3-Person_Guide.docx`, Member 2's Falsification
Engine track (the Verdict Engine & Audit Pack half of Member 2's scope is
**not** included here — this is the falsification engine alone, as requested).

## What it does

Given a `CohortFilters` (a disease/domain + a drug that defines the
intervention arm), it:

1. **Builds its own cohort** directly from case data — `local_cohort_builder.py`
   is a deliberate, independent duplicate of Member 1's cohort-building logic
   (per the guide's Independence Checklist: zero import coupling between
   members, at the cost of a small amount of duplicated logic).
2. **Computes a baseline statistic** — 2x2 contingency table
   (intervention/control × favorable/unfavorable outcome), odds ratio with
   95% CI, and Fisher's exact or chi-square (Fisher when any expected cell
   count < 5 — exactly the guide's rule).
3. **Tries to break it**, six ways:
   - `perturbations.py` — leave-one-hospital-out, leave-one-country-out,
     leave-one-demographic-out (sex, age range)
   - `bootstrap.py` — 1000-resample bootstrap, checks how often the
     resampled odds ratio lands on the same side of 1.0 as baseline
   - `time_split.py` — splits by `created_at` (the only date field this
     schema has) into an earlier/later half, recomputes independently.
     Explicitly labeled a *record-date* split, not a causal time analysis.
   - `stratified.py` — logistic regression with a subgroup × intervention
     interaction term (statsmodels), replacing naive subgroup removal as the
     source of truth for "does this effect actually differ by subgroup"
4. **Pools every check's p-value and applies Holm-Bonferroni** (`correction.py`)
   before marking anything failed — this is what stops one lucky/unlucky
   subgroup from being reported as false fragility on a small sample.
5. **Returns a verdict**: `robust` / `fragile` / `insufficient_data`, plus a
   step-by-step `audit_trace` (step, library, function, params, result,
   timestamp) ready to feed a future `audit_pack.py`.

## Data reality this is built around

Per the guide: `outcome` is free text, not a clean binary; there's no event
date, only `created_at`; there's no explicit intervention flag — it's derived
from `medications`. Every module here works within those constraints rather
than pretending they don't exist. See `shared_config/db_schema_notes.md`.

## Files

```
shared_config/
  outcome_mapping.json      # favorable | unfavorable | ongoing, the one shared config file
  db_schema_notes.md        # field reference, read-only
falsification_engine/
  local_cohort_builder.py   # CohortFilters -> case_id lists (own copy)
  stats_core.py             # contingency table -> OR/CI -> fisher/chi2 (internal helper, shared by every check)
  perturbations.py          # leave-one-{hospital,country,demographic}-out
  bootstrap.py               # resampling stability
  time_split.py               # record-date split-half consistency
  stratified.py                # subgroup x intervention interaction model
  correction.py                # Holm-Bonferroni + Benjamini-Hochberg
  schemas.py                  # CohortFilters, ContingencyResult, PerturbationCheckResult, FalsificationRunResult
  service.py                   # run_falsification() — the orchestrator
  router.py                    # POST /api/falsification/run, GET /checks/{id}
  tests/
    csv_case_source.py         # demo-only: CSV -> CaseRow, stand-in for a Supabase read
    sample_dataset.csv         # copy of the real uploaded dataset (105 cases)
    test_falsification_engine.py
```

## Wiring it to your real backend

Everything reads case data through one injection point:

```python
run_falsification(filters, case_source=some_zero_arg_callable_returning_CaseRow_list)
```

In `router.py`, replace `get_case_source()`'s `NotImplementedError` with a real
Supabase read — same field names as `CaseRow`, so it's a ~10 line change:

```python
def get_case_source():
    def _load():
        resp = supabase.table("cases").select(
            "id,disease,domain,hospital_id,country,sex,age_range,medications,outcome,created_at"
        ).execute()
        return [CaseRow(id=r["id"], disease=r["disease"], domain=r["domain"],
                         hospital=r["hospital_id"], country=r["country"], sex=r["sex"],
                         age_range=r["age_range"], medications=r["medications"],
                         outcome=r["outcome"], created_at=r["created_at"]) for r in resp.data]
    return _load
```

Mount the router in `main.py`:
```python
from app.hypothesis.falsification_engine.router import router as falsification_router
app.include_router(falsification_router)
```

## Running the tests

```bash
pip install pandas scipy statsmodels pydantic fastapi pytest
python -m pytest backend/app/hypothesis/falsification_engine/tests/ -v
```

9/9 pass, including 3 integration tests run against the real 105-case dataset
(not synthetic fixtures): a workable 7-case cohort (Colorectal Cancer ×
Cetuximab) that exercises the full pipeline, a 1-case cohort (Leukemia ×
Rituximab) that proves the engine degrades to `insufficient_data` instead of
crashing or fabricating a p-value, and a domain-level (Oncology) grouping.

## Honest limitation this run against the real data surfaces

With only 105 rows spread across ~90 diseases, most single-disease cohorts
are too small (2–11 cases) for most perturbation checks to run at all — they
correctly report `insufficient_data` rather than a number. That's not a bug
in the engine; it's the engine doing its job on a dataset this size. It will
light up properly (real leave-one-out passes/fails, a working stratified
interaction fit, a meaningful bootstrap CI) as soon as cohorts clear
`min_arm_size` in both arms — which just needs the real dataset to grow past
the current seed size, or `domain`-level grouping to be used for early demos
instead of single-disease grouping.
