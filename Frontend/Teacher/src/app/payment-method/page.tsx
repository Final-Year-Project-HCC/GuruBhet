"use client";

import EsewaSection from "../../components/PaymentMethod/EsewaSection";

export default function TeacherPaymentMethodPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Payment Method</h1>
        <p className="text-sm text-muted-foreground">Link and manage how you receive payments.</p>
      </header>
      <section className="space-y-3">
        <EsewaSection />
      </section>
    </div>
  );
}
