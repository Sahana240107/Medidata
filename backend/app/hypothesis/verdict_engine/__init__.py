"""
Verdict Engine — Member 2's second track.

decision_rules.py + scorecard.py, testable against two hand-written mock
inputs (an EvidenceInput shaped like Member 1's future output, and a real
FalsificationRunResult from this member's own falsification_engine) —
per the guide, fully buildable without waiting on Member 1.
"""
from .schemas import EvidenceInput, VerdictResult, Scorecard, AuditPack
from .service import compute_verdict

__all__ = ["EvidenceInput", "VerdictResult", "Scorecard", "AuditPack", "compute_verdict"]
