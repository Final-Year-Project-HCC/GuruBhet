"use client";

import { useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { toast } from "react-toastify";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const { bookingId } = useParams<{ bookingId: string }>();
  const queryClient = useQueryClient();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    // eSewa v2 appends ?data=<base64-JSON> to whatever success_url we provided.
    // Since booking_id is now in the path, the URL is clean:
    // /payment/success/<booking_id>?data=<base64>
    const params = new URLSearchParams(window.location.search);
    const rawData = params.get("data");

    if (!bookingId || !rawData) {
      toast.error("Invalid payment response.");
      router.replace("/bookings");
      return;
    }

    let esewaData: Record<string, string>;
    try {
      esewaData = JSON.parse(atob(rawData));
    } catch {
      toast.error("Could not decode payment response.");
      router.replace("/bookings");
      return;
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

    if (!transaction_code || !signature) {
      toast.error("Incomplete payment response.");
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
        queryClient.invalidateQueries({ queryKey: ["sessions", "in-progress"] });
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
