"use client";

import Link from "next/link";
import { useUser } from "@/hooks";
import LoadingSpinner from "./LoadingSpinner";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, data: user } = useUser();

  if (isLoading) return <LoadingSpinner />;

  if (!user) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          {/* Lock icon */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-border bg-muted">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-muted-foreground"
            >
              <rect
                x="3"
                y="11"
                width="18"
                height="11"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M7 11V7a5 5 0 0 1 10 0v4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <circle cx="12" cy="16" r="1.5" fill="currentColor" />
            </svg>
          </div>

          {/* Heading */}
          <h1 className="mb-2 text-2xl font-semibold text-foreground">
            Login required
          </h1>
          <p className="mb-8 text-base text-muted-foreground">
            You need to be logged in to access this page. Please sign in or
            create an account to continue.
          </p>

          {/* Action buttons */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="w-full rounded-md bg-primary px-6 py-2.5 text-base font-medium text-primary-foreground hover:opacity-90 sm:w-auto"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="w-full rounded-md border border-border px-6 py-2.5 text-base font-medium text-foreground hover:bg-muted sm:w-auto"
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
