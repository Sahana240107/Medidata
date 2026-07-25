/**
 * falsification.js — client for the Falsification Engine.
 *
 * Talks directly to the FastAPI backend (NEXT_PUBLIC_API_URL), matching the
 * pattern used by cases.js / clisync.js. Previously this called relative
 * '/api/falsification/*' paths, which would have hit the Next.js app itself
 * rather than the backend — fixed here.
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

/**
 * Runs a falsification check for a cohort definition.
 * @param {object} filters - CohortFilters shape: disease/domain,
 *   intervention_medication (required), control_medication?, country?,
 *   hospital?, sex?, age_range?, min_arm_size?
 */
export async function runFalsification(filters) {
  const res = await fetch(`${base()}/api/falsification/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters),
  });
  return handleResponse(res);
}

export async function getFalsificationRun(runId) {
  const res = await fetch(`${base()}/api/falsification/checks/${runId}`, { cache: 'no-store' });
  return handleResponse(res);
}
