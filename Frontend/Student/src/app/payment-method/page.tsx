"use client";

import EsewaSection from "../../components/PaymentMethod/EsewaSection";

export default function PaymentMethodPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Payment Methods</h1>
        <p className="text-sm text-muted-foreground">
          Add, verify, and manage your payment options.
        </p>
      </header>
      <section className="space-y-3">
        <EsewaSection />
      </section>
    </div>
  );
}
