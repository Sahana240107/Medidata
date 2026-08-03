"""
CLI entrypoint for the discovery scan — run manually or on a cron/scheduled
task (see app/tasks/scheduler.py). The same logic is exposed as
POST /feed/scan for an on-demand "Run Discovery Scan" button in the UI.

Usage (from backend/):
    python -m scripts.run_discovery_scan
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.clustering_service import run_discovery_scan


async def main():
    result = await run_discovery_scan()
    print(f"Cases scanned:   {result['cases_scanned']}")
    print(f"Clusters found:  {result['clusters_found']}")
    print(f"Signals created: {result['signals_created']}")
    print(f"Signals updated: {result['signals_updated']}")


if __name__ == "__main__":
    asyncio.run(main())