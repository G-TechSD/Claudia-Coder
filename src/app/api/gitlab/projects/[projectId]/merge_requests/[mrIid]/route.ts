/**
 * GitLab Single Merge Request API Proxy
 * Proxies single MR requests to handle CORS and self-signed certificates
 */

import { NextRequest, NextResponse } from "next/server"
import {
  gitlabFetch,
  getTokenFromRequest,
  createAuthErrorResponse,
  handleGitLabError,
} from "../../../../_lib/gitlab-proxy"

interface RouteParams {
  params: Promise<{ projectId: string; mrIid: string }>
}

/**
 * GET /api/gitlab/projects/[projectId]/merge_requests/[mrIid] - Get a single merge request
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId, mrIid } = await params
    const token = getTokenFromRequest(request)

    if (!token) {
      return createAuthErrorResponse()
    }

    const encodedId = encodeURIComponent(projectId)
    const response = await gitlabFetch(
      `/projects/${encodedId}/merge_requests/${mrIid}`,
      token
    )

    if (!response.ok) {
      return handleGitLabError(response, "Failed to get merge request")
    }

    const mergeRequest = await response.json()
    return NextResponse.json(mergeRequest)
  } catch (error) {
    console.error("GitLab get merge request error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get merge request" },
      { status: 500 }
    )
  }
}
