/**
 * Linear Projects API
 * List and search Linear projects for import
 */

import { NextRequest, NextResponse } from "next/server"
import { listProjects, hasLinearToken, searchProjects } from "@/lib/linear/api"

export async function GET(request: NextRequest) {
  if (!hasLinearToken()) {
    return NextResponse.json(
      { error: "Linear API key not configured" },
      { status: 401 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get("search")
  const teamId = searchParams.get("teamId")

  try {
    let projects
    if (search) {
      projects = await searchProjects(search)
    } else {
      projects = await listProjects(teamId || undefined)
    }

    // Log project details for debugging
    console.log(`[Linear Projects] Fetched ${projects.length} projects:`)
    for (const p of projects) {
      console.log(`  - ${p.name} (${p.id}): ${p.issueCount || 0} issues, state: ${p.state}, description: ${p.description?.substring(0, 50) || 'none'}`)
    }

    return NextResponse.json({ projects })
  } catch (error) {
    console.error("Linear projects fetch error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch projects" },
      { status: 500 }
    )
  }
}
