/**
 * Run History Export API
 *
 * GET /api/run-history/[id]/export?format=markdown|json
 */

import { NextRequest, NextResponse } from "next/server"
import { exportRunAsMarkdown, exportRunAsJSON } from "@/lib/data/execution-sessions"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format") || "markdown"

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Run ID is required" },
        { status: 400 }
      )
    }

    if (format === "json") {
      const entry = await exportRunAsJSON(id)

      if (!entry) {
        return NextResponse.json(
          { success: false, error: "Run not found" },
          { status: 404 }
        )
      }

      return NextResponse.json(entry, {
        headers: {
          "Content-Disposition": `attachment; filename="run-${id}.json"`,
        },
      })
    }

    // Default to markdown
    const markdown = await exportRunAsMarkdown(id)

    if (!markdown) {
      return NextResponse.json(
        { success: false, error: "Run not found" },
        { status: 404 }
      )
    }

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="run-${id}.md"`,
      },
    })
  } catch (error) {
    console.error("[run-history] Error exporting run:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to export run",
      },
      { status: 500 }
    )
  }
}
