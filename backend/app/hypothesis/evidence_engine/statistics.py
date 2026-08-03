"""
statistics.py

Produces a real odds ratio / CI / p-value from actual Supabase data:
contingency table -> odds ratio + CI -> Fisher's exact or chi-square, chosen
by expected cell count (Fisher when ANY expected cell count < 5, per the
Data Reality Check in the team guide).

Pure scipy/math. No I/O, no network calls, no LLM — safe to unit test against
a hardcoded pair of outcome lists with zero external dependency.
"""
from __future__ import annotations

import math
from typing import Iterable, Literal, Optional

from scipy.stats import chi2_contingency, fisher_exact, norm

from .cohort_builder import CaseRow
from .outcome_mapping import normalize_outcome
from .schemas import ContingencyResult


def outcomes_for(ids: Iterable[str], rows_by_id: dict[str, CaseRow]) -> list[str]:
    """Maps a list of case ids to their normalized outcome buckets."""
    return [normalize_outcome(rows_by_id[i].outcome) for i in ids if i in rows_by_id]


def build_binary_counts(outcomes: list[str]) -> tuple[int, int, int, int]:
    """Counts favorable/unfavorable, and separately how many were excluded as
    ongoing/unclassified (returned for caller bookkeeping, not part of the 2x2)."""
    favorable = sum(1 for o in outcomes if o == "favorable")
    unfavorable = sum(1 for o in outcomes if o == "unfavorable")
    ongoing = sum(1 for o in outcomes if o == "ongoing")
    unclassified = sum(1 for o in outcomes if o == "unclassified")
    return favorable, unfavorable, ongoing, unclassified


def compute_contingency(
    intervention_outcomes: list[str],
    control_outcomes: list[str],
    min_arm_size: int = 5,
) -> ContingencyResult:
    """The one true statistics function for the Evidence Engine. Called with
    the intervention/control outcome lists resolved by cohort_builder.py."""
    a, b, i_ong, i_unc = build_binary_counts(intervention_outcomes)
    c, d, c_ong, c_unc = build_binary_counts(control_outcomes)

    n_intervention = len(intervention_outcomes)
    n_control = len(control_outcomes)
    n_excluded_ongoing = i_ong + c_ong
    n_excluded_unclassified = i_unc + c_unc

    binary_intervention_n = a + b
    binary_control_n = c + d
    favorable_col_n = a + c
    unfavorable_col_n = b + d

    if (
        n_intervention < min_arm_size
        or n_control < min_arm_size
        or binary_intervention_n == 0
        or binary_control_n == 0
        or favorable_col_n == 0
        or unfavorable_col_n == 0
    ):
        return ContingencyResult(
            a_intervention_favorable=a,
            b_intervention_unfavorable=b,
            c_control_favorable=c,
            d_control_unfavorable=d,
            n_intervention=n_intervention,
            n_control=n_control,
            n_excluded_ongoing=n_excluded_ongoing,
            n_excluded_unclassified=n_excluded_unclassified,
            odds_ratio=None,
            ci_low=None,
            ci_high=None,
            p_value=None,
            test_used="insufficient_data",
            direction=None,
        )

    table = [[a, b], [c, d]]

    # Expected-cell-count check decides Fisher's exact vs chi-square: Fisher
    # when ANY expected cell count < 5, per the guide's explicit rule.
    _, _, _, expected = chi2_contingency(table, correction=False)
    use_fisher = (expected < 5).any()

    continuity_correction_applied = False
    a_c, b_c, c_c, d_c = a, b, c, d
    if 0 in (a, b, c, d):
        # Haldane-Anscombe continuity correction so OR/CI stay finite instead
        # of blowing up to inf/0 whenever any cell is zero.
        a_c, b_c, c_c, d_c = a + 0.5, b + 0.5, c + 0.5, d + 0.5
        continuity_correction_applied = True

    odds_ratio = (a_c * d_c) / (b_c * c_c)
    log_or = math.log(odds_ratio)
    se_log_or = math.sqrt(1 / a_c + 1 / b_c + 1 / c_c + 1 / d_c)
    z = norm.ppf(0.975)
    ci_low = math.exp(log_or - z * se_log_or)
    ci_high = math.exp(log_or + z * se_log_or)

    if use_fisher:
        _, p_value = fisher_exact(table)
        test_used: Literal["fisher_exact", "chi_square"] = "fisher_exact"
    else:
        chi2, p_value, _, _ = chi2_contingency(table, correction=True)
        test_used = "chi_square"

    if odds_ratio > 1 and ci_low > 1:
        direction: Optional[str] = "favors_intervention"
    elif odds_ratio < 1 and ci_high < 1:
        direction = "favors_control"
    else:
        direction = "no_effect"

    return ContingencyResult(
        a_intervention_favorable=a,
        b_intervention_unfavorable=b,
        c_control_favorable=c,
        d_control_unfavorable=d,
        n_intervention=n_intervention,
        n_control=n_control,
        n_excluded_ongoing=n_excluded_ongoing,
        n_excluded_unclassified=n_excluded_unclassified,
        odds_ratio=round(odds_ratio, 4),
        ci_low=round(ci_low, 4),
        ci_high=round(ci_high, 4),
        p_value=round(p_value, 6),
        test_used=test_used,
        continuity_correction_applied=continuity_correction_applied,
        direction=direction,
    )