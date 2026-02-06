"use client";

import { useEffect, useState } from "react";

export default function TeacherEsewaVerifyFailedPage() {
  const [pid, setPid] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPid(params.get("pid"));
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-center">
      <h1 className="text-2xl font-semibold mb-2">Verification Failed</h1>
      <p className="text-sm text-muted-foreground mb-4">
        We could not verify your eSewa wallet. Please try again.
      </p>
      <div className="mx-auto inline-block rounded-md border border-border px-4 py-2 text-left">
        <p className="text-sm">PID: {pid || "N/A"}</p>
      </div>
      <div className="mt-6">
        <a href="/payment-method" className="rounded-md bg-black px-4 py-2 text-white ring-1 ring-border dark:bg-white dark:text-black">
          Back to Payment Method
        </a>
      </div>
    </div>
  );
}
