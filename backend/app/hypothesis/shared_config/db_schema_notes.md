# `cases` table — field reference for the Hypothesis Engine

Read-only reference. Not code, not imported. Copied from `public.cases` in the
Supabase schema, restricted to the fields the hypothesis engine actually touches.

| field | type | notes for statistical use |
|---|---|---|
| `id` | uuid | case identifier, used everywhere as the join key |
| `disease` | text | often `"Unclassified"` — filter on `domain` as a fallback when `disease` is too sparse |
| `domain` | text | broader clinical area (Oncology, Cardiovascular, ...) — coarser but denser than `disease` |
| `hospital_id` / `hospital` (denormalized) | uuid / text | leave-one-hospital-out unit |
| `country` | text | leave-one-country-out unit — **currently single-country (India) in the seed dataset**, so this perturbation will report `not_applicable` until multi-country data lands. Code must not assume >1 country exists. |
| `sex`, `age_range` | text | demographic subgroup units for leave-one-demographic-out and the stratified interaction model |
| `symptoms`, `lab_results` | text (`;`-delimited, values often carry ` (unit)` suffixes) | not used by the falsification engine directly; Member 1 / Member 3 territory |
| `medications` | text (`;`-delimited, values often carry ` (dose/status)` suffixes) | **this is the intervention/control signal** — there is no explicit intervention flag in the schema. A case is "intervention" if any semicolon-delimited entry, stripped of its parenthetical suffix, contains the target drug name (case-insensitive substring). |
| `outcome` | free text | not a clean binary, not a mortality flag — normalize via `shared_config/outcome_mapping.json` before any statistical test |
| `status` | enum (`active`/`archived`/`resolved`) | record lifecycle, not a clinical outcome — do not confuse with `outcome` |
| `created_at` | timestamptz | **the only date field.** No event date, no follow-up duration. `time_split.py` splits on this as an explicit *record-date* split — it is a data-drift/robustness check, not a survival-time analysis. |

## Consequences for the Falsification Engine specifically

- No survival analysis (Cox, log-rank) — the data shape doesn't support it. Every
  statistical check here is a **categorical outcome comparison**: contingency
  table → odds ratio + CI → chi-square or Fisher's exact (Fisher when any
  expected cell count < 5).
- Intervention/control is **derived**, not stored — `local_cohort_builder.py`
  re-derives it from `medications` independently of Member 1's cohort builder,
  by design (zero cross-member coupling, small duplicated-logic cost).
- Because `country` is currently single-valued in the seed data, and `hospital`
  has only a handful of distinct values with a very long tail (two hospitals
  hold ~90% of rows), most perturbation checks on small disease-level cohorts
  will legitimately report `insufficient_data` rather than a pass/fail. That is
  correct behavior, not a bug — see `perturbations.py` docstring.
