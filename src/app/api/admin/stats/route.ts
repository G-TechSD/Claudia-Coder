/**
 * Admin Platform Stats API
 * GET - Get overall platform statistics and engagement metrics
 */

import { NextResponse } from "next/server"
import { verifyApiAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/api-helpers"
import { getPlatformStats, getSessionStats } from "@/lib/data/sessions"
import { getUserStats } from "@/lib/data/users"

/**
 * GET /api/admin/stats
 * Get comprehensive platform statistics
 *
 * Returns:
 * - User counts and breakdown by role
 * - Session statistics (today, this week, this month)
 * - Active user metrics
 * - Engagement metrics (avg session duration, sessions per user)
 * - Popular features/pages
 */
export async function GET() {
  try {
    // Verify admin role
    const auth = await verifyApiAuth()
    if (!auth) {
      return unauthorizedResponse()
    }
    if (auth.user.role !== "admin") {
      return forbiddenResponse("Requires admin role")
    }

    // Get all stats
    const platformStats = getPlatformStats()
    const sessionStats = getSessionStats()
    const userStats = getUserStats()

    return NextResponse.json({
      success: true,
      stats: {
        // User metrics
        users: {
          total: platformStats.totalUsers,
          admins: userStats.admins,
          betaTesters: userStats.betaTesters,
          regularUsers: userStats.users,
          ndaSigned: userStats.ndaSigned,
          disabled: userStats.disabled,
          byRole: platformStats.usersByRole,
        },

        // Activity metrics
        activity: {
          activeToday: platformStats.activeUsersToday,
          activeThisWeek: platformStats.activeUsersThisWeek,
          activeThisMonth: platformStats.activeUsersThisMonth,
        },

        // Session metrics
        sessions: {
          total: sessionStats.total,
          today: platformStats.sessionsToday,
          thisWeek: platformStats.sessionsThisWeek,
          thisMonth: platformStats.sessionsThisMonth,
          avgPerUser: platformStats.avgSessionsPerUser,
          avgDuration: platformStats.avgSessionDuration,
          totalDuration: platformStats.totalSessionTime,
          totalClicks: sessionStats.totalClicks,
          totalErrors: sessionStats.totalErrors,
        },

        // Engagement metrics
        engagement: {
          avgSessionDuration: platformStats.avgSessionDuration,
          avgSessionsPerUser: platformStats.avgSessionsPerUser,
          totalSessionTime: platformStats.totalSessionTime,
        },

        // Feature usage
        features: {
          topFeatures: platformStats.topFeatures,
        },
      },
    })
  } catch (error) {
    console.error("[Admin Stats] Error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to get stats" },
      { status: 500 }
    )
  }
}
