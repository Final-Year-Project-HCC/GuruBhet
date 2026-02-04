"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-toastify";
import FileInputWithPreview from "../../components/FileInputWithPreview";

type TeacherProfile = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  panCard?: File | null;
  citizenship?: File | null;
  selfie?: File | null;
  selfieWithCitizenship?: File | null;
};

export default function TeacherProfilePage() {
  const [data, setData] = useState<TeacherProfile>({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    panCard: null,
    citizenship: null,
    selfie: null,
    selfieWithCitizenship: null,
  });
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const objectUrlsRef = useRef<Record<string, string>>({});
  const mutation = useMutation({
    mutationFn: async (payload: FormData) => {
      const url = process.env.NEXT_PUBLIC_API_BASE_URL
        ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/teacher/profile`
        : "/api/teacher/profile";
      const { data } = await axios.post(url, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Profile updated successfully");
    },
    onError: (err) => {
      let message = "Update failed";
      if (axios.isAxiosError(err)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message = (err.response?.data as any)?.message || err.message || message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      toast.error(message);
    },
  });

  function onTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setData((d) => ({ ...d, [name]: value }));
  }

  function setFile(name: keyof TeacherProfile & string, file: File | null) {
    setData((d) => ({ ...d, [name]: file }));
    // Revoke previous URL to avoid memory leaks
    const prevUrl = objectUrlsRef.current[name];
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    if (file) {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current[name] = url;
      setPreviews((p) => ({ ...p, [name]: url }));
    } else {
      delete objectUrlsRef.current[name];
      setPreviews((p) => ({ ...p, [name]: "" }));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data.firstName || !data.lastName) {
      toast.error("First and Last name are required");
      return;
    }
    if (!data.email) {
      toast.error("Email is required");
      return;
    }

    const form = new FormData();
    form.append("firstName", data.firstName);
    form.append("middleName", data.middleName);
    form.append("lastName", data.lastName);
    form.append("email", data.email);
    if (data.panCard) form.append("panCard", data.panCard);
    if (data.citizenship) form.append("citizenship", data.citizenship);
    if (data.selfie) form.append("selfie", data.selfie);
    if (data.selfieWithCitizenship) form.append("selfieWithCitizenship", data.selfieWithCitizenship);

    mutation.mutate(form);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">Update Profile</h1>
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-muted-foreground">First Name</label>
            <input
              name="firstName"
              value={data.firstName}
              onChange={onTextChange}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
              placeholder="First name"
            />
          </div>
          <div>
            <label className="mb-1 block text-muted-foreground">Middle Name</label>
            <input
              name="middleName"
              value={data.middleName}
              onChange={onTextChange}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
              placeholder="Middle name"
            />
          </div>
          <div>
            <label className="mb-1 block text-muted-foreground">Last Name</label>
            <input
              name="lastName"
              value={data.lastName}
              onChange={onTextChange}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
              placeholder="Last name"
            />
          </div>
          <div>
            <label className="mb-1 block text-muted-foreground">Email</label>
            <input
              type="email"
              name="email"
              value={data.email}
              onChange={onTextChange}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
              placeholder="email@example.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <FileInputWithPreview
            name="panCard"
            label="PAN Card"
            previewSrc={previews.panCard}
            onChange={(file) => setFile("panCard", file)}
          />
          <FileInputWithPreview
            name="citizenship"
            label="Citizenship"
            previewSrc={previews.citizenship}
            onChange={(file) => setFile("citizenship", file)}
          />
          <FileInputWithPreview
            name="selfie"
            label="Selfie"
            previewSrc={previews.selfie}
            onChange={(file) => setFile("selfie", file)}
          />
          <FileInputWithPreview
            name="selfieWithCitizenship"
            label="Selfie with Citizenship"
            previewSrc={previews.selfieWithCitizenship}
            onChange={(file) => setFile("selfieWithCitizenship", file)}
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {mutation.isPending ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
