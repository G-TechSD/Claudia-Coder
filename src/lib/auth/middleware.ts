/**
 * Auth Middleware Helpers
 * Utilities for protecting routes and API endpoints
 */

import { headers, cookies } from "next/headers"
import { redirect } from "next/navigation"
import { auth, type Session, type AuthUser } from "./index"

/**
 * Get the current session from the request
 * Returns null if not authenticated
 * Supports beta auth bypass when NEXT_PUBLIC_BETA_AUTH_BYPASS is enabled
 */
export async function getServerSession(): Promise<Session | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (session) {
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
          updatedAt: new Date(),
          role: "user",
        } as AuthUser,
        session: {
          id: "bypass-session",
          expiresAt: new Date(Date.now() + 86400000),
          token: "bypass",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "beta-tester",
        }
      } as Session
    }

    return null
  } catch {
    // Allow bypass in beta mode even on error
    if (process.env.NEXT_PUBLIC_BETA_AUTH_BYPASS === "true") {
      return {
        user: {
          id: "beta-tester",
          name: "Beta Tester",
          email: "beta@claudiacoder.com",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          role: "user",
        } as AuthUser,
        session: {
          id: "bypass-session",
          expiresAt: new Date(Date.now() + 86400000),
          token: "bypass",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "beta-tester",
        }
      } as Session
    }
    return null
  }
}

/**
 * Get the current user from the session
 * Returns null if not authenticated
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getServerSession()
  return session?.user ?? null
}

/**
 * Require authentication for a server component or API route
 * Redirects to login if not authenticated
 */
export async function requireAuth(redirectTo = "/auth/login"): Promise<Session> {
  const session = await getServerSession()

  if (!session) {
    redirect(redirectTo)
  }

  return session
}

/**
 * Require authentication for API routes
 * Returns the session or throws an error
 */
export async function requireApiAuth(): Promise<Session> {
  const session = await getServerSession()

  if (!session) {
    throw new Error("Unauthorized")
  }

  return session
}

/**
 * Check if user has a specific role
 */
export async function hasRole(role: string): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.role === role
}

/**
 * Require a specific role
 * Throws an error if user doesn't have the role
 */
export async function requireRole(role: string): Promise<Session> {
  const session = await requireApiAuth()

  if (session.user.role !== role) {
    throw new Error("Forbidden")
  }

  return session
}

/**
 * Create an API response for unauthorized requests
 */
export function unauthorizedResponse(message = "Unauthorized") {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  })
}

/**
 * Create an API response for forbidden requests
 */
export function forbiddenResponse(message = "Forbidden") {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  })
}
