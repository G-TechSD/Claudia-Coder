/**
 * Admin Security API
 * GET - Get security status (lockdown state, security events)
 * POST - Security actions (lockdown, revoke access)
 */

import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/api-helpers"
import { cookies } from "next/headers"
import {
  getLockdownState,
  enableLockdown,
  disableLockdown,
  getSecurityEvents,
  logSecurityEvent,
} from "@/lib/beta/lockdown"
import {
  getAllUsers,
  getUserStats,
  revokeUserAccess,
  restoreUserAccess,
} from "@/lib/data/users"

/**
 * GET /api/admin/security
 * Get security dashboard data
 */
export const GET = withRole("admin")(async () => {
  try {
    const lockdownState = getLockdownState()
    const securityEvents = getSecurityEvents(50)
    const users = getAllUsers()
    const stats = getUserStats()

    return NextResponse.json({
      success: true,
      lockdown: lockdownState,
      events: securityEvents,
      users,
      stats,
    })
  } catch (error) {
    console.error("[Admin Security] Error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to get security status" },
      { status: 500 }
    )
  }
})

/**
 * POST /api/admin/security
 * Perform security actions
 */
export const POST = withRole("admin")(async (auth, request) => {
  try {
    const body = await request.json()
    const { action, userId, reason } = body

    const cookieStore = await cookies()

    switch (action) {
      case "enable_lockdown": {
        if (!reason) {
          return NextResponse.json(
            { success: false, error: "Reason is required for lockdown" },
            { status: 400 }
          )
        }

        const success = enableLockdown(auth.user.id, reason)
        if (success) {
          // Set lockdown cookie for all users (handled by middleware)
          // This will be broadcast to clients on their next request
          cookieStore.set("claudia-lockdown-active", "true", {
            path: "/",
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
          })

          return NextResponse.json({
            success: true,
            message: "System lockdown enabled",
            lockdown: getLockdownState(),
          })
        }
        return NextResponse.json(
          { success: false, error: "Failed to enable lockdown" },
          { status: 500 }
        )
      }

      case "disable_lockdown": {
        const success = disableLockdown(auth.user.id)
        if (success) {
          // Clear lockdown cookie
          cookieStore.delete("claudia-lockdown-active")

          return NextResponse.json({
            success: true,
            message: "System lockdown disabled",
            lockdown: getLockdownState(),
          })
        }
        return NextResponse.json(
          { success: false, error: "Failed to disable lockdown" },
          { status: 500 }
        )
      }

      case "revoke_access": {
        if (!userId) {
          return NextResponse.json(
            { success: false, error: "User ID is required" },
            { status: 400 }
          )
        }
        if (!reason) {
          return NextResponse.json(
            { success: false, error: "Reason is required for access revocation" },
            { status: 400 }
          )
        }

        // Cannot revoke own access
        if (userId === auth.user.id) {
          return NextResponse.json(
            { success: false, error: "Cannot revoke your own access" },
            { status: 400 }
          )
        }

        const success = revokeUserAccess(userId, reason)
        if (success) {
          logSecurityEvent({
            type: "access_revoked",
            userId: auth.user.id,
            targetUserId: userId,
            details: `Access revoked: ${reason}`,
            ipAddress: request.headers.get("x-forwarded-for") || null,
          })

          return NextResponse.json({
            success: true,
            message: "User access revoked",
          })
        }
        return NextResponse.json(
          { success: false, error: "Failed to revoke access" },
          { status: 500 }
        )
      }

      case "restore_access": {
        if (!userId) {
          return NextResponse.json(
            { success: false, error: "User ID is required" },
            { status: 400 }
          )
        }

        const success = restoreUserAccess(userId)
        if (success) {
          logSecurityEvent({
            type: "access_restored",
            userId: auth.user.id,
            targetUserId: userId,
            details: "Access restored",
            ipAddress: request.headers.get("x-forwarded-for") || null,
          })

          return NextResponse.json({
            success: true,
            message: "User access restored",
          })
        }
        return NextResponse.json(
          { success: false, error: "Failed to restore access" },
          { status: 500 }
        )
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error("[Admin Security] Action error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to perform security action" },
      { status: 500 }
    )
  }
})
