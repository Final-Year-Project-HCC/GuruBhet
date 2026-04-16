"use client";

import { usePathname } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import StudentNavbar from "@/components/StudentNavbar";
import Footer from "@/components/Footer";

/** Routes accessible without logging in */
const PUBLIC_PATHS = ["/", "/login", "/signup", "/search-teacher"];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/teacher-profile")
  );
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
      <StudentNavbar />
      <main className="flex-1">
        {isPublic ? children : <AuthGuard>{children}</AuthGuard>}
      </main>
      <Footer />
    </div>
  );
}
