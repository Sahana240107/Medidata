/**
 * cliSync.js — API helpers for the CLI-sync surface of the web app.
 *
 * The web app never pushes cases itself and never runs an in-browser
 * approval step — that would require the browser to execute a local
 * process on the doctor's machine, which no browser allows. The actual
 * fetch -> anonymize -> preview -> approve -> upload flow (Phases 4-11 of
 * the CLI implementation guide) runs entirely in the doctor's terminal via
 * `medidata sync`, including the Y/N approval gate, before anything is
 * even sent to the backend.
 *
 * All this file does is read back the audit trail of what already
 * happened, from `cli_sync_logs` (written by POST /api/cli/sync after a
 * successful CLI-approved sync) — so the web app can show "yes, that sync
 * went through" without ever handling case data itself.
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

export async function getSyncHistory(token, { limit = 20 } = {}) {
  const res = await fetch(`${base()}/api/cli/sync/history?limit=${limit}`, {
    headers: authHeaders(token),
  });
  return handleResponse(res);
}