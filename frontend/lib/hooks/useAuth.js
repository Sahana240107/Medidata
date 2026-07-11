import { useAuthStore } from "@/store/useAuthStore";

/**
 * useAuth — primary hook for auth state in components.
 *
 * Returns:
 *   user          — profile object or null
 *   token         — JWT string or null
 *   loading       — bool, true during login/register requests
 *   error         — last error message or null
 *   isAuthenticated — bool
 *   login(email, password) → { ok, error? }
 *   register(payload)      → { ok, error? }
 *   logout()
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const logout = useAuthStore((s) => s.logout);

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!token,
    login,
    register,
    logout,
  };
}