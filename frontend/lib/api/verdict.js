/**
 * verdict.js — client for the Verdict Engine + Audit Pack.
 *
 * Talks directly to the FastAPI backend (NEXT_PUBLIC_API_URL), matching the
 * pattern used by cases.js / clisync.js. Previously this called relative
 * '/api/verdict/*' and '/api/audit-pack/*' paths, which would have hit the
 * Next.js app itself rather than the backend — fixed here.
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
 * @param {object} evidence - EvidenceInput shape
 * @param {object} falsification - FalsificationRunResult, as returned by runFalsification()
 */
export async function computeVerdict(evidence, falsification) {
  const res = await fetch(`${base()}/api/verdict/compute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evidence, falsification }),
  });
  return handleResponse(res);
}

export async function getVerdict(verdictId) {
  const res = await fetch(`${base()}/api/verdict/${verdictId}`, { cache: 'no-store' });
  return handleResponse(res);
}

export async function getAuditPack(verdictId) {
  const res = await fetch(`${base()}/api/audit-pack/${verdictId}`, { cache: 'no-store' });
  return handleResponse(res);
}

export function downloadAuditPackUrl(verdictId, format = 'json') {
  return `${base()}/api/audit-pack/${verdictId}/download?format=${format}`;
}
