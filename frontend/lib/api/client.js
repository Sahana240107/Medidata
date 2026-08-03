"use client";

import { useAuthStore } from "@/store/useAuthStore";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

/**
 * Shared fetch wrapper: attaches the Supabase bearer token from the auth
 * store, JSON-encodes the body, and throws a readable Error on failure.
 */
export async function apiFetch(path, { method = "GET", body, headers = {}, ...rest } = {}) {
  const token = useAuthStore.getState().token;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = data?.detail || data?.message || `Request failed (${res.status})`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return data;
}
