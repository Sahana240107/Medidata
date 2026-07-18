import { apiFetch } from "./client";

/**
 * Experts directory — filterable list, filter options, detail, and the
 * Network Activity table used on the Experts page.
 */

export function listExperts({
  specialty = null,
  country = null,
  verificationStatus = null,
  search = null,
  sort = "cases",
  limit = 24,
  offset = 0,
} = {}) {
  const params = new URLSearchParams();
  params.set("sort", sort);
  params.set("limit", limit);
  params.set("offset", offset);
  if (specialty) params.set("specialty", specialty);
  if (country) params.set("country", country);
  if (verificationStatus) params.set("verification_status", verificationStatus);
  if (search) params.set("search", search);
  return apiFetch(`/experts?${params.toString()}`);
}

export function getExpertFilters() {
  return apiFetch(`/experts/filters`);
}

export function getNetworkActivity(limit = 10) {
  return apiFetch(`/experts/network-activity?limit=${limit}`);
}

export function getExpert(expertId) {
  return apiFetch(`/experts/${expertId}`);
}