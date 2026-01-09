/**
 * Admin Users API
 * GET - List all users with role and NDA status
 */

import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/api-helpers"
import { getAllUsers, getUserStats } from "@/lib/data/users"

/**
 * GET /api/admin/users
 * List all users with statistics
 */
export const GET = withRole("admin")(async () => {
  try {
    const users = getAllUsers()
    const stats = getUserStats()

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
})
