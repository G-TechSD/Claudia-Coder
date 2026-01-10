/**
 * Admin User Sessions API
 * GET - List all sessions for a specific user
 */

import { NextResponse, NextRequest } from "next/server"
import { verifyApiAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/api-helpers"
import { getSessions, getUserSessionStats } from "@/lib/data/sessions"
import { getUserById } from "@/lib/data/users"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/users/[id]/sessions
 * Get all sessions for a specific user
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // Verify admin role
    const auth = await verifyApiAuth()
    if (!auth) {
      return unauthorizedResponse()
    }
    if (auth.user.role !== "admin") {
      return forbiddenResponse("Requires admin role")
    }

    const { id: userId } = await context.params

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      )
    }

    // Verify user exists
    const user = getUserById(userId)
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }

    // Get query params
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get("limit") || "100", 10)
    const offset = parseInt(searchParams.get("offset") || "0", 10)
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined

    // Get sessions for this user
    const { sessions, total } = getSessions({
      userId,
      startDate,
      endDate,
      limit,
      offset,
    })

    // Get user session stats
    const stats = getUserSessionStats(userId)

    return NextResponse.json({
      success: true,
      sessions,
      stats,
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + sessions.length < total,
      },
    })
  } catch (error) {
    console.error("[Admin User Sessions] Error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to get sessions" },
      { status: 500 }
    )
  }
}
