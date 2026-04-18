"use client";

import { useCallback } from "react";
import { toast } from "react-toastify";
import { useUser } from "./useCurrentUser";

/**
 * Hook to protect actions requiring authentication.
 * Shows a toast if user is not authenticated.
 */
export function useRequireAuth() {
  const { data: user, isLoading } = useUser();

  return useCallback(
    (action: () => void | Promise<void>) => {
      if (isLoading) return;
      if (user) return action();
      toast.info("You have to log in first to perform this action.", {
        position: "top-right",
        autoClose: 2000,
      });
    },
    [user, isLoading],
  );
}
