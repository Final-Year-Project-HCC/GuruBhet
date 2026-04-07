"use client";

import AuthGuard from "@/components/AuthGuard";
import TeacherNavbar from "@/components/TeacherNavbar";
import Footer from "@/components/Footer";
import { useAuthFailureListener } from "@/hooks";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useAuthFailureListener();
  return (
    <AuthGuard>
      <div className="min-h-screen flex flex-col">
        <TeacherNavbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </AuthGuard>
  );
}
