"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

export default function PaymentFailurePage() {
  const router = useRouter();

  useEffect(() => {
    toast.error("Payment was not completed.");
    router.replace("/bookings");
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-center">
      <h1 className="text-2xl font-semibold mb-2">Payment Cancelled</h1>
      <p className="text-sm text-muted-foreground">
        Your payment was not completed. Redirecting you back to bookings...
      </p>
      <div className="mt-6">
        <a
          href="/bookings"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground ring-1 ring-border hover:opacity-90"
        >
          Back to Bookings
        </a>
      </div>
    </div>
  );
}
