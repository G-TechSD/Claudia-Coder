/**
 * Admin Single Invite API
 * GET - Get single invite details
 * DELETE - Revoke an invite
 * PATCH - Resend email for an invite
 */

import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/api-helpers"
import { getInviteById, revokeInvite, markEmailSent } from "@/lib/data/invites"
import { sendInviteEmail, isEmailConfigured } from "@/lib/email/send-invite"

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
 * PATCH /api/admin/invites/[id]
 * Resend email for an invite
 */
export const PATCH = withRole("admin")(async (auth, request) => {
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

    const body = await request.json()

    if (body.resendEmail) {
      if (!invite.email) {
        return NextResponse.json(
          { success: false, error: "This invite has no email address" },
          { status: 400 }
        )
      }

      if (invite.status === "revoked") {
        return NextResponse.json(
          { success: false, error: "Cannot send email for revoked invite" },
          { status: 400 }
        )
      }

      if (!isEmailConfigured()) {
        return NextResponse.json(
          { success: false, error: "Email is not configured" },
          { status: 400 }
        )
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const inviteLink = `${appUrl}/auth/register?invite=${invite.code}`

      const emailResult = await sendInviteEmail({
        to: invite.email,
        inviteCode: invite.code,
        inviteLink,
        customMessage: invite.customMessage || undefined,
        inviterName: auth.user.name,
        expiresAt: invite.expiresAt || undefined,
      })

      if (!emailResult.success) {
        return NextResponse.json(
          { success: false, error: emailResult.error || "Failed to send email" },
          { status: 500 }
        )
      }

      markEmailSent(id)

      return NextResponse.json({
        success: true,
        message: "Email sent successfully",
        messageId: emailResult.messageId,
      })
    }

    return NextResponse.json(
      { success: false, error: "No valid action specified" },
      { status: 400 }
    )
  } catch (error) {
    console.error("[Admin Invite] Patch error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update invite" },
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
