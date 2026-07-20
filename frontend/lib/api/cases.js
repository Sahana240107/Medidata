/**
 * cases.js — read-only API helpers for viewing cases.
 *
 * Case ingestion now happens exclusively through the MediData CLI
 * (`medidata sync`, which posts to /api/cli/sync after running its own
 * local privacy pipeline). The web app no longer creates cases — no PDF
 * autofill, no manual entry form, no preview/confirm step — it only
 * displays what the CLI has already synced in.
 */

const base = () => process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function handleResponse(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

function authHeaders(token) {
  if (!token) throw new Error("Not authenticated. Please log in and try again.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function listCases(token, { limit = 50, offset = 0 } = {}) {
  const res = await fetch(`${base()}/cases?limit=${limit}&offset=${offset}`, {
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function getCase(caseId, token) {
  const res = await fetch(`${base()}/cases/${caseId}`, {
    headers: authHeaders(token),
  });
  return handleResponse(res);
}