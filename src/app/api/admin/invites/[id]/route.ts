/**
 * Admin Single Invite API
 * DELETE - Revoke an invite
 * GET - Get single invite details
 */

import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/api-helpers"
import { getInviteById, revokeInvite } from "@/lib/data/invites"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/invites/[id]
 * Get a single invite by ID
 */
export const GET = withRole("admin")(async (_auth, request) => {
  try {
    // Extract id from URL
    const url = new URL(request.url)
    const id = url.pathname.split("/").pop()

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Invite ID is required" },
        { status: 400 }
      )
    }

    const invite = getInviteById(id)

    if (!invite) {
      return NextResponse.json(
        { success: false, error: "Invite not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      invite,
    })
  } catch (error) {
    console.error("[Admin Invite] Get error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to get invite" },
      { status: 500 }
    )
  }
})

/**
 * DELETE /api/admin/invites/[id]
 * Revoke an invite
 */
export const DELETE = withRole("admin")(async (_auth, request) => {
  try {
    // Extract id from URL
    const url = new URL(request.url)
    const id = url.pathname.split("/").pop()

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Invite ID is required" },
        { status: 400 }
      )
    }

    const invite = getInviteById(id)

    if (!invite) {
      return NextResponse.json(
        { success: false, error: "Invite not found" },
        { status: 404 }
      )
    }

    if (invite.status === "revoked") {
      return NextResponse.json(
        { success: false, error: "Invite is already revoked" },
        { status: 400 }
      )
    }

    const success = revokeInvite(id)

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Failed to revoke invite" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Invite revoked successfully",
    })
  } catch (error) {
    console.error("[Admin Invite] Revoke error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to revoke invite" },
      { status: 500 }
    )
  }
})
