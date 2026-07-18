"use client";

import { apiFetch } from "./client";
import { useAuthStore } from "@/store/useAuthStore";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

/** Diseases + domains + locations, all with real counts — powers every grouping mode. */
export function getDiseaseCatalog() {
  return apiFetch("/research/datasets/catalog");
}

function buildParams({ disease, domain, location, gender, ageRange } = {}) {
  const params = new URLSearchParams();
  if (disease) params.set("disease", disease);
  if (domain) params.set("domain", domain);
  if (location) params.set("location", location);
  if (gender) params.set("gender", gender);
  if (ageRange) params.set("age_range", ageRange);
  return params;
}

/** Live totals for the current filter selection (the summary bar). */
export function getDatasetSummary(filters = {}) {
  const qs = buildParams(filters).toString();
  return apiFetch(`/research/datasets/summary${qs ? `?${qs}` : ""}`);
}

/**
 * Downloads the filtered dataset as CSV or XLSX. Uses a raw fetch (not
 * apiFetch) because the response is a file, not JSON — apiFetch always
 * calls res.json(), which would fail on a binary/CSV body.
 */
export async function downloadDataset({ disease, domain, location, gender, ageRange, format = "csv" } = {}) {
  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_URL is not set — see frontend/.env.local.example.");
  }

  const params = buildParams({ disease, domain, location, gender, ageRange });
  params.set("format", format);

  const token = useAuthStore.getState().token;

  const res = await fetch(`${API_BASE}/research/datasets/export?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Export failed (${res.status})`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : `medidata_dataset.${format}`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);

  return filename;
}

/** Triggers a PostgREST schema-cache reload — use after any DB migration. */
export function reloadSchemaCache() {
  return apiFetch("/research/datasets/reload-schema-cache", { method: "POST" });
}