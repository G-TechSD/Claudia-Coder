/**
 * API Authentication Helpers
 * Utilities for protecting API routes with Better Auth
 */

import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "./index"

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
  const auth = await verifyApiAuth()
  return auth?.user.id ?? null
}
