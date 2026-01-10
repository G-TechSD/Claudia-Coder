/**
 * GitLab Projects API Proxy
 * Proxies project list requests to handle CORS and self-signed certificates
 */

import { NextRequest, NextResponse } from "next/server"
import {
  gitlabFetch,
  getTokenFromRequest,
  createAuthErrorResponse,
  handleGitLabError,
} from "../_lib/gitlab-proxy"

/**
 * GET /api/gitlab/projects - List GitLab projects
 * Query params: per_page, order_by, search, owned, membership
 */
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request)
    if (!token) {
      return createAuthErrorResponse()
    }

    const searchParams = request.nextUrl.searchParams
    const params = new URLSearchParams()

    // Pass through supported query parameters
    const perPage = searchParams.get("per_page") || searchParams.get("perPage") || "20"
    params.set("per_page", perPage)

    const orderBy = searchParams.get("order_by") || "last_activity_at"
    params.set("order_by", orderBy)

    const search = searchParams.get("search")
    if (search) params.set("search", search)

    const owned = searchParams.get("owned")
    if (owned === "true") params.set("owned", "true")

    const membership = searchParams.get("membership")
    if (membership === "true") params.set("membership", "true")

    const response = await gitlabFetch(`/projects?${params}`, token)

    if (!response.ok) {
      return handleGitLabError(response, "Failed to list projects")
    }

    const projects = await response.json()
    return NextResponse.json(projects)
  } catch (error) {
    console.error("GitLab list projects error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list projects" },
      { status: 500 }
    )
  }
}
