/**
 * localCli.js — API helpers for the CLI's LOCAL server (`medidata serve`).
 *
 * This talks to http://127.0.0.1:<port> — a process running on the
 * doctor's own machine, NOT the MediData backend. It's what lets the
 * Setup and Submit Cases pages drive login / MySQL connect / doctor
 * mapping / sync preview / sync approve from the browser instead of
 * typed terminal commands, while all the raw-data handling still
 * happens locally (see medidata/local_server.py's docstring).
 *
 * Every call here can fail with a network error if `medidata serve`
 * isn't running — callers should treat that as "not connected yet",
 * not as a generic error.
 */

export const CLI_LOCAL_URL =
  process.env.NEXT_PUBLIC_CLI_LOCAL_URL || "http://127.0.0.1:8787";

class LocalCliUnreachableError extends Error {
  constructor(message) {
    super(message);
    this.name = "LocalCliUnreachableError";
    this.unreachable = true;
  }
}

async function request(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`${CLI_LOCAL_URL}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new LocalCliUnreachableError(
      "Can't reach the MediData CLI on this machine. Make sure you've run `medidata serve` in a terminal."
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Request to CLI failed (${res.status})`);
  }
  return data;
}

// ── health / status ────────────────────────────────────────────────────

export const isCliReachable = () =>
  request("/health").then(() => true).catch(() => false);

export const getSetupStatus = () => request("/setup/status");

// ── setup steps ─────────────────────────────────────────────────────────

export const cliLogin = ({ email, password, base_url }) =>
  request("/setup/login", { method: "POST", body: { email, password, base_url } });

export const cliSetMysql = ({ host, port, database, user, password, doctors_table }) =>
  request("/setup/mysql", { method: "POST", body: { host, port, database, user, password, doctors_table } });

export const cliListDoctors = () => request("/setup/doctors");

export const cliMapDoctor = (local_doctor_id) =>
  request("/setup/map-doctor", { method: "POST", body: { local_doctor_id: String(local_doctor_id) } });

// ── sync: preview / approve ──────────────────────────────────────────────

export const cliSyncPreview = ({ mapping_path = "mapping.yaml", limit, k } = {}) =>
  request("/sync/preview", { method: "POST", body: { mapping_path, ...(limit ? { limit } : {}), ...(k ? { k } : {}) } });

export const cliSyncApprove = ({ batch_id, approve }) =>
  request("/sync/approve", { method: "POST", body: { batch_id, approve } });

export const cliSyncHistory = (limit = 20) => request(`/sync/history?limit=${limit}`);

export { LocalCliUnreachableError };
