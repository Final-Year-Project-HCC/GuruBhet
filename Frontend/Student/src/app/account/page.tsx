"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-toastify";
import { validateEmail } from "../../lib/utils";

type StudentProfile = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
};

export default function StudentProfilePage() {
  const [data, setData] = useState<StudentProfile>({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
  });
  const mutation = useMutation({
    mutationFn: async (payload: StudentProfile) => {
      const url = process.env.NEXT_PUBLIC_API_BASE_URL
        ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/student/profile`
        : "/api/student/profile";
      const { data } = await axios.post(url, payload, {
        headers: { "Content-Type": "application/json" },
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

  function onChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const { name, value } = e.target;
    setData((d) => ({ ...d, [name]: value }));
  }

  async function onSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    if (!data.firstName || !data.lastName) {
      toast.error("First and Last name are required");
      return;
    }
    if (!validateEmail(data.email)) {
      toast.error("Please enter a valid email");
      return;
    }
    mutation.mutate(data);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-2 text-2xl font-semibold">Update Account</h1>
      <p className="mb-4 text-muted-foreground">Keep your information up to date.</p>
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-muted-foreground">First Name</label>
              <input
                name="firstName"
                value={data.firstName}
                onChange={onChange}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
                placeholder="First name"
              />
            </div>
            <div>
              <label className="mb-1 block text-muted-foreground">Middle Name</label>
              <input
                name="middleName"
                value={data.middleName}
                onChange={onChange}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
                placeholder="Middle name (optional)"
              />
            </div>
            <div>
              <label className="mb-1 block text-muted-foreground">Last Name</label>
              <input
                name="lastName"
                value={data.lastName}
                onChange={onChange}
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
                onChange={onChange}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
