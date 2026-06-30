"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { toast } from "react-toastify";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const called = useRef(false); // prevent double-call in React StrictMode

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const params = new URLSearchParams(window.location.search);

    // Log the full URL for debugging
    console.log("[eSewa callback] full URL:", window.location.href);
    console.log(
      "[eSewa callback] search params:",
      Object.fromEntries(params.entries()),
    );

    const bookingId = params.get("booking_id");

    // eSewa v2 can send either:
    // (a) a single base64-encoded JSON `data` param, OR
    // (b) individual params directly (transaction_code, status, etc.)
    const rawData = params.get("data");

    let esewaData: Record<string, string>;

    if (rawData) {
      // Format (a): decode the base64 JSON
      try {
        esewaData = JSON.parse(atob(rawData));
        console.log("[eSewa callback] decoded data:", esewaData);
      } catch {
        toast.error("Could not decode payment response.");
        router.replace("/bookings");
        return;
      }
    } else {
      // Format (b): individual params already in the URL
      esewaData = Object.fromEntries(params.entries());
      console.log("[eSewa callback] individual params:", esewaData);
    }

    const {
      transaction_code,
      status,
      total_amount,
      transaction_uuid,
      product_code,
      signed_field_names,
      signature,
    } = esewaData;

    if (!bookingId || !transaction_code || !signature) {
      console.error("[eSewa callback] missing required fields", {
        bookingId,
        transaction_code,
        signature,
      });
      toast.error("Invalid payment response.");
      router.replace("/bookings");
      return;
    }

    apiClient
      .post("/payments/esewa/callback", {
        booking_id: bookingId,
        transaction_code,
        status,
        total_amount,
        transaction_uuid,
        product_code,
        signed_field_names,
        signature,
      })
      .then(() => {
        toast.success("Payment confirmed! Your booking is now active.");
        queryClient.invalidateQueries({ queryKey: ["studentBookings"] });
        router.replace("/bookings");
      })
      .catch(() => {
        toast.error("Payment verification failed. Please contact support.");
        router.replace("/bookings");
      });
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-center">
      <h1 className="text-2xl font-semibold mb-2">Verifying Payment...</h1>
      <p className="text-sm text-muted-foreground">
        Please wait while we confirm your payment with eSewa.
      </p>
    </div>
  );
}
