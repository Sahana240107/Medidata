"""
Shared pytest fixtures.

FAKE_CASES is a small, hand-built dataset covering the scenarios the
analytics tools need to handle correctly: two diseases with overlapping
symptoms (for compare_diseases / diseases_that_mimic), a disease with
< MIN_CONFIDENT_CASE_COUNT cases (for the low_confidence guardrail), and
mixed symptom/medication jsonb shapes (plain strings vs. dicts).
"""

import pytest

FAKE_CASES = [
    # Behcet's disease — 6 cases, symptom dicts shape
    {"id": "b1", "disease": "Beh\u00e7et's Disease", "symptoms": [{"name": "oral ulcers"}, {"name": "genital ulcers"}, {"name": "uveitis"}],
     "medications": [{"name": "colchicine"}], "country": "Turkey", "age_range": "20-30", "outcome": "recovered"},
    {"id": "b2", "disease": "Beh\u00e7et's Disease", "symptoms": [{"name": "oral ulcers"}, {"name": "skin lesions"}],
     "medications": [{"name": "colchicine"}], "country": "Turkey", "age_range": "30-40", "outcome": "unresolved"},
    {"id": "b3", "disease": "Beh\u00e7et's Disease", "symptoms": [{"name": "oral ulcers"}, {"name": "uveitis"}, {"name": "arthritis"}],
     "medications": [{"name": "azathioprine"}], "country": "Japan", "age_range": "20-30", "outcome": "recovered"},
    {"id": "b4", "disease": "Beh\u00e7et's Disease", "symptoms": [{"name": "genital ulcers"}, {"name": "arthritis"}],
     "medications": [{"name": "azathioprine"}], "country": "Iran", "age_range": "30-40", "outcome": "deteriorated"},
    {"id": "b5", "disease": "Beh\u00e7et's Disease", "symptoms": [{"name": "oral ulcers"}, {"name": "skin lesions"}, {"name": "arthritis"}],
     "medications": [{"name": "colchicine"}], "country": "Turkey", "age_range": "40-50", "outcome": "recovered"},
    {"id": "b6", "disease": "Beh\u00e7et's Disease", "symptoms": [{"name": "uveitis"}, {"name": "oral ulcers"}],
     "medications": [{"name": "azathioprine"}], "country": "Japan", "age_range": "20-30", "outcome": "recovered"},

    # AOSD — 5 cases, plain-string symptom shape, overlaps arthritis/skin lesions with Behcet's
    {"id": "a1", "disease": "AOSD", "symptoms": ["fever", "salmon rash", "arthritis"],
     "medications": ["nsaids"], "country": "USA", "age_range": "30-40", "outcome": "recovered"},
    {"id": "a2", "disease": "AOSD", "symptoms": ["fever", "arthritis", "sore throat"],
     "medications": ["steroids"], "country": "USA", "age_range": "20-30", "outcome": "unresolved"},
    {"id": "a3", "disease": "AOSD", "symptoms": ["fever", "salmon rash"],
     "medications": ["steroids"], "country": "France", "age_range": "30-40", "outcome": "recovered"},
    {"id": "a4", "disease": "AOSD", "symptoms": ["arthritis", "skin lesions"],
     "medications": ["nsaids"], "country": "France", "age_range": "40-50", "outcome": "deteriorated"},
    {"id": "a5", "disease": "AOSD", "symptoms": ["fever", "arthritis"],
     "medications": ["steroids"], "country": "USA", "age_range": "20-30", "outcome": "recovered"},

    # Fabry disease — only 2 cases, should trip low_confidence
    {"id": "f1", "disease": "Fabry Disease", "symptoms": [{"name": "angiokeratoma"}, {"name": "neuropathic pain"}],
     "medications": [], "country": "Brazil", "age_range": "10-20", "outcome": "unresolved"},
    {"id": "f2", "disease": "Fabry Disease", "symptoms": [{"name": "angiokeratoma"}],
     "medications": [], "country": "Brazil", "age_range": "20-30", "outcome": "recovered"},
]


@pytest.fixture
def fake_cases():
    return [dict(c) for c in FAKE_CASES]


@pytest.fixture
def patch_data_access(monkeypatch, fake_cases):
    """
    Monkeypatches app.tools.data_access's Supabase-backed functions to run
    entirely against FAKE_CASES, so analytics_tools tests don't need a real
    Supabase connection.
    """
    from app.tools import data_access as da

    def fake_fetch_cases_for_disease(disease):
        return [c for c in fake_cases if c["disease"].lower() == disease.lower()]

    def fake_get_all_disease_names(force_refresh=False):
        return sorted({c["disease"] for c in fake_cases})

    monkeypatch.setattr(da, "fetch_cases_for_disease", fake_fetch_cases_for_disease)
    monkeypatch.setattr(da, "get_all_disease_names", fake_get_all_disease_names)
    # bust the matrix cache so it recomputes from fake_cases each test
    monkeypatch.setattr(da, "_matrix_cache", {"matrix": None, "fetched_at": 0.0, "case_counts": None})
    monkeypatch.setattr(da, "_disease_cache", {"names": None, "fetched_at": 0.0})

    def fake_fetch_all(select="", eq_filters=None):
        return fake_cases

    monkeypatch.setattr(da, "_fetch_all", fake_fetch_all)

    return da
