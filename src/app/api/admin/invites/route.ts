/**
 * Admin Invites API
 * POST - Create new invite
 * GET - List all invites with usage data
 */

import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/api-helpers"
import {
  createInvite,
  getAllInvites,
  getInviteStats,
} from "@/lib/data/invites"

/**
 * POST /api/admin/invites
 * Create a new beta invite
 */
export const POST = withRole("admin")(async (auth, request) => {
  try {
    const body = await request.json()
    const { email, maxUses, expiresAt } = body

    // Validate maxUses
    const uses = maxUses ? parseInt(maxUses, 10) : 1
    if (uses < 1 || uses > 100) {
      return NextResponse.json(
        { success: false, error: "maxUses must be between 1 and 100" },
        { status: 400 }
      )
    }

    // Validate expiresAt if provided
    if (expiresAt) {
      const expiryDate = new Date(expiresAt)
      if (isNaN(expiryDate.getTime()) || expiryDate < new Date()) {
        return NextResponse.json(
          { success: false, error: "expiresAt must be a valid future date" },
          { status: 400 }
        )
      }
    }

    const invite = createInvite({
      email: email || undefined,
      maxUses: uses,
      expiresAt: expiresAt || undefined,
      createdBy: auth.user.id,
    })

    return NextResponse.json({
      success: true,
      invite,
      inviteLink: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/register?invite=${invite.code}`,
    })
  } catch (error) {
    console.error("[Admin Invites] Create error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create invite" },
      { status: 500 }
    )
  }
})

/**
 * GET /api/admin/invites
 * List all invites with usage data and statistics
 */
export const GET = withRole("admin")(async () => {
  try {
    const invites = getAllInvites()
    const stats = getInviteStats()

    return NextResponse.json({
      success: true,
      invites,
      stats,
    })
  } catch (error) {
    console.error("[Admin Invites] List error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to list invites" },
      { status: 500 }
    )
  }
})
