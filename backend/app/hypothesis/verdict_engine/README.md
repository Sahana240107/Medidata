# Verdict Engine — Member 2's second track

`decision_rules.py` + `scorecard.py`, built and tested against **two
hardcoded mock inputs** exactly as the guide specifies — an `EvidenceInput`
hand-written to match the shape Member 1's `statistics.py` will eventually
produce, and this same member's own real `FalsificationRunResult`. No wait
on Member 1 required; wiring their real output in later is a field mapping,
not a code dependency.

## Pipeline

`EvidenceInput` + `FalsificationRunResult` → `decision_rules.py` (plain
if/else, 7 ordered rules, self-documenting `rule_fired`) → `scorecard.py`
(four 1-5 rule-based dimensions) → `narrative_templates.py` (deterministic
slot-fill by default; optional LLM rephrase constrained to the same slots,
validated to reject any invented number) → `audit_pack.py` (chains the
falsification engine's own trace with the verdict's, exportable JSON/CSV).

## Verdicts

| verdict | fires when |
|---|---|
| `insufficient_evidence` | baseline or falsification couldn't compute a real stat, or zero checks were testable |
| `no_significant_association` | baseline CI includes 1.0 / p ≥ alpha — nothing to stress-test |
| `supported` | significant baseline, survived every testable check |
| `fragile_support` | significant baseline, a minority of checks flip direction after Holm-Bonferroni correction |
| `contradicted_by_falsification` | significant baseline, but a majority of checks flip — likely an artifact of one slice of the data |

`fragile_support` and `contradicted_by_falsification` verdicts always come
with a `restricted_to` plain-language explanation built from exactly which
check families flipped (hospital, country, demographic, time, subgroup
interaction, or bootstrap instability) — never a bare label.

## Scorecard dimensions (rubric v1, versioned in the output)

- **evidence_strength** — p-value + CI tightness
- **falsification_resistance** — fraction of testable checks that survived
- **generalizability** — hospital/country diversity + total cohort size
- **confounding_risk** (1=low, 5=high) — significant subgroup×intervention interactions found

## The narrative validator

`validate_no_invented_numbers()` extracts every number in a generated
sentence and rejects it if any number isn't present in the slot dict that
was actually handed to the template/LLM. Caught two real bugs during
building: a hardcoded `"0 flipped"` that ignored the actual count, and a
hyphen-as-range-separator (`"1.4-7.3"`) that the regex misread as a negative
number `-7.3`. Both are why this validator exists — it's not decorative.

## Tests

```bash
python -m pytest backend/app/hypothesis/verdict_engine/tests/ -v
```

12/12 pass: 7 unit tests hand-writing every decision-rule branch (the
guide's required "two hardcoded mock inputs"), 2 scorecard/narrative
correctness tests, 1 full mock-to-audit-pack integration test, and 2
integration tests that run the real falsification engine against the real
105-case dataset and feed its actual output into the verdict engine —
including a real, non-cherry-picked case where a tiny 7-case cohort
correctly comes back `no_significant_association` because its CI crosses 1.0.

## Wiring notes

- `compute_verdict(evidence, falsification, llm_call=None)` is the one
  entry point. Pass `llm_call` (any `str -> str` function) to get the
  constrained LLM narrative; omit it for the deterministic template.
- `router.py` mounts under `/api` — `verdict/compute`, `verdict/{id}`,
  `audit-pack/{id}`, `audit-pack/{id}/download` (supports `?format=csv`).
- Mount alongside the falsification router in `main.py`:
  ```python
  from app.hypothesis.verdict_engine.router import router as verdict_router
  app.include_router(verdict_router)
  ```
