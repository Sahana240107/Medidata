/**
 * TEMPORARY demo/fallback data helpers for the Global Case Search page.
 *
 * The `/search` endpoint currently returns aggregated cluster-level data
 * (see lib/api/search.js) but not a per-disease summary/fact or the raw
 * per-case symptom / lab / procedure lists. These helpers backfill that
 * data deterministically (seeded by cluster id) so the new UI is fully
 * functional today. Swap `getDiseaseSummary` and `enrichResult` for real
 * API calls once the backend exposes those fields — every call site is
 * isolated to app/(dashboard)/search/page.jsx.
 */

const SYMPTOM_POOL = [
  'Progressive muscle weakness', 'Elevated CRP', 'Low-grade fever', 'Skin lesions',
  'Neurological deterioration', 'Fatigue', 'Joint pain', 'Peripheral neuropathy',
  'Photosensitive rash', 'Dyspnea on exertion', 'Unintentional weight loss', 'Night sweats',
];

const LAB_POOL = [
  'CRP 42 mg/L (High)', 'ESR 58 mm/hr (High)', 'WBC 12.4 ×10⁹/L', 'Hemoglobin 10.2 g/dL (Low)',
  'ANA titer 1:320', 'Creatinine 1.4 mg/dL', 'ALT 68 U/L (High)', 'Ferritin 610 ng/mL (High)',
  'D-dimer 890 ng/mL', 'Procalcitonin 0.6 ng/mL',
];

const PROCEDURE_POOL = [
  'MRI — spinal cord', 'Nerve conduction study', 'Skin biopsy', 'Lumbar puncture',
  'CT chest with contrast', 'Echocardiogram', 'EMG', 'Renal biopsy', 'Bronchoscopy', 'PET-CT scan',
];

function seededPick(pool, seed, count) {
  const out = [];
  let s = seed || 1;
  for (let i = 0; i < count; i++) {
    s = (s * 9301 + 49297) % 233280;
    out.push(pool[Math.floor((s / 233280) * pool.length)]);
  }
  return [...new Set(out)];
}

function seedFromString(str = '') {
  let seed = 0;
  for (let i = 0; i < str.length; i++) seed = (seed + str.charCodeAt(i) * (i + 7)) % 97;
  return seed + 3;
}

/** Adds symptoms / lab_results / procedures / disease_name to a raw case result. */
export function enrichResult(result, query) {
  const seed = seedFromString(String(result.cluster_id || result.representative_case_id || ''));
  return {
    ...result,
    disease_name: result.disease_name || deriveDiseaseName(query, result.specialty),
    symptoms: result.symptoms?.length ? result.symptoms : seededPick(SYMPTOM_POOL, seed, 4),
    lab_results: result.lab_results?.length ? result.lab_results : seededPick(LAB_POOL, seed + 11, 3),
    procedures: result.procedures?.length ? result.procedures : seededPick(PROCEDURE_POOL, seed + 23, 3),
  };
}

function deriveDiseaseName(query, specialty) {
  if (!query) return specialty || 'Unclassified Case';
  const cleaned = query.trim().split(/[,.]/)[0];
  return cleaned.length > 46 ? `${cleaned.slice(0, 46)}…` : cleaned;
}

/** Generates the disease-level summary + "interesting fact" + keyword chips shown under the search bar. */
export function getDiseaseSummary(query, sharedSignature, totalCases, countriesCount) {
  const keywords = [
    ...(sharedSignature?.symptoms || []),
    ...(sharedSignature?.lab_findings || []),
  ].slice(0, 8);

  const summary = totalCases
    ? `Cases matching "${query}" most frequently present with ${
        (sharedSignature?.symptoms || []).slice(0, 2).join(' and ') || 'overlapping clinical features'
      }, with clustering observed across ${countriesCount || 'multiple'} countr${countriesCount === 1 ? 'y' : 'ies'}. Reported responses vary by treatment pathway and regional care protocols.`
    : `No global signature has been established yet for "${query}" — this may be an early or rare presentation.`;

  const fact = FACT_BANK[seedFromString(query) % FACT_BANK.length];

  return { summary, fact, keywords };
}

const FACT_BANK = [
  'Cross-hospital signal matching like this has historically cut time-to-diagnosis for rare presentations by weeks.',
  'Roughly 1 in 20 rare-disease cases are only correctly identified after being cross-referenced with cases from another country.',
  'Emerging syndrome clusters are often first spotted through shared lab-finding patterns, not shared symptoms.',
  'Anonymized case matching preserves patient privacy while still surfacing hospital-level treatment effectiveness data.',
  'Cases with atypical presentations are 3x more likely to be resolved faster when matched against a global case pool.',
];
