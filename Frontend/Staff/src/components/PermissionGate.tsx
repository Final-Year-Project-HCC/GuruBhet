"use client";

import React from "react";
import type { Permission } from "@/lib/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface PermissionGateProps {
  children: React.ReactNode;
  /**
   * Single permission required
   */
  require?: Permission;
  /**
   * Any of these permissions required
   */
  requireAny?: Permission[];
  /**
   * All of these permissions required
   */
  requireAll?: Permission[];
  /**
   * Fallback UI when user doesn't have permission
   */
  fallback?: React.ReactNode;
}

/**
 * PermissionGate: Conditionally render components based on user permissions
 * 
 * @example
 * // Single permission
 * <PermissionGate require="academic_domains:manage">
 *   <AcademicSetupPage />
 * </PermissionGate>
 * 
 * // Multiple permissions (any)
 * <PermissionGate requireAny={["teacher:verify", "staff:manage"]}>
 *   <AdminPanel />
 * </PermissionGate>
 * 
 * // Multiple permissions (all)
 * <PermissionGate requireAll={["staff:manage", "teacher:verify"]}>
 *   <SensitiveArea />
 * </PermissionGate>
 */
export function PermissionGate({
  children,
  require,
  requireAny,
  requireAll,
  fallback,
}: PermissionGateProps) {
  const { data: user, isLoading, isError } = useCurrentUser();

  // Authentication check
  if (isLoading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  if (isError || !user) {
    return fallback ?? <div className="p-4 text-destructive">Authentication failed</div>;
  }

  // Single permission check
  if (require) {
    const hasPermission = user.is_superuser || user.permissions.includes(require);
    if (!hasPermission) {
      return fallback ?? <div className="p-4 text-destructive">Permission denied: {require}</div>;
    }
  }

  // Any permission check
  if (requireAny) {
    const hasAnyPermission = user.is_superuser || requireAny.some((p) => user.permissions.includes(p));
    if (!hasAnyPermission) {
      return fallback ?? <div className="p-4 text-destructive">Insufficient permissions</div>;
    }
  }

  // All permissions check
  if (requireAll) {
    const hasAllPermissions = user.is_superuser || requireAll.every((p) => user.permissions.includes(p));
    if (!hasAllPermissions) {
      return fallback ?? <div className="p-4 text-destructive">Insufficient permissions</div>;
    }
  }

  return <>{children}</>;
}
