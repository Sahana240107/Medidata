"""
stratified.py

logistic regression with a subgroup x intervention interaction term,
replacing naive subgroup removal as the source of truth for confounder
claims (per the guide: this is what perturbations.py's leave-one-out checks
are NOT allowed to claim — removal shows sensitivity, it doesn't establish
effect modification).

Model: outcome_binary ~ intervention + subgroup + intervention:subgroup
  outcome_binary: 1 = favorable, 0 = unfavorable (ongoing/unclassified cases
    are excluded from this model exactly as they are from the contingency
    table, for the same reason)
  intervention: 1 = case is in the intervention arm, 0 = control arm
  subgroup: categorical (sex, age_range) — one model per candidate subgroup

A significant interaction term means the intervention's effect genuinely
differs by subgroup (a real candidate confounder/effect-modifier). This is
reported as a candidate for review, consistent with Member 3's confounders
track being the place that owns confirmed-vs-candidate classification.

Fits with statsmodels; any convergence failure, singular matrix, or
insufficient category depth degrades to insufficient_data rather than a
crash or a fabricated p-value.
"""
from __future__ import annotations

import warnings

import pandas as pd

from .local_cohort_builder import CaseRow, normalize_outcome
from .schemas import PerturbationCheckResult

try:
    import statsmodels.formula.api as smf

    _HAS_STATSMODELS = True
except ImportError:  # pragma: no cover
    _HAS_STATSMODELS = False

_CANDIDATE_SUBGROUPS = [("sex", "sex"), ("age_range", "age range")]
_MIN_PER_CELL = 3  # minimum cases per (subgroup value x arm) cell to attempt a fit


def _build_frame(
    intervention_ids: list[str],
    control_ids: list[str],
    rows_by_id: dict[str, CaseRow],
    subgroup_attr: str,
) -> pd.DataFrame:
    records = []
    for i in intervention_ids:
        row = rows_by_id.get(i)
        if row is None:
            continue
        bucket = normalize_outcome(row.outcome)
        if bucket not in ("favorable", "unfavorable"):
            continue
        sg = (getattr(row, subgroup_attr, "") or "").strip()
        if not sg:
            continue
        records.append({"outcome_binary": 1 if bucket == "favorable" else 0, "intervention": 1, "subgroup": sg})
    for i in control_ids:
        row = rows_by_id.get(i)
        if row is None:
            continue
        bucket = normalize_outcome(row.outcome)
        if bucket not in ("favorable", "unfavorable"):
            continue
        sg = (getattr(row, subgroup_attr, "") or "").strip()
        if not sg:
            continue
        records.append({"outcome_binary": 1 if bucket == "favorable" else 0, "intervention": 0, "subgroup": sg})
    return pd.DataFrame.from_records(records)


def _fit_interaction_model(df: pd.DataFrame, subgroup_label: str) -> PerturbationCheckResult:
    check_name = f"Stratified interaction: intervention x {subgroup_label}"

    n_subgroups = df["subgroup"].nunique()
    if n_subgroups < 2:
        return PerturbationCheckResult(
            check_family="stratified_interaction",
            check_name=check_name,
            status="not_applicable",
            n_intervention=int((df["intervention"] == 1).sum()),
            n_control=int((df["intervention"] == 0).sum()),
            detail=f"only {n_subgroups} distinct {subgroup_label} value(s) with a binary outcome — no interaction to test",
        )

    cell_counts = df.groupby(["subgroup", "intervention"]).size()
    if (cell_counts < _MIN_PER_CELL).any() or df.shape[0] < 4 * _MIN_PER_CELL:
        return PerturbationCheckResult(
            check_family="stratified_interaction",
            check_name=check_name,
            status="insufficient_data",
            n_intervention=int((df["intervention"] == 1).sum()),
            n_control=int((df["intervention"] == 0).sum()),
            detail=(
                f"at least one (subgroup x arm) cell has fewer than {_MIN_PER_CELL} cases "
                "— interaction model would be unreliable, not attempted"
            ),
        )

    if not _HAS_STATSMODELS:
        return PerturbationCheckResult(
            check_family="stratified_interaction",
            check_name=check_name,
            status="insufficient_data",
            detail="statsmodels not installed",
        )

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", category=Warning)
            model = smf.logit(
                "outcome_binary ~ intervention * C(subgroup)", data=df
            ).fit(disp=0)
    except Exception as exc:  # perfect separation, singular matrix, non-convergence, etc.
        return PerturbationCheckResult(
            check_family="stratified_interaction",
            check_name=check_name,
            status="insufficient_data",
            n_intervention=int((df["intervention"] == 1).sum()),
            n_control=int((df["intervention"] == 0).sum()),
            detail=f"model did not fit cleanly ({type(exc).__name__}: {exc}) — reported as insufficient_data rather than a guessed p-value",
        )

    interaction_terms = [t for t in model.pvalues.index if ":" in t]
    if not interaction_terms:
        return PerturbationCheckResult(
            check_family="stratified_interaction",
            check_name=check_name,
            status="insufficient_data",
            detail="model fit but produced no interaction term (likely rank-deficient design)",
        )

    # Smallest interaction-term p-value across the subgroup's dummy-coded levels.
    worst_term = min(interaction_terms, key=lambda t: model.pvalues[t])
    p_value = float(model.pvalues[worst_term])
    significant = p_value < 0.05

    return PerturbationCheckResult(
        check_family="stratified_interaction",
        check_name=check_name,
        status="failed" if significant else "passed",
        verdict_flipped=significant,
        p_value_raw=round(p_value, 6),
        n_intervention=int((df["intervention"] == 1).sum()),
        n_control=int((df["intervention"] == 0).sum()),
        detail=(
            f"interaction term '{worst_term}' p={p_value:.4f} "
            f"({'candidate effect modifier — flag for Member 3 confounder review' if significant else 'no significant effect modification detected'})"
        ),
    )


def stratified_interaction_check(
    intervention_ids: list[str],
    control_ids: list[str],
    rows_by_id: dict[str, CaseRow],
) -> list[PerturbationCheckResult]:
    results = []
    for attr, label in _CANDIDATE_SUBGROUPS:
        df = _build_frame(intervention_ids, control_ids, rows_by_id, attr)
        if df.empty:
            results.append(
                PerturbationCheckResult(
                    check_family="stratified_interaction",
                    check_name=f"Stratified interaction: intervention x {label}",
                    status="insufficient_data",
                    detail="no binary-outcome cases with this field populated",
                )
            )
            continue
        results.append(_fit_interaction_model(df, label))
    return results
