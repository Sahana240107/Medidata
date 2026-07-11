/**
 * cases.js — API helpers for the case intake flow.
 *
 * Three-step happy path:
 *   1. extractPdf(file)          → raw extracted fields for autofill
 *   2. processCase(raw)          → de-identified fingerprint for preview
 *   3. submitCase(fingerprint, token_H) → persisted CaseRead
 *
 * Legacy one-shot:
 *   createCase(payload)          → persisted CaseRead (no preview step)
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

// ── Step 1 — Extract PDF ──────────────────────────────────────────────────────

/**
 * Upload a PDF discharge summary.
 * Returns { extracted: { name, dob, sex, address, patient_id, ... } }
 * No auth required.
 */
export async function extractPdf(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${base()}/cases/extract-pdf`, {
    method: "POST",
    body: fd,
  });
  return handleResponse(res);
}

// ── Step 2 — Process (privacy pipeline) ──────────────────────────────────────

/**
 * Run the 6-layer privacy pipeline on raw extracted data.
 * Returns { fingerprint, token_H, layers_applied }
 * Requires auth token.
 */
export async function processCase(raw, token) {
  const res = await fetch(`${base()}/cases/process`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ raw }),
  });
  return handleResponse(res);
}

// ── Step 3 — Submit confirmed fingerprint ────────────────────────────────────

/**
 * Persist the fingerprint after the doctor confirms the preview.
 * Returns the full CaseRead row.
 * Requires auth token.
 */
export async function submitCase(fingerprint, token_H, token) {
  const res = await fetch(`${base()}/cases/submit`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ fingerprint, token_H }),
  });
  return handleResponse(res);
}

// ── Legacy one-shot ───────────────────────────────────────────────────────────

/**
 * Create a de-identified case in a single call (no preview step).
 * Requires auth token.
 */
export async function createCase(payload, token) {
  const res = await fetch(`${base()}/cases`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

// ── Read helpers ──────────────────────────────────────────────────────────────

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