import type { Permission } from "@/lib/types";

/**
 * Route Configuration with Permission Requirements
 * This is a scalable way to define which routes require which permissions
 * Add new routes here and they'll automatically be checked
 */

export interface RouteConfig {
  path: string;
  label: string;
  icon?: React.ReactNode;
  requiredPermission?: Permission;
  requiredAnyPermission?: Permission[];
  requiredAllPermissions?: Permission[];
  description?: string;
  children?: RouteConfig[];
}

export const STAFF_ROUTES: RouteConfig[] = [
  {
    path: "/",
    label: "Dashboard",
    description: "Home dashboard",
  },
  {
    path: "/teachers",
    label: "Pending Teachers",
    requiredPermission: "teacher:verify",
    description: "Review and verify pending teacher submissions",
    icon: "👥",
  },
  {
    path: "/academic-setup",
    label: "Academic Setup",
    requiredPermission: "academic_domains:manage",
    description: "Create and manage universities, faculties, subjects",
    icon: "🎓",
    children: [
      {
        path: "/academic-setup/universities",
        label: "Universities",
        requiredPermission: "academic_domains:manage",
      },
      {
        path: "/academic-setup/faculties",
        label: "Faculties",
        requiredPermission: "academic_domains:manage",
      },
      {
        path: "/academic-setup/subjects",
        label: "Subjects",
        requiredPermission: "academic_domains:manage",
      },
    ],
  },
  // Add future routes based on permissions here
  // {
  //   path: "/moderation",
  //   label: "Moderation",
  //   requiredPermission: "moderation:manage",
  //   description: "Moderate user content",
  //   icon: "🚨",
  // },
];

/**
 * Utility to get accessible routes for a user based on their permissions
 */
export function getAccessibleRoutes(
  permissions: string[],
  isSuperuser: boolean
): RouteConfig[] {
  if (isSuperuser) {
    return STAFF_ROUTES;
  }

  return STAFF_ROUTES.filter((route) => {
    // Routes without permission requirements are always accessible
    if (!route.requiredPermission && !route.requiredAnyPermission && !route.requiredAllPermissions) {
      return true;
    }

    // Single permission check
    if (route.requiredPermission && permissions.includes(route.requiredPermission)) {
      return true;
    }

    // Any permission check
    if (route.requiredAnyPermission && route.requiredAnyPermission.some((p) => permissions.includes(p))) {
      return true;
    }

    // All permissions check
    if (route.requiredAllPermissions && route.requiredAllPermissions.every((p) => permissions.includes(p))) {
      return true;
    }

    return false;
  });
}
