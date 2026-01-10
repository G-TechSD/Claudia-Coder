/**
 * GitLab Tree API Proxy
 * Proxies file tree requests to handle CORS and self-signed certificates
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
 * GET /api/gitlab/projects/[projectId]/tree - List repository tree
 * Query params: path, ref, recursive, per_page
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

    const path = searchParams.get("path")
    if (path) queryParams.set("path", path)

    const ref = searchParams.get("ref")
    if (ref) queryParams.set("ref", ref)

    const recursive = searchParams.get("recursive")
    if (recursive === "true") queryParams.set("recursive", "true")

    const perPage = searchParams.get("per_page") || searchParams.get("perPage") || "100"
    queryParams.set("per_page", perPage)

    const encodedId = encodeURIComponent(projectId)
    const response = await gitlabFetch(
      `/projects/${encodedId}/repository/tree?${queryParams}`,
      token
    )

    if (!response.ok) {
      return handleGitLabError(response, "Failed to get tree")
    }

    const tree = await response.json()
    return NextResponse.json(tree)
  } catch (error) {
    console.error("GitLab get tree error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get tree" },
      { status: 500 }
    )
  }
}
