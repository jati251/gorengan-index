import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isAuthPage = pathname.startsWith("/login");
  const isApiAuth = pathname.startsWith("/api/auth");

  // Allow API auth endpoints to run freely
  if (isApiAuth) {
    return NextResponse.next();
  }

  // If already logged in and visiting login page, redirect to full terminal
  if (isAuthPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/terminal", req.url));
    }
    return NextResponse.next();
  }

  // Public Landing Page (/) is accessible to everyone
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Protected routes (e.g. /terminal and sub-routes) require authentication
  const isProtectedRoute = pathname.startsWith("/terminal");
  if (isProtectedRoute && !isLoggedIn) {
    const callbackUrl = encodeURIComponent(pathname);
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, req.url)
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static assets)
     * - _next/image (image optimization)
     * - favicon.ico, public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
