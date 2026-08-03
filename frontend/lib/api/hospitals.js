"use client";

import { apiFetch } from "./client";

/**
 * Fetches the Hospital Insights payload: a network-wide overview
 * (all hospitals), a leaderboard placement, a country footprint, and —
 * scoped to the caller's own hospital — its stats, achievements, and
 * recent activity. Backed by GET /hospitals/insights/me.
 */
export function getHospitalInsights() {
  return apiFetch("/hospitals/insights/me", { method: "GET" });
}
