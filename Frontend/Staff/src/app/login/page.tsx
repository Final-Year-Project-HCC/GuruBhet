"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";
import axios from "axios";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { validateEmail } from "@/lib/utils";
import apiClient from "@/lib/api";

type LoginInput = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<LoginInput>({ email: "", password: "" });
  const [touched, setTouched] = useState<Record<keyof LoginInput, boolean>>({ email: false, password: false });
  const [showPassword, setShowPassword] = useState(false);

  const errors: Partial<Record<keyof LoginInput, string>> = {};
  if ((touched.email || form.email.length > 0) && !validateEmail(form.email)) {
    errors.email = "Enter a valid email address";
  }
  if ((touched.password || form.password.length > 0) && form.password.length === 0) {
    errors.password = "Password is required";
  }

  const mutation = useMutation({
    mutationFn: async (payload: LoginInput) => {
      const { data } = await apiClient.post("/auth/login", payload, {
        withCredentials: true,
      });
      return data;
    },
    onError: (err: unknown) => {
      let message = "Login failed";
      if (axios.isAxiosError(err)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message = (err.response?.data as any)?.detail || (err.response?.data as any)?.message || err.message || message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      toast.error(message);
    },
    onSuccess: () => {
      toast.success("Logged in successfully");
      router.push("/academic-setup");
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
    setTouched({ email: true, password: true });
    if (!errors.email && !errors.password && form.email && form.password) {
      mutation.mutate({ email: form.email, password: form.password });
    }
  };

  const hasClientErrors = !!errors.email || !!errors.password;

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-lg border border-border p-6 bg-background">
        <h1 className="text-2xl font-semibold">Staff Login</h1>

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

        <button
          type="submit"
          disabled={mutation.isPending || hasClientErrors}
          className="w-full rounded-md bg-primary cursor-pointer text-primary-foreground px-4 py-2 disabled:opacity-60"
        >
          {mutation.isPending ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
