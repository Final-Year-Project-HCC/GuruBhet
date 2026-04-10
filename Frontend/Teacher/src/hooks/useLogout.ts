"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import apiClient, { clearAuthOnLogout } from "@/lib/api";
import { toast } from "react-toastify";

/**
 * Mutation to logout the current user
 *
 * Actions on success:
 * - Clear the TanStack Query cache
 * - Redirect to /login page
 *
 * Actions on error:
 * - Show an error toast
 */
export function useLogout() {
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      // Call the logout endpoint
      await apiClient.post("/auth/logout");
    },
    onSuccess: async () => {
      // Clear cache and redirect
      await clearAuthOnLogout();
      router.push("/dashboard");
    },
    onError: (error) => {
      console.error("Logout failed:", error);
      toast.error("Unable to logout. Please try again later.", {
        position: "top-right",
        autoClose: 5000,
      });
    },
  });
}
