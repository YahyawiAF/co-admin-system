// Centralized HTTP client with automatic token refresh
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

let globalTokenRefreshCallback:
  | ((forceRefresh?: boolean) => Promise<string | null>)
  | null = null;
let globalSessionExpiredCallback: (() => void) | null = null;

export function setTokenRefreshCallback(
  callback: (forceRefresh?: boolean) => Promise<string | null>
) {
  globalTokenRefreshCallback = callback;
}

export function clearTokenRefreshCallback() {
  globalTokenRefreshCallback = null;
}

export function setSessionExpiredCallback(callback: () => void) {
  globalSessionExpiredCallback = callback;
}

export function clearSessionExpiredCallback() {
  globalSessionExpiredCallback = null;
}

function getStoredToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

function parseApiError(error: unknown): Error {
  const body = (error || {}) as {
    message?: string | string[] | { message?: string; occupants?: unknown };
    occupants?: unknown;
  };
  let message = "Request failed";
  let occupants: unknown;
  if (typeof body.message === "string") {
    message = body.message;
    occupants = body.occupants;
  } else if (Array.isArray(body.message)) {
    message = body.message.join(", ");
    occupants = body.occupants;
  } else if (body.message && typeof body.message === "object") {
    message = body.message.message || message;
    occupants = body.message.occupants || body.occupants;
  } else if (body.occupants) {
    occupants = body.occupants;
  }
  const err = new Error(message) as Error & { occupants?: unknown };
  if (occupants) err.occupants = occupants;
  return err;
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  skipAutoRefresh?: boolean;
}

export async function httpClient<T = unknown>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const { skipAuth = false, skipAutoRefresh = false, ...fetchOptions } =
    options;
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

  if (skipAuth) {
    const response = await fetch(fullUrl, {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...(fetchOptions.headers as Record<string, string>),
      },
    });
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Request failed" }));
      throw parseApiError(error);
    }
    if (response.status === 204) return undefined as T;
    return response.json();
  }

  let currentToken = getStoredToken();

  if (
    !skipAutoRefresh &&
    globalTokenRefreshCallback &&
    typeof window !== "undefined" &&
    localStorage.getItem("refreshToken")
  ) {
    try {
      if (!currentToken) {
        await globalTokenRefreshCallback(true);
        currentToken = getStoredToken();
      }
    } catch {
      /* continue with existing token */
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (currentToken) headers.Authorization = `Bearer ${currentToken}`;

  let response = await fetch(fullUrl, {
    ...fetchOptions,
    headers: headers as HeadersInit,
  });

  if (response.status === 401 && !skipAutoRefresh && globalTokenRefreshCallback) {
    try {
      await globalTokenRefreshCallback(true);
      const refreshed = getStoredToken();
      if (refreshed) {
        response = await fetch(fullUrl, {
          ...fetchOptions,
          headers: {
            ...headers,
            Authorization: `Bearer ${refreshed}`,
          } as HeadersInit,
        });
      }
    } catch {
      /* fall through */
    }
    if (response.status === 401 && globalSessionExpiredCallback) {
      globalSessionExpiredCallback();
    }
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Request failed" }));
    throw parseApiError(error);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const http = {
  get: <T = unknown>(url: string, options?: RequestOptions) =>
    httpClient<T>(url, { ...options, method: "GET" }),
  post: <T = unknown>(url: string, data?: unknown, options?: RequestOptions) =>
    httpClient<T>(url, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),
  patch: <T = unknown>(url: string, data?: unknown, options?: RequestOptions) =>
    httpClient<T>(url, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),
  put: <T = unknown>(url: string, data?: unknown, options?: RequestOptions) =>
    httpClient<T>(url, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),
  delete: <T = unknown>(url: string, options?: RequestOptions) =>
    httpClient<T>(url, { ...options, method: "DELETE" }),
};

export { API_BASE_URL };
