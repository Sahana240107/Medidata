"""
correction.py

Holm-Bonferroni across the full check family. This is what prevents false
fragility alarms on small samples: run enough leave-one-out / time-split /
stratified checks and, by chance alone, some will cross p<0.05 even when
nothing real is going on. Do not ship without it — this module is called by
service.py after every check has a raw p-value, before ANY check is finally
marked passed/failed in the result the frontend sees.

Also exposes Benjamini-Hochberg (FDR control) as an alternate, less
conservative option, per the guide's "Holm-Bonferroni / Benjamini-Hochberg"
phrasing — Holm is the default because a falsification engine's job is to be
conservative about declaring "robust", not permissive.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class CorrectionResult:
    check_index: int
    p_value_raw: float
    p_value_corrected: float
    significant: bool


def holm_bonferroni(p_values: list[float], alpha: float = 0.05) -> list[CorrectionResult]:
    """Standard Holm step-down procedure.

    Sorts ascending, corrected_p_i = max_{j<=i}( (m - j + 1) * p_(j) ),
    enforced monotone non-decreasing, capped at 1.0. Returns results in the
    ORIGINAL input order (check_index preserves the caller's ordering).
    """
    m = len(p_values)
    if m == 0:
        return []

    indexed = sorted(range(m), key=lambda i: p_values[i])
    corrected = [0.0] * m
    running_max = 0.0
    for rank, orig_idx in enumerate(indexed):  # rank is 0-based here
        raw = p_values[orig_idx]
        adjusted = (m - rank) * raw
        running_max = max(running_max, adjusted)
        corrected[orig_idx] = min(running_max, 1.0)

    return [
        CorrectionResult(
            check_index=i,
            p_value_raw=p_values[i],
            p_value_corrected=round(corrected[i], 6),
            significant=corrected[i] < alpha,
        )
        for i in range(m)
    ]


def benjamini_hochberg(p_values: list[float], alpha: float = 0.05) -> list[CorrectionResult]:
    """FDR control, offered as the less-conservative alternative the guide
    mentions. Not the default — see module docstring."""
    m = len(p_values)
    if m == 0:
        return []

    indexed = sorted(range(m), key=lambda i: p_values[i])
    corrected = [0.0] * m
    running_min = 1.0
    for rank in range(m - 1, -1, -1):  # walk from largest p to smallest
        orig_idx = indexed[rank]
        raw = p_values[orig_idx]
        adjusted = raw * m / (rank + 1)
        running_min = min(running_min, adjusted)
        corrected[orig_idx] = min(running_min, 1.0)

    return [
        CorrectionResult(
            check_index=i,
            p_value_raw=p_values[i],
            p_value_corrected=round(corrected[i], 6),
            significant=corrected[i] < alpha,
        )
        for i in range(m)
    ]
