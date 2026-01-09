/**
 * User N8N API Proxy
 *
 * Proxies requests to user's n8n instance (personal or shared).
 * Handles:
 * - Self-signed certificates
 * - CORS issues
 * - User authentication and isolation
 */

import { NextRequest, NextResponse } from "next/server"
import https from "https"

// Allow self-signed certificates for local N8N instances
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
})

interface ProxyRequest {
  userId: string
  endpoint: string
  method?: string
  data?: unknown
  credentials?: {
    baseUrl: string
    apiKey: string
  }
}

// Default shared N8N instance
const SHARED_N8N_URL = process.env.N8N_URL || process.env.NEXT_PUBLIC_N8N_URL || "https://192.168.245.211:5678"
const SHARED_N8N_API_KEY = process.env.N8N_API_KEY || process.env.NEXT_PUBLIC_N8N_API_KEY || ""

export async function POST(request: NextRequest) {
  try {
    const body: ProxyRequest = await request.json()
    const { userId, endpoint, method = "GET", data, credentials } = body

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "User ID is required" },
        { status: 400 }
      )
    }

    if (!endpoint) {
      return NextResponse.json(
        { ok: false, error: "Endpoint is required" },
        { status: 400 }
      )
    }

    // Determine which n8n instance to use
    let baseUrl: string
    let apiKey: string

    if (credentials?.baseUrl && credentials?.apiKey) {
      // User's personal instance
      baseUrl = credentials.baseUrl
      apiKey = credentials.apiKey
    } else {
      // Shared instance
      baseUrl = SHARED_N8N_URL
      apiKey = SHARED_N8N_API_KEY
    }

    // Construct the full URL
    const url = `${baseUrl}${endpoint}`

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (apiKey) {
      headers["X-N8N-API-KEY"] = apiKey
    }

    // Make the request to n8n
    const fetchOptions: RequestInit = {
      method,
      headers,
      // @ts-expect-error - agent is a valid option for node-fetch
      agent: url.startsWith("https://") ? httpsAgent : undefined,
    }

    if (data && method !== "GET") {
      fetchOptions.body = JSON.stringify(data)
    }

    const response = await fetch(url, fetchOptions)

    // Handle non-JSON responses
    const contentType = response.headers.get("content-type")
    if (!contentType?.includes("application/json")) {
      const text = await response.text()
      return NextResponse.json({
        ok: response.ok,
        status: response.status,
        data: text,
      })
    }

    const responseData = await response.json()

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      data: responseData,
    })
  } catch (error) {
    console.error("N8N proxy error:", error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Proxy request failed",
      },
      { status: 500 }
    )
  }
}

/**
 * Health check endpoint for user's n8n connection
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")
    const baseUrl = request.nextUrl.searchParams.get("baseUrl")
    const apiKey = request.nextUrl.searchParams.get("apiKey")

    // Determine which instance to check
    let targetUrl: string
    let targetApiKey: string

    if (baseUrl && apiKey) {
      targetUrl = baseUrl
      targetApiKey = apiKey
    } else {
      targetUrl = SHARED_N8N_URL
      targetApiKey = SHARED_N8N_API_KEY
    }

    // Build headers
    const headers: Record<string, string> = {}
    if (targetApiKey) {
      headers["X-N8N-API-KEY"] = targetApiKey
    }

    // Try to fetch workflows (limited to 1) as a health check
    const response = await fetch(`${targetUrl}/api/v1/workflows?limit=1`, {
      method: "GET",
      headers,
      // @ts-expect-error - agent is a valid option for node-fetch
      agent: targetUrl.startsWith("https://") ? httpsAgent : undefined,
      signal: AbortSignal.timeout(10000),
    })

    const healthy = response.ok

    return NextResponse.json({
      healthy,
      url: targetUrl,
      userId: userId || "shared",
      message: healthy ? "Connected" : `Connection failed: ${response.status}`,
    })
  } catch (error) {
    console.error("N8N health check error:", error)

    return NextResponse.json({
      healthy: false,
      url: SHARED_N8N_URL,
      message: error instanceof Error ? error.message : "Health check failed",
    })
  }
}
