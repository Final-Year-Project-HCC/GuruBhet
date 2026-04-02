"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";
import axios from "axios";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { validateEmail } from "@/lib/utils";
import apiClient from "@/lib/api";

type SignupInput = {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
};

function passwordValidationMessages(password: string): string[] {
  const messages: string[] = [];
  if (!/[A-Z]/.test(password)) messages.push("uppercase letter");
  if (!/\d/.test(password)) messages.push("digit");
  return messages;
}

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<SignupInput>({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [touched, setTouched] = useState<Record<keyof SignupInput, boolean>>({
    firstName: false,
    middleName: false,
    lastName: false,
    email: false,
    phone: false,
    password: false,
    confirmPassword: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const errors: Partial<Record<keyof SignupInput, string>> = {};
  if ((touched.firstName || form.firstName.length > 0) && form.firstName.trim() === "") {
    errors.firstName = "First name is required";
  }
  if ((touched.lastName || form.lastName.length > 0) && form.lastName.trim() === "") {
    errors.lastName = "Last name is required";
  }
  if ((touched.email || form.email.length > 0) && !validateEmail(form.email)) {
    errors.email = "Enter a valid email address";
  }
  if ((touched.password || form.password.length > 0)) {
    const missing = passwordValidationMessages(form.password);
    if (form.password.length === 0) {
      errors.password = "Password is required";
    } else if (missing.length > 0) {
      errors.password = `Password must include: ${missing.join(", ")}`;
    }
  }
  if ((touched.confirmPassword || form.confirmPassword.length > 0)) {
    if (form.confirmPassword.length === 0) {
      errors.confirmPassword = "Confirm your password";
    } else if (form.confirmPassword !== form.password) {
      errors.confirmPassword = "Passwords do not match";
    }
  }

  const mutation = useMutation({
    mutationFn: async (payload: Omit<SignupInput, "confirmPassword">) => {
      const registrationPayload = {
        firstName: payload.firstName,
        middleName: payload.middleName || null,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone || null,
        password: payload.password,
        role: "TEACHER",
      };
      const { data } = await apiClient.post("/auth/register", registrationPayload);
      return data;
    },
    onError: (err: unknown) => {
      let message = "Signup failed";
      if (axios.isAxiosError(err)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message = (err.response?.data as any)?.detail || (err.response?.data as any)?.message || err.message || message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      toast.error(message);
    },
    onSuccess: () => {
      toast.success("Signed up successfully");
      router.push("/login");
    },
  });

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target as HTMLInputElement;
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();
    setTouched({ firstName: true, middleName: true, lastName: true, email: true, phone: true, password: true, confirmPassword: true });
    const hasErrors = Object.keys(errors).length > 0;
    if (!hasErrors) {
      const { confirmPassword, ...payload } = form;
      mutation.mutate(payload);
    }
  };

  const hasClientErrors = Object.keys(errors).length > 0;

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-4 rounded-lg border border-border p-6 bg-background">
        <h1 className="text-2xl font-semibold">Teacher Signup</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1" htmlFor="firstName">First Name</label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              value={form.firstName}
              onChange={onChange}
              onBlur={onBlur}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 outline-none focus:border-primary"
              placeholder="First name"
            />
            {errors.firstName && <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>}
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="middleName">Middle Name</label>
            <input
              id="middleName"
              name="middleName"
              type="text"
              value={form.middleName}
              onChange={onChange}
              onBlur={onBlur}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 outline-none focus:border-primary"
              placeholder="Middle name (optional)"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1" htmlFor="lastName">Last Name</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            value={form.lastName}
            onChange={onChange}
            onBlur={onBlur}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 outline-none focus:border-primary"
            placeholder="Last name"
          />
          {errors.lastName && <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>}
        </div>

        <div>
          <label className="block text-sm mb-1" htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={onChange}
            onBlur={onBlur}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 outline-none focus:border-primary"
            placeholder="you@example.com"
          />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        </div>

        <div>
          <label className="block text-sm mb-1" htmlFor="phone">Phone Number</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={onChange}
            onBlur={onBlur}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 outline-none focus:border-primary"
            placeholder="9800000000"
          />
        </div>

        <div>
          <label className="block text-sm mb-1" htmlFor="password">Password</label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={onChange}
              onBlur={onBlur}
              className="w-full rounded-md border border-input bg-transparent px-3 pr-10 py-2 outline-none focus:border-primary"
              placeholder="••••••••"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
        </div>

        <div>
          <label className="block text-sm mb-1" htmlFor="confirmPassword">Confirm Password</label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              value={form.confirmPassword}
              onChange={onChange}
              onBlur={onBlur}
              className="w-full rounded-md border border-input bg-transparent px-3 pr-10 py-2 outline-none focus:border-primary"
              placeholder="••••••••"
            />
            <button
              type="button"
              aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
              onClick={() => setShowConfirm((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirm ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
          {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
        </div>

        <button
          type="submit"
          disabled={mutation.isPending || hasClientErrors}
          className="w-full rounded-md bg-primary text-primary-foreground cursor-pointer px-4 py-2 disabled:opacity-60"
        >
          {mutation.isPending ? "Signing up..." : "Create Account"}
        </button>
      </form>
    </div>
  );
}
