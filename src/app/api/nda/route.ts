/**
 * NDA Signature API
 * Handle NDA signing and checking
 */

import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { getSessionWithBypass } from "@/lib/auth/api-helpers"
import {
  hasSignedNda,
  getNdaSignature,
  createNdaSignature,
} from "@/lib/auth/nda-db"

/**
 * GET /api/nda - Check if current user has signed NDA
 */
export async function GET() {
  try {
    const session = await getSessionWithBypass()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const hasSigned = hasSignedNda(session.user.id)
    const signature = hasSigned ? getNdaSignature(session.user.id) : null

    const response = NextResponse.json({
      hasSigned,
      signature: signature
        ? {
            fullName: signature.fullName,
            signedAt: signature.signedAt,
            ndaVersion: signature.ndaVersion,
          }
        : null,
    })

    // If user has signed NDA, ensure the cookie is set (for middleware checks)
    if (hasSigned) {
      response.cookies.set("claudia-nda-signed", "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: "/",
      })
    }

    return response
  } catch (error) {
    console.error("[NDA API] Error checking NDA status:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/nda - Sign the NDA
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionWithBypass()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { fullName, signature, signatureType, agreedToTerms } = body

    // Validate required fields
    if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
      return NextResponse.json(
        { error: "Full name is required (minimum 2 characters)" },
        { status: 400 }
      )
    }

    if (!signature || typeof signature !== "string") {
      return NextResponse.json(
        { error: "Signature is required" },
        { status: 400 }
      )
    }

    if (!agreedToTerms) {
      return NextResponse.json(
        { error: "You must agree to the terms" },
        { status: 400 }
      )
    }

    // Check if already signed
    if (hasSignedNda(session.user.id)) {
      return NextResponse.json(
        { error: "You have already signed the NDA" },
        { status: 400 }
      )
    }

    // Get IP and User Agent for audit trail
    const headersList = await headers()
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0] ||
      headersList.get("x-real-ip") ||
      "unknown"
    const userAgent = headersList.get("user-agent") || "unknown"

    // Create the signature
    const ndaSignature = createNdaSignature({
      userId: session.user.id,
      fullName: fullName.trim(),
      email: session.user.email,
      signature,
      signatureType: signatureType === "drawn" ? "drawn" : "typed",
      ipAddress,
      userAgent,
    })

    // Create response with NDA signed cookie
    const response = NextResponse.json({
      success: true,
      signature: {
        fullName: ndaSignature.fullName,
        signedAt: ndaSignature.signedAt,
        ndaVersion: ndaSignature.ndaVersion,
      },
    })

    // Set the NDA signed cookie (used by middleware for quick checks)
    // Cookie expires in 1 year or when NDA version changes
    response.cookies.set("claudia-nda-signed", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    })

    return response
  } catch (error) {
    console.error("[NDA API] Error signing NDA:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
