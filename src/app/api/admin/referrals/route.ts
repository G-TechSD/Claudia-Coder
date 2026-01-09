/**
 * Admin Referrals API
 * GET - List all referrals with statistics
 * PUT - Update referral status
 */

import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/api-helpers"
import {
  getAllReferrals,
  getReferralStats,
  updateReferralStatus,
  calculateCommission,
  markCommissionPaid,
  getAllAttorneys,
  ReferralStatus,
} from "@/lib/data/referrals"

/**
 * GET /api/admin/referrals
 * List all referrals with stats
 */
export const GET = withRole("admin")(async () => {
  try {
    const referrals = getAllReferrals()
    const stats = getReferralStats()
    const attorneys = getAllAttorneys()

    // Sort by most recent first
    const sortedReferrals = [...referrals].sort(
      (a, b) => new Date(b.referredAt).getTime() - new Date(a.referredAt).getTime()
    )

    return NextResponse.json({
      success: true,
      referrals: sortedReferrals,
      stats,
      attorneys,
    })
  } catch (error) {
    console.error("[Admin Referrals] List error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to list referrals" },
      { status: 500 }
    )
  }
})

/**
 * PUT /api/admin/referrals
 * Update referral status or commission
 * Body:
 *   - referralId: ID of the referral
 *   - action: "update_status" | "calculate_commission" | "mark_paid"
 *   - status: (for update_status) new status
 *   - serviceAmount: (for calculate_commission) amount for commission calculation
 *   - notes: optional notes
 */
export const PUT = withRole("admin")(async (_auth, request) => {
  try {
    const body = await request.json()
    const { referralId, action, status, serviceAmount, notes } = body

    if (!referralId) {
      return NextResponse.json(
        { success: false, error: "Referral ID is required" },
        { status: 400 }
      )
    }

    let referral = null

    switch (action) {
      case "update_status":
        if (!status) {
          return NextResponse.json(
            { success: false, error: "Status is required for update_status action" },
            { status: 400 }
          )
        }

        const validStatuses: ReferralStatus[] = [
          "pending",
          "contacted",
          "consultation_scheduled",
          "converted",
          "declined",
          "expired",
        ]

        if (!validStatuses.includes(status)) {
          return NextResponse.json(
            { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
            { status: 400 }
          )
        }

        referral = updateReferralStatus(referralId, status, notes)
        break

      case "calculate_commission":
        if (!serviceAmount || serviceAmount <= 0) {
          return NextResponse.json(
            { success: false, error: "Valid service amount is required for commission calculation" },
            { status: 400 }
          )
        }

        referral = calculateCommission(referralId, serviceAmount)
        break

      case "mark_paid":
        referral = markCommissionPaid(referralId)
        break

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action. Must be: update_status, calculate_commission, or mark_paid" },
          { status: 400 }
        )
    }

    if (!referral) {
      return NextResponse.json(
        { success: false, error: "Referral not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      referral,
    })
  } catch (error) {
    console.error("[Admin Referrals] Update error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update referral" },
      { status: 500 }
    )
  }
})
