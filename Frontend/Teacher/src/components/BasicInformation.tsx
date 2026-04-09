'use client';

import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { toast } from 'react-toastify';
import FileInputWithPreview from './FileInputWithPreview';

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
 * - Name fields (first, middle, last)
 * - Email address
 * - KYC document uploads (PAN, Citizenship, Selfies)
 */
export function BasicInformation({ onSuccess }: BasicInformationProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
  });

  const [files, setFiles] = useState<Record<string, FileState>>({
    panCard: { file: null, previewUrl: null },
    citizenship: { file: null, previewUrl: null },
    selfie: { file: null, previewUrl: null },
    selfieWithCitizenship: { file: null, previewUrl: null },
  });

  // Cleanup object URLs on component unmount
  useEffect(() => {
    return () => {
      Object.values(files).forEach((file) => {
        if (file.previewUrl) {
          URL.revokeObjectURL(file.previewUrl);
        }
      });
    };
  }, []);

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiClient.patch('/teachers/me', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Profile updated successfully');
      onSuccess?.();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to update profile');
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (fieldName: string, file: File | null) => {
    // Revoke previous URL to avoid memory leaks
    if (files[fieldName]?.previewUrl) {
      URL.revokeObjectURL(files[fieldName].previewUrl);
    }

    const previewUrl = file ? URL.createObjectURL(file) : null;
    setFiles((prev) => ({
      ...prev,
      [fieldName]: { file, previewUrl },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
      toast.error('First name, last name, and email are required');
      return;
    }

    const formDataToSubmit = new FormData();
    formDataToSubmit.append('firstName', formData.firstName);
    formDataToSubmit.append('middleName', formData.middleName);
    formDataToSubmit.append('lastName', formData.lastName);
    formDataToSubmit.append('email', formData.email);

    // Add files if they exist
    Object.entries(files).forEach(([key, { file }]) => {
      if (file) {
        formDataToSubmit.append(key, file);
      }
    });

    updateMutation.mutate(formDataToSubmit);
  };

  return (
    <div className="space-y-8">
      {/* Personal Information Section */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Personal Information</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
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
                value={formData.firstName}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="First name"
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
                value={formData.middleName}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Middle name (optional)"
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
                value={formData.lastName}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Last name"
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
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="your@email.com"
            />
          </div>

          {/* Document Upload Section */}
          <div className="pt-4 border-t border-border">
            <h3 className="text-lg font-semibold mb-6">KYC Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FileInputWithPreview
                name="panCard"
                label="PAN Card"
                previewSrc={files.panCard.previewUrl || undefined}
                onChange={(file) => handleFileChange('panCard', file)}
              />
              <FileInputWithPreview
                name="citizenship"
                label="Citizenship Document"
                previewSrc={files.citizenship.previewUrl || undefined}
                onChange={(file) => handleFileChange('citizenship', file)}
              />
              <FileInputWithPreview
                name="selfie"
                label="Selfie"
                previewSrc={files.selfie.previewUrl || undefined}
                onChange={(file) => handleFileChange('selfie', file)}
              />
              <FileInputWithPreview
                name="selfieWithCitizenship"
                label="Selfie with Citizenship Document"
                previewSrc={files.selfieWithCitizenship.previewUrl || undefined}
                onChange={(file) => handleFileChange('selfieWithCitizenship', file)}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-6 flex gap-4">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
