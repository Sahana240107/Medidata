import { apiFetch } from "./client";

/** Submit a new de-identified case. Backend embeds + indexes it in Qdrant too. */
export function createCase(payload) {
  return apiFetch("/cases", { method: "POST", body: payload });
}

export function listCases({ limit = 50, offset = 0 } = {}) {
  return apiFetch(`/cases?limit=${limit}&offset=${offset}`);
}

export function getCase(caseId) {
  return apiFetch(`/cases/${caseId}`);
}
