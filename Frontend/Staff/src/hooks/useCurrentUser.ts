"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import apiClient from "@/lib/api";
import type { CurrentUser, Permission } from "@/lib/types";

export const QUERY_KEY = ["auth", "current-user"];

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const { data } = await apiClient.get<CurrentUser>("/auth/me");
    return data;
  } catch (error) {
    // Only a 401/403 means "not logged in". Anything else (network failure,
    // 5xx, timeout) must NOT be swallowed as null — treating an outage as
    // "logged out" bounces authenticated staff back to /login whenever
    // /auth/me has a transient failure.
    if (
      axios.isAxiosError(error) &&
      (error.response?.status === 401 || error.response?.status === 403)
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Custom hook to fetch and cache the current user
 *
 * Configuration:
 * - staleTime: 1 hour - Data is fresh for 1 hour before refetching
 * - gcTime (cacheTime): 1 hour - Keep data in cache for 1 hour after component unmounts
 * - refetchOnWindowFocus: true - Refetch when window regains focus for security
 * - retry: 2 - 401s resolve to null (never retried); only real failures retry
 */
export function useUser() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchCurrentUser,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60, // 1 hour cache retention
    refetchOnWindowFocus: true, // Refetch on window focus for security
    // 401/403 resolve to null (success path), so they never hit retry.
    // Only genuine network/server failures retry, riding out transient
    // blips instead of kicking a logged-in user back to /login.
    retry: 2,
  });
}

/**
 * Check if user has a specific permission
 */
export function useHasPermission(permission: Permission) {
  const { data: user } = useUser();
  if (!user) return false;
  return user.isSuperuser || user.permissions?.includes(permission);
}

/**
 * Check if user has any of the provided permissions
 */
export function useHasAnyPermission(permissions: Permission[]) {
  const { data: user } = useUser();
  if (!user) return false;
  return (
    user.isSuperuser || permissions.some((p) => user.permissions?.includes(p))
  );
}

/**
 * Check if user has all of the provided permissions
 */
export function useHasAllPermissions(permissions: Permission[]) {
  const { data: user } = useUser();
  if (!user) return false;
  return (
    user.isSuperuser || permissions.every((p) => user.permissions?.includes(p))
  );
}

/**
 * Manually invalidate the current user query (e.g., after token refresh)
 */
export function useInvalidateCurrentUser() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
}
