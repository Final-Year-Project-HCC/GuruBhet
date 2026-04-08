"use client";

import Link from "next/link";
import { useUser } from "@/hooks/useCurrentUser";
import { getAccessibleRoutes } from "@/lib/routes";

export default function Sidebar() {
  const { data: user, isLoading, isError } = useUser();

  if (isLoading) {
    return (
      <nav className="flex flex-col gap-4 p-4 border-r border-border">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </nav>
    );
  }

  if (isError || !user) {
    return (
      <nav className="flex flex-col gap-4 p-4 border-r border-border">
        <div className="text-sm text-destructive">Failed to load navigation</div>
      </nav>
    );
  }

  const accessibleRoutes = getAccessibleRoutes(user.permissions, user.isSuperuser);

  return (
    <nav className="flex flex-col gap-2 p-4 border-r border-border bg-card">
      {accessibleRoutes.map((route) => (
        <Link
          key={route.path}
          href={route.path}
          className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          title={route.description}
        >
          {route.icon && <span className="mr-2">{route.icon}</span>}
          {route.label}
        </Link>
      ))}
    </nav>
  );
}
