"use client";
/* eslint-disable @next/next/no-img-element */

// import axios from "axios";
// function buildUrl(path: string) {
//   const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
//   return base ? `${base}${path}` : path;
// }
// async function fetchDetail(id: string) {
//   const url = buildUrl(`/staff/teachers/${id}`);
//   const { data } = await axios.get(url);
//   return data;
// }

import { useParams, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { buildUrl } from "@/lib/utils";

type TeacherDetail = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  panCardUrl?: string;
  citizenshipUrl?: string;
  selfieUrl?: string;
  selfieWithCitizenshipUrl?: string;
  submittedAt?: string;
};

async function fetchDetail(id: string): Promise<TeacherDetail> {
  const url = buildUrl(`/staff/teachers/${id}`);
  const { data } = await axios.get(url);
  return data;
}

export default function TeacherDetail() {
  const router = useRouter();
  const [previewSrc, setPreviewSrc] = useState<string>("");
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const { data, isLoading, isError } = useQuery({ queryKey: ["staff", "teacher-detail", id], queryFn: () => fetchDetail(id), enabled: !!id });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const url = buildUrl(`/staff/teachers/${id}/verify`);
      const { data } = await axios.post(url);
      return data;
    },
    onSuccess: () => {
      toast.success("Teacher verified");
      router.push("/teachers");
    },
    onError: () => toast.error("Failed to verify"),
  });

  const discardMutation = useMutation({
    mutationFn: async () => {
      const url = buildUrl(`/staff/teachers/${id}/discard`);
      const { data } = await axios.post(url);
      return data;
    },
    onSuccess: () => {
      toast.info("Submission discarded");
      router.push("/teachers");
    },
    onError: () => toast.error("Failed to discard"),
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

  const fullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(" ");


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
            <p className="font-medium">{data.email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Submitted</p>
            <p className="font-medium">{data.submittedAt ? new Date(data.submittedAt).toLocaleString() : "—"}</p>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Documents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {data.panCardUrl && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">PAN Card</p>
                <img
                  src={data.panCardUrl}
                  alt="PAN Card"
                  className="h-40 w-full object-cover rounded-md cursor-zoom-in border border-border"
                  onClick={() => setPreviewSrc(data.panCardUrl!)}
                />
              </div>
            )}
            {data.citizenshipUrl && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Citizenship</p>
                <img
                  src={data.citizenshipUrl}
                  alt="Citizenship"
                  className="h-40 w-full object-cover rounded-md cursor-zoom-in border border-border"
                  onClick={() => setPreviewSrc(data.citizenshipUrl!)}
                />
              </div>
            )}
            {data.selfieUrl && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Selfie</p>
                <img
                  src={data.selfieUrl}
                  alt="Selfie"
                  className="h-40 w-full object-cover rounded-md cursor-zoom-in border border-border"
                  onClick={() => setPreviewSrc(data.selfieUrl!)}
                />
              </div>
            )}
            {data.selfieWithCitizenshipUrl && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Selfie with Citizenship</p>
                <img
                  src={data.selfieWithCitizenshipUrl}
                  alt="Selfie with Citizenship"
                  className="h-40 w-full object-cover rounded-md cursor-zoom-in border border-border"
                  onClick={() => setPreviewSrc(data.selfieWithCitizenshipUrl!)}
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
            onClick={() => discardMutation.mutate()}
          >
            {discardMutation.isPending ? "Discarding..." : "Discard"}
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
    </div>
  );
}
