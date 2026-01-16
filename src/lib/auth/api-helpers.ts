/**
 * API Authentication Helpers
 * Utilities for protecting API routes with Better Auth
 */

import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "./index"
import {
  type Role,
  type Permission,
  roleHasPermission,
  canAccessAdminPanel,
  isAdmin as checkIsAdmin,
} from "./roles"

/**
 * Response types for API helpers
 */
export interface AuthenticatedRequest {
  user: {
    id: string
    name: string
    email: string
    role?: string
    image?: string | null
  }
  session: {
    id: string
    expiresAt: Date
    token: string
  }
}

/**
 * Verify authentication for an API route
 * Returns the user and session if authenticated, or null if not
 */
export async function verifyApiAuth(): Promise<AuthenticatedRequest | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return null
    }

    return {
      user: session.user,
      session: session.session,
    }
  } catch {
    return null
  }
}

/**
 * Get session with beta auth bypass support
 * Returns a mock session when NEXT_PUBLIC_BETA_AUTH_BYPASS is enabled
 */
export async function getSessionWithBypass() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (session?.user) {
    return session
  }

  // Allow bypass in beta mode
  if (process.env.NEXT_PUBLIC_BETA_AUTH_BYPASS === "true") {
    return {
      user: {
        id: "beta-tester",
        name: "Beta Tester",
        email: "beta@claudiacoder.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      session: {
        id: "bypass-session",
        expiresAt: new Date(Date.now() + 86400000),
        token: "bypass",
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "beta-tester"
      }
    }
  }

  return null
}

/**
 * Create an unauthorized JSON response
 */
export function unauthorizedResponse(message = "Unauthorized") {
  return NextResponse.json(
    { success: false, error: message },
    { status: 401 }
  )
}

/**
 * Create a forbidden JSON response
 */
export function forbiddenResponse(message = "Forbidden") {
  return NextResponse.json(
    { success: false, error: message },
    { status: 403 }
  )
}

/**
 * Higher-order function to wrap an API handler with authentication
 *
 * Usage:
 * ```ts
 * export const GET = withAuth(async (auth, request) => {
 *   // auth.user is available here
 *   return NextResponse.json({ user: auth.user })
 * })
 * ```
 */
export function withAuth<T extends Request>(
  handler: (auth: AuthenticatedRequest, request: T) => Promise<Response>
) {
  return async (request: T): Promise<Response> => {
    const authResult = await verifyApiAuth()

    if (!authResult) {
      return unauthorizedResponse()
    }

    return handler(authResult, request)
  }
}

/**
 * Higher-order function to wrap an API handler with role-based auth
 *
 * Usage:
 * ```ts
 * export const POST = withRole("admin")(async (auth, request) => {
 *   // Only admins can access this
 *   return NextResponse.json({ success: true })
 * })
 * ```
 */
export function withRole<T extends Request>(role: string) {
  return (handler: (auth: AuthenticatedRequest, request: T) => Promise<Response>) => {
    return async (request: T): Promise<Response> => {
      const authResult = await verifyApiAuth()

      if (!authResult) {
        return unauthorizedResponse()
      }

      if (authResult.user.role !== role) {
        return forbiddenResponse(`Requires ${role} role`)
      }

      return handler(authResult, request)
    }
  }
}

/**
 * Get the current user ID from the session
 * Returns null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  const authResult = await verifyApiAuth()
  return authResult?.user.id ?? null
}

/**
 * Higher-order function to wrap an API handler with admin-only access
 *
 * Usage:
 * ```ts
 * export const POST = withAdmin(async (auth, request) => {
 *   // Only admins can access this
 *   return NextResponse.json({ success: true })
 * })
 * ```
 */
export function withAdmin<T extends Request>(
  handler: (auth: AuthenticatedRequest, request: T) => Promise<Response>
) {
  return withRole<T>("admin")(handler)
}

/**
 * Higher-order function to wrap an API handler with permission-based auth
 *
 * Usage:
 * ```ts
 * export const POST = withPermission("invite_users")(async (auth, request) => {
 *   // Only users with invite_users permission can access this
 *   return NextResponse.json({ success: true })
 * })
 * ```
 */
export function withPermission<T extends Request>(permission: Permission) {
  return (handler: (auth: AuthenticatedRequest, request: T) => Promise<Response>) => {
    return async (request: T): Promise<Response> => {
      const authResult = await verifyApiAuth()

      if (!authResult) {
        return unauthorizedResponse()
      }

      const userRole = (authResult.user.role || "user") as Role
      if (!roleHasPermission(userRole, permission)) {
        return forbiddenResponse(`Requires ${permission} permission`)
      }

      return handler(authResult, request)
    }
  }
}

/**
 * Check if the current request is from an admin user
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const authResult = await verifyApiAuth()
  if (!authResult) return false
  return authResult.user.role === "admin"
}

/**
 * Require admin access - returns error response if not admin, null if ok
 */
export async function requireAdmin(): Promise<Response | null> {
  const authResult = await verifyApiAuth()

  if (!authResult) {
    return unauthorizedResponse()
  }

  if (authResult.user.role !== "admin") {
    return forbiddenResponse("Admin access required")
  }

  return null
}
