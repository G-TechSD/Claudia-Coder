/**
 * GitLab Branches API Proxy
 * Proxies branch requests to handle CORS and self-signed certificates
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
 * GET /api/gitlab/projects/[projectId]/branches - List branches
 * Query params: per_page, search
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

    const perPage = searchParams.get("per_page") || searchParams.get("perPage") || "20"
    queryParams.set("per_page", perPage)

    const search = searchParams.get("search")
    if (search) queryParams.set("search", search)

    const encodedId = encodeURIComponent(projectId)
    const response = await gitlabFetch(
      `/projects/${encodedId}/repository/branches?${queryParams}`,
      token
    )

    if (!response.ok) {
      return handleGitLabError(response, "Failed to get branches")
    }

    const branches = await response.json()
    return NextResponse.json(branches)
  } catch (error) {
    console.error("GitLab get branches error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get branches" },
      { status: 500 }
    )
  }
}
