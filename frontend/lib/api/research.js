/**
 * research.js — client for Member 1's Evidence Discovery Engine and
 * Cross-Dataset Discovery endpoints.
 *
 * Talks directly to the FastAPI backend (NEXT_PUBLIC_API_URL), matching the
 * pattern used by falsification.js / verdict.js / cases.js.
 */
const base = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function handleResponse(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.detail || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ─── Evidence Discovery Engine ──────────────────────────────────────────────

/**
 * Parses a free-text hypothesis question into a CohortFilters object.
 * @param {string} question
 */
export async function parseEvidenceQuestion(question) {
  const res = await fetch(`${base()}/api/evidence/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  return handleResponse(res);
}

/**
 * CohortFilters -> intervention/control case ID lists.
 * @param {object} filters - disease/domain, intervention_medication (required),
 *   control_medication?, country?, hospital_id?, sex?, age_range?, min_arm_size?
 */
export async function buildEvidenceCohort(filters) {
  const res = await fetch(`${base()}/api/evidence/build-cohort`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters),
  });
  return handleResponse(res);
}

/**
 * Case ID lists -> odds ratio, CI, p-value.
 * @param {{intervention_ids: string[], control_ids: string[], min_arm_size?: number}} body
 */
export async function computeEvidence(body) {
  const res = await fetch(`${base()}/api/evidence/compute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

/**
 * Convenience: question OR filters -> full pipeline result in one call.
 * @param {{question?: string, filters?: object}} body
 */
export async function runEvidenceEngine(body) {
  const res = await fetch(`${base()}/api/evidence/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function getEvidenceRun(runId) {
  const res = await fetch(`${base()}/api/evidence/run/${runId}`, { cache: 'no-store' });
  return handleResponse(res);
}

// ─── Cross-Dataset Discovery ─────────────────────────────────────────────────

/**
 * Compares two or more disease/domain groups for shared symptom/lab/
 * medication patterns.
 * @param {{datasets: Array<{disease?: string, domain?: string, country?: string, label?: string}>,
 *   field_types?: string[], top_n?: number, min_datasets_sharing?: number}} body
 */
export async function compareDatasets(body) {
  const res = await fetch(`${base()}/api/cross-dataset/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

/**
 * Ranked list of every cross-dataset pattern surfaced so far.
 * @param {number} [limit=50]
 */
export async function getCrossDatasetDiscoveries(limit = 50) {
  const res = await fetch(`${base()}/api/cross-dataset/discoveries?limit=${limit}`, {
    cache: 'no-store',
  });
  return handleResponse(res);
}