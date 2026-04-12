"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { isValidNepalMobile } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { toast } from "react-toastify";
import FileInputWithPreview from "./FileInputWithPreview";
import LoadingSpinner from "./LoadingSpinner";
import { useTeacher } from "@/hooks/useTeacherProfile";

interface FileState {
  file: File | null;
  previewUrl: string | null;
}

interface KycVerificationProps {
  onSuccess?: () => void;
}

export function KycVerification({ onSuccess }: KycVerificationProps) {
  const { data: teacherData, isFetching } = useTeacher();
  const isApproved = teacherData?.documentStatus === "APPROVED";
  const [kycFormData, setKycFormData] = useState({
    phone: "",
  });
  const [kycFiles, setKycFiles] = useState<Record<string, FileState>>({
    nidFront: { file: null, previewUrl: null },
    nidBack: { file: null, previewUrl: null },
    panCard: { file: null, previewUrl: null },
    selfieWithNid: { file: null, previewUrl: null },
  });

  useEffect(() => {
    if (!teacherData) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKycFormData((prev) => ({ ...prev, phone: teacherData.user.phone ?? "" }));
    // Map TeacherDocument.type to KYC field keys
    const docTypeToField: Record<string, keyof typeof kycFiles> = {
      NID_FRONT: "nidFront",
      NID_BACK: "nidBack",
      PAN_CARD: "panCard",
      SELFIE_WITH_NID: "selfieWithNid",
    };
    if (teacherData.documents && Array.isArray(teacherData.documents)) {
      setKycFiles((prev) => {
        const updated: typeof prev = { ...prev };
        teacherData.documents.forEach((doc) => {
          const field = docTypeToField[doc.type];
          if (field && doc.fileUrl) {
            updated[field] = {
              file: null,
              previewUrl: doc.fileUrl,
            };
          }
        });
        return updated;
      });
    }
  }, [teacherData]);

  // Cleanup object URLs on component unmount
  useEffect(() => {
    return () => {
      Object.values(kycFiles).forEach((file) => {
        if (file.previewUrl && file.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(file.previewUrl);
        }
      });
    };
  }, [kycFiles]);

  const kycMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiClient.patch("/teachers/onboarding/documents", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("KYC documents updated successfully");
      onSuccess?.();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to update KYC documents");
    },
  });

  const handleKycInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setKycFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (fieldName: string, file: File | null) => {
    // Revoke previous URL to avoid memory leaks
    if (kycFiles[fieldName]?.previewUrl && kycFiles[fieldName].previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(kycFiles[fieldName].previewUrl!);
    }
    const previewUrl = file ? URL.createObjectURL(file) : null;
    setKycFiles((prev) => ({
      ...prev,
      [fieldName]: { file, previewUrl },
    }));
  };

  const handleKycSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (
      !kycFormData.phone.trim() ||
      !isValidNepalMobile(kycFormData.phone) ||
      !kycFiles.nidFront.file ||
      !kycFiles.nidBack.file ||
      !kycFiles.panCard.file ||
      !kycFiles.selfieWithNid.file
    ) {
      toast.error("All KYC fields are required and phone number must be valid");
      return;
    }
    const formDataToSubmit = new FormData();
    formDataToSubmit.append("phone", kycFormData.phone);
    Object.entries(kycFiles).forEach(([key, { file }]) => {
      if (file) {
        formDataToSubmit.append(key, file);
      }
    });
    kycMutation.mutate(formDataToSubmit);
  };

  if (isFetching) return <LoadingSpinner />;

  return (
    <div className="border border-border rounded-lg p-6 mx-auto">
      <h2 className="text-2xl font-bold mb-6">KYC Verification</h2>
      <form onSubmit={handleKycSubmit} className="space-y-6">
        {/* Phone Number Field */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium mb-2">
            Phone Number <span className="text-destructive">*</span>
          </label>
          <input
            id="phone"
            type="tel"
            name="phone"
            value={kycFormData.phone}
            onChange={handleKycInputChange}
            required
            readOnly={isApproved}
            tabIndex={isApproved ? -1 : 0}
            className={`w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none ${isApproved ? 'pointer-events-none opacity-80' : 'focus:ring-2 focus:ring-primary'}`}
            placeholder="Your phone number"
          />
          {kycFormData.phone && !isValidNepalMobile(kycFormData.phone) && (
            <span className="text-destructive text-xs">Invalid Nepal phone number</span>
          )}
        </div>
        {/* Document Uploads */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Required Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FileInputWithPreview
              name="nidFront"
              label="NID Front"
              previewSrc={kycFiles.nidFront.previewUrl || undefined}
              onChange={(file) => handleFileChange("nidFront", file)}
              disabled={isApproved}
            />
            <FileInputWithPreview
              name="nidBack"
              label="NID Back"
              previewSrc={kycFiles.nidBack.previewUrl || undefined}
              onChange={(file) => handleFileChange("nidBack", file)}
              disabled={isApproved}
            />
            <FileInputWithPreview
              name="panCard"
              label="PAN Card"
              previewSrc={kycFiles.panCard.previewUrl || undefined}
              onChange={(file) => handleFileChange("panCard", file)}
              disabled={isApproved}
            />
            <FileInputWithPreview
              name="selfieWithNid"
              label="Selfie with NID"
              previewSrc={kycFiles.selfieWithNid.previewUrl || undefined}
              onChange={(file) => handleFileChange("selfieWithNid", file)}
              disabled={isApproved}
            />
          </div>
        </div>
        {/* Submit Button */}
        <div className="pt-4 flex gap-4">
          {!isApproved ? (
            <button
              type="submit"
              disabled={
                kycMutation.isPending ||
                !kycFormData.phone?.trim() ||
                !isValidNepalMobile(kycFormData.phone) ||
                !kycFiles.nidFront.file ||
                !kycFiles.nidBack.file ||
                !kycFiles.panCard.file ||
                !kycFiles.selfieWithNid.file
              }
              className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {kycMutation.isPending ? "Uploading..." : "Upload KYC Documents"}
            </button>
          ) : (
            <p className="text-sm text-green-600 dark:text-green-500 font-medium">
              Your KYC documents have been approved and can no longer be modified.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
