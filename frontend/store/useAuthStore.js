import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createClient } from "@supabase/supabase-js";

const API = process.env.NEXT_PUBLIC_API_URL;

// Supabase client — used only for session refresh
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: false,
      error: null,

      setAuth: (token, user) => {
        if (typeof document !== "undefined") {
          document.cookie = `medidata_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        }
        set({ token, user, error: null });
      },

      clearAuth: () => {
        if (typeof document !== "undefined") {
          document.cookie = "medidata_token=; path=/; max-age=0";
        }
        set({ token: null, user: null, error: null });
      },

      /**
       * Call once on app mount (e.g. in your root layout or an AuthProvider).
       * Asks Supabase for a fresh access_token using the stored session.
       * If the session is gone or expired, clears auth so the user hits the login page.
       */
      refreshSession: async () => {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error || !data?.session) {
            get().clearAuth();
            return;
          }
          const { access_token, user } = data.session;
          get().setAuth(access_token, user);
        } catch {
          get().clearAuth();
        }
      },

      login: async (email, password) => {
        set({ loading: true, error: null });
        try {
          const res = await fetch(`${API}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || "Login failed.");
          get().setAuth(data.access_token, data.user);
          return { ok: true };
        } catch (err) {
          set({ error: err.message });
          return { ok: false, error: err.message };
        } finally {
          set({ loading: false });
        }
      },

      register: async (payload) => {
        set({ loading: true, error: null });
        try {
          const res = await fetch(`${API}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || "Registration failed.");
          get().setAuth(data.access_token, data.user);
          return { ok: true };
        } catch (err) {
          set({ error: err.message });
          return { ok: false, error: err.message };
        } finally {
          set({ loading: false });
        }
      },

      logout: async () => {
        await supabase.auth.signOut();
        get().clearAuth();
      },

      isAuthenticated: () => !!get().token,
    }),
    {
      name: "medidata-auth",
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);