/**
 * Beta Role Sync API
 * Sets the user role cookie for middleware access
 * Also sets security-related cookies (revoked access, lockdown status)
 * This should be called after login to sync cookies
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/auth/db"
import { isLockdownMode } from "@/lib/beta/lockdown"

export async function POST(request: NextRequest) {
  try {
    // Get the session token from the cookie
    const sessionToken = request.cookies.get("better-auth.session_token")?.value

    let result: { id: string; role: string; accessRevoked: number } | undefined

    if (sessionToken) {
      // Look up the user's role and security status from the database
      result = db.prepare(`
        SELECT u.id, u.role, COALESCE(u.accessRevoked, 0) as accessRevoked
        FROM session s
        JOIN user u ON s.userId = u.id
        WHERE s.token = ?
      `).get(sessionToken) as { id: string; role: string; accessRevoked: number } | undefined
    }

    // Allow bypass in beta mode - use admin role for full access
    if (!result && process.env.NEXT_PUBLIC_BETA_AUTH_BYPASS === "true") {
      result = { id: "beta-admin", role: "admin", accessRevoked: 0 }
    }

    if (!result) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    const role = result.role || "user"
    const accessRevoked = !!result.accessRevoked
    const lockdownActive = isLockdownMode()

    // Create the response and set cookies
    const response = NextResponse.json({
      success: true,
      role,
      userId: result.id,
      accessRevoked,
      lockdownActive,
    })

    // Set the user ID cookie (httpOnly: false so middleware can read it)
    // This cookie is used by middleware for user data sandboxing
    response.cookies.set("claudia-user-id", result.id, {
      httpOnly: false, // Must be false for middleware to access
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days (matches session)
    })

    // Set the role cookie (httpOnly: false so middleware can read it)
    // This cookie is used by middleware to check beta restrictions
    response.cookies.set("claudia-user-role", role, {
      httpOnly: false, // Must be false for middleware to access
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days (matches session)
    })

    // Set access revoked cookie
    if (accessRevoked) {
      response.cookies.set("claudia-access-revoked", "true", {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      })
    } else {
      response.cookies.delete("claudia-access-revoked")
    }

    // Set lockdown status cookie
    if (lockdownActive) {
      response.cookies.set("claudia-lockdown-active", "true", {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60, // 1 hour - refresh more frequently for lockdown
      })
    } else {
      response.cookies.delete("claudia-lockdown-active")
    }

    return response
  } catch (error) {
    console.error("[beta/sync-role] Error:", error)
    return NextResponse.json(
      { error: "Failed to sync role" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // GET endpoint to check current role
  const roleCookie = request.cookies.get("claudia-user-role")

  return NextResponse.json({
    role: roleCookie?.value || null,
  })
}

export async function DELETE() {
  // DELETE endpoint to clear all security cookies (on logout)
  const response = NextResponse.json({ success: true })

  response.cookies.delete("claudia-user-id")
  response.cookies.delete("claudia-user-role")
  response.cookies.delete("claudia-access-revoked")
  response.cookies.delete("claudia-lockdown-active")
  response.cookies.delete("claudia-nda-signed")

  return response
}
