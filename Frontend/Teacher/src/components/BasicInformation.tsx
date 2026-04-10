"use client";

import React, { useState, useEffect } from "react";
import { isValidNepalMobile } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { toast } from "react-toastify";
import FileInputWithPreview from "./FileInputWithPreview";
import LoadingSpinner from "./LoadingSpinner";
import { useTeacher } from "@/hooks/useCurrentUser";

interface FileState {
  file: File | null;
  previewUrl: string | null;
}

interface BasicInformationProps {
  onSuccess?: () => void;
}

/**
 * BasicInformation Component
 * Displays and manages teacher profile information:
 * - Personal Information: first name, middle name, last name, email
 * - KYC Documents: NID front/back, PAN card, phone number, selfie with NID
 */
export function BasicInformation({ onSuccess }: BasicInformationProps) {
  const [personalFormData, setPersonalFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
  });
  const [kycFormData, setKycFormData] = useState({
    phone: "",
  });
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const { data: user, isFetching } = useTeacher();
  const [kycFiles, setKycFiles] = useState<Record<string, FileState>>({
    nidFront: { file: null, previewUrl: null },
    nidBack: { file: null, previewUrl: null },
    panCard: { file: null, previewUrl: null },
    selfieWithNid: { file: null, previewUrl: null },
  });
  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPersonalFormData((prev) => ({
      ...prev,
      firstName: user.firstName ?? "",
      middleName: user.middleName ?? "",
      lastName: user.lastName ?? "",
      email: user.email ?? "",
    }));
    setKycFormData((prev) => ({
      ...prev,
      phone: user.phone ?? "",
    }));

    // Map TeacherDocument.type to KYC field keys
    const docTypeToField: Record<string, keyof typeof kycFiles> = {
      NID_FRONT: "nidFront",
      NID_BACK: "nidBack",
      PAN_CARD: "panCard",
      SELFIE_WITH_NID: "selfieWithNid",
    };
    if (user.documents && Array.isArray(user.documents)) {
      setKycFiles((prev) => {
        const updated: typeof prev = { ...prev };
        user.documents.forEach((doc) => {
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
  }, [user]);
  // Cleanup object URLs on component unmount
  useEffect(() => {
    return () => {
      Object.values(kycFiles).forEach((file) => {
        if (file.previewUrl) {
          URL.revokeObjectURL(file.previewUrl);
        }
      });
    };
  }, [kycFiles]);

  const personalInfoMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiClient.patch("/teachers/onboarding/personal-info", data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Personal information updated successfully");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to update personal information");
    },
  });

  const kycMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiClient.patch("/teachers/onboarding/documents", data, {
        headers: {
          "Content-Type": "multipart/form-data",
        }}
      );
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

  const handlePersonalInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPersonalFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleKycInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setKycFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (fieldName: string, file: File | null) => {
    // Revoke previous URL to avoid memory leaks
    if (kycFiles[fieldName]?.previewUrl) {
      URL.revokeObjectURL(kycFiles[fieldName].previewUrl);
    }

    const previewUrl = file ? URL.createObjectURL(file) : null;
    setKycFiles((prev) => ({
      ...prev,
      [fieldName]: { file, previewUrl },
    }));
  };

  const handlePersonalInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate required fields
    if (
      !personalFormData.firstName.trim() ||
      !personalFormData.lastName.trim() ||
      !personalFormData.email.trim()
    ) {
      toast.error("First name, last name, and email are required");
      return;
    }
    const formDataToSubmit = new FormData();
    formDataToSubmit.append("firstName", personalFormData.firstName);
    formDataToSubmit.append("middleName", personalFormData.middleName);
    formDataToSubmit.append("lastName", personalFormData.lastName);
    formDataToSubmit.append("email", personalFormData.email);
    personalInfoMutation.mutate(formDataToSubmit, {
      onSuccess: () => setIsEditingPersonal(false),
    });
  };

  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // All fields required
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
  if (isFetching) {
    return <LoadingSpinner />;
  }
  return (
    <div className="space-y-8">
      {/* Personal Information Section */}
      <div className="border border-border rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6">Personal Information</h2>
        <form onSubmit={handlePersonalInfoSubmit} className="space-y-6">
          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium mb-2">
                First Name <span className="text-destructive">*</span>
              </label>
              <input
                id="firstName"
                type="text"
                name="firstName"
                value={personalFormData.firstName}
                onChange={handlePersonalInputChange}
                required
                className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="First name"
                readOnly={!isEditingPersonal}
              />
            </div>
            <div>
              <label htmlFor="middleName" className="block text-sm font-medium mb-2">
                Middle Name
              </label>
              <input
                id="middleName"
                type="text"
                name="middleName"
                value={personalFormData.middleName}
                onChange={handlePersonalInputChange}
                className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Middle name (optional)"
                readOnly={!isEditingPersonal}
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium mb-2">
                Last Name <span className="text-destructive">*</span>
              </label>
              <input
                id="lastName"
                type="text"
                name="lastName"
                value={personalFormData.lastName}
                onChange={handlePersonalInputChange}
                required
                className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Last name"
                readOnly={!isEditingPersonal}
              />
            </div>
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email Address <span className="text-destructive">*</span>
            </label>
            <input
              id="email"
              type="email"
              name="email"
              value={personalFormData.email}
              onChange={handlePersonalInputChange}
              required
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="your@email.com"
              readOnly={!isEditingPersonal}
            />
          </div>

          {/* Edit/Save Button */}
          <div className="pt-4 flex gap-4">
            {isEditingPersonal ? (
              <button
                type="submit"
                disabled={personalInfoMutation.isPending}
                className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {personalInfoMutation.isPending ? "Saving..." : "Save"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingPersonal(true)}
                className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors"
              >
                Edit Personal Information
              </button>
            )}
          </div>
        </form>
      </div>

      {/* KYC Documents Section */}
      <div className="border border-border rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6">KYC Documents</h2>
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
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
              />
              <FileInputWithPreview
                name="nidBack"
                label="NID Back"
                previewSrc={kycFiles.nidBack.previewUrl || undefined}
                onChange={(file) => handleFileChange("nidBack", file)}
              />
              <FileInputWithPreview
                name="panCard"
                label="PAN Card"
                previewSrc={kycFiles.panCard.previewUrl || undefined}
                onChange={(file) => handleFileChange("panCard", file)}
              />
              <FileInputWithPreview
                name="selfieWithNid"
                label="Selfie with NID"
                previewSrc={kycFiles.selfieWithNid.previewUrl || undefined}
                onChange={(file) => handleFileChange("selfieWithNid", file)}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 flex gap-4">
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
          </div>
        </form>
      </div>
    </div>
  );
}
