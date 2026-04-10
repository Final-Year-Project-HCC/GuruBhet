"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import axios from "axios";
import apiClient from "@/lib/api";
import { useEmailVerificationTimer } from "@/hooks/useEmailVerificationTimer";

interface CheckEmailProps {
  email: string;
  onBack: () => void;
  mode?: "signup" | "login"; // signup or login context
}

export default function CheckEmail({ email, onBack, mode = "signup" }: CheckEmailProps) {
  const router = useRouter();
  const { formattedTime, isExpired, resetTimer } = useEmailVerificationTimer(90, true);

  // Initialize Broadcast Channel for cross-tab communication
  useEffect(() => {
    try {
      const authChannel = new BroadcastChannel("auth_channel");

      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === "VERIFIED") {
          authChannel.close();
          router.push("/login");
        }
      };

      authChannel.addEventListener("message", handleMessage);

      return () => {
        authChannel.removeEventListener("message", handleMessage);
        authChannel.close();
      };
    } catch (error) {
      console.warn("BroadcastChannel not supported:", error);
    }
  }, [router]);

  const handleResendEmail = async () => {
    if (isExpired) {
      try {
        await apiClient.post("/auth/resend-verification", {
          email,
        });
        toast.success("Verification email resent. Please check your inbox.");
        resetTimer();
      } catch (error) {
        let message = "Failed to resend verification email";
        if (axios.isAxiosError(error)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          message = (error.response?.data as any)?.detail || (error.response?.data as any)?.message || message;
        }
        toast.error(message);
      }
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6 rounded-lg border border-border p-8 bg-background text-center">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Check Your Email</h1>
          <p className="text-muted-foreground">
            We&apos;ve sent a verification link to <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        <div className="py-4">
          <p className="text-lg text-muted-foreground mb-2">
            Please check your inbox (and spam folder) to activate your GuruBhet account.
          </p>
        </div>

        <div className="bg-accent/50 rounded-md p-4 text-sm text-muted-foreground">
          <p>Didn&apos;t receive the email? You can resend it in:</p>
          <p className="text-xl font-mono font-bold text-foreground mt-2">{formattedTime}</p>
        </div>

        <button
          onClick={handleResendEmail}
          disabled={!isExpired}
          className="w-full rounded-md bg-primary text-primary-foreground cursor-pointer px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExpired ? "Resend Verification Email" : "Wait to Resend"}
        </button>

        <button
          onClick={onBack}
          className="w-full rounded-md bg-secondary text-secondary-foreground cursor-pointer px-4 py-2 hover:bg-secondary/90"
        >
          {mode === "login" ? "Back to Login" : "Back to Signup"}
        </button>
      </div>
    </div>
  );
}
