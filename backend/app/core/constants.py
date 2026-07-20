"""
Shared constants.
"""

# Fixed demo hospital ("Node") IDs — also seeded into the real `hospitals`
# table by supabase/seed/002_node_simulator.sql. Used as a fallback node
# registry so the Multi-Node Simulator still works in an environment where
# that seed script hasn't been run yet.
DEMO_NODES = [
    {
        "id": "a1000000-0000-4000-8000-000000000001",
        "name": "Apex General Hospital",
        "city": "Chennai",
        "country": "India",
    },
    {
        "id": "a1000000-0000-4000-8000-000000000002",
        "name": "Riverside Medical Center",
        "city": "Nairobi",
        "country": "Kenya",
    },
    {
        "id": "a1000000-0000-4000-8000-000000000003",
        "name": "Meridian Health Institute",
        "city": "Manila",
        "country": "Philippines",
    },
]

# Minimum local cohort size a node will release even an aggregate count for.
# Below this, releasing a count risks re-identification within a small node
# (e.g. "1 matching case" at a small hospital is often as identifying as a
# row-level record). Used by the cross-node discovery broker.
K_ANONYMITY_RELEASE_THRESHOLD = 3