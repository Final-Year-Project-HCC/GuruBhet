"use client";

import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "react-toastify";
import EsewaForm from "./EsewaForm";
import Modal from "../Modal";
import { maskMobile } from "@/lib/utils";

type SavedPaymentMethod = {
  id: string;
  type: "esewa" | string;
  isDefault: boolean;
  verified: boolean;
  walletMobile?: string;
};

export default function EsewaSection() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
  const qc = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const methodsQuery = useQuery<SavedPaymentMethod[]>({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      if (!API_URL) throw new Error("API base URL not configured");
      const { data } = await axios.get(`${API_URL}/students/payment-methods`);
      return data as SavedPaymentMethod[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!API_URL) throw new Error("API base URL not configured");
      await axios.delete(`${API_URL}/students/payment-methods/${id}`);
    },
    onSuccess: () => {
      toast.success("eSewa method removed");
      qc.invalidateQueries({ queryKey: ["payment-methods"] });
      setConfirmId(null);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to remove eSewa method",
      );
    },
  });

  const esewaMethods = (methodsQuery.data || []).filter((m) => m.type === "esewa");

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">eSewa</h2>

      {methodsQuery.isLoading && <div className="text-sm text-muted-foreground">Loading...</div>}

      {!methodsQuery.isLoading && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Manage your eSewa payment methods.</p>
            <button
              onClick={() => setShowForm(true)}
              className="rounded-md px-3 py-2 text-sm bg-primary text-primary-foreground ring-1 ring-border hover:opacity-90"
            >
              Add New
            </button>
          </div>

          {esewaMethods.length === 0 && (
            <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
              No eSewa payment method linked yet.
            </div>
          )}

          {esewaMethods.length > 0 && (
            <div className="space-y-2">
              {esewaMethods.map((esewa) => (
                <div
                  key={esewa.id}
                  className="rounded-md border border-border p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium">
                      eSewa • {maskMobile(esewa.walletMobile)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {esewa.verified ? "Verified" : "Unverified"}
                      {esewa.isDefault ? " • Default" : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmId(esewa.id)}
                    className="rounded-md px-3 py-1 text-xs bg-background ring-1 ring-border hover:bg-muted"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {showForm && (
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
              className="rounded-md px-3 py-2 text-sm bg-destructive text-destructive-foreground ring-1 ring-border hover:opacity-90"
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


