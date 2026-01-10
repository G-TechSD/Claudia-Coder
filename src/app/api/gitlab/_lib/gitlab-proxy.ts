/**
 * Shared GitLab Proxy Utilities
 * Handles self-signed certificates and common GitLab API patterns
 */

import https from "https"
import { NextRequest, NextResponse } from "next/server"

const GITLAB_URL = process.env.NEXT_PUBLIC_GITLAB_URL || "https://bill-dev-linux-1"

// Create an HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
})

/**
 * Make a server-side fetch to GitLab with self-signed cert support
 */
export async function gitlabFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${GITLAB_URL}/api/v4${endpoint}`

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
 * Extract GitLab token from request headers
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  return request.headers.get("x-gitlab-token")
}

/**
 * Create a standard error response
 */
export function createErrorResponse(
  message: string,
  status: number = 500
): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Create a missing token error response
 */
export function createAuthErrorResponse(): NextResponse {
  return NextResponse.json(
    { error: "GitLab token is required" },
    { status: 401 }
  )
}

/**
 * Handle a GitLab API error response
 */
export async function handleGitLabError(
  response: Response,
  fallbackMessage: string
): Promise<NextResponse> {
  const data = await response.json().catch(() => ({}))

  let errorMessage: string
  if (typeof data.message === "string") {
    errorMessage = data.message
  } else if (typeof data.message === "object" && data.message !== null) {
    errorMessage = Object.entries(data.message)
      .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(", ") : errors}`)
      .join("; ")
  } else if (typeof data.error === "string") {
    errorMessage = data.error
  } else {
    errorMessage = `${fallbackMessage}: ${response.status}`
  }

  return NextResponse.json({ error: errorMessage }, { status: response.status })
}

/**
 * Build query string from URLSearchParams, filtering empty values
 */
export function buildQueryString(params: URLSearchParams): string {
  const filtered = new URLSearchParams()
  params.forEach((value, key) => {
    if (value) {
      filtered.set(key, value)
    }
  })
  return filtered.toString()
}

export { GITLAB_URL, httpsAgent }
