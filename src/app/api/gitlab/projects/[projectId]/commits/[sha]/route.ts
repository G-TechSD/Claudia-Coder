/**
 * GitLab Single Commit API Proxy
 * Proxies single commit requests to handle CORS and self-signed certificates
 */

import { NextRequest, NextResponse } from "next/server"
import {
  gitlabFetch,
  getTokenFromRequest,
  createAuthErrorResponse,
  handleGitLabError,
} from "../../../../_lib/gitlab-proxy"

interface RouteParams {
  params: Promise<{ projectId: string; sha: string }>
}

/**
 * GET /api/gitlab/projects/[projectId]/commits/[sha] - Get a single commit
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId, sha } = await params
    const token = getTokenFromRequest(request)

    if (!token) {
      return createAuthErrorResponse()
    }

    const encodedId = encodeURIComponent(projectId)
    const response = await gitlabFetch(
      `/projects/${encodedId}/repository/commits/${sha}?stats=true`,
      token
    )

    if (!response.ok) {
      return handleGitLabError(response, "Failed to get commit")
    }

    const commit = await response.json()
    return NextResponse.json(commit)
  } catch (error) {
    console.error("GitLab get commit error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get commit" },
      { status: 500 }
    )
  }
}
