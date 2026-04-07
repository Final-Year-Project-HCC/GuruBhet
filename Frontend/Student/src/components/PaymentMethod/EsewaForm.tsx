"use client";

import { isValidNepalMobile } from "@/lib/utils";
import { useState } from "react";
import { toast } from "react-toastify";

type EsewaPayload = {
  walletMobile: string;
  fullName?: string;
  isDefault?: boolean;
};

export default function EsewaForm() {
  const [walletMobile, setWalletMobile] = useState("");
  const [fullName, setFullName] = useState("");

  const MERCHANT_CODE = process.env.NEXT_PUBLIC_ESEWA_MERCHANT_CODE || "";

  function handleVerify() {
    // Implementation pending
  }

  return (
    <div className="max-w-xl border border-border rounded-lg p-4 bg-background">
      <h2 className="text-xl font-semibold mb-3">Add new eSewa payment method</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Link your eSewa wallet to simplify future payments.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-sm mb-1">eSewa Mobile Number</label>
          <input
            type="tel"
            value={walletMobile}
            onChange={(e) => setWalletMobile(e.target.value.replace(/\D/g, ""))}
            placeholder="98XXXXXXXX"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Full Name (optional)</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Name as per eSewa"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>


        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleVerify}
            className="rounded-md bg-success px-4 py-2 text-primary-foreground ring-1 ring-border hover:opacity-90"
          >
            Verify via eSewa
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Verification will redirect you to eSewa for a small Rs. 1 test payment. On success,
          you will be brought back here.
        </p>
      </div>
    </div>
  );
}
