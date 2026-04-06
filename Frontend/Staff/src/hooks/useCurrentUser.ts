"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import type { CurrentUser, Permission } from "@/lib/types";

const QUERY_KEY = ["auth", "current-user"];

async function fetchCurrentUser(): Promise<CurrentUser> {
  const { data } = await apiClient.get<CurrentUser>("/auth/me");
  return data;
}

export function useCurrentUser() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
}

/**
 * Check if user has a specific permission
 */
export function useHasPermission(permission: Permission) {
  const { data: user } = useCurrentUser();
  if (!user) return false;
  return user.is_superuser || user.permissions.includes(permission);
}

/**
 * Check if user has any of the provided permissions
 */
export function useHasAnyPermission(permissions: Permission[]) {
  const { data: user } = useCurrentUser();
  if (!user) return false;
  return user.is_superuser || permissions.some((p) => user.permissions.includes(p));
}

/**
 * Check if user has all of the provided permissions
 */
export function useHasAllPermissions(permissions: Permission[]) {
  const { data: user } = useCurrentUser();
  if (!user) return false;
  return user.is_superuser || permissions.every((p) => user.permissions.includes(p));
}

/**
 * Manually invalidate the current user query (e.g., after token refresh)
 */
export function useInvalidateCurrentUser() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
}
