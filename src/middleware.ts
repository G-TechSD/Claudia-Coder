/**
 * Next.js Middleware for Route Protection
 * Redirects unauthenticated users to login page
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Routes that don't require authentication
const publicPaths = [
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/api/auth", // Better Auth API routes
  "/landing",
  "/legal",
]

// Static assets that should always be accessible
const staticPaths = [
  "/_next",
  "/favicon.ico",
  "/claudia-logo.jpg",
  "/api/health", // Health check endpoint
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow static assets
  if (staticPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Check for session cookie (Better Auth uses this pattern)
  const sessionCookie = request.cookies.get("better-auth.session_token")
  const hasSession = !!sessionCookie?.value

  // If no session, redirect to login
  if (!hasSession) {
    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
