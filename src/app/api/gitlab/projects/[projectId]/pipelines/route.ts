/**
 * GitLab Pipelines API Proxy
 * Proxies pipeline requests to handle CORS and self-signed certificates
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
 * GET /api/gitlab/projects/[projectId]/pipelines - List pipelines
 * Query params: per_page, ref, status
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

    const perPage = searchParams.get("per_page") || searchParams.get("perPage") || "10"
    queryParams.set("per_page", perPage)

    const ref = searchParams.get("ref")
    if (ref) queryParams.set("ref", ref)

    const status = searchParams.get("status")
    if (status) queryParams.set("status", status)

    const encodedId = encodeURIComponent(projectId)
    const response = await gitlabFetch(
      `/projects/${encodedId}/pipelines?${queryParams}`,
      token
    )

    if (!response.ok) {
      return handleGitLabError(response, "Failed to get pipelines")
    }

    const pipelines = await response.json()
    return NextResponse.json(pipelines)
  } catch (error) {
    console.error("GitLab get pipelines error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get pipelines" },
      { status: 500 }
    )
  }
}
