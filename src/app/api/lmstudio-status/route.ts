/**
 * LM Studio Status API Route
 *
 * Server-side endpoint for checking LM Studio server health status.
 * This is needed because:
 * 1. Browser fetch() is blocked by CORS when making cross-origin requests
 * 2. Server-side Node.js doesn't have CORS restrictions
 * 3. This allows the Settings page to check LM Studio status reliably
 */

import { NextRequest, NextResponse } from "next/server"

interface LMStudioModel {
  id: string
  object?: string
  owned_by?: string
}

interface LMStudioModelsResponse {
  data: LMStudioModel[]
}

/**
 * GET /api/lmstudio-status - Check all configured LM Studio servers
 *
 * Force dynamic rendering to always get fresh status
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const servers = []

  // Check local-llm-server
  const server1Url = process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_1
  if (server1Url) {
    const server1Status = await checkServer("local-llm-server", server1Url)
    servers.push(server1Status)
  }

  // Check local-llm-server-2
  const server2Url = process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_2
  if (server2Url) {
    const server2Status = await checkServer("local-llm-server-2", server2Url)
    servers.push(server2Status)
  }

  // Return with no-cache headers to ensure fresh status on each request
  return NextResponse.json({
    servers,
    timestamp: new Date().toISOString()
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  })
}

/**
 * POST /api/lmstudio-status - Check a specific server URL
 * Used for testing new server connections
 */
export async function POST(request: NextRequest) {
  try {
    const { url, name } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      )
    }

    const status = await checkServer(name || "Custom Server", url)

    return NextResponse.json(status, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

/**
 * Check a single LM Studio server
 */
async function checkServer(name: string, baseUrl: string): Promise<{
  name: string
  url: string
  status: "connected" | "disconnected" | "error"
  latency?: number
  models?: string[]
  currentModel?: string
  error?: string
}> {
  const startTime = Date.now()

  try {
    // LM Studio uses OpenAI-compatible API at /v1/models
    const modelsUrl = `${baseUrl}/v1/models`

    // Use 10 second timeout to handle network latency
    // Disable Next.js fetch caching
    const response = await fetch(modelsUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store'
    } as RequestInit)

    const latency = Date.now() - startTime

    if (!response.ok) {
      return {
        name,
        url: baseUrl,
        status: "error",
        latency,
        error: `Server returned status ${response.status}`
      }
    }

    const data: LMStudioModelsResponse = await response.json()
    // Filter out embedding models - they cannot be used for chat/generation
    const models = (data.data || [])
      .filter(m => {
        const id = m.id.toLowerCase()
        return !id.includes('embed') && !id.includes('embedding')
      })
      .map(m => m.id)
    const currentModel = models[0] // First model is typically the loaded one

    return {
      name,
      url: baseUrl,
      status: "connected",
      latency,
      models,
      currentModel
    }
  } catch (error) {
    const latency = Date.now() - startTime
    const message = error instanceof Error ? error.message : "Unknown error"

    // Provide helpful error messages
    if (message.includes("ECONNREFUSED")) {
      return {
        name,
        url: baseUrl,
        status: "disconnected",
        latency,
        error: "Connection refused - LM Studio may not be running"
      }
    }

    if (message.includes("ETIMEDOUT") || message.includes("timeout") || message.includes("aborted")) {
      return {
        name,
        url: baseUrl,
        status: "disconnected",
        latency,
        error: "Connection timed out - server may be unreachable"
      }
    }

    if (message.includes("ENOTFOUND") || message.includes("getaddrinfo")) {
      return {
        name,
        url: baseUrl,
        status: "disconnected",
        latency,
        error: "Host not found - check the server address"
      }
    }

    return {
      name,
      url: baseUrl,
      status: "error",
      latency,
      error: message
    }
  }
}
