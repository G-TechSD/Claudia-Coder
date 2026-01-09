/**
 * Beta Limits API
 * Returns the current usage limits for beta testers
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/auth/db"
import {
  checkBetaLimitsServer,
  isBetaTester,
  BETA_MAX_PROJECTS,
  BETA_MAX_DAILY_EXECUTIONS,
} from "@/lib/beta/restrictions"

export async function GET(request: NextRequest) {
  try {
    // Get the session token from the cookie
    const sessionToken = request.cookies.get("better-auth.session_token")?.value

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Look up the user's role from the database
    const result = db.prepare(`
      SELECT u.id, u.role, u.email, u.name
      FROM session s
      JOIN user u ON s.userId = u.id
      WHERE s.token = ?
    `).get(sessionToken) as { id: string; role: string; email: string; name: string } | undefined

    if (!result) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 401 }
      )
    }

    const role = result.role || "user"

    // If not a beta tester, return unlimited
    if (!isBetaTester(role)) {
      return NextResponse.json({
        isBetaTester: false,
        limits: null,
      })
    }

    // Get the beta limits for this user
    const limits = await checkBetaLimitsServer(result.id)

    return NextResponse.json({
      isBetaTester: true,
      userId: result.id,
      email: result.email,
      name: result.name,
      limits: {
        ...limits,
        maxProjects: BETA_MAX_PROJECTS,
        maxDailyExecutions: BETA_MAX_DAILY_EXECUTIONS,
      },
    })
  } catch (error) {
    console.error("[beta/limits] Error:", error)
    return NextResponse.json(
      { error: "Failed to get beta limits" },
      { status: 500 }
    )
  }
}
