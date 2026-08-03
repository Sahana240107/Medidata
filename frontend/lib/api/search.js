"use client";

import { apiFetch } from "./client";

/**
 * Runs a case search against POST /search.
 * @param {object} params
 * @param {string} params.query
 * @param {string[]} [params.regions]
 * @param {string[]} [params.specialties]
 * @param {string[]} [params.outcomes]
 * @param {string[]} [params.confidenceTiers]
 * @param {number} [params.limit]
 */
export function searchCases({
  query,
  regions,
  specialties,
  outcomes,
  confidenceTiers,
  limit = 10,
} = {}) {
  return apiFetch("/search", {
    method: "POST",
    body: {
      query,
      result_type: "all",
      regions: regions && regions.length ? regions : null,
      specialties: specialties && specialties.length ? specialties : null,
      outcomes: outcomes && outcomes.length ? outcomes : null,
      confidence_tiers: confidenceTiers && confidenceTiers.length ? confidenceTiers : null,
      limit,
    },
  });
}