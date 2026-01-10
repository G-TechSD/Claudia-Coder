/**
 * GitLab Project API Proxy
 * Handles operations on a specific GitLab project (get, delete)
 */

// Disable SSL verification for self-signed GitLab certs
// Node.js native fetch() doesn't support the agent option, so we use this env var
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

import { NextRequest, NextResponse } from "next/server"
import https from "https"

const GITLAB_URL = process.env.NEXT_PUBLIC_GITLAB_URL || "https://bill-dev-linux-1"

// Create an HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
})

interface RouteParams {
  params: Promise<{ projectId: string }>
}

/**
 * GET /api/gitlab/repos/[projectId] - Get a specific GitLab project
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params
    const token = request.headers.get("x-gitlab-token")

    if (!token) {
      return NextResponse.json(
        { error: "GitLab token is required" },
        { status: 401 }
      )
    }

    const response = await fetch(`${GITLAB_URL}/api/v4/projects/${projectId}`, {
      headers: {
        "PRIVATE-TOKEN": token,
      },
      // @ts-expect-error - Next.js extends fetch with agent support
      agent: httpsAgent,
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: data.message || `Failed to get project: ${response.status}` },
        { status: response.status }
      )
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

/**
 * DELETE /api/gitlab/repos/[projectId] - Delete a GitLab project
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params
    const token = request.headers.get("x-gitlab-token")

    if (!token) {
      return NextResponse.json(
        { error: "GitLab token is required" },
        { status: 401 }
      )
    }

    const response = await fetch(`${GITLAB_URL}/api/v4/projects/${projectId}`, {
      method: "DELETE",
      headers: {
        "PRIVATE-TOKEN": token,
      },
      // @ts-expect-error - Next.js extends fetch with agent support
      agent: httpsAgent,
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: data.message || `Failed to delete project: ${response.status}` },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("GitLab delete project error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete project" },
      { status: 500 }
    )
  }
}
