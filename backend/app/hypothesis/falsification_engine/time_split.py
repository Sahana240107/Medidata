"""
time_split.py

Splits the cohort by `created_at` (the only date field this schema has) into
an earlier half and a later half, and recomputes the contingency stat
independently in each. This is explicitly a RECORD-DATE split, not a survival
or causal time-to-event analysis — the Data Reality Check is clear there's no
event date to do that with. What this catches: a hypothesis that only holds
in the early-recorded cases (e.g. protocol drift, a new hospital coming
online partway through, coding-convention changes) and quietly disappears in
more recent records, or vice versa.
"""
from __future__ import annotations

from datetime import datetime

from .local_cohort_builder import CaseRow
from .schemas import ContingencyResult, PerturbationCheckResult
from .stats_core import compute_contingency, outcomes_for


def _parse_dt(value: str) -> datetime:
    # Cases use ISO 8601 with a timezone offset, e.g. 2026-06-26T15:32:58.383096+00:00
    return datetime.fromisoformat(value)


def time_split_check(
    intervention_ids: list[str],
    control_ids: list[str],
    rows_by_id: dict[str, CaseRow],
    baseline: ContingencyResult,
    min_arm_size: int,
) -> list[PerturbationCheckResult]:
    all_ids = intervention_ids + control_ids
    dated = [(i, _parse_dt(rows_by_id[i].created_at)) for i in all_ids if i in rows_by_id and rows_by_id[i].created_at]

    if len(dated) < 2 * min_arm_size:
        return [
            PerturbationCheckResult(
                check_family="time_split",
                check_name="Record-date split (early half vs. late half)",
                status="insufficient_data",
                detail=f"only {len(dated)} dated cases in cohort — need at least {2 * min_arm_size} for a meaningful split",
            )
        ]

    dated.sort(key=lambda pair: pair[1])
    median_idx = len(dated) // 2
    early_ids = {i for i, _ in dated[:median_idx]}
    late_ids = {i for i, _ in dated[median_idx:]}
    split_date = dated[median_idx][1].date().isoformat()

    results = []
    for label, id_set in (("earlier half", early_ids), ("later half", late_ids)):
        half_intervention = [i for i in intervention_ids if i in id_set]
        half_control = [i for i in control_ids if i in id_set]
        check_name = f"Record-date split: {label} (before/after {split_date}, by created_at)"

        if len(half_intervention) < min_arm_size or len(half_control) < min_arm_size:
            results.append(
                PerturbationCheckResult(
                    check_family="time_split",
                    check_name=check_name,
                    status="insufficient_data",
                    n_intervention=len(half_intervention),
                    n_control=len(half_control),
                    detail=(
                        f"{label} has intervention={len(half_intervention)}, "
                        f"control={len(half_control)} — below min_arm_size={min_arm_size}"
                    ),
                )
            )
            continue

        stat = compute_contingency(
            outcomes_for(half_intervention, rows_by_id),
            outcomes_for(half_control, rows_by_id),
            min_arm_size=min_arm_size,
        )

        if stat.test_used == "insufficient_data":
            results.append(
                PerturbationCheckResult(
                    check_family="time_split",
                    check_name=check_name,
                    status="insufficient_data",
                    n_intervention=stat.n_intervention,
                    n_control=stat.n_control,
                    detail="binary outcome count too small within this half",
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
                check_family="time_split",
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
