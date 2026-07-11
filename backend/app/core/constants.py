"""
Shared constants for the research chat / analytics tool layer.
"""

# -- Guardrails ---------------------------------------------------------------
# Below this many matching cases, tools still return the numbers but flag
# `low_confidence: true` so the agent is instructed to caveat the answer
# instead of stating it as a confident pattern.
MIN_CONFIDENT_CASE_COUNT = 5

# Hard cap on how many tool-call round-trips the agent loop can make while
# answering a single user turn. Prevents runaway loops if the model keeps
# calling tools without converging on an answer.
MAX_TOOL_ITERATIONS = 6

# Standard caveat appended to every chat answer. The agent is instructed to
# include this itself, but the service layer also stamps it defensively.
DATASET_CAVEAT = (
    "This reflects patterns in MediData's de-identified case dataset only - "
    "it is not clinical guidance and should not be used to diagnose or treat "
    "a patient."
)

# -- Analytics tool tuning ------------------------------------------------------
DEFAULT_TOP_N_SYMPTOMS = 10
DEFAULT_MIMIC_TOP_N = 5
DEFAULT_EVIDENCE_TOP_K = 10

# Rough midpoints used to approximate an "average age" from bucketed
# age_range strings like "30-40" -- cases never store exact DOB/age.
AGE_BUCKET_MIDPOINTS = {
    "0-10": 5, "10-20": 15, "20-30": 25, "30-40": 35, "40-50": 45,
    "50-60": 55, "60-70": 65, "70-80": 75, "80-90": 85, "90-100": 95,
}

# In-memory cache TTL (seconds) for the disease list and the disease x
# symptom-frequency matrix used by compare/mimic tools. Rebuilding this on
# every call would mean scanning the full `cases` table each time.
PRECOMPUTE_CACHE_TTL_SECONDS = 600
