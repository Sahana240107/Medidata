"""
Falsification Engine — Member 2's track.

Pure-algorithm robustness testing for a hypothesis's odds ratio: no LLM
anywhere in this package. Given a CohortFilters object, this engine pulls its
own cohort directly from the data source (own copy of cohort-building logic —
does not call Member 1's API, per the independence checklist), computes a
baseline categorical-outcome statistic, then tries to break it:

  - leave-one-hospital-out / leave-one-country-out / leave-one-demographic-out
  - bootstrap resampling stability
  - record-date (created_at) split-half consistency
  - subgroup x intervention interaction (stratified logistic regression)

All check p-values are pooled into one family and corrected with
Holm-Bonferroni before anything is marked passed/failed, so small-sample
noise doesn't get reported as false fragility.
"""

from .schemas import (
    CohortFilters,
    ContingencyResult,
    PerturbationCheckResult,
    FalsificationRunResult,
)
from .service import run_falsification

__all__ = [
    "CohortFilters",
    "ContingencyResult",
    "PerturbationCheckResult",
    "FalsificationRunResult",
    "run_falsification",
]
