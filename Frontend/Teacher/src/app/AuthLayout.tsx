"use client";

import { usePathname } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import TeacherNavbar from "@/components/TeacherNavbar";
import Footer from "@/components/Footer";

/** Routes accessible without logging in */
const PUBLIC_PATHS = ["/", "/dashboard", "/login", "/signup"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname);
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPublic = isPublicPath(pathname);

  return (
    <div className="min-h-screen flex flex-col">
      <TeacherNavbar />
      <main className="flex-1">
        {isPublic ? children : <AuthGuard>{children}</AuthGuard>}
      </main>
      <Footer />
    </div>
  );
}
