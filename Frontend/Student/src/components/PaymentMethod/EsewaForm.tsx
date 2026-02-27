"use client";

import { isValidNepalMobile } from "@/lib/utils";
import { useState } from "react";
import { toast } from "react-toastify";

type EsewaPayload = {
  wallet_mobile: string;
  full_name?: string;
  is_default?: boolean;
};

export default function EsewaForm() {
  const [walletMobile, setWalletMobile] = useState("");
  const [fullName, setFullName] = useState("");

  const MERCHANT_CODE = process.env.NEXT_PUBLIC_ESEWA_MERCHANT_CODE || "";
  // Note: We no longer save directly to backend here to avoid confusion.
  // Verification flow will redirect to eSewa, and backend should create/verify the method upon success.

  function handleVerify() {
    //We will handle this later
    
    /*if (!isValidNepalMobile(walletMobile)) {
      toast.error("Enter a valid eSewa mobile before verifying");
      return;
    }
    if (!MERCHANT_CODE) {
      toast.error("Merchant code not configured");
      return;
    }

    // Minimal verification flow via Rs. 1 redirect
    const amt = 1; // verification amount
    const taxAmt = 0;
    const psc = 0; // service charge
    const pdc = 0; // delivery charge
    const tAmt = amt + taxAmt + psc + pdc;
    const pid = `verify-${Date.now()}`;
    const su = `${window.location.origin}/payment-method?status=success&pid=${encodeURIComponent(pid)}`;
    const fu = `${window.location.origin}/payment-method?status=failed&pid=${encodeURIComponent(pid)}`;

    const params = new URLSearchParams({
      amt: String(amt),
      psc: String(psc),
      pdc: String(pdc),
      txAmt: String(taxAmt),
      tAmt: String(tAmt),
      pid,
      scd: MERCHANT_CODE,
      su,
      fu,
    });
    const redirectUrl = `https://esewa.com.np/epay/main?${params.toString()}`;
    window.location.href = redirectUrl;*/
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
