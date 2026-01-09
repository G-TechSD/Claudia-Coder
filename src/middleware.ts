/**
 * Next.js Middleware for Route Protection
 * Redirects unauthenticated users to login page
 * Enforces beta tester sandboxed access restrictions
 * Requires NDA signature for beta testers
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Routes that don't require authentication
const publicPaths = [
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/invite", // Invite code redemption
  "/api/auth", // Better Auth API routes
  "/landing",
  "/legal",
]

// Routes that require auth but NOT NDA signature
const ndaExemptPaths = [
  "/auth/nda", // NDA signing page itself
  "/api/nda", // NDA API endpoints
  "/api/invite", // Invite API endpoints
]

// Static assets that should always be accessible
const staticPaths = [
  "/_next",
  "/favicon.ico",
  "/claudia-logo.jpg",
  "/api/health", // Health check endpoint
  "/api/beta", // Beta API endpoints
]

// Routes that beta testers cannot access
const BETA_RESTRICTED_ROUTES = [
  "/admin",
  "/claude-code",
  "/settings/data",
]

// API routes restricted for beta testers
const BETA_RESTRICTED_API_ROUTES = [
  "/api/admin",
  "/api/settings/data",
]

/**
 * Check if the user is a beta tester based on the role cookie
 */
function isBetaTester(request: NextRequest): boolean {
  const roleCookie = request.cookies.get("claudia-user-role")
  const role = roleCookie?.value
  return role === "beta" || role === "beta_tester"
}

/**
 * Check if the user is an admin based on the role cookie
 */
function isAdmin(request: NextRequest): boolean {
  const roleCookie = request.cookies.get("claudia-user-role")
  const role = roleCookie?.value
  return role === "admin"
}

/**
 * Check if the user has signed the NDA based on a cookie
 * The cookie is set by the NDA signing API after successful signature
 */
function hasSignedNda(request: NextRequest): boolean {
  const ndaCookie = request.cookies.get("claudia-nda-signed")
  return ndaCookie?.value === "true"
}

/**
 * Check if a path is exempt from NDA requirement
 */
function isNdaExemptPath(pathname: string): boolean {
  return ndaExemptPaths.some((path) => pathname.startsWith(path))
}

/**
 * Check if a route is restricted for beta testers
 */
function isRouteRestrictedForBeta(pathname: string): boolean {
  // Check page routes
  if (BETA_RESTRICTED_ROUTES.some(route => pathname.startsWith(route) || pathname === route)) {
    return true
  }
  // Check API routes
  if (BETA_RESTRICTED_API_ROUTES.some(route => pathname.startsWith(route) || pathname === route)) {
    return true
  }
  return false
}

/**
 * Get a user-friendly message for beta restriction
 */
function getBetaRestrictionMessage(pathname: string): string {
  if (pathname.startsWith("/admin")) {
    return "Admin features are not available for beta testers."
  }
  if (pathname.startsWith("/claude-code")) {
    return "The Claude Code development interface is not available for beta testers."
  }
  if (pathname.startsWith("/settings/data")) {
    return "Data management features are not available for beta testers."
  }
  return "This feature is not available for beta testers."
}

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

  // Check NDA requirement for beta testers (admins bypass this check)
  if (isBetaTester(request) && !isAdmin(request) && !isNdaExemptPath(pathname)) {
    if (!hasSignedNda(request)) {
      // For API routes, return a JSON error
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          {
            error: "NDA Required",
            message: "You must sign the Non-Disclosure Agreement before accessing this resource.",
            code: "NDA_REQUIRED",
            redirect: "/auth/nda",
          },
          { status: 403 }
        )
      }

      // For page routes, redirect to NDA signing page
      const ndaUrl = new URL("/auth/nda", request.url)
      ndaUrl.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(ndaUrl)
    }
  }

  // Check beta tester restrictions
  if (isBetaTester(request) && isRouteRestrictedForBeta(pathname)) {
    // For API routes, return a JSON error
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "Access denied",
          message: getBetaRestrictionMessage(pathname),
          code: "BETA_RESTRICTED",
        },
        { status: 403 }
      )
    }

    // For page routes, redirect to a restricted access page
    const restrictedUrl = new URL("/beta/restricted", request.url)
    restrictedUrl.searchParams.set("from", pathname)
    restrictedUrl.searchParams.set("message", getBetaRestrictionMessage(pathname))
    return NextResponse.redirect(restrictedUrl)
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
