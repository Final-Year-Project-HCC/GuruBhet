import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("access_token")?.value;

  if (!token) {
    if (!request.nextUrl.pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));

    if (payload.role !== "STAFF") {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }

    const pathname = request.nextUrl.pathname;
    const permissions = payload.permissions || [];
    const isSuperuser = payload.is_superuser || false;

    if (
      pathname.startsWith("/management") &&
      !isSuperuser &&
      !permissions.includes("staff:manage")
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (
      pathname.startsWith("/approvals") &&
      !isSuperuser &&
      !permissions.includes("teacher:verify")
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (
      pathname.startsWith("/academics") &&
      !isSuperuser &&
      !permissions.includes("academic_domains:manage")
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  } catch (error) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login|unauthorized).*)",
  ],
};
