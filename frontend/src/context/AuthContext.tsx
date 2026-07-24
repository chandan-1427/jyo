import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { authMeKey, fetchAuthMe, type Profile } from "@/lib/queries/auth";

type AuthContextType = {
  user: Profile | null;
  loading: boolean;
  login: (user: Profile) => void;
  logout: () => Promise<void>;
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

  return (
    <AuthContext.Provider value={{ user: user ?? null, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook — never import AuthContext directly, always use this
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}