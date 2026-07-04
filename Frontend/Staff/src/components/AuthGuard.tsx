"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "@/hooks/useCurrentUser";
import LoadingSpinner from "./LoadingSpinner";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading, isFetching, isError } = useUser();
  useEffect(() => {
    // Only redirect once the query has truly settled. While a fetch is in
    // flight (e.g. the refetch triggered right after login invalidates the
    // cache), `user` still holds the stale pre-login `null`; redirecting on
    // that would bounce a freshly-logged-in user back to /login.
    if (!isLoading && !isFetching && (isError || !user)) {
      router.push("/login");
    }
  }, [isLoading, isFetching, isError, user, router]);

  // Show spinner while checking authentication
  if (isLoading || isFetching) {
    return <LoadingSpinner />;
  }
  return <>{children}</>;
}
