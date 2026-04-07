"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "@/hooks/useCurrentUser";
import LoadingSpinner from "./LoadingSpinner";

/**
 * Auth Guard Component
 *
 * Responsibilities:
 * 1. Check if user is authenticated (via useUser hook)
 * 2. Show LoadingSpinner while checking
 * 3. Redirect to /login if user is not authenticated or 401 occurs
 * 4. Render children if user is authenticated
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading, isError } = useUser();

  useEffect(() => {
    // If query failed or no user, redirect to login
    if (!isLoading && (isError || !user)) {
      router.push("/login");
    }
  }, [isLoading, isError, user, router]);

  // Show spinner while checking authentication
  if (isLoading) {
    return <LoadingSpinner />;
  }

  return <>{children}</>;
}
