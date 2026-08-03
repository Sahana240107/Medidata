"""
perturbations.py

Leave-one-{hospital,country,demographic}-out checks. Each removes one
subgroup at a time from BOTH arms, recomputes the contingency stat on what's
left, and flags whether the direction of effect flips relative to baseline.

A "flip" means the baseline conclusion depends heavily on one hospital, one
country, or one demographic slice — exactly the kind of fragility this engine
exists to catch before a hypothesis reaches a verdict.

Design note on this dataset: `country` is currently single-valued (India-only
in the seed data) and `hospital` is dominated by two sites holding ~90% of
rows with a long tail of near-singleton hospitals. Both facts are handled
explicitly here rather than assumed away:
  - a subgroup with only one distinct value in the cohort -> not_applicable
    (nothing to leave out)
  - removing a subgroup that drops either arm below `min_arm_size` ->
    insufficient_data, not a silent skip
"""
from __future__ import annotations

from typing import Iterable, Literal

from .local_cohort_builder import CaseRow, normalize_outcome
from .schemas import ContingencyResult, PerturbationCheckResult
from .stats_core import compute_contingency, outcomes_for

CheckFamily = Literal["leave_one_hospital_out", "leave_one_country_out", "leave_one_demographic_out"]


def _distinct_values(ids: list[str], rows_by_id: dict[str, CaseRow], attr: str) -> list[str]:
    seen = []
    for i in ids:
        row = rows_by_id.get(i)
        if row is None:
            continue
        v = (getattr(row, attr) or "").strip()
        if v and v not in seen:
            seen.append(v)
    return seen


def _run_leave_one_out(
    check_family: CheckFamily,
    attr: str,
    label_prefix: str,
    intervention_ids: list[str],
    control_ids: list[str],
    rows_by_id: dict[str, CaseRow],
    baseline: ContingencyResult,
    min_arm_size: int,
) -> list[PerturbationCheckResult]:
    all_ids = intervention_ids + control_ids
    distinct = _distinct_values(all_ids, rows_by_id, attr)

    if len(distinct) < 2:
        return [
            PerturbationCheckResult(
                check_family=check_family,
                check_name=f"{label_prefix} (only one distinct {attr} in cohort)",
                status="not_applicable",
                baseline_direction=baseline.direction,
                detail=f"cohort has {len(distinct)} distinct value(s) for `{attr}` — nothing to leave out",
            )
        ]

    results: list[PerturbationCheckResult] = []
    for value in distinct:
        remaining_intervention = [i for i in intervention_ids if getattr(rows_by_id[i], attr, "") != value]
        remaining_control = [i for i in control_ids if getattr(rows_by_id[i], attr, "") != value]

        n_removed = (len(intervention_ids) - len(remaining_intervention)) + (
            len(control_ids) - len(remaining_control)
        )
        check_name = f"{label_prefix}: excluding '{value}' ({n_removed} case(s) removed)"

        if len(remaining_intervention) < min_arm_size or len(remaining_control) < min_arm_size:
            results.append(
                PerturbationCheckResult(
                    check_family=check_family,
                    check_name=check_name,
                    status="insufficient_data",
                    baseline_direction=baseline.direction,
                    n_intervention=len(remaining_intervention),
                    n_control=len(remaining_control),
                    detail=(
                        f"after removing '{value}', an arm drops below min_arm_size="
                        f"{min_arm_size} (intervention={len(remaining_intervention)}, "
                        f"control={len(remaining_control)})"
                    ),
                )
            )
            continue

        stat = compute_contingency(
            outcomes_for(remaining_intervention, rows_by_id),
            outcomes_for(remaining_control, rows_by_id),
            min_arm_size=min_arm_size,
        )

        if stat.test_used == "insufficient_data":
            results.append(
                PerturbationCheckResult(
                    check_family=check_family,
                    check_name=check_name,
                    status="insufficient_data",
                    baseline_direction=baseline.direction,
                    n_intervention=stat.n_intervention,
                    n_control=stat.n_control,
                    detail="binary outcome count (favorable+unfavorable) too small after removal",
                )
            )
            continue

        flipped = (
            baseline.direction in ("favors_intervention", "favors_control")
            and stat.direction in ("favors_intervention", "favors_control")
            and stat.direction != baseline.direction
        )

        results.append(
            PerturbationCheckResult(
                check_family=check_family,
                check_name=check_name,
                status="failed" if flipped else "passed",
                baseline_direction=baseline.direction,
                check_direction=stat.direction,
                verdict_flipped=flipped,
                odds_ratio=stat.odds_ratio,
                ci_low=stat.ci_low,
                ci_high=stat.ci_high,
                p_value_raw=stat.p_value,
                n_intervention=stat.n_intervention,
                n_control=stat.n_control,
                detail=(
                    f"OR={stat.odds_ratio} [{stat.ci_low}, {stat.ci_high}], "
                    f"{stat.test_used}, p={stat.p_value}"
                ),
            )
        )
    return results


def leave_one_hospital_out(
    intervention_ids: list[str],
    control_ids: list[str],
    rows_by_id: dict[str, CaseRow],
    baseline: ContingencyResult,
    min_arm_size: int,
) -> list[PerturbationCheckResult]:
    return _run_leave_one_out(
        "leave_one_hospital_out",
        "hospital",
        "Leave-one-hospital-out",
        intervention_ids,
        control_ids,
        rows_by_id,
        baseline,
        min_arm_size,
    )


def leave_one_country_out(
    intervention_ids: list[str],
    control_ids: list[str],
    rows_by_id: dict[str, CaseRow],
    baseline: ContingencyResult,
    min_arm_size: int,
) -> list[PerturbationCheckResult]:
    return _run_leave_one_out(
        "leave_one_country_out",
        "country",
        "Leave-one-country-out",
        intervention_ids,
        control_ids,
        rows_by_id,
        baseline,
        min_arm_size,
    )


def leave_one_demographic_out(
    intervention_ids: list[str],
    control_ids: list[str],
    rows_by_id: dict[str, CaseRow],
    baseline: ContingencyResult,
    min_arm_size: int,
) -> list[PerturbationCheckResult]:
    """Runs leave-one-out separately over `sex` and `age_range`, since these
    are two independent demographic axes, not one combined key."""
    results = []
    for attr, label in (("sex", "Leave-one-sex-group-out"), ("age_range", "Leave-one-age-range-out")):
        results.extend(
            _run_leave_one_out(
                "leave_one_demographic_out",
                attr,
                label,
                intervention_ids,
                control_ids,
                rows_by_id,
                baseline,
                min_arm_size,
            )
        )
    return results
