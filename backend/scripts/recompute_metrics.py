"""
Standalone entry point for recomputing every hospital's metrics and
global rank from live Supabase data.

Run manually:
    python -m backend.scripts.recompute_metrics

Or on a schedule (e.g. a cron job / Supabase scheduled function every
15-30 minutes) so ranks stay fresh across hospitals nobody has opened
the Insights page for recently. Hospitals that ARE being actively
viewed already self-heal on page load — see
hospital_service.get_hospital_insights — so this script mainly exists
to keep the leaderboard fair for everyone else.
"""

import sys
from pathlib import Path

# Make sure `backend/` (the parent of this scripts/ folder, and the
# folder that contains the `app` package) is on sys.path. Without this,
# running the script directly — e.g. `py scripts/recompute_metrics.py`
# from inside backend/, or via an absolute/relative path on Windows —
# only puts scripts/ itself on sys.path, and `from app...` imports
# either fail outright or (if `app` resolves to something else on the
# path) fail confusingly deep inside a function, like a NameError on
# get_supabase_admin.
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

try:
    # This script runs outside your normal FastAPI startup, so if
    # SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are normally loaded from a
    # .env file there (via python-dotenv), load it here too. Safe no-op
    # if python-dotenv isn't installed or there's no .env file.
    from dotenv import load_dotenv
    load_dotenv(BACKEND_ROOT / ".env")
except ImportError:
    pass

from app.services.metrics_service import recompute_all_hospital_metrics  # noqa: E402


def main():
    results = recompute_all_hospital_metrics()
    print(f"Recomputed metrics for {len(results)} hospital(s):")
    for r in sorted(results, key=lambda m: m["global_rank"]):
        print(
            f"  #{r['global_rank']:<3} hospital_id={r['hospital_id']} "
            f"discovery_score={r['discovery_score']:<6} "
            f"cases={r['case_count']:<5} "
            f"discoveries={r['disease_discoveries']} "
            f"collaborations={r['published_collaborations']}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
