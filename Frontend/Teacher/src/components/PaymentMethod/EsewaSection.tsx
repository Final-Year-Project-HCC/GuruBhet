"use client";

import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "react-toastify";
import EsewaForm from "./EsewaForm";
import Modal from "../Modal";
import maskMobile from "@/lib/utils";

type SavedPaymentMethod = {
  id: string;
  type: "esewa" | string;
  verified: boolean;
  walletMobile?: string;
};

export default function EsewaSection() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
  const qc = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const methodsQuery = useQuery<SavedPaymentMethod[]>({
    queryKey: ["teacher-payment-methods"],
    queryFn: async () => {
      if (!API_URL) throw new Error("API base URL not configured");
      const { data } = await axios.get(`${API_URL}/teachers/payment-methods`);
      return data as SavedPaymentMethod[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!API_URL) throw new Error("API base URL not configured");
      await axios.delete(`${API_URL}/teachers/payment-methods/${id}`);
    },
    onSuccess: () => {
      toast.success("eSewa method removed");
      qc.invalidateQueries({ queryKey: ["teacher-payment-methods"] });
      setConfirmId(null);
      setShowForm(false);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to remove eSewa method");
    },
  });

  const esewaMethods = (methodsQuery.data || []).filter((m) => m.type === "esewa");
  const hasEsewa = esewaMethods.length > 0;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">eSewa</h2>

      {methodsQuery.isLoading && <div className="text-sm text-muted-foreground">Loading...</div>}

      {!methodsQuery.isLoading && (
        <div className="space-y-3">
          {!hasEsewa && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Link your eSewa to receive payments.</p>
              <button
                onClick={() => setShowForm(true)}
                className="rounded-md px-3 py-2 text-sm bg-black text-white ring-1 ring-border hover:opacity-90 dark:bg-white dark:text-black"
              >
                Add eSewa payment method
              </button>
            </div>
          )}

          {!hasEsewa && !showForm && (
            <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
              No eSewa payment method linked yet.
            </div>
          )}

          {showForm && !hasEsewa && (
            <div className="space-y-2">
              <EsewaForm />
              <div className="flex justify-end">
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-md px-3 py-2 text-sm bg-background ring-1 ring-border hover:bg-muted"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {hasEsewa && (
            <div className="space-y-2">
              {esewaMethods.map((esewa) => (
                <div
                  key={esewa.id}
                  className="rounded-md border border-border p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium">eSewa • {maskMobile(esewa.walletMobile)}</div>
                    <div className="text-xs text-muted-foreground">{esewa.verified ? "Verified" : "Unverified"}</div>
                  </div>
                  <button
                    onClick={() => setConfirmId(esewa.id)}
                    className="rounded-md px-3 py-1 text-xs bg-background ring-1 ring-border hover:bg-muted"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Remove current method to add another.</p>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={!!confirmId}
        onClose={() => setConfirmId(null)}
        title={"Remove eSewa method?"}
        size="sm"
        actions={
          <>
            <button
              onClick={() => setConfirmId(null)}
              className="rounded-md px-3 py-2 text-sm bg-background ring-1 ring-border hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => confirmId && deleteMutation.mutate(confirmId)}
              className="rounded-md px-3 py-2 text-sm bg-red-600 text-white ring-1 ring-border hover:opacity-90"
            >
              Remove
            </button>
          </>
        }
      >
        This will unlink your eSewa wallet from GuruBhet. You can add it again later.
      </Modal>
    </div>
  );
}

