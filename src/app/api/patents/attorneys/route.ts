/**
 * Patent Attorneys API
 * GET - List patent attorneys/services
 * POST - Submit referral request
 */

import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthenticatedRequest } from "@/lib/auth/api-helpers"
import {
  getAllAttorneys,
  searchAttorneys,
  trackReferral,
  getUserReferrals,
  getPatentReferrals,
  Attorney,
  Referral
} from "@/lib/data/referrals"

/**
 * GET /api/patents/attorneys
 * List patent attorneys, optionally filtered by specialty/location
 * Query params:
 *   - specialty: Filter by specialty (e.g., "software", "biotechnology")
 *   - location: Filter by location (e.g., "San Francisco")
 *   - minRating: Minimum rating (1-5)
 *   - patentId: If provided, also returns referrals for this patent
 */
export const GET = withAuth(async (auth: AuthenticatedRequest, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const specialty = searchParams.get("specialty") || undefined
    const location = searchParams.get("location") || undefined
    const minRating = searchParams.get("minRating")
    const patentId = searchParams.get("patentId")

    let attorneys: Attorney[]

    // Apply filters if any are provided
    if (specialty || location || minRating) {
      attorneys = searchAttorneys({
        specialty,
        location,
        minRating: minRating ? parseFloat(minRating) : undefined
      })
    } else {
      attorneys = getAllAttorneys({ activeOnly: true })
    }

    // Get user's referrals
    const userReferrals = getUserReferrals(auth.user.id)

    // If patentId provided, get referrals for that patent
    let patentReferrals: Referral[] = []
    if (patentId) {
      patentReferrals = getPatentReferrals(patentId)
    }

    // Get unique specialties for filter UI
    const allAttorneys = getAllAttorneys({ activeOnly: true })
    const specialties = [...new Set(allAttorneys.flatMap(a => a.specialty))].sort()
    const locations = [...new Set(allAttorneys.map(a => a.location))].sort()

    return NextResponse.json({
      success: true,
      attorneys,
      userReferrals,
      patentReferrals,
      filters: {
        specialties,
        locations
      },
      // Commission disclosure - required for transparency
      commissionDisclosure: "Claudia Coder may receive a referral commission (typically 10-12%) if you engage an attorney through our platform. This does not affect the fees you pay to the attorney."
    })
  } catch (error) {
    console.error("[Attorneys API] List error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to list attorneys" },
      { status: 500 }
    )
  }
})

/**
 * POST /api/patents/attorneys
 * Submit a referral request
 * Body:
 *   - attorneyId: ID of the attorney
 *   - patentId: ID of the patent/idea being referred
 *   - notes: Optional notes for the attorney
 */
export const POST = withAuth(async (auth: AuthenticatedRequest, request: NextRequest) => {
  try {
    const body = await request.json()
    const { attorneyId, patentId, notes } = body

    // Validate required fields
    if (!attorneyId) {
      return NextResponse.json(
        { success: false, error: "Attorney ID is required" },
        { status: 400 }
      )
    }

    if (!patentId) {
      return NextResponse.json(
        { success: false, error: "Patent/idea ID is required" },
        { status: 400 }
      )
    }

    // Check if user already has a pending referral for this patent/attorney combo
    const existingReferrals = getUserReferrals(auth.user.id)
    const existingPending = existingReferrals.find(
      r => r.patentId === patentId &&
           r.attorneyId === attorneyId &&
           ["pending", "contacted", "consultation_scheduled"].includes(r.status)
    )

    if (existingPending) {
      return NextResponse.json(
        {
          success: false,
          error: "You already have an active referral to this attorney for this patent",
          existingReferral: existingPending
        },
        { status: 409 }
      )
    }

    // Track the referral
    const referral = trackReferral(auth.user.id, patentId, attorneyId, notes)

    if (!referral) {
      return NextResponse.json(
        { success: false, error: "Failed to create referral. Attorney may not exist." },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      referral,
      message: "Referral request submitted successfully. The attorney will be notified of your interest.",
      commissionDisclosure: `A ${referral.commissionRate}% referral commission may apply if you engage this attorney's services.`
    })
  } catch (error) {
    console.error("[Attorneys API] Create referral error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to submit referral request" },
      { status: 500 }
    )
  }
})
