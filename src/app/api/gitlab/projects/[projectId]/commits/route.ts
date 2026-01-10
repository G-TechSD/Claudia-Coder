/**
 * GitLab Commits API Proxy
 * Proxies commit requests to handle CORS and self-signed certificates
 */

import { NextRequest, NextResponse } from "next/server"
import {
  gitlabFetch,
  getTokenFromRequest,
  createAuthErrorResponse,
  handleGitLabError,
} from "../../../_lib/gitlab-proxy"

interface RouteParams {
  params: Promise<{ projectId: string }>
}

/**
 * GET /api/gitlab/projects/[projectId]/commits - List commits
 * Query params: ref_name, per_page, page, with_stats
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params
    const token = getTokenFromRequest(request)

    if (!token) {
      return createAuthErrorResponse()
    }

    const searchParams = request.nextUrl.searchParams
    const queryParams = new URLSearchParams()

    // Pass through supported query parameters
    const refName = searchParams.get("ref_name") || searchParams.get("ref")
    if (refName) queryParams.set("ref_name", refName)

    const perPage = searchParams.get("per_page") || searchParams.get("perPage") || "20"
    queryParams.set("per_page", perPage)

    const page = searchParams.get("page") || "1"
    queryParams.set("page", page)

    const withStats = searchParams.get("with_stats") || "true"
    queryParams.set("with_stats", withStats)

    const encodedId = encodeURIComponent(projectId)
    const response = await gitlabFetch(
      `/projects/${encodedId}/repository/commits?${queryParams}`,
      token
    )

    if (!response.ok) {
      return handleGitLabError(response, "Failed to get commits")
    }

    const commits = await response.json()
    return NextResponse.json(commits)
  } catch (error) {
    console.error("GitLab get commits error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get commits" },
      { status: 500 }
    )
  }
}
