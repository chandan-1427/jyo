import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { authMeKey, fetchAuthMe, type Profile } from "@/lib/queries/auth";

type AuthContextType = {
  user: Profile | null;
  loading: boolean;
  login: (user: Profile) => void;
  logout: () => Promise<void>;
  startDemo: () => Promise<void>;
  stopDemo: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading: loading } = useQuery({
    queryKey: authMeKey,
    queryFn: fetchAuthMe,
  });

  const login = (user: Profile) => {
    // Seed the cache synchronously so route guards see the logged-in user
    // right away, then refresh in the background to fill in full profile
    // fields the login response doesn't include (phone, locationText, etc).
    queryClient.setQueryData(authMeKey, user);
    queryClient.invalidateQueries({ queryKey: authMeKey });
  };

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    queryClient.setQueryData(authMeKey, null);
  };

  // Anyone can opt into a sandboxed demo session — see docs/demo-mode-plan.md.
  // Both re-seed the auth query directly (same pattern as login()) so the
  // Navbar/DemoBanner reflect the switch immediately, no extra round trip.
  // Posts/requests queries are keyed independently of auth state, so without
  // an explicit invalidation here they'd keep serving their pre-toggle
  // result until their own refetch interval happened to fire — the feed
  // wouldn't show demo content, or would keep showing it, for up to 15s.
  const startDemo = async () => {
    const res = await apiFetch("/auth/demo/start", { method: "POST" });
    queryClient.setQueryData(authMeKey, (prev: Profile | null | undefined) => ({
      ...prev,
      ...res.user,
      demoExpiresAt: res.demoExpiresAt,
    }));
    queryClient.invalidateQueries({ queryKey: ["posts"] });
    queryClient.invalidateQueries({ queryKey: ["requests"] });
  };

  const stopDemo = async () => {
    const res = await apiFetch("/auth/demo/stop", { method: "POST" });
    queryClient.setQueryData(authMeKey, (prev: Profile | null | undefined) => ({
      ...prev,
      ...res.user,
      demoExpiresAt: null,
    }));
    queryClient.invalidateQueries({ queryKey: ["posts"] });
    queryClient.invalidateQueries({ queryKey: ["requests"] });
  };

  return (
    <AuthContext.Provider value={{ user: user ?? null, loading, login, logout, startDemo, stopDemo }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook — never import AuthContext directly, always use this. The
// context+hook-in-one-file pattern is the standard idiom here; splitting
// useAuth into its own file just to satisfy Fast Refresh would only add
// import indirection everywhere it's used, for no real benefit.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}