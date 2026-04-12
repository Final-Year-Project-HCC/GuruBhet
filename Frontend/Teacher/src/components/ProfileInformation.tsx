"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { toast } from "react-toastify";
import LoadingSpinner from "./LoadingSpinner";
import { useTeacher } from "@/hooks/useTeacherProfile";
import { AvatarUpload } from "./AvatarUpload";

interface ProfileInformationProps {
  onSuccess?: () => void;
}

export function ProfileInformation({ onSuccess }: ProfileInformationProps) {
  const queryClient = useQueryClient();
  const { data: teacherData, isFetching } = useTeacher();
  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    tagline: "",
    bio: ""
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!teacherData?.user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData({
      firstName: teacherData.user.firstName ?? "",
      middleName: teacherData.user.middleName ?? "",
      lastName: teacherData.user.lastName ?? "",
      email: teacherData.user.email ?? "",
      tagline: teacherData.tagline ?? "",
      bio: teacherData.bio ?? ""
    });
  }, [teacherData]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const infoMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const response = await apiClient.patch(
        "/teachers/me/profile",
        data
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success("Profile information updated successfully");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["teacher", "me"] });
      onSuccess?.();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ||
          "Failed to update profile information",
      );
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (
      !formData.firstName.trim() ||
      !formData.lastName.trim() ||
      !formData.email.trim()
    ) {
      toast.error("First name, last name, and email are required");
      return;
    }
    const data = {
      firstName: formData.firstName,
      middleName: formData.middleName,
      lastName: formData.lastName,
      tagline: formData.tagline,
      bio: formData.bio,
    };
    infoMutation.mutate(data);
  };

  if (isFetching) return <LoadingSpinner />;

  return (
    <div className="border border-border rounded-lg p-6 mx-auto">
      <h2 className="text-2xl font-bold mb-6">Profile Information</h2>
      <form className="space-y-6">
        {/* Avatar Upload */}
        <AvatarUpload onSuccess={onSuccess} />

        {/* Name Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="firstName"
              className="block text-sm font-medium mb-2"
            >
              First Name <span className="text-destructive">*</span>
            </label>
            <input
              id="firstName"
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              required
              className={`w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none ${isEditing ? 'focus:ring-2 focus:ring-primary' : 'pointer-events-none'}`}
              placeholder="First name"
              readOnly={!isEditing}
              tabIndex={!isEditing ? -1 : 0}
            />
          </div>
          <div>
            <label
              htmlFor="middleName"
              className="block text-sm font-medium mb-2"
            >
              Middle Name
            </label>
            <input
              id="middleName"
              type="text"
              name="middleName"
              value={formData.middleName}
              onChange={handleInputChange}
              className={`w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none ${isEditing ? 'focus:ring-2 focus:ring-primary' : 'pointer-events-none'}`}
              placeholder="Middle name (optional)"
              readOnly={!isEditing}
              tabIndex={!isEditing ? -1 : 0}
            />
          </div>
          <div>
            <label
              htmlFor="lastName"
              className="block text-sm font-medium mb-2"
            >
              Last Name <span className="text-destructive">*</span>
            </label>
            <input
              id="lastName"
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              required
              className={`w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none ${isEditing ? 'focus:ring-2 focus:ring-primary' : 'pointer-events-none'}`}
              placeholder="Last name"
              readOnly={!isEditing}
              tabIndex={!isEditing ? -1 : 0}
            />
          </div>
        </div>
        <div>
          <label htmlFor="tagline" className="block text-sm font-medium mb-2">
            Tagline
          </label>
          <textarea
            id="tagline"
            name="tagline"
            value={formData.tagline}
            onChange={handleInputChange}
            className={`w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none min-h-[40px] ${isEditing ? 'focus:ring-2 focus:ring-primary' : 'pointer-events-none'}`}
            placeholder="Expert educator specializing in multiple subjects. Committed to providing personalized 1-to-1 learning experiences that help students achieve their full academic potential."
            readOnly={!isEditing}
            tabIndex={!isEditing ? -1 : 0}
            rows={4}
            maxLength={100}
          />
        </div>

        {/* Bio Field */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium mb-2">
            Bio
          </label>
          <textarea
            id="bio"
            name="bio"
            value={formData.bio}
            onChange={handleInputChange}
            className={`w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none min-h-[80px] ${isEditing ? 'focus:ring-2 focus:ring-primary' : 'pointer-events-none'}`}
            placeholder="With over 5 years of experience in the educational sector, I have helped hundreds of students navigate complex curricula including SEE/SLC, A-Levels, and Bachelor-level courses. My teaching methodology focuses on conceptual clarity followed by intensive problem-solving sessions."
            readOnly={!isEditing}
            tabIndex={!isEditing ? -1 : 0}
            rows={6}
            maxLength={1000}
          />
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
            value={formData.email}
            onChange={handleInputChange}
            required
            className={`w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none ${isEditing ? 'focus:ring-2 focus:ring-primary' : 'pointer-events-none'}`}
            placeholder="your@email.com"
            readOnly
            tabIndex={!isEditing ? -1 : 0}
          />
        </div>

        {/* Edit/Save Button */}
        <div className="pt-4 flex gap-4">
          {isEditing ? (
            <>
              <button
                type="button"
                disabled={infoMutation.isPending}
                onClick={handleSubmit}
                className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {infoMutation.isPending ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-6 py-2 border border-input rounded-md font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
