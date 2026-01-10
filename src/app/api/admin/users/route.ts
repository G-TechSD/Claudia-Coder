/**
 * Admin Users API
 * GET - List all users with role and NDA status
 */

import { NextResponse, NextRequest } from "next/server"
import { verifyApiAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/api-helpers"
import { getAllUsers, getUserStats } from "@/lib/data/users"
import { getAllUsersWithSessionStats } from "@/lib/data/sessions"

/**
 * GET /api/admin/users
 * List all users with statistics
 * Query params:
 *   - includeSessionStats: Include session statistics for each user
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin role
    const auth = await verifyApiAuth()
    if (!auth) {
      return unauthorizedResponse()
    }
    if (auth.user.role !== "admin") {
      return forbiddenResponse("Requires admin role")
    }

    const searchParams = request.nextUrl.searchParams
    const includeSessionStats = searchParams.get("includeSessionStats") === "true"

    const users = getAllUsers()
    const stats = getUserStats()

    // Include session stats if requested
    if (includeSessionStats) {
      const usersWithStats = getAllUsersWithSessionStats()

      return NextResponse.json({
        success: true,
        users,
        usersWithStats,
        stats,
      })
    }

    return NextResponse.json({
      success: true,
      users,
      stats,
    })
  } catch (error) {
    console.error("[Admin Users] List error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to list users" },
      { status: 500 }
    )
  }
}
