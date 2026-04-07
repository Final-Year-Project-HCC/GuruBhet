"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AUTH_FAILURE_EVENT } from "@/lib/api";

/**
 * Hook that listens for auth failure events and redirects to login
 * Should be used only once in the root layout to prevent redirect loops
 */
export function useAuthFailureListener() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function handleAuthFailure() {
      // Only redirect if not already on the login page
      if (pathname !== "/login") {
        router.replace("/login");
      }
    }

    window.addEventListener(AUTH_FAILURE_EVENT, handleAuthFailure);

    return () => {
      window.removeEventListener(AUTH_FAILURE_EVENT, handleAuthFailure);
    };
  }, [router, pathname]);
}
