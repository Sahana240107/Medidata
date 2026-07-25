"""
bootstrap.py

Resampling for CI stability. Independent of the perturbation checks: instead
of removing a subgroup, this resamples each arm WITH replacement at its own
size, recomputes the odds ratio each time, and asks "how often does the
resampled OR land on the same side of 1.0 as the baseline?" A baseline that
only "works" because of a couple of lucky cases will show a low same-direction
rate here even when leave-one-out doesn't catch it (leave-one-out removes
whole subgroups; bootstrap probes case-level sensitivity).

Pure scipy/numpy — no LLM, deterministic given a fixed random seed.
"""
from __future__ import annotations

import math
import random
from typing import Optional

from scipy.stats import binomtest

from .local_cohort_builder import CaseRow
from .schemas import ContingencyResult, PerturbationCheckResult
from .stats_core import compute_contingency, outcomes_for


def bootstrap_stability(
    intervention_ids: list[str],
    control_ids: list[str],
    rows_by_id: dict[str, CaseRow],
    baseline: ContingencyResult,
    min_arm_size: int,
    n_resamples: int = 1000,
    seed: int = 42,
) -> PerturbationCheckResult:
    if baseline.test_used == "insufficient_data" or baseline.direction is None:
        return PerturbationCheckResult(
            check_family="bootstrap_stability",
            check_name=f"Bootstrap resampling ({n_resamples} resamples)",
            status="insufficient_data",
            detail="baseline itself is insufficient_data — nothing to bootstrap",
        )

    rng = random.Random(seed)
    same_direction_count = 0
    valid_resamples = 0
    log_ors: list[float] = []

    for _ in range(n_resamples):
        resampled_intervention = [rng.choice(intervention_ids) for _ in intervention_ids]
        resampled_control = [rng.choice(control_ids) for _ in control_ids]

        stat = compute_contingency(
            outcomes_for(resampled_intervention, rows_by_id),
            outcomes_for(resampled_control, rows_by_id),
            min_arm_size=1,  # resamples keep arm size fixed by construction; only binary-count can shrink
        )
        if stat.test_used == "insufficient_data" or stat.odds_ratio is None or stat.odds_ratio <= 0:
            continue

        valid_resamples += 1
        log_ors.append(math.log(stat.odds_ratio))
        if stat.direction == baseline.direction:
            same_direction_count += 1
        elif stat.odds_ratio > 1 and baseline.odds_ratio and baseline.odds_ratio > 1:
            same_direction_count += 1
        elif stat.odds_ratio < 1 and baseline.odds_ratio and baseline.odds_ratio < 1:
            same_direction_count += 1

    if valid_resamples < n_resamples * 0.5:
        return PerturbationCheckResult(
            check_family="bootstrap_stability",
            check_name=f"Bootstrap resampling ({n_resamples} resamples)",
            status="insufficient_data",
            baseline_direction=baseline.direction,
            detail=(
                f"only {valid_resamples}/{n_resamples} resamples produced a computable OR "
                "— arms too small/sparse for stable bootstrapping"
            ),
        )

    same_direction_rate = same_direction_count / valid_resamples

    log_ors.sort()
    lo_idx = int(0.025 * len(log_ors))
    hi_idx = min(int(0.975 * len(log_ors)), len(log_ors) - 1)
    boot_ci_low = round(math.exp(log_ors[lo_idx]), 4)
    boot_ci_high = round(math.exp(log_ors[hi_idx]), 4)

    # Fragility threshold: if the OR sign is not reproduced in at least 90% of
    # resamples, the baseline direction is not resampling-stable.
    passed = same_direction_rate >= 0.90

    # Empirical p-value: two-sided binomial test against the null that
    # resampled direction is a 50/50 coin flip (i.e. baseline direction is
    # pure noise). A small p here means "more consistent than chance", which
    # is what we want feeding into the family-wise correction alongside the
    # other checks' p-values.
    p_value_raw = round(
        binomtest(same_direction_count, valid_resamples, 0.5, alternative="two-sided").pvalue, 6
    )

    return PerturbationCheckResult(
        check_family="bootstrap_stability",
        check_name=f"Bootstrap resampling ({n_resamples} resamples, seed={seed})",
        status="passed" if passed else "failed",
        baseline_direction=baseline.direction,
        check_direction=baseline.direction if passed else "unstable",
        verdict_flipped=not passed,
        odds_ratio=baseline.odds_ratio,
        ci_low=boot_ci_low,
        ci_high=boot_ci_high,
        p_value_raw=p_value_raw,
        n_intervention=len(intervention_ids),
        n_control=len(control_ids),
        detail=(
            f"{same_direction_count}/{valid_resamples} resamples ({same_direction_rate:.1%}) "
            f"reproduced baseline direction ({baseline.direction}); "
            f"bootstrap 95% OR range [{boot_ci_low}, {boot_ci_high}] vs analytic "
            f"[{baseline.ci_low}, {baseline.ci_high}]; empirical p={p_value_raw} "
            "(two-sided binomial test vs. 50/50 chance)"
        ),
    )
