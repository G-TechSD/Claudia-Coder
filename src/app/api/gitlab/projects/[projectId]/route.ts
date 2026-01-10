/**
 * GitLab Single Project API Proxy
 * Proxies single project requests to handle CORS and self-signed certificates
 */

import { NextRequest, NextResponse } from "next/server"
import {
  gitlabFetch,
  getTokenFromRequest,
  createAuthErrorResponse,
  handleGitLabError,
} from "../../_lib/gitlab-proxy"

interface RouteParams {
  params: Promise<{ projectId: string }>
}

/**
 * GET /api/gitlab/projects/[projectId] - Get a single project
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params
    const token = getTokenFromRequest(request)

    if (!token) {
      return createAuthErrorResponse()
    }

    // URL-encode the project ID in case it's a path like "group/project"
    const encodedId = encodeURIComponent(projectId)
    const response = await gitlabFetch(`/projects/${encodedId}`, token)

    if (!response.ok) {
      return handleGitLabError(response, "Failed to get project")
    }

    const project = await response.json()
    return NextResponse.json(project)
  } catch (error) {
    console.error("GitLab get project error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get project" },
      { status: 500 }
    )
  }
}
