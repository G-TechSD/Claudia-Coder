/**
 * Single Run History Entry API
 *
 * GET /api/run-history/[id] - Get full details for a specific run
 */

import { NextRequest, NextResponse } from "next/server"
import { getRunHistoryEntry } from "@/lib/data/execution-sessions"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Run ID is required" },
        { status: 400 }
      )
    }

    const entry = await getRunHistoryEntry(id)

    if (!entry) {
      return NextResponse.json(
        { success: false, error: "Run not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      entry,
    })
  } catch (error) {
    console.error("[run-history] Error fetching run:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch run",
      },
      { status: 500 }
    )
  }
}
