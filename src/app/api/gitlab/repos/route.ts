/**
 * GitLab Repos API Proxy
 * Proxies GitLab API requests from the client to handle CORS and self-signed certificates
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

// Helper to make server-side fetch with self-signed cert support
async function gitlabFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${GITLAB_URL}/api/v4${endpoint}`

  // For Node.js fetch with self-signed certs, we need to use the agent
  // The global fetch in Next.js supports this via the agent option
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "PRIVATE-TOKEN": token,
      ...options.headers,
    },
    // @ts-expect-error - Next.js extends fetch with agent support
    agent: httpsAgent,
  })

  return response
}

/**
 * POST /api/gitlab/repos - Create a new GitLab repository
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, name, description, visibility, initializeWithReadme, defaultBranch } = body

    if (!token) {
      return NextResponse.json(
        { error: "GitLab token is required" },
        { status: 401 }
      )
    }

    if (!name) {
      return NextResponse.json(
        { error: "Repository name is required" },
        { status: 400 }
      )
    }

    // Build the GitLab API request body
    const gitlabBody: Record<string, unknown> = {
      name,
      description: description || "",
      visibility: visibility || "private",
      initialize_with_readme: initializeWithReadme ?? true,
    }

    if (defaultBranch) {
      gitlabBody.default_branch = defaultBranch
    }

    const response = await gitlabFetch("/projects", token, {
      method: "POST",
      body: JSON.stringify(gitlabBody),
    })

    const data = await response.json()

    if (!response.ok) {
      // Parse GitLab error format
      let errorMessage: string
      if (typeof data.message === "string") {
        errorMessage = data.message
      } else if (typeof data.message === "object" && data.message !== null) {
        // Validation errors come as { message: { field: ["error1", "error2"] } }
        errorMessage = Object.entries(data.message)
          .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(", ") : errors}`)
          .join("; ")
      } else if (typeof data.error === "string") {
        errorMessage = data.error
      } else {
        errorMessage = `Failed to create repository: ${response.status}`
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("GitLab repo creation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create repository" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gitlab/repos - List GitLab repositories
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("x-gitlab-token")

    if (!token) {
      return NextResponse.json(
        { error: "GitLab token is required" },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search")
    const perPage = searchParams.get("perPage") || "20"
    const page = searchParams.get("page") || "1"
    const owned = searchParams.get("owned")

    // Build query string
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    params.set("per_page", perPage)
    params.set("page", page)
    if (owned === "true") params.set("owned", "true")
    params.set("order_by", "last_activity_at")

    const response = await gitlabFetch(`/projects?${params}`, token)

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: data.message || `Failed to list projects: ${response.status}` },
        { status: response.status }
      )
    }

    const projects = await response.json()
    return NextResponse.json(projects)
  } catch (error) {
    console.error("GitLab list repos error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list repositories" },
      { status: 500 }
    )
  }
}
