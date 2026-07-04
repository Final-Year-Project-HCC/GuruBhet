"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "@/hooks/useCurrentUser";
import LoadingSpinner from "./LoadingSpinner";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading, isFetching, isError, refetch } = useUser();
  useEffect(() => {
    // Redirect only once the query has settled AND the backend actually
    // answered. `user` is null only for a genuine 401/403 (see
    // fetchCurrentUser); network/server failures set isError and render the
    // retry UI below instead — a transient backend blip must not log the
    // user out. Waiting on isFetching also avoids acting on the stale
    // pre-login null while the post-login refetch is in flight.
    if (!isLoading && !isFetching && !isError && !user) {
      router.push("/login");
    }
  }, [isLoading, isFetching, isError, user, router]);

  // Show spinner while checking authentication
  if (isLoading || isFetching) {
    return <LoadingSpinner />;
  }

  // Backend unreachable / server error: session state is unknown, so offer a
  // retry instead of silently treating the user as logged out.
  if (isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground">
          Could not verify your session. Please check your connection and try
          again.
        </p>
        <button
          onClick={() => refetch()}
          className="rounded-md border border-border px-4 py-2 hover:bg-muted"
        >
          Retry
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
