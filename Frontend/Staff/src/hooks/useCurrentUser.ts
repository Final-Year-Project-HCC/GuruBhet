"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import type { CurrentUser, Permission } from "@/lib/types";

const QUERY_KEY = ["auth", "current-user"];

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const { data } = await apiClient.get<CurrentUser>("/auth/me");
    return data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    // throw error;
    return null;
  }
}

/**
 * Custom hook to fetch and cache the current user
 *
 * Configuration:
 * - staleTime: 1 hour - Data is fresh for 1 hour before refetching
 * - gcTime (cacheTime): 1 hour - Keep data in cache for 1 hour after component unmounts
 * - refetchOnWindowFocus: true - Refetch when window regains focus for security
 * - retry: false - Don't retry on failure, let it fail fast for 401s
 */
export function useUser() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchCurrentUser,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60, // 1 hour cache retention
    refetchOnWindowFocus: true, // Refetch on window focus for security
    retry: false, // Don't retry on 401 errors
  });
}

/**
 * Check if user has a specific permission
 */
export function useHasPermission(permission: Permission) {
  const { data: user } = useUser();
  if (!user) return false;
  return user.isSuperuser || user.permissions.includes(permission);
}

/**
 * Check if user has any of the provided permissions
 */
export function useHasAnyPermission(permissions: Permission[]) {
  const { data: user } = useUser();
  if (!user) return false;
  return (
    user.isSuperuser || permissions.some((p) => user.permissions.includes(p))
  );
}

/**
 * Check if user has all of the provided permissions
 */
export function useHasAllPermissions(permissions: Permission[]) {
  const { data: user } = useUser();
  if (!user) return false;
  return (
    user.isSuperuser || permissions.every((p) => user.permissions.includes(p))
  );
}

/**
 * Manually invalidate the current user query (e.g., after token refresh)
 */
export function useInvalidateCurrentUser() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
}
