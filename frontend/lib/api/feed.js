import { apiFetch } from "./client";

/**
 * Paginated, filterable discovery feed — used by the /feed page.
 * Returns { items: [...], total: number }.
 */
export function listFeed({ limit = 12, offset = 0, signalType = null, sort = "recent", status = null } = {}) {
  const params = new URLSearchParams();
  params.set("limit", limit);
  params.set("offset", offset);
  if (signalType) params.set("signal_type", signalType);
  if (sort) params.set("sort", sort);
  if (status) params.set("status", status);
  return apiFetch(`/feed/signals?${params.toString()}`);
}

/** Single signal, for the /feed/[signalId] detail page. */
export function getFeedItem(signalId) {
  return apiFetch(`/feed/signals/${signalId}`);
}

/** Top N signals by confidence — used by the dashboard's Discovery Feed cards. */
export async function fetchSignals(limit = 4) {
  const { items } = await listFeed({ limit, sort: "confidence" });
  return items;
}

/** The 4 top stat cards on the dashboard. */
export function fetchStats() {
  return apiFetch(`/feed/stats`);
}

/** Runs the clustering pipeline on-demand — embeds every active case,
 * clusters them, and writes real research_signals rows. */
export function triggerScan() {
  return apiFetch(`/feed/scan`, { method: "POST" });
}