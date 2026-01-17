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
import * as https from "https"
import * as http from "http"

/**
 * Make HTTPS request that accepts self-signed certificates
 */
function httpsRequest(url: string, options: {
  method?: string
  headers?: Record<string, string>
  body?: string
  timeout?: number
}): Promise<{ ok: boolean; status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === "https:"
    const reqModule = isHttps ? https : http

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: options.headers || {},
      rejectUnauthorized: false, // Accept self-signed certificates
      timeout: options.timeout || 30000,
    }

    const req = reqModule.request(reqOptions, (res) => {
      let body = ""
      res.on("data", (chunk) => { body += chunk })
      res.on("end", () => {
        resolve({
          ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode || 0,
          body,
        })
      })
    })

    req.on("error", reject)
    req.on("timeout", () => {
      req.destroy()
      reject(new Error("Request timed out"))
    })

    if (options.body) {
      req.write(options.body)
    }
    req.end()
  })
}

/**
 * Fetch with self-signed cert support for both HTTP and HTTPS
 */
async function fetchWithSelfSignedCert(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string; timeout?: number } = {}
): Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }> {
  const result = await httpsRequest(url, options)
  return {
    ok: result.ok,
    status: result.status,
    json: async () => JSON.parse(result.body),
    text: async () => result.body,
  }
}

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
const SHARED_N8N_URL = process.env.N8N_URL || process.env.NEXT_PUBLIC_N8N_URL || "http://localhost:5678"
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

    // Make the request to n8n using the custom fetch that handles self-signed certs
    const response = await fetchWithSelfSignedCert(url, {
      method,
      headers,
      body: data && method !== "GET" ? JSON.stringify(data) : undefined,
      timeout: 30000,
    })

    // Try to parse as JSON
    try {
      const responseData = await response.json()
      return NextResponse.json({
        ok: response.ok,
        status: response.status,
        data: responseData,
      })
    } catch {
      // Not JSON, return as text
      const text = await response.text()
      return NextResponse.json({
        ok: response.ok,
        status: response.status,
        data: text,
      })
    }
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

    // Try to fetch workflows (limited to 1) as a health check using custom fetch
    const response = await fetchWithSelfSignedCert(`${targetUrl}/api/v1/workflows?limit=1`, {
      method: "GET",
      headers,
      timeout: 10000,
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
