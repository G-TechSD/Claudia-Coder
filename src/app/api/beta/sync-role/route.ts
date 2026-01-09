/**
 * Beta Role Sync API
 * Sets the user role cookie for middleware access
 * This should be called after login to sync the role cookie
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/auth/db"

export async function POST(request: NextRequest) {
  try {
    // Get the session token from the cookie
    const sessionToken = request.cookies.get("better-auth.session_token")?.value

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Look up the user's role from the database
    const result = db.prepare(`
      SELECT u.id, u.role
      FROM session s
      JOIN user u ON s.userId = u.id
      WHERE s.token = ?
    `).get(sessionToken) as { id: string; role: string } | undefined

    if (!result) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 401 }
      )
    }

    const role = result.role || "user"

    // Create the response and set the role cookie
    const response = NextResponse.json({
      success: true,
      role,
      userId: result.id,
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
  // DELETE endpoint to clear the role cookie (on logout)
  const response = NextResponse.json({ success: true })

  response.cookies.delete("claudia-user-role")

  return response
}
