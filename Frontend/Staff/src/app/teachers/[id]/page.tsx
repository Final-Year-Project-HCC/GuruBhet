"use client";

import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "react-toastify";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api";

type DocumentType = "NID_FRONT" | "NID_BACK" | "PAN_CARD" | "SELFIE_WITH_NID";

type TeacherDocumentVerificationRead = {
  id: string;
  type: DocumentType;
  fileUrl: string;
  status: string;
  createdAt: string;
};

type UserRead = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
};

type TeacherDetail = {
  userId: string;
  bio?: string;
  tagline?: string;
  documentStatus: string;
  reviewedById?: string;
  reviewedAt?: string;
  remarks?: string;
  createdAt: string;
  user: UserRead;
  documents: TeacherDocumentVerificationRead[];
};

async function fetchDetail(id: string): Promise<TeacherDetail> {
  const { data } = await apiClient.get(`/staff/teachers/pending/${id}`);
  return data;
}

export default function TeacherDetail() {
  const router = useRouter();
  const [previewSrc, setPreviewSrc] = useState<string>("");
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const { data, isLoading, isError } = useQuery({ queryKey: ["staff", "teacher-detail", id], queryFn: () => fetchDetail(id), enabled: !!id });

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState("");

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/staff/teachers/${id}/verify`, { action: "APPROVED" });
      return data;
    },
    onSuccess: () => {
      toast.success("Teacher verified");
      router.push("/teachers");
    },
    onError: () => toast.error("Failed to verify"),
  });

  const rejectMutation = useMutation({
    mutationFn: async (remarks: string) => {
      const { data } = await apiClient.post(`/staff/teachers/${id}/verify`, { action: "REJECTED", remarks });
      return data;
    },
    onSuccess: () => {
      toast.info("Teacher application rejected");
      setShowRejectModal(false);
      router.push("/teachers");
    },
    onError: () => toast.error("Failed to reject application"),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-destructive">Submission not found.</p>
        <button className="mt-4 rounded-md border border-border px-4 py-2 hover:bg-muted" onClick={() => router.push("/teachers")}>Back</button>
      </div>
    );
  }

  const fullName = [data.user.firstName, data.user.middleName, data.user.lastName].filter(Boolean).join(" ");

  // Extract document URLs
  const getDocUrl = (type: DocumentType) => data.documents?.find(d => d.type === type)?.fileUrl;

  const panCardUrl = getDocUrl("PAN_CARD");
  const nidFrontUrl = getDocUrl("NID_FRONT");
  const nidBackUrl = getDocUrl("NID_BACK");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">Teacher Submission Detail</h1>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Full Name</p>
            <p className="font-medium">{fullName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{data.user.email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Submitted</p>
            <p className="font-medium">{data.createdAt ? new Date(data.createdAt).toLocaleString() : "—"}</p>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Documents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {panCardUrl && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">PAN Card</p>
                <Image
                  src={panCardUrl}
                  alt="PAN Card"
                  width={800}
                  height={320}
                  unoptimized
                  className="h-40 w-full object-cover rounded-md cursor-zoom-in border border-border"
                  onClick={() => setPreviewSrc(panCardUrl)}
                />
              </div>
            )}
            {nidFrontUrl && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Citizenship (Front)</p>
                <Image
                  src={nidFrontUrl}
                  alt="Citizenship Front"
                  width={800}
                  height={320}
                  unoptimized
                  className="h-40 w-full object-cover rounded-md cursor-zoom-in border border-border"
                  onClick={() => setPreviewSrc(nidFrontUrl)}
                />
              </div>
            )}
            {nidBackUrl && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Citizenship (Back)</p>
                <Image
                  src={nidBackUrl}
                  alt="Citizenship Back"
                  width={800}
                  height={320}
                  unoptimized
                  className="h-40 w-full object-cover rounded-md cursor-zoom-in border border-border"
                  onClick={() => setPreviewSrc(nidBackUrl)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            className="rounded-md bg-green-600 px-4 py-2 text-white hover:opacity-90"
            onClick={() => verifyMutation.mutate()}
          >
            {verifyMutation.isPending ? "Verifying..." : "Verify"}
          </button>
          <button
            className="rounded-md bg-red-600 px-4 py-2 text-white hover:opacity-90"
            onClick={() => setShowRejectModal(true)}
          >
            Reject
          </button>
          <button
            className="rounded-md border border-border px-4 py-2 hover:bg-muted"
            onClick={() => router.push("/teachers")}
          >
            Back
          </button>
        </div>
      </div>

      <ImagePreviewModal src={previewSrc} isOpen={!!previewSrc} onClose={() => setPreviewSrc("")} />

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-md bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Reject Application</h3>
            <p className="text-sm text-muted-foreground mb-4">Please provide a reason for rejecting this application.</p>
            <textarea
              className="w-full rounded-md border border-border p-2 focus:ring focus:ring-ring mb-4"
              rows={4}
              placeholder="e.g. Blurry photo, mismatched names..."
              value={rejectRemarks}
              onChange={(e) => setRejectRemarks(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                className="rounded-md px-4 py-2 hover:bg-muted"
                onClick={() => setShowRejectModal(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-red-600 px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
                disabled={!rejectRemarks.trim() || rejectMutation.isPending}
                onClick={() => rejectMutation.mutate(rejectRemarks)}
              >
                {rejectMutation.isPending ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
