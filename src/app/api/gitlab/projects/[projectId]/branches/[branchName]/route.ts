/**
 * GitLab Single Branch API Proxy
 * Proxies single branch requests to handle CORS and self-signed certificates
 */

import { NextRequest, NextResponse } from "next/server"
import {
  gitlabFetch,
  getTokenFromRequest,
  createAuthErrorResponse,
  handleGitLabError,
} from "../../../../_lib/gitlab-proxy"

interface RouteParams {
  params: Promise<{ projectId: string; branchName: string }>
}

/**
 * GET /api/gitlab/projects/[projectId]/branches/[branchName] - Get a single branch
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId, branchName } = await params
    const token = getTokenFromRequest(request)

    if (!token) {
      return createAuthErrorResponse()
    }

    const encodedId = encodeURIComponent(projectId)
    const encodedBranch = encodeURIComponent(branchName)
    const response = await gitlabFetch(
      `/projects/${encodedId}/repository/branches/${encodedBranch}`,
      token
    )

    if (!response.ok) {
      return handleGitLabError(response, "Failed to get branch")
    }

    const branch = await response.json()
    return NextResponse.json(branch)
  } catch (error) {
    console.error("GitLab get branch error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get branch" },
      { status: 500 }
    )
  }
}
