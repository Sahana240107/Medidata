"""
test_falsification_engine.py

Runs the engine against the real dataset (105 rows, tests/sample_dataset.csv,
a copy of the uploaded medidata_dataset.csv) to prove it works end-to-end,
not just on synthetic fixtures. Also includes small synthetic unit tests for
the pieces that need controlled inputs (correction math, outcome
normalization, medication matching) that the real dataset can't reliably
exercise on its own.

Run with: python -m pytest backend/app/hypothesis/falsification_engine/tests/ -v
"""
from __future__ import annotations

from pathlib import Path

from ..correction import benjamini_hochberg, holm_bonferroni
from ..local_cohort_builder import medication_match, normalize_outcome
from ..schemas import CohortFilters
from ..service import run_falsification
from .csv_case_source import load_cases_from_csv

_CSV_PATH = Path(__file__).parent / "sample_dataset.csv"


# ---------------------------------------------------------------------------
# Unit tests — pure functions, synthetic inputs
# ---------------------------------------------------------------------------

def test_normalize_outcome_buckets():
    assert normalize_outcome("recovered") == "favorable"
    assert normalize_outcome("Partial Response") == "favorable"
    assert normalize_outcome("progressive disease") == "unfavorable"
    assert normalize_outcome("deceased") == "unfavorable"
    assert normalize_outcome("stable after cycle 1") == "ongoing"
    assert normalize_outcome("stable") == "ongoing"
    assert normalize_outcome("under follow-up") == "ongoing"
    assert normalize_outcome("") == "unclassified"
    assert normalize_outcome("some totally novel free text nobody wrote in the mapping") == "unclassified"


def test_medication_match_ignores_dose_suffix_and_case():
    field = "IV Immunoglobulin (IVIG); Pregabalin; Pantoprazole"
    assert medication_match(field, "immunoglobulin")
    assert medication_match(field, "PREGABALIN")
    assert not medication_match(field, "aspirin")


def test_holm_bonferroni_more_conservative_than_bh():
    # classic textbook p-values
    pvals = [0.01, 0.02, 0.03, 0.04, 0.20]
    holm = holm_bonferroni(pvals)
    bh = benjamini_hochberg(pvals)
    n_sig_holm = sum(1 for r in holm if r.significant)
    n_sig_bh = sum(1 for r in bh if r.significant)
    assert n_sig_holm <= n_sig_bh, "Holm should never flag more checks significant than BH on the same input"


def test_holm_bonferroni_monotone_and_capped():
    pvals = [0.001, 0.2, 0.15, 0.9, 0.5]
    results = holm_bonferroni(pvals)
    corrected_sorted_by_raw = [r.p_value_corrected for r in sorted(results, key=lambda r: r.p_value_raw)]
    assert all(a <= b + 1e-9 for a, b in zip(corrected_sorted_by_raw, corrected_sorted_by_raw[1:])), (
        "corrected p-values must be monotone non-decreasing in raw-p rank"
    )
    assert all(0.0 <= r.p_value_corrected <= 1.0 for r in results)


def test_correction_empty_input():
    assert holm_bonferroni([]) == []
    assert benjamini_hochberg([]) == []


# ---------------------------------------------------------------------------
# Integration tests — the real dataset
# ---------------------------------------------------------------------------

def test_engine_runs_end_to_end_on_real_dataset_colorectal_cetuximab():
    """Colorectal Cancer + Cetuximab: 7 cases in-cohort (5 intervention / 2
    control) — enough to exercise the full pipeline without every check
    bottoming out at insufficient_data."""
    cases = load_cases_from_csv(_CSV_PATH)
    filters = CohortFilters(
        disease="Colorectal Cancer",
        intervention_medication="Cetuximab",
        min_arm_size=2,
    )
    result = run_falsification(filters, case_source=lambda: cases, n_bootstrap_resamples=500)

    assert result.overall_verdict in ("robust", "fragile", "insufficient_data")
    assert result.baseline.n_intervention + result.baseline.n_control <= 7
    assert len(result.checks) > 0
    assert len(result.audit_trace) > 0
    # every check that reports a raw p-value must also carry a corrected one
    for check in result.checks:
        if check.p_value_raw is not None:
            assert check.p_value_corrected is not None
            assert check.p_value_corrected >= check.p_value_raw - 1e-9


def test_engine_reports_insufficient_data_on_tiny_real_cohort():
    """Leukemia + Rituximab: 1 matching case in the real dataset. The engine
    must degrade gracefully to insufficient_data, never crash, never fabricate
    a p-value from a single case."""
    cases = load_cases_from_csv(_CSV_PATH)
    filters = CohortFilters(
        disease="Leukemia",
        intervention_medication="Rituximab",
        min_arm_size=5,
    )
    result = run_falsification(filters, case_source=lambda: cases)
    assert result.overall_verdict == "insufficient_data"
    assert result.baseline.test_used == "insufficient_data"
    assert result.checks == []


def test_engine_handles_domain_level_grouping_on_real_dataset():
    """Oncology domain (21 cases) with a broad chemo-class intervention —
    exercises leave-one-hospital-out and demographic perturbations with more
    room to actually run rather than short-circuit."""
    cases = load_cases_from_csv(_CSV_PATH)
    filters = CohortFilters(
        domain="Oncology",
        intervention_medication="Carboplatin",
        min_arm_size=2,
    )
    result = run_falsification(filters, case_source=lambda: cases, n_bootstrap_resamples=300)
    assert result.overall_verdict in ("robust", "fragile", "insufficient_data")
    assert isinstance(result.fragility_reasons, list)


def test_no_case_id_appears_in_both_arms():
    cases = load_cases_from_csv(_CSV_PATH)
    filters = CohortFilters(domain="Oncology", intervention_medication="Carboplatin", min_arm_size=1)
    from ..local_cohort_builder import build_cohort

    cohort = build_cohort(filters, cases)
    assert set(cohort.intervention_ids).isdisjoint(set(cohort.control_ids))


if __name__ == "__main__":
    import sys

    import pytest

    sys.exit(pytest.main([__file__, "-v"]))
