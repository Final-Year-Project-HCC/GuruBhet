"use client";

import Link from "next/link";
import { useUser } from "@/hooks/useCurrentUser";
import { getAccessibleRoutes } from "@/lib/routes";

export default function Home() {
  const { data: user, isLoading, isError } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-b from-background to-muted">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="text-center text-muted-foreground">Loading user permissions...</p>
        </div>
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="min-h-screen bg-linear-to-b from-background to-muted">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="text-center text-destructive">Failed to load permissions. Please refresh.</p>
        </div>
      </div>
    );
  }

  const accessibleRoutes = getAccessibleRoutes(user.permissions, user.is_superuser).filter(
    (route) => route.path !== "/" && route.description
  );

  return (
    <div className="min-h-screen bg-linear-to-b from-background to-muted">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-foreground">Staff Dashboard</h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              Manage teachers, create academic domain structures, and maintain system data.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 pt-8">
            {accessibleRoutes.map((route) => (
              <Link
                key={route.path}
                href={route.path}
                className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 hover:border-primary transition-all hover:shadow-lg hover:shadow-primary/10"
              >
                <div className="space-y-4">
                  {route.icon && (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xl">
                      {route.icon}
                    </div>
                  )}
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">{route.label}</h2>
                    <p className="text-muted-foreground">
                      {route.description}
                    </p>
                  </div>
                </div>
                <div className="absolute inset-0 -z-10 bg-linear-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>

          {accessibleRoutes.length === 0 && (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">No Available Actions</h2>
              <p className="text-muted-foreground">
                You don&apos;t have permissions to access any features yet. Contact your administrator.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
