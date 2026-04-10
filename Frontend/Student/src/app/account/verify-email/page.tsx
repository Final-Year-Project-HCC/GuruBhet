"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import apiClient from "@/lib/api";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();
  // Initialize countdown to 10 so we don't have to set it synchronously in an effect
  const [autoCloseCountdown, setAutoCloseCountdown] = useState(10);

  const verifyMutation = useMutation({
    mutationFn: async (verificationToken: string) => {
      const { data } = await apiClient.post(
        `/auth/verify/${verificationToken}`,
      );
      return data;
    },
    onSuccess: () => {
      try {
        const authChannel = new BroadcastChannel("auth_channel");
        authChannel.postMessage({ type: "VERIFIED" });
        authChannel.close();
      } catch (error) {
        console.warn("BroadcastChannel not supported:", error);
      }
    },
    onError: (err: unknown) => {
      let message = "Verification failed";
      if (axios.isAxiosError(err)) {
        message =
          err.response?.data?.detail || err.response?.data?.message || message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      console.error(message);
    },
  });

  const isMissingToken = !token;
  const isSuccess = verifyMutation.isSuccess;
  const isError = verifyMutation.isError;
  const isFailed = isMissingToken || isError;
  const isVerifying = verifyMutation.isPending && !isMissingToken;

  // 1. Trigger Mutation
  useEffect(() => {
    if (token) {
      verifyMutation.mutate(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // 2. Handle Countdown & Auto-Close
  useEffect(() => {
    // Only start the interval if the status is failed
    if (!isFailed) return;

    const interval = setInterval(() => {
      setAutoCloseCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          window.close();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isFailed]);

  // --- RENDER LOGIC ---

  // Loading State
  if (isVerifying || (verifyMutation.isIdle && !isMissingToken)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6 rounded-lg border border-border p-8 bg-background text-center">
          <h1 className="text-3xl font-semibold mb-4">Verifying Email</h1>
          <LoadingSpinner />
          <p className="text-muted-foreground">
            Please wait while we verify your email...
          </p>
        </div>
      </div>
    );
  }

  // Success State
  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6 rounded-lg border border-border p-8 bg-background text-center">
          <div>
            <h1 className="text-3xl font-semibold mb-2 text-green-600">
              Verification Successful
            </h1>
            <p className="text-muted-foreground">
              Your email has been verified! You can now log in to your GuruBhet
              account.
            </p>
          </div>
          <button
            onClick={() => router.push("/login")}
            className="w-full rounded-md bg-primary text-primary-foreground cursor-pointer px-4 py-2 hover:bg-primary/90"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Failure State
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6 rounded-lg border border-border p-8 bg-background text-center">
        <div>
          <h1 className="text-3xl font-semibold mb-2 text-red-600">
            Verification Failed
          </h1>
          <p className="text-muted-foreground mb-4">
            {isMissingToken
              ? "No verification token found."
              : "Verification failed or your link has expired. Please return to the signup page and click 'Resend'."}
          </p>
        </div>

        {isFailed && (
          <div className="bg-accent/50 rounded-md p-4 text-sm text-muted-foreground">
            <p>
              This window will close automatically in {autoCloseCountdown}{" "}
              seconds...
            </p>
          </div>
        )}

        <button
          onClick={() => window.close()}
          className="w-full rounded-md bg-secondary text-secondary-foreground cursor-pointer px-4 py-2 hover:bg-secondary/90"
        >
          Close Window
        </button>
      </div>
    </div>
  );
}
