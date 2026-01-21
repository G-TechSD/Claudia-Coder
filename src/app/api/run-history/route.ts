/**
 * Run History API
 *
 * GET /api/run-history - List run history with optional filters
 */

import { NextRequest, NextResponse } from "next/server"
import { getRunHistoryList } from "@/lib/data/execution-sessions"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId") || undefined
    const userId = searchParams.get("userId") || undefined
    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const offset = parseInt(searchParams.get("offset") || "0", 10)

    const history = await getRunHistoryList({
      projectId,
      userId,
      limit: Math.min(limit, 100), // Cap at 100
      offset,
    })

    return NextResponse.json({
      success: true,
      history,
      count: history.length,
      pagination: {
        limit,
        offset,
        hasMore: history.length === limit,
      },
    })
  } catch (error) {
    console.error("[run-history] Error fetching history:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch run history",
      },
      { status: 500 }
    )
  }
}
