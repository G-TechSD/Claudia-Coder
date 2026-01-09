/**
 * Invite Code API
 * Handle invite code validation and creation
 */

import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import {
  isInviteCodeValid,
  useInviteCode,
  createInviteCode,
  getInviterDetails,
  getInvitesByUser,
  getUserRole,
} from "@/lib/auth/nda-db"

/**
 * GET /api/invite?code=XXX - Validate an invite code
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get("code")

    if (!code) {
      return NextResponse.json(
        { error: "Invite code is required" },
        { status: 400 }
      )
    }

    const { valid, reason, invite } = isInviteCodeValid(code)

    if (!valid) {
      return NextResponse.json(
        { valid: false, error: reason },
        { status: 400 }
      )
    }

    // Get inviter details
    const inviter = getInviterDetails(code)

    return NextResponse.json({
      valid: true,
      inviter: inviter
        ? {
            name: inviter.name,
          }
        : null,
      invitedEmail: invite?.invitedEmail || null,
    })
  } catch (error) {
    console.error("[Invite API] Error validating invite:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/invite - Create a new invite code (admin/user action)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Only admins can create invite codes
    const userRole = getUserRole(session.user.id)
    if (userRole !== "admin") {
      return NextResponse.json(
        { error: "Only administrators can create invite codes" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { invitedEmail, maxUses, expiresInDays } = body

    const invite = createInviteCode({
      invitedBy: session.user.id,
      invitedEmail,
      maxUses: maxUses || 1,
      expiresInDays: expiresInDays || 30,
    })

    return NextResponse.json({
      success: true,
      invite: {
        code: invite.code,
        maxUses: invite.maxUses,
        expiresAt: invite.expiresAt,
      },
    })
  } catch (error) {
    console.error("[Invite API] Error creating invite:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/invite - Use an invite code
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { code } = body

    if (!code) {
      return NextResponse.json(
        { error: "Invite code is required" },
        { status: 400 }
      )
    }

    const success = useInviteCode(code, session.user.id)

    if (!success) {
      return NextResponse.json(
        { error: "Invalid or expired invite code" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Invite code redeemed successfully",
    })
  } catch (error) {
    console.error("[Invite API] Error using invite:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
