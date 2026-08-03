"""
Maps a disease/diagnosis name (cases.disease) to a broad clinical domain, so
the dataset page can group "all cancer subtypes" together, etc.

This is a keyword classifier, not a medical ontology — it's meant to give a
reasonable default grouping for the dataset picker, not to be diagnostically
authoritative. If it misclassifies something in your real data, that's a
one-line fix below, not a sign anything deeper is broken.

Order matters: more specific / narrower categories are checked before
broader ones (e.g. specific rare-disease names are checked before the
generic "sclerosis" keyword, so Tuberous Sclerosis doesn't get bucketed
into Neurological just because Multiple Sclerosis also contains "sclerosis").
"""

DOMAIN_ORDER = [
    "Oncology",
    "Rare & Genetic Disease",
    "Cardiovascular",
    "Respiratory",
    "Renal",
    "Gastrointestinal",
    "Endocrine & Metabolic",
    "Rheumatology & Autoimmune",
    "Neurological",
    "Infectious Disease",
    "Other",
]

_DOMAIN_KEYWORDS = {
    "Oncology": [
        "cancer", "carcinoma", "leukemia", "leukaemia", "lymphoma",
        "tumor", "tumour", "sarcoma", "melanoma", "neoplasm", "oncology",
    ],
    "Rare & Genetic Disease": [
        "gaucher", "fabry", "wilson", "poems", "tuberous sclerosis",
        "ehlers-danlos", "ehlers danlos", "neuromyelitis", "behcet",
        "behçet", "still's disease", "still disease", "adult-onset still",
    ],
    "Cardiovascular": [
        "heart", "cardiac", "coronary", "atrial", "hypertension",
        "artery", "arterial", "thrombosis", "embolism", "stroke",
        "vascular", "cardio",
    ],
    "Respiratory": [
        "asthma", "copd", "pulmonary", "bronch", "tuberculosis",
        "lung", "influenza", " flu", "sleep apnea", "sleep apnoea", "respiratory",
    ],
    "Renal": ["kidney", "renal", "nephro"],
    "Gastrointestinal": [
        "bowel", "reflux", "ulcer", "pancreat", "gastro",
        "irritable bowel", "crohn", "colitis",
    ],
    "Endocrine & Metabolic": [
        "thyroid", "obesity", "metabolic syndrome", "cholesterol",
        "diabet", "lipid", "hypothyroid", "hyperthyroid",
    ],
    "Rheumatology & Autoimmune": [
        "arthritis", "lupus", "psoriasis", "psoriatic", "autoimmune",
    ],
    "Neurological": [
        "alzheimer", "parkinson", "epilep", "migraine", "sclerosis",
        "seizure", "amyotrophic", " als",
    ],
    "Infectious Disease": [
        "infection", "typhoid", "urinary tract", " uti", "sepsis", "malaria",
    ],
}


def classify_domain(disease_name: str | None) -> str:
    if not disease_name:
        return "Other"
    name = f" {disease_name.strip().lower()} "
    for domain in DOMAIN_ORDER:
        keywords = _DOMAIN_KEYWORDS.get(domain, [])
        if any(kw in name for kw in keywords):
            return domain
    return "Other"