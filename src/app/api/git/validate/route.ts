/**
 * Git Server Token Validation API
 * Validates personal access tokens for GitLab, Gitea, and auto-detects the provider
 */

// Disable SSL verification for self-signed certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

import { NextRequest, NextResponse } from "next/server"
import https from "https"

type GitProvider = "gitlab" | "gitea" | "auto"

interface ValidationResult {
  valid: boolean
  provider?: GitProvider
  user?: {
    id: number
    username: string
    name: string
    email?: string
    avatar_url?: string
  }
  error?: string
}

// Create an HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
})

/**
 * Detect the git provider by checking API endpoints
 */
async function detectProvider(baseUrl: string): Promise<GitProvider | null> {
  const cleanUrl = baseUrl.replace(/\/+$/, "")

  // Try Gitea first (it's more common for self-hosted)
  try {
    const giteaResponse = await fetch(`${cleanUrl}/api/v1/version`, {
      method: "GET",
      // @ts-expect-error - Next.js extends fetch with agent support
      agent: httpsAgent,
    })
    if (giteaResponse.ok) {
      const data = await giteaResponse.json()
      if (data.version) {
        return "gitea"
      }
    }
  } catch {
    // Not Gitea, continue
  }

  // Try GitLab
  try {
    const gitlabResponse = await fetch(`${cleanUrl}/api/v4/version`, {
      method: "GET",
      // @ts-expect-error - Next.js extends fetch with agent support
      agent: httpsAgent,
    })
    if (gitlabResponse.ok) {
      return "gitlab"
    }
  } catch {
    // Not GitLab
  }

  return null
}

/**
 * Validate a Gitea token
 */
async function validateGiteaToken(baseUrl: string, token: string): Promise<ValidationResult> {
  const cleanUrl = baseUrl.replace(/\/+$/, "")

  try {
    const response = await fetch(`${cleanUrl}/api/v1/user`, {
      headers: {
        "Authorization": `token ${token}`,
      },
      // @ts-expect-error - Next.js extends fetch with agent support
      agent: httpsAgent,
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: "Invalid or expired token" }
      }
      if (response.status === 403) {
        return { valid: false, error: "Token lacks required permissions" }
      }
      return { valid: false, error: `Gitea returned HTTP ${response.status}` }
    }

    const user = await response.json()
    return {
      valid: true,
      provider: "gitea",
      user: {
        id: user.id,
        username: user.login || user.username,
        name: user.full_name || user.login || user.username,
        email: user.email,
        avatar_url: user.avatar_url,
      },
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Connection failed",
    }
  }
}

/**
 * Validate a GitLab token
 */
async function validateGitLabToken(baseUrl: string, token: string): Promise<ValidationResult> {
  const cleanUrl = baseUrl.replace(/\/+$/, "")

  try {
    const response = await fetch(`${cleanUrl}/api/v4/user`, {
      headers: {
        "PRIVATE-TOKEN": token,
      },
      // @ts-expect-error - Next.js extends fetch with agent support
      agent: httpsAgent,
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: "Invalid or expired token" }
      }
      if (response.status === 403) {
        return { valid: false, error: "Token lacks required permissions (api scope)" }
      }
      return { valid: false, error: `GitLab returned HTTP ${response.status}` }
    }

    const user = await response.json()
    return {
      valid: true,
      provider: "gitlab",
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
      },
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Connection failed",
    }
  }
}

/**
 * POST /api/git/validate - Validate a git server token
 * Supports GitLab, Gitea, and auto-detection
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, baseUrl, provider = "auto" } = body as {
      token: string
      baseUrl: string
      provider?: GitProvider
    }

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token is required" },
        { status: 400 }
      )
    }

    if (!baseUrl) {
      return NextResponse.json(
        { valid: false, error: "Server URL is required" },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(baseUrl)
    } catch {
      return NextResponse.json(
        { valid: false, error: "Invalid URL format" },
        { status: 400 }
      )
    }

    let detectedProvider = provider

    // Auto-detect provider if needed
    if (provider === "auto") {
      const detected = await detectProvider(baseUrl)
      if (!detected) {
        return NextResponse.json({
          valid: false,
          error: "Could not detect git server type. Please select GitLab or Gitea manually.",
        })
      }
      detectedProvider = detected
    }

    // Validate based on provider
    let result: ValidationResult
    if (detectedProvider === "gitea") {
      result = await validateGiteaToken(baseUrl, token)
    } else {
      result = await validateGitLabToken(baseUrl, token)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Git token validation error:", error)

    let errorMessage = "Connection failed"
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      if (
        message.includes("certificate") ||
        message.includes("ssl") ||
        message.includes("self-signed")
      ) {
        errorMessage = "SSL certificate error. The server may use a self-signed certificate."
      } else if (message.includes("network") || message.includes("enotfound")) {
        errorMessage = "Network error. Cannot reach the server."
      } else if (message.includes("econnrefused")) {
        errorMessage = "Connection refused. Server may not be running."
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
