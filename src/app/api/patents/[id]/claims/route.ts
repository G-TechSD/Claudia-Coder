/**
 * Patent Claims API
 * GET /api/patents/[id]/claims - Get all claims for a patent
 * POST /api/patents/[id]/claims - Add a new claim
 * PUT /api/patents/[id]/claims - Update a claim (requires claimId in body)
 * DELETE /api/patents/[id]/claims - Delete a claim (requires claimId in body or query param)
 */

import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import {
  getPatentResearchById,
  getPatentClaimsByPatentId,
  getPatentClaimById,
  createPatentClaim,
  updatePatentClaim,
  deletePatentClaim,
} from "@/lib/auth/patent-db"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Helper to verify patent ownership
 */
async function verifyPatentOwnership(
  patentId: string,
  userId: string
): Promise<{ error?: string; status?: number }> {
  const patent = getPatentResearchById(patentId)

  if (!patent) {
    return { error: "Patent not found", status: 404 }
  }

  if (patent.userId !== userId) {
    return { error: "Forbidden", status: 403 }
  }

  return {}
}

/**
 * GET /api/patents/[id]/claims
 * Get all claims for a patent
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
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

    const { id: patentId } = await params

    // Verify ownership
    const ownership = await verifyPatentOwnership(patentId, session.user.id)
    if (ownership.error) {
      return NextResponse.json(
        { error: ownership.error },
        { status: ownership.status }
      )
    }

    const claims = getPatentClaimsByPatentId(patentId)

    return NextResponse.json({
      success: true,
      claims,
    })
  } catch (error) {
    console.error("[Patent Claims API] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch claims" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/patents/[id]/claims
 * Add a new claim to a patent
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
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

    const { id: patentId } = await params
    const body = await request.json()

    // Verify ownership
    const ownership = await verifyPatentOwnership(patentId, session.user.id)
    if (ownership.error) {
      return NextResponse.json(
        { error: ownership.error },
        { status: ownership.status }
      )
    }

    // Validate required fields
    if (!body.text) {
      return NextResponse.json(
        { error: "Claim text is required" },
        { status: 400 }
      )
    }

    // Get existing claims to determine the next claim number
    const existingClaims = getPatentClaimsByPatentId(patentId)
    const nextClaimNumber = body.claimNumber ||
      (existingClaims.length > 0
        ? Math.max(...existingClaims.map((c) => c.claimNumber || 0)) + 1
        : 1)

    const claim = createPatentClaim({
      patentId,
      type: body.type || "independent",
      claimNumber: nextClaimNumber,
      text: body.text,
      status: body.status || "draft",
      dependencies: body.dependencies,
      notes: body.notes,
    })

    return NextResponse.json(
      {
        success: true,
        claim,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("[Patent Claims API] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create claim" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/patents/[id]/claims
 * Update a claim (requires claimId in body)
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
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

    const { id: patentId } = await params
    const body = await request.json()

    // Validate claimId is provided
    if (!body.claimId) {
      return NextResponse.json(
        { error: "Claim ID is required" },
        { status: 400 }
      )
    }

    // Verify ownership
    const ownership = await verifyPatentOwnership(patentId, session.user.id)
    if (ownership.error) {
      return NextResponse.json(
        { error: ownership.error },
        { status: ownership.status }
      )
    }

    // Verify claim exists and belongs to this patent
    const existingClaim = getPatentClaimById(body.claimId)
    if (!existingClaim) {
      return NextResponse.json(
        { error: "Claim not found" },
        { status: 404 }
      )
    }

    if (existingClaim.patentId !== patentId) {
      return NextResponse.json(
        { error: "Claim does not belong to this patent" },
        { status: 400 }
      )
    }

    // Update the claim
    const claim = updatePatentClaim(body.claimId, {
      type: body.type,
      claimNumber: body.claimNumber,
      text: body.text,
      status: body.status,
      dependencies: body.dependencies,
      notes: body.notes,
    })

    if (!claim) {
      return NextResponse.json(
        { error: "Failed to update claim" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      claim,
    })
  } catch (error) {
    console.error("[Patent Claims API] PUT error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update claim" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/patents/[id]/claims
 * Delete a claim (requires claimId in body or as query param)
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
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

    const { id: patentId } = await params

    // Get claimId from query params or body
    const { searchParams } = new URL(request.url)
    let claimId = searchParams.get("claimId")

    if (!claimId) {
      try {
        const body = await request.json()
        claimId = body.claimId
      } catch {
        // No body provided
      }
    }

    if (!claimId) {
      return NextResponse.json(
        { error: "Claim ID is required" },
        { status: 400 }
      )
    }

    // Verify ownership
    const ownership = await verifyPatentOwnership(patentId, session.user.id)
    if (ownership.error) {
      return NextResponse.json(
        { error: ownership.error },
        { status: ownership.status }
      )
    }

    // Verify claim exists and belongs to this patent
    const existingClaim = getPatentClaimById(claimId)
    if (!existingClaim) {
      return NextResponse.json(
        { error: "Claim not found" },
        { status: 404 }
      )
    }

    if (existingClaim.patentId !== patentId) {
      return NextResponse.json(
        { error: "Claim does not belong to this patent" },
        { status: 400 }
      )
    }

    const deleted = deletePatentClaim(claimId)

    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete claim" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Claim deleted successfully",
    })
  } catch (error) {
    console.error("[Patent Claims API] DELETE error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete claim" },
      { status: 500 }
    )
  }
}
