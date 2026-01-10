/**
 * GitLab Merge Requests API Proxy
 * Proxies merge request list requests to handle CORS and self-signed certificates
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
 * GET /api/gitlab/projects/[projectId]/merge_requests - List merge requests
 * Query params: state, per_page, page
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

    const state = searchParams.get("state")
    if (state) queryParams.set("state", state)

    const perPage = searchParams.get("per_page") || searchParams.get("perPage") || "20"
    queryParams.set("per_page", perPage)

    const page = searchParams.get("page") || "1"
    queryParams.set("page", page)

    const encodedId = encodeURIComponent(projectId)
    const queryString = queryParams.toString()
    const endpoint = queryString
      ? `/projects/${encodedId}/merge_requests?${queryString}`
      : `/projects/${encodedId}/merge_requests`

    const response = await gitlabFetch(endpoint, token)

    if (!response.ok) {
      return handleGitLabError(response, "Failed to get merge requests")
    }

    const mergeRequests = await response.json()
    return NextResponse.json(mergeRequests)
  } catch (error) {
    console.error("GitLab get merge requests error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get merge requests" },
      { status: 500 }
    )
  }
}
