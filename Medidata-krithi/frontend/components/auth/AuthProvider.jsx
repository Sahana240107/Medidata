"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * Wrap your root layout children with this.
 * On mount it silently refreshes the Supabase session so the stored
 * access_token is always fresh before any API call is made.
 *
 * Usage in app/layout.jsx:
 *   import AuthProvider from "@/components/AuthProvider";
 *   ...
 *   <AuthProvider>{children}</AuthProvider>
 */
export default function AuthProvider({ children }) {
  const refreshSession = useAuthStore((state) => state.refreshSession);

  useEffect(() => {
    refreshSession();
  }, []);

  return children;
}