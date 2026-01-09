/**
 * Admin User Budget API
 * GET - Get user's budget status
 * PATCH - Update user's budget settings
 * POST - Reset user's budget
 */

import { NextResponse } from "next/server"
import { withRole } from "@/lib/auth/api-helpers"
import { getUserById } from "@/lib/data/users"
import {
  getBudgetStatus,
  updateBudgetSettings,
  resetBudget,
} from "@/lib/beta/api-budget"
import { isBetaTester } from "@/lib/beta/restrictions"

/**
 * GET /api/admin/users/[id]/budget
 * Get a user's budget status
 */
export const GET = withRole("admin")(async (_auth, request) => {
  try {
    // Extract id from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split("/")
    const id = pathParts[pathParts.length - 2] // Get the [id] part before /budget

    if (!id) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      )
    }

    const user = getUserById(id)

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }

    // Only get budget for beta testers
    if (!isBetaTester(user.role)) {
      return NextResponse.json({
        success: true,
        budget: null,
        message: "Budget tracking only applies to beta testers",
      })
    }

    const budget = await getBudgetStatus(id)

    return NextResponse.json({
      success: true,
      budget,
    })
  } catch (error) {
    console.error("[Admin User Budget] GET error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to get budget status" },
      { status: 500 }
    )
  }
})

/**
 * PATCH /api/admin/users/[id]/budget
 * Update a user's budget settings (admin only)
 */
export const PATCH = withRole("admin")(async (_auth, request) => {
  try {
    // Extract id from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split("/")
    const id = pathParts[pathParts.length - 2]

    if (!id) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      )
    }

    const user = getUserById(id)

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }

    // Only update budget for beta testers
    if (!isBetaTester(user.role)) {
      return NextResponse.json(
        { success: false, error: "Budget settings only apply to beta testers" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { apiUsageBudget } = body

    if (apiUsageBudget !== undefined) {
      if (typeof apiUsageBudget !== "number" || apiUsageBudget < 0) {
        return NextResponse.json(
          { success: false, error: "Invalid budget amount" },
          { status: 400 }
        )
      }

      await updateBudgetSettings(id, { apiUsageBudget })
    }

    const budget = await getBudgetStatus(id)

    return NextResponse.json({
      success: true,
      budget,
      message: "Budget settings updated",
    })
  } catch (error) {
    console.error("[Admin User Budget] PATCH error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update budget settings" },
      { status: 500 }
    )
  }
})

/**
 * POST /api/admin/users/[id]/budget
 * Reset a user's budget (admin only)
 */
export const POST = withRole("admin")(async (_auth, request) => {
  try {
    // Extract id from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split("/")
    const id = pathParts[pathParts.length - 2]

    if (!id) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      )
    }

    const user = getUserById(id)

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }

    // Only reset budget for beta testers
    if (!isBetaTester(user.role)) {
      return NextResponse.json(
        { success: false, error: "Budget reset only applies to beta testers" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { action } = body

    if (action !== "reset") {
      return NextResponse.json(
        { success: false, error: "Invalid action. Use 'reset'" },
        { status: 400 }
      )
    }

    await resetBudget(id)
    const budget = await getBudgetStatus(id)

    return NextResponse.json({
      success: true,
      budget,
      message: "Budget reset successfully",
    })
  } catch (error) {
    console.error("[Admin User Budget] POST error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to reset budget" },
      { status: 500 }
    )
  }
})
