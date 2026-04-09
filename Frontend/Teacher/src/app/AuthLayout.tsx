"use client";
import TeacherNavbar from "@/components/TeacherNavbar";
import Footer from "@/components/Footer";
import { useUser } from "@/hooks";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading } = useUser();
  if (isLoading) {
    return <LoadingSpinner />;
  }
  return (
    <div className="min-h-screen flex flex-col">
      <TeacherNavbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
