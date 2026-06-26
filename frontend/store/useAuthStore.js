import { create } from "zustand";
import { persist } from "zustand/middleware";

const API = process.env.NEXT_PUBLIC_API_URL;

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: false,
      error: null,

      setAuth: (token, user) => {
        // Also set cookie so middleware can read it (JS-accessible cookie)
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

      logout: () => {
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