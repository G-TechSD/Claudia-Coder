/**
 * Next.js Middleware for Route Protection
 * Redirects unauthenticated users to login page
 * Enforces beta tester sandboxed access restrictions
 * Requires NDA signature for beta testers
 * Enforces user data access sandboxing
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// ============ User Data Access Control ============

/**
 * Get the current user ID from the session cookie
 * This is used for user data sandboxing verification
 */
function getCurrentUserId(request: NextRequest): string | null {
  const userIdCookie = request.cookies.get("claudia-user-id")
  return userIdCookie?.value || null
}

/**
 * API routes that handle user-scoped data and require user ID verification
 * These routes must include the user ID in the request and verify access
 */
const USER_DATA_API_ROUTES = [
  "/api/projects",
  "/api/build-plans",
  "/api/packets",
  "/api/resources",
  "/api/research",
  "/api/business-ideas",
  "/api/patents",
  "/api/business-dev",
  "/api/brain-dumps",
]

/**
 * Check if a route handles user-scoped data
 */
function isUserDataRoute(pathname: string): boolean {
  return USER_DATA_API_ROUTES.some(route => pathname.startsWith(route))
}

/**
 * Check if a session cookie exists (Better Auth session)
 */
function hasSessionCookie(request: NextRequest): boolean {
  const sessionCookie = request.cookies.get("better-auth.session_token")
  return !!sessionCookie?.value
}

/**
 * Verify user data access for API routes
 * Returns an error response if access should be denied
 *
 * This function is now more resilient:
 * - If claudia-user-id cookie exists, it validates access
 * - If claudia-user-id is missing but session cookie exists, it allows the request
 *   to proceed so the route handler can do proper session verification
 * - Only blocks if there's clearly no auth at all
 */
function verifyUserDataAccess(
  request: NextRequest,
  pathname: string
): NextResponse | null {
  // Skip verification for non-user-data routes
  if (!isUserDataRoute(pathname)) {
    return null
  }

  const currentUserId = getCurrentUserId(request)
  const isAdminUser = isAdmin(request)

  // Admin users can access all data
  if (isAdminUser) {
    return null
  }

  // If user ID cookie is missing, check if session cookie exists
  // If session exists, let the request proceed - route handler will do full verification
  // This handles the case where session is valid but custom cookies aren't set yet
  if (!currentUserId) {
    if (hasSessionCookie(request)) {
      // Session exists but user ID cookie is missing
      // Let the request proceed - route handler will verify the session
      // and can extract user ID from the session data
      return null
    }

    // No user ID cookie AND no session cookie - deny access
    return NextResponse.json(
      {
        error: "User ID Required",
        message: "User identification required for this resource. Please log in again.",
        code: "USER_ID_REQUIRED",
      },
      { status: 401 }
    )
  }

  // For GET requests with a userId query param, verify it matches current user
  const url = new URL(request.url)
  const requestedUserId = url.searchParams.get("userId")

  if (requestedUserId && requestedUserId !== currentUserId) {
    return NextResponse.json(
      {
        error: "Access Denied",
        message: "You can only access your own data.",
        code: "USER_DATA_ACCESS_DENIED",
      },
      { status: 403 }
    )
  }

  // For POST/PUT/PATCH requests, we'd need to check the body
  // This is handled at the API route level since we can't easily parse body in middleware

  return null
}

// Routes that don't require authentication
const publicPaths = [
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/invite", // Invite code redemption
  "/auth/access-revoked", // Access revoked page
  "/maintenance", // System maintenance page
  "/api/auth", // Better Auth API routes
  "/api/dev/disable-auth", // Dev endpoint to disable auth
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
 * Check if user's access has been revoked
 * The cookie is set by the revoke API when access is revoked
 */
function isAccessRevoked(request: NextRequest): boolean {
  const revokedCookie = request.cookies.get("claudia-access-revoked")
  return revokedCookie?.value === "true"
}

/**
 * Check if system lockdown is active
 * The cookie is set by the lockdown API when lockdown is enabled
 */
function isSystemLockdown(request: NextRequest): boolean {
  const lockdownCookie = request.cookies.get("claudia-lockdown-active")
  return lockdownCookie?.value === "true"
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

  // Redirect root to Easy Mode for demo
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/easy-mode", request.url))
  }

  // TEMPORARY: Bypass all authentication for beta testing
  // TODO: Remove this before production release
  return NextResponse.next()

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

  // Check if user's access has been revoked
  if (isAccessRevoked(request)) {
    // For API routes, return JSON error
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "Access Revoked",
          message: "Your access has been revoked. Please contact support.",
          code: "ACCESS_REVOKED",
        },
        { status: 403 }
      )
    }

    // For page routes, redirect to access revoked page
    const revokedUrl = new URL("/auth/access-revoked", request.url)
    return NextResponse.redirect(revokedUrl)
  }

  // Check if system is in lockdown mode (only admins can access)
  if (isSystemLockdown(request) && !isAdmin(request)) {
    // For API routes, return JSON error
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "System Maintenance",
          message: "The system is currently in maintenance mode. Please try again later.",
          code: "LOCKDOWN_ACTIVE",
        },
        { status: 503 }
      )
    }

    // For page routes, redirect to maintenance page
    const maintenanceUrl = new URL("/maintenance", request.url)
    return NextResponse.redirect(maintenanceUrl)
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

  // Verify user data access for API routes (user sandboxing)
  if (pathname.startsWith("/api/")) {
    const accessError = verifyUserDataAccess(request, pathname)
    if (accessError) {
      return accessError
    }
  }

  // Add user ID to response headers for client-side use
  const response = NextResponse.next()
  const currentUserId = getCurrentUserId(request)
  if (currentUserId) {
    response.headers.set("x-claudia-user-id", currentUserId as string)
  }

  return response
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
