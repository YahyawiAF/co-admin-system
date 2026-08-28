"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import {
  clearSessionExpiredCallback,
  clearTokenRefreshCallback,
  setSessionExpiredCallback,
  setTokenRefreshCallback,
} from "@/lib/api/httpClient";
import type { User } from "@/lib/types";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signup: (data: {
    identifier: string;
    password: string;
    fullname: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const persistUser = useCallback((next: User) => {
    setUser(next);
    localStorage.setItem("user", JSON.stringify(next));
    authApi.storeTokens(next.accessToken, next.refreshToken);
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      const refreshToken = authApi.getStoredRefreshToken();
      if (!refreshToken) return null;
      if (!force && authApi.getStoredToken()) return authApi.getStoredToken();
      try {
        const next = await authApi.refresh(refreshToken);
        persistUser(next);
        return next.accessToken;
      } catch {
        authApi.clearTokens();
        setUser(null);
        return null;
      }
    },
    [persistUser]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      const token = authApi.getStoredToken();
      if (raw && token) setUser(JSON.parse(raw) as User);
    } catch {
      authApi.clearTokens();
    } finally {
      setIsLoading(false);
    }

    setTokenRefreshCallback(refresh);
    setSessionExpiredCallback(() => {
      authApi.clearTokens();
      setUser(null);
      router.replace("/login");
    });

    return () => {
      clearTokenRefreshCallback();
      clearSessionExpiredCallback();
    };
  }, [refresh, router]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const next = await authApi.login(identifier, password);
      persistUser(next);
    },
    [persistUser]
  );

  const signup = useCallback(
    async (data: {
      identifier: string;
      password: string;
      fullname: string;
    }) => {
      const next = await authApi.signup(data);
      persistUser(next);
    },
    [persistUser]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    authApi.clearTokens();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user && !!authApi.getStoredToken(),
      login,
      signup,
      logout,
    }),
    [user, isLoading, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
