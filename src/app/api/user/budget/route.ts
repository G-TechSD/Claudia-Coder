/**
 * User Budget API
 * GET - Get current user's budget status
 * PATCH - Update user's API key settings
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/auth/db"
import {
  getBudgetStatus,
  updateBudgetSettings,
} from "@/lib/beta/api-budget"
import { isBetaTester } from "@/lib/beta/restrictions"

/**
 * Get the current user from session
 * Supports beta auth bypass when NEXT_PUBLIC_BETA_AUTH_BYPASS is enabled
 */
function getCurrentUser(request: NextRequest): { id: string; role: string } | null {
  const sessionToken = request.cookies.get("better-auth.session_token")?.value

  if (sessionToken) {
    const result = db.prepare(`
      SELECT u.id, u.role
      FROM session s
      JOIN user u ON s.userId = u.id
      WHERE s.token = ?
    `).get(sessionToken) as { id: string; role: string } | undefined

    if (result) return result
  }

  // Allow bypass in beta mode
  if (process.env.NEXT_PUBLIC_BETA_AUTH_BYPASS === "true") {
    return { id: "beta-tester", role: "user" }
  }

  return null
}

/**
 * GET /api/user/budget
 * Get current user's budget status
 */
export async function GET(request: NextRequest) {
  try {
    const user = getCurrentUser(request)

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Only beta testers have budgets
    if (!isBetaTester(user.role)) {
      return NextResponse.json({
        success: true,
        budget: null,
        message: "Budget tracking only applies to beta testers",
      })
    }

    const budget = await getBudgetStatus(user.id)

    return NextResponse.json({
      success: true,
      budget,
    })
  } catch (error) {
    console.error("[User Budget] GET error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to get budget status" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/user/budget
 * Update user's API key settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = getCurrentUser(request)

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Only beta testers can update budget settings
    if (!isBetaTester(user.role)) {
      return NextResponse.json(
        { success: false, error: "Budget settings only available for beta testers" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { apiKeySource, anthropicApiKey } = body

    // Validate apiKeySource
    if (apiKeySource && !["provided", "own"].includes(apiKeySource)) {
      return NextResponse.json(
        { success: false, error: "Invalid apiKeySource. Must be 'provided' or 'own'" },
        { status: 400 }
      )
    }

    // Update settings
    const updated = await updateBudgetSettings(user.id, {
      apiKeySource,
      anthropicApiKey: anthropicApiKey === null ? undefined : anthropicApiKey,
    })

    // Get full status
    const budget = await getBudgetStatus(user.id)

    return NextResponse.json({
      success: true,
      budget,
      message: apiKeySource === "own"
        ? "API key saved. You now have unlimited access."
        : "Switched to provided API key with budget limits.",
    })
  } catch (error) {
    console.error("[User Budget] PATCH error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update budget settings" },
      { status: 500 }
    )
  }
}
