"""
Disease code -> human-readable name + clinical domain mapping.

Codes are the prefix of `fingerprint_id` (e.g. "BRC-US-4f9a1c2b91" -> "BRC").
Mapping was derived by inspecting clinical_notes_summary text for every code
present in the real cases table (61 codes, 1105 cases).

Any fingerprint_id prefix not found here falls back to the raw code as the
display name and "Other" as the domain, so new disease codes never crash
the grouping — they just show up ungrouped until added here.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class DiseaseInfo:
    code: str
    name: str
    domain: str


# domain buckets used for "group by domain" (e.g. all cancer types together)
DOMAIN_ONCOLOGY = "Oncology"
DOMAIN_CARDIOVASCULAR = "Cardiovascular"
DOMAIN_RESPIRATORY = "Respiratory"
DOMAIN_NEUROLOGICAL = "Neurological"
DOMAIN_INFECTIOUS = "Infectious Disease"
DOMAIN_ENDOCRINE = "Endocrine & Metabolic"
DOMAIN_GASTROINTESTINAL = "Gastrointestinal"
DOMAIN_RENAL = "Renal"
DOMAIN_AUTOIMMUNE = "Musculoskeletal & Autoimmune"
DOMAIN_RARE = "Rare & Genetic Disease"

DISEASE_MAP: dict[str, DiseaseInfo] = {
    # Oncology
    "LUC":  DiseaseInfo("LUC",  "Lung Cancer",              DOMAIN_ONCOLOGY),
    "BRC":  DiseaseInfo("BRC",  "Breast Cancer",             DOMAIN_ONCOLOGY),
    "CRC":  DiseaseInfo("CRC",  "Colorectal Cancer",         DOMAIN_ONCOLOGY),
    "PRC":  DiseaseInfo("PRC",  "Prostate Cancer",           DOMAIN_ONCOLOGY),
    "LEU":  DiseaseInfo("LEU",  "Leukemia",                  DOMAIN_ONCOLOGY),

    # Cardiovascular
    "HTN":  DiseaseInfo("HTN",  "Hypertension",              DOMAIN_CARDIOVASCULAR),
    "AFIB": DiseaseInfo("AFIB", "Atrial Fibrillation",       DOMAIN_CARDIOVASCULAR),
    "MI":   DiseaseInfo("MI",   "Myocardial Infarction",     DOMAIN_CARDIOVASCULAR),
    "CAD":  DiseaseInfo("CAD",  "Coronary Artery Disease",   DOMAIN_CARDIOVASCULAR),
    "PAD":  DiseaseInfo("PAD",  "Peripheral Artery Disease", DOMAIN_CARDIOVASCULAR),
    "HF":   DiseaseInfo("HF",   "Heart Failure",             DOMAIN_CARDIOVASCULAR),
    "DVT":  DiseaseInfo("DVT",  "Deep Vein Thrombosis",      DOMAIN_CARDIOVASCULAR),
    "PE":   DiseaseInfo("PE",   "Pulmonary Embolism",        DOMAIN_CARDIOVASCULAR),

    # Respiratory
    "AST":  DiseaseInfo("AST",  "Asthma",                    DOMAIN_RESPIRATORY),
    "ABR":  DiseaseInfo("ABR",  "Acute Bronchitis",           DOMAIN_RESPIRATORY),
    "COPD": DiseaseInfo("COPD", "COPD",                       DOMAIN_RESPIRATORY),
    "OSA":  DiseaseInfo("OSA",  "Obstructive Sleep Apnea",   DOMAIN_RESPIRATORY),

    # Neurological
    "EPI":  DiseaseInfo("EPI",  "Epilepsy",                  DOMAIN_NEUROLOGICAL),
    "MIG":  DiseaseInfo("MIG",  "Migraine",                  DOMAIN_NEUROLOGICAL),
    "PARK": DiseaseInfo("PARK", "Parkinson's Disease",       DOMAIN_NEUROLOGICAL),
    "ALZ":  DiseaseInfo("ALZ",  "Alzheimer's Disease",       DOMAIN_NEUROLOGICAL),
    "STR":  DiseaseInfo("STR",  "Stroke",                    DOMAIN_NEUROLOGICAL),
    "ALS":  DiseaseInfo("ALS",  "ALS",                       DOMAIN_NEUROLOGICAL),

    # Infectious disease
    "UTI":  DiseaseInfo("UTI",  "Urinary Tract Infection",   DOMAIN_INFECTIOUS),
    "TYPH": DiseaseInfo("TYPH", "Typhoid Fever",              DOMAIN_INFECTIOUS),
    "FLU":  DiseaseInfo("FLU",  "Influenza",                 DOMAIN_INFECTIOUS),
    "TB":   DiseaseInfo("TB",   "Tuberculosis",              DOMAIN_INFECTIOUS),

    # Endocrine & metabolic
    "HYPR": DiseaseInfo("HYPR", "Hyperthyroidism",           DOMAIN_ENDOCRINE),
    "HYPO": DiseaseInfo("HYPO", "Hypothyroidism",            DOMAIN_ENDOCRINE),
    "T2DM": DiseaseInfo("T2DM", "Type 2 Diabetes",           DOMAIN_ENDOCRINE),
    "T1DM": DiseaseInfo("T1DM", "Type 1 Diabetes",           DOMAIN_ENDOCRINE),
    "METS": DiseaseInfo("METS", "Metabolic Syndrome",        DOMAIN_ENDOCRINE),
    "OBES": DiseaseInfo("OBES", "Obesity",                   DOMAIN_ENDOCRINE),

    # Gastrointestinal
    "IBS":  DiseaseInfo("IBS",  "Irritable Bowel Syndrome",  DOMAIN_GASTROINTESTINAL),
    "GERD": DiseaseInfo("GERD", "GERD",                       DOMAIN_GASTROINTESTINAL),
    "CHOL": DiseaseInfo("CHOL", "Cholelithiasis",             DOMAIN_GASTROINTESTINAL),
    "PUD":  DiseaseInfo("PUD",  "Peptic Ulcer Disease",      DOMAIN_GASTROINTESTINAL),
    "APAN": DiseaseInfo("APAN", "Acute Pancreatitis",        DOMAIN_GASTROINTESTINAL),

    # Renal
    "CKD":  DiseaseInfo("CKD",  "Chronic Kidney Disease",    DOMAIN_RENAL),
    "NEPH": DiseaseInfo("NEPH", "Nephrolithiasis",            DOMAIN_RENAL),
    "AKI":  DiseaseInfo("AKI",  "Acute Kidney Injury",       DOMAIN_RENAL),

    # Musculoskeletal & autoimmune
    "RA":   DiseaseInfo("RA",   "Rheumatoid Arthritis",      DOMAIN_AUTOIMMUNE),
    "PSA":  DiseaseInfo("PSA",  "Psoriatic Arthritis",        DOMAIN_AUTOIMMUNE),
    "PSO":  DiseaseInfo("PSO",  "Psoriasis",                 DOMAIN_AUTOIMMUNE),
    "SLE":  DiseaseInfo("SLE",  "Lupus (SLE)",                DOMAIN_AUTOIMMUNE),
    "AOSD": DiseaseInfo("AOSD", "Adult-Onset Still's Disease", DOMAIN_AUTOIMMUNE),

    # Rare & genetic disease
    "BEH":  DiseaseInfo("BEH",  "Behcet's Disease",          DOMAIN_RARE),
    "NMO":  DiseaseInfo("NMO",  "Neuromyelitis Optica",      DOMAIN_RARE),
    "GAU":  DiseaseInfo("GAU",  "Gaucher Disease",           DOMAIN_RARE),
    "WIL":  DiseaseInfo("WIL",  "Wilson Disease",             DOMAIN_RARE),
    "EDS":  DiseaseInfo("EDS",  "Ehlers-Danlos Syndrome",    DOMAIN_RARE),
    "POM":  DiseaseInfo("POM",  "Pompe Disease",             DOMAIN_RARE),
    "FAB":  DiseaseInfo("FAB",  "Fabry Disease",             DOMAIN_RARE),
    "TSC":  DiseaseInfo("TSC",  "Tuberous Sclerosis Complex", DOMAIN_RARE),
}


def get_disease_code(fingerprint_id: str) -> str:
    """Extract the disease code prefix from a fingerprint_id like 'BRC-US-4f9a1c2b91'."""
    if not fingerprint_id:
        return "UNKNOWN"
    return fingerprint_id.split("-")[0]


def get_disease_info(fingerprint_id: str) -> DiseaseInfo:
    code = get_disease_code(fingerprint_id)
    return DISEASE_MAP.get(code, DiseaseInfo(code, code, "Other"))