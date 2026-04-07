"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "./useCurrentUser";

/**
 * Hook that redirects authenticated users away from auth pages to landing page
 * Use this in login/auth pages to prevent authenticated users from viewing them
 * @param landingPagePath - The path to redirect authenticated users to (default: "/")
 */
export function useAuthRedirectToLanding(landingPagePath: string = "/dashboard") {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isLoading } = useUser();

  useEffect(() => {
    // If user is authenticated and on login/auth page, redirect to landing page
    if (!isLoading && user) {
      // Only redirect if on auth-related pages
      if (pathname === "/login") {
        router.replace(landingPagePath);
      }
    }
  }, [isLoading, user, pathname, router, landingPagePath]);
}
