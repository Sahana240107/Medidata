"""
service.py

Orchestrates the whole Falsification Engine: build the baseline cohort and
stat, run every perturbation family, pool every check's p-value into one
family, apply Holm-Bonferroni, and decide the overall verdict. This is the
one function the router calls.

Deliberately has NO import of Member 1's code anywhere in this file or
anything it calls — see local_cohort_builder.py's docstring.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Callable, Iterable

from . import bootstrap as bootstrap_mod
from . import perturbations as perturbations_mod
from . import time_split as time_split_mod
from . import stratified as stratified_mod
from .correction import holm_bonferroni
from .local_cohort_builder import CaseRow, build_cohort
from .schemas import CohortFilters, FalsificationRunResult, PerturbationCheckResult
from .stats_core import compute_contingency, outcomes_for


def _trace(steps: list[dict], step: str, library: str, function: str, params: dict, result) -> None:
    steps.append(
        {
            "step": step,
            "library": library,
            "function": function,
            "params": params,
            "result": result,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )


def run_falsification(
    filters: CohortFilters,
    case_source: Callable[[], Iterable[CaseRow]],
    n_bootstrap_resamples: int = 1000,
    bootstrap_seed: int = 42,
    alpha: float = 0.05,
) -> FalsificationRunResult:
    """
    case_source: zero-arg callable returning an iterable of CaseRow. Kept as a
    callable (not a materialized list) so the caller controls exactly when
    the data pull happens — swap this for a Supabase query function with zero
    other changes to this module.
    """
    run_id = str(uuid.uuid4())
    audit_trace: list[dict] = []

    cases = list(case_source())
    rows_by_id = {row.id: row for row in cases}
    _trace(audit_trace, "load_cases", "local", "case_source()", {}, {"n_cases_loaded": len(cases)})

    cohort = build_cohort(filters, cases)
    _trace(
        audit_trace,
        "build_cohort",
        "local_cohort_builder",
        "build_cohort",
        {"filters": filters.model_dump()},
        {
            "n_intervention": len(cohort.intervention_ids),
            "n_control": len(cohort.control_ids),
            "n_excluded": len(cohort.excluded_ids),
            "notes": cohort.notes,
        },
    )

    baseline = compute_contingency(
        outcomes_for(cohort.intervention_ids, rows_by_id),
        outcomes_for(cohort.control_ids, rows_by_id),
        min_arm_size=filters.min_arm_size,
    )
    _trace(
        audit_trace,
        "compute_baseline",
        "scipy.stats",
        "compute_contingency",
        {"min_arm_size": filters.min_arm_size},
        baseline.model_dump(),
    )

    if baseline.test_used == "insufficient_data":
        return FalsificationRunResult(
            run_id=run_id,
            filters=filters,
            baseline=baseline,
            checks=[],
            family_size=0,
            overall_verdict="insufficient_data",
            fragility_reasons=[
                f"baseline cohort too small for a statistical test "
                f"(intervention n={baseline.n_intervention}, control n={baseline.n_control}, "
                f"min_arm_size={filters.min_arm_size}) — no falsification checks were run"
            ],
            audit_trace=audit_trace,
            computed_at=datetime.now(timezone.utc),
        )

    all_checks: list[PerturbationCheckResult] = []

    hospital_checks = perturbations_mod.leave_one_hospital_out(
        cohort.intervention_ids, cohort.control_ids, rows_by_id, baseline, filters.min_arm_size
    )
    _trace(audit_trace, "leave_one_hospital_out", "scipy.stats", "perturbations.leave_one_hospital_out", {}, {"n_checks": len(hospital_checks)})
    all_checks.extend(hospital_checks)

    country_checks = perturbations_mod.leave_one_country_out(
        cohort.intervention_ids, cohort.control_ids, rows_by_id, baseline, filters.min_arm_size
    )
    _trace(audit_trace, "leave_one_country_out", "scipy.stats", "perturbations.leave_one_country_out", {}, {"n_checks": len(country_checks)})
    all_checks.extend(country_checks)

    demo_checks = perturbations_mod.leave_one_demographic_out(
        cohort.intervention_ids, cohort.control_ids, rows_by_id, baseline, filters.min_arm_size
    )
    _trace(audit_trace, "leave_one_demographic_out", "scipy.stats", "perturbations.leave_one_demographic_out", {}, {"n_checks": len(demo_checks)})
    all_checks.extend(demo_checks)

    boot_check = bootstrap_mod.bootstrap_stability(
        cohort.intervention_ids,
        cohort.control_ids,
        rows_by_id,
        baseline,
        filters.min_arm_size,
        n_resamples=n_bootstrap_resamples,
        seed=bootstrap_seed,
    )
    _trace(
        audit_trace,
        "bootstrap_stability",
        "scipy.stats",
        "bootstrap.bootstrap_stability",
        {"n_resamples": n_bootstrap_resamples, "seed": bootstrap_seed},
        {"status": boot_check.status},
    )
    all_checks.append(boot_check)

    ts_checks = time_split_mod.time_split_check(
        cohort.intervention_ids, cohort.control_ids, rows_by_id, baseline, filters.min_arm_size
    )
    _trace(audit_trace, "time_split", "scipy.stats", "time_split.time_split_check", {}, {"n_checks": len(ts_checks)})
    all_checks.extend(ts_checks)

    strat_checks = stratified_mod.stratified_interaction_check(
        cohort.intervention_ids, cohort.control_ids, rows_by_id
    )
    _trace(audit_trace, "stratified_interaction", "statsmodels", "stratified.stratified_interaction_check", {}, {"n_checks": len(strat_checks)})
    all_checks.extend(strat_checks)

    # --- Holm-Bonferroni across the full check family ---
    testable_indices = [idx for idx, c in enumerate(all_checks) if c.p_value_raw is not None]
    p_values = [all_checks[idx].p_value_raw for idx in testable_indices]
    corrections = holm_bonferroni(p_values, alpha=alpha)
    _trace(
        audit_trace,
        "holm_bonferroni_correction",
        "local",
        "correction.holm_bonferroni",
        {"alpha": alpha, "family_size": len(p_values)},
        {"n_significant_after_correction": sum(1 for c in corrections if c.significant)},
    )

    for corr in corrections:
        check = all_checks[testable_indices[corr.check_index]]
        check.p_value_corrected = corr.p_value_corrected
        check.significant_after_correction = corr.significant

    # A check only counts as a genuine fragility signal if it BOTH showed a
    # verdict flip / instability AND survives multiplicity correction.
    fragility_reasons: list[str] = []
    for check in all_checks:
        if not check.verdict_flipped:
            continue
        if check.p_value_raw is None:
            # No p-value to correct (shouldn't happen given current checks,
            # but handled explicitly rather than silently trusted).
            fragility_reasons.append(f"{check.check_name}: flipped, but no p-value available to confirm significance — flagged for manual review")
        elif check.significant_after_correction:
            fragility_reasons.append(f"{check.check_name}: {check.detail}")

    n_insufficient = sum(1 for c in all_checks if c.status == "insufficient_data")
    n_testable = sum(1 for c in all_checks if c.status in ("passed", "failed"))

    if n_testable == 0:
        overall_verdict = "insufficient_data"
        if not fragility_reasons:
            fragility_reasons.append(
                f"baseline was computable but all {len(all_checks)} robustness checks were "
                "insufficient_data or not_applicable — cohort too small/homogeneous to stress-test"
            )
    elif fragility_reasons:
        overall_verdict = "fragile"
    else:
        overall_verdict = "robust"

    return FalsificationRunResult(
        run_id=run_id,
        filters=filters,
        baseline=baseline,
        checks=all_checks,
        alpha=alpha,
        family_size=len(p_values),
        overall_verdict=overall_verdict,
        fragility_reasons=fragility_reasons,
        audit_trace=audit_trace,
        computed_at=datetime.now(timezone.utc),
    )
