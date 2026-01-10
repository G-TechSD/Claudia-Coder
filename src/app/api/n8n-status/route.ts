/**
 * N8N Status API Route
 *
 * Server-side endpoint for checking N8N health status.
 * This is needed because:
 * 1. N8N is running on HTTPS with a self-signed certificate
 * 2. Browser fetch() cannot accept self-signed certs
 * 3. Server-side Node.js can be configured to accept self-signed certs
 */

import { NextResponse } from "next/server"
import https from "https"
import http from "http"

// N8N URL configuration - empty string means not configured
const N8N_BASE_URL = process.env.NEXT_PUBLIC_N8N_URL || ""
const N8N_API_KEY = process.env.NEXT_PUBLIC_N8N_API_KEY || ""
const N8N_API_URL = N8N_BASE_URL ? `${N8N_BASE_URL}/api/v1` : ""

/**
 * Check if N8N is configured
 */
function isN8NConfigured(): boolean {
  // Check if we have a valid URL
  if (!N8N_BASE_URL || N8N_BASE_URL.trim() === "") {
    return false
  }

  // Check if URL looks valid
  try {
    new URL(N8N_BASE_URL)
    return true
  } catch {
    return false
  }
}

/**
 * Make HTTP/HTTPS request that accepts self-signed certificates
 */
function makeRequest(url: string, options: {
  method?: string
  headers?: Record<string, string>
  body?: string
  timeout?: number
}): Promise<{ ok: boolean; status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === "https:"
    const httpModule = isHttps ? https : http

    const reqOptions: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: options.headers || {},
      timeout: options.timeout || 5000,
    }

    // For HTTPS, accept self-signed certificates
    if (isHttps) {
      reqOptions.rejectUnauthorized = false
    }

    const req = httpModule.request(reqOptions, (res) => {
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

    req.on("error", (err) => {
      reject(err)
    })
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
  // Use our custom request handler for both HTTP and HTTPS
  // This gives us consistent error handling and timeout support
  const result = await makeRequest(url, options)
  return {
    ok: result.ok,
    status: result.status,
    json: async () => JSON.parse(result.body),
    text: async () => result.body,
  }
}

/**
 * GET /api/n8n-status - Check N8N health and get basic info
 *
 * Force dynamic rendering to always get fresh status
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Common no-cache headers
const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
}

export async function GET() {
  // Check if N8N is configured first
  if (!isN8NConfigured()) {
    return NextResponse.json({
      healthy: false,
      configured: false,
      url: N8N_BASE_URL || null,
      message: "N8N is not configured. Set NEXT_PUBLIC_N8N_URL environment variable.",
    }, { headers: noCacheHeaders })
  }

  try {
    // Try the health endpoint first
    const healthUrl = `${N8N_BASE_URL}/healthz`

    const healthResponse = await fetchWithSelfSignedCert(healthUrl, {
      method: "GET",
      timeout: 5000,
    })

    if (healthResponse.ok) {
      // N8N is healthy, try to get more info
      let workflows: { total: number; active: number } | null = null

      try {
        const workflowsResponse = await fetchWithSelfSignedCert(`${N8N_API_URL}/workflows`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(N8N_API_KEY ? { "X-N8N-API-KEY": N8N_API_KEY } : {}),
          },
          timeout: 5000,
        })

        if (workflowsResponse.ok) {
          const data = await workflowsResponse.json() as { data?: { active: boolean }[] }
          const workflowList = data.data || []
          workflows = {
            total: workflowList.length,
            active: workflowList.filter((w: { active: boolean }) => w.active).length,
          }
        }
      } catch {
        // Workflow fetch failed, but health check passed
        console.log("Could not fetch workflows, but N8N is healthy")
      }

      return NextResponse.json({
        healthy: true,
        configured: true,
        url: N8N_BASE_URL,
        message: "N8N is running",
        workflows,
      }, { headers: noCacheHeaders })
    }

    return NextResponse.json({
      healthy: false,
      configured: true,
      url: N8N_BASE_URL,
      message: `Health check returned status ${healthResponse.status}`,
    }, { headers: noCacheHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"

    // Check for common connection errors
    if (message.includes("ECONNREFUSED")) {
      return NextResponse.json({
        healthy: false,
        configured: true,
        url: N8N_BASE_URL,
        message: "Connection refused - N8N may not be running",
      }, { headers: noCacheHeaders })
    }

    if (message.includes("ETIMEDOUT") || message.includes("timeout")) {
      return NextResponse.json({
        healthy: false,
        configured: true,
        url: N8N_BASE_URL,
        message: "Connection timed out - N8N may be unreachable",
      }, { headers: noCacheHeaders })
    }

    if (message.includes("CERT") || message.includes("certificate")) {
      return NextResponse.json({
        healthy: false,
        configured: true,
        url: N8N_BASE_URL,
        message: "Certificate error - check HTTPS configuration",
      }, { headers: noCacheHeaders })
    }

    if (message.includes("ENOTFOUND") || message.includes("getaddrinfo")) {
      return NextResponse.json({
        healthy: false,
        configured: true,
        url: N8N_BASE_URL,
        message: "Host not found - check N8N URL configuration",
      }, { headers: noCacheHeaders })
    }

    return NextResponse.json({
      healthy: false,
      configured: true,
      url: N8N_BASE_URL,
      message: `Health check failed: ${message}`,
    }, { headers: noCacheHeaders })
  }
}

/**
 * POST /api/n8n-status - Proxy requests to N8N API
 * Useful for workflows, executions, etc.
 */
export async function POST(request: Request) {
  // Check if N8N is configured
  if (!isN8NConfigured()) {
    return NextResponse.json({
      error: "N8N is not configured",
      configured: false,
    }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { endpoint, method = "GET", data } = body

    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 })
    }

    const url = `${N8N_BASE_URL}${endpoint}`

    const response = await fetchWithSelfSignedCert(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(N8N_API_KEY ? { "X-N8N-API-KEY": N8N_API_KEY } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
      timeout: 30000,
    })

    const responseData = await response.json().catch(() => null)

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      data: responseData,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
