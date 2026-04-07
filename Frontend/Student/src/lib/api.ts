import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { QueryClient } from "@tanstack/react-query";

let queryClient: QueryClient | null = null;

export function setAuthQueryClient(client: QueryClient) {
  queryClient = client;
}

// Custom event for auth failures to prevent redirect loops
export const AUTH_FAILURE_EVENT = "auth:failure";

export function emitAuthFailure() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_FAILURE_EVENT));
  }
}

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "https://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Track if we're already trying to refresh
let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

/**
 * Silent Refresh Logic:
 * If a 401 is received, try to refresh the token once.
 * If refresh succeeds, retry the original request.
 * If refresh fails, redirect to login.
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only handle 401 errors and prevent infinite retry loops
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // If we're already refreshing, wait for that promise
      if (isRefreshing && refreshPromise) {
        try {
          await refreshPromise;
          // Retry the original request
          return apiClient(originalRequest);
        } catch {
          handleAuthFailure();
          return Promise.reject(error);
        }
      }

      // Start the refresh process
      isRefreshing = true;
      refreshPromise = performTokenRefresh();

      try {
        await refreshPromise;
        // Retry the original request
        return apiClient(originalRequest);
      } catch {
        handleAuthFailure();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Perform token refresh by calling /auth/refresh
 * Uses a separate axios request (not apiClient) to avoid interceptor loops
 * Throws an error if refresh fails (e.g., no refresh token)
 */
async function performTokenRefresh(): Promise<void> {
  try {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:8000";
    // Use axios.post directly without interceptors to avoid refresh loop
    const response = await axios.post(
      `${baseURL}/auth/refresh`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
      }
    );
    if (response.status !== 200) {
      throw new Error("Token refresh failed");
    }
  } catch (error) {
    // Refresh failed - throw error to trigger handleAuthFailure
    throw error;
  }
}

/**
 * Handle authentication failure:
 * - Clear TanStack Query cache
 * - Emit auth failure event (instead of redirecting directly)
 */
function handleAuthFailure() {
  if (queryClient) {
    queryClient.clear();
  }

  // Emit event instead of redirecting to prevent loops
  emitAuthFailure();
}

/**
 * Clear auth on logout
 */
export async function clearAuthOnLogout() {
  if (queryClient) {
    queryClient.clear();
  }

  // Emit event for logout redirect
  emitAuthFailure();
}

export default apiClient;
