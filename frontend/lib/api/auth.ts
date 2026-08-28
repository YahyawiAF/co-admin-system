import { http, API_BASE_URL } from "./httpClient";
import type { User } from "@/lib/types";

export const authApi = {
  login(identifier: string, password: string) {
    return http.post<User>(
      "/auth/login",
      { identifier, password },
      { skipAuth: true }
    );
  },
  signup(data: {
    identifier: string;
    password: string;
    fullname: string;
  }) {
    return http.post<User>(
      "/auth/signup",
      { ...data, role: "ADMIN" },
      { skipAuth: true }
    );
  },
  async refresh(refreshToken: string) {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${refreshToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) throw new Error("Refresh failed");
    return response.json() as Promise<User>;
  },
  logout() {
    return http.post<void>("/auth/logout");
  },
  getStoredToken() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("accessToken");
  },
  getStoredRefreshToken() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("refreshToken");
  },
  storeTokens(accessToken: string, refreshToken?: string | null) {
    localStorage.setItem("accessToken", accessToken);
    if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
  },
  clearTokens() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
  },
};
