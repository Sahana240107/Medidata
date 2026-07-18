from app.tools import analytics_tools as t


def test_symptom_frequency_counts_and_percentages(patch_data_access):
    result = t.symptom_frequency("Behcet's Disease", top_n=5)

    assert result["disease"] == "Beh\u00e7et's Disease"
    assert result["case_count"] == 6
    assert result["low_confidence"] is False

    by_symptom = {s["symptom"]: s for s in result["symptoms"]}
    assert by_symptom["oral ulcers"]["case_count"] == 5
    assert by_symptom["oral ulcers"]["pct_of_cases"] == round(100 * 5 / 6, 1)


def test_symptom_frequency_fuzzy_disease_match(patch_data_access):
    # "Behcet" (no accent, no "disease") should still resolve
    result = t.symptom_frequency("Behcet")
    assert result["case_count"] == 6


def test_symptom_frequency_unknown_disease_returns_error(patch_data_access):
    result = t.symptom_frequency("Not A Real Disease Name")
    assert "error" in result
    assert "did_you_mean" in result


def test_country_distribution(patch_data_access):
    result = t.country_distribution("AOSD")
    assert result["case_count"] == 5
    top = result["countries"][0]
    assert top["country"] == "USA"
    assert top["case_count"] == 3


def test_age_distribution_approx_average(patch_data_access):
    result = t.age_distribution("AOSD")
    # buckets: 30-40 x2, 20-30 x2, 40-50 x1 -> midpoints 35,35,25,25,45
    assert result["approx_average_age"] == round((35 + 35 + 25 + 25 + 45) / 5, 1)


def test_outcome_stats_percentages(patch_data_access):
    result = t.outcome_stats("AOSD")
    outcomes = {o["outcome"]: o for o in result["outcomes"]}
    assert outcomes["recovered"]["case_count"] == 3
    assert outcomes["recovered"]["pct_of_cases"] == 60.0


def test_low_confidence_flag_trips_below_threshold(patch_data_access):
    result = t.symptom_frequency("Fabry Disease")
    assert result["case_count"] == 2
    assert result["low_confidence"] is True


def test_compare_diseases_shared_and_distinctive(patch_data_access):
    result = t.compare_diseases("Behcet's Disease", "AOSD")

    shared_symptoms = {e["symptom"] for e in result["shared_symptoms"]}
    assert "arthritis" in shared_symptoms  # both diseases have this
    assert "skin lesions" in shared_symptoms  # both diseases have this too

    only_a = {e["symptom"] for e in result["distinctive_to_disease_a"]}
    only_b = {e["symptom"] for e in result["distinctive_to_disease_b"]}
    assert "oral ulcers" in only_a
    assert "fever" in only_b
    # nothing should appear in both distinctive lists
    assert only_a.isdisjoint(only_b)


def test_diseases_that_mimic_ranks_by_overlap(patch_data_access):
    result = t.diseases_that_mimic("Behcet's Disease")
    diseases_ranked = [e["disease"] for e in result["similar_diseases"]]

    # AOSD shares arthritis + skin lesions with Behcet's; Fabry shares nothing
    assert "AOSD" in diseases_ranked
    assert "Fabry Disease" not in diseases_ranked  # no symptom overlap at all -> excluded


def test_compare_drug_outcomes_exact_match(patch_data_access):
    result = t.compare_drug_outcomes("AOSD", "steroids", "nsaids")
    assert result["drug_a"]["case_count"] == 3
    assert result["drug_b"]["case_count"] == 2
    # both groups are below MIN_CONFIDENT_CASE_COUNT (5) at this sample size
    assert result["drug_a"]["low_confidence"] is True
    assert result["drug_b"]["low_confidence"] is True


def test_compare_drug_outcomes_unknown_disease(patch_data_access):
    result = t.compare_drug_outcomes("Not Real", "a", "b")
    assert "error" in result
