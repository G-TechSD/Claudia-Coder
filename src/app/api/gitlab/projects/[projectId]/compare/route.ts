/**
 * GitLab Compare API Proxy
 * Proxies branch comparison requests to handle CORS and self-signed certificates
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
 * GET /api/gitlab/projects/[projectId]/compare - Compare branches
 * Query params: from, to
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params
    const token = getTokenFromRequest(request)

    if (!token) {
      return createAuthErrorResponse()
    }

    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    if (!from || !to) {
      return NextResponse.json(
        { error: "Both 'from' and 'to' query parameters are required" },
        { status: 400 }
      )
    }

    const queryParams = new URLSearchParams()
    queryParams.set("from", from)
    queryParams.set("to", to)

    const encodedId = encodeURIComponent(projectId)
    const response = await gitlabFetch(
      `/projects/${encodedId}/repository/compare?${queryParams}`,
      token
    )

    if (!response.ok) {
      return handleGitLabError(response, "Failed to compare branches")
    }

    const comparison = await response.json()
    return NextResponse.json(comparison)
  } catch (error) {
    console.error("GitLab compare error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compare branches" },
      { status: 500 }
    )
  }
}
