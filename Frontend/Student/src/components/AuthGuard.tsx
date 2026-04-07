"use client";

import { useUser } from "@/hooks/useCurrentUser";
import LoadingSpinner from "./LoadingSpinner";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading } = useUser();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return <>{children}</>;
}
