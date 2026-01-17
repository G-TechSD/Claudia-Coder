/**
 * GitLab Token Validation API
 * Validates a GitLab personal access token by checking the /user endpoint
 */

// Disable SSL verification for self-signed GitLab certs
// Node.js native fetch() doesn't support the agent option, so we use this env var
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

import { NextRequest, NextResponse } from "next/server"
import https from "https"

const GITLAB_URL = process.env.GITLAB_URL || ""

// Create an HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
})

/**
 * POST /api/gitlab/validate - Validate a GitLab token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, baseUrl } = body

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token is required" },
        { status: 400 }
      )
    }

    // Use provided baseUrl or default
    const gitlabUrl = (baseUrl || GITLAB_URL).replace(/\/+$/, "")

    const response = await fetch(`${gitlabUrl}/api/v4/user`, {
      headers: {
        "PRIVATE-TOKEN": token,
      },
      // @ts-expect-error - Next.js extends fetch with agent support
      agent: httpsAgent,
    })

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json({
          valid: false,
          error: "Invalid or expired token",
        })
      }
      if (response.status === 403) {
        return NextResponse.json({
          valid: false,
          error: "Token lacks required permissions (api scope)",
        })
      }

      return NextResponse.json({
        valid: false,
        error: `GitLab returned HTTP ${response.status}`,
      })
    }

    const user = await response.json()
    return NextResponse.json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
      },
    })
  } catch (error) {
    console.error("GitLab token validation error:", error)

    // Parse connection errors for better messages
    let errorMessage = "Connection failed"
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      if (
        message.includes("certificate") ||
        message.includes("ssl") ||
        message.includes("self-signed")
      ) {
        errorMessage = "SSL certificate error. The GitLab server may use a self-signed certificate."
      } else if (message.includes("network") || message.includes("enotfound")) {
        errorMessage = "Network error. Cannot reach the GitLab server."
      } else if (message.includes("econnrefused")) {
        errorMessage = "Connection refused. GitLab server may not be running."
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json({
      valid: false,
      error: errorMessage,
    })
  }
}
