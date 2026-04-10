import { NextRequest, NextResponse } from "next/server";

/**
 * PROTECTED ROUTES - Require authentication
 * Routes that require user to be logged in
 */
const PROTECTED_ROUTES = [
  "/teachers",
  "/academic-setup",
  "/",
];

/**
 * PUBLIC ROUTES - Accessible without authentication
 * Routes that don't require login
 */
const PUBLIC_ROUTES = ["/login"];

/**
 * Check if a route is protected
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => {
    if (route === "/") {
      // Root path needs exact match but allow paths starting with /
      return pathname === "/" || pathname === "";
    }
    return pathname.startsWith(route);
  });
}

/**
 * Check if a route is public
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log("HELLO")
  // If it's a public route, allow it through without auth check
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // If it's not a protected route, allow it through
  if (!isProtectedRoute(pathname)) {
    return NextResponse.next();
  }
  console.log(pathname + " HELLO")
  console.log("All Cookies:", request.cookies.getAll());
  // Protected route: Check authentication
  const accessToken = request.cookies.get("access_token")?.value;
  console.log(accessToken)

  if (!accessToken) {
    // No token found, redirect to login
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Verify token with backend
    const verifyResponse = await verifyTokenWithBackend(accessToken);

    if (verifyResponse.ok) {
      // Token is valid, allow request to continue
      return NextResponse.next();
    }

    // Token is invalid or expired - try to refresh
    if (verifyResponse.status === 401) {
      const refreshToken = request.cookies.get("refresh_token")?.value;
  console.log(accessToken)

      if (!refreshToken) {
        // No refresh token, redirect to login
        const loginUrl = new URL("/login", request.url);
        return NextResponse.redirect(loginUrl);
      }

      try {
        // Try to refresh the token
        const refreshResponse = await refreshTokenWithBackend(refreshToken);

        if (!refreshResponse.ok) {
          // Refresh failed, redirect to login
          const loginUrl = new URL("/login", request.url);
          return NextResponse.redirect(loginUrl);
        }

        // Refresh succeeded - extract Set-Cookie headers and apply them
        // 1. We create a response that passes the modified request headers forward
        const response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });

        // 2. Get Set-Cookie headers from refresh response
        const setCookieHeaders = refreshResponse.headers.getSetCookie();
        
        // 3. Apply each Set-Cookie header to both the Response and the Request
        setCookieHeaders.forEach((cookieString) => {
          // Send to browser for future requests
          response.headers.append("Set-Cookie", cookieString);

          // Parse name and value to update the CURRENT request
          const [cookieNameValuePair] = cookieString.split(';');
          const [name, value] = cookieNameValuePair.split('=');
          
          // Update the request object so Server Components see the new token now
          request.cookies.set(name, value);
        });

        return response;
      } catch (refreshError) {
        // If refresh fails, redirect to login
        console.error("[Token Refresh Error]", refreshError);
        const loginUrl = new URL("/login", request.url);
        return NextResponse.redirect(loginUrl);
      }
    }

    // For any other error status, redirect to login
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  } catch (error) {
    // If backend verification fails, redirect to login for security
    console.error("[Middleware Auth Error]", error);
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
}

/**
 * Verify token with backend by calling /auth/me endpoint
 * Server-to-server communication (no CORS issues)
 */
async function verifyTokenWithBackend(
  accessToken: string
): Promise<Response> {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_URL || "https://api.gurubhet.tech/api/v1";

  try {
    const response = await fetch(`${apiBaseUrl}/auth/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-access-token": accessToken,
      },
      // Important: Don't send cookies automatically in server-to-server requests
      credentials: "omit",
    });

    return response;
  } catch (error) {
    console.error("[Backend Verification Error]", error);
    throw error;
  }
}

/**
 * Refresh token with backend by calling /auth/refresh endpoint
 * Sends refresh token in x-refresh-token header
 * Returns response with Set-Cookie headers for new tokens
 */
async function refreshTokenWithBackend(
  refreshToken: string
): Promise<Response> {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_URL || "https://api.gurubhet.tech/api/v1";

  try {
    const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-refresh-token": refreshToken,
      },
      // Important: Don't send cookies automatically in server-to-server requests
      credentials: "omit",
    });

    return response;
  } catch (error) {
    console.error("[Backend Refresh Error]", error);
    throw error;
  }
}

/**
 * Configuration for which routes to run middleware on
 * This prevents middleware from running on static assets, API routes, etc.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
