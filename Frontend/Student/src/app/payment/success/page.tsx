"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api";
import { toast } from "react-toastify";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const called = useRef(false); // prevent double-call in React StrictMode

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get("booking_id");
    const transactionCode = params.get("transaction_code");
    const status = params.get("status");
    const totalAmount = params.get("total_amount");
    const transactionUuid = params.get("transaction_uuid");
    const productCode = params.get("product_code");
    const signedFieldNames = params.get("signed_field_names");
    const signature = params.get("signature");

    if (!bookingId || !transactionCode || !signature) {
      toast.error("Invalid payment response.");
      router.replace("/bookings");
      return;
    }

    apiClient
      .post("/payments/esewa/callback", {
        booking_id: bookingId,
        transaction_code: transactionCode,
        status,
        total_amount: totalAmount,
        transaction_uuid: transactionUuid,
        product_code: productCode,
        signed_field_names: signedFieldNames,
        signature,
      })
      .then(() => {
        toast.success("Payment confirmed! Your booking is now active.");
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
