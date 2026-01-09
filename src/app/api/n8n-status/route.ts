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

const N8N_BASE_URL = process.env.NEXT_PUBLIC_N8N_URL || "https://192.168.245.211:5678"
const N8N_API_KEY = process.env.NEXT_PUBLIC_N8N_API_KEY || ""
const N8N_API_URL = process.env.N8N_API_URL || `${N8N_BASE_URL}/api/v1`

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
    const reqOptions: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: options.headers || {},
      rejectUnauthorized: false, // Accept self-signed certificates
      timeout: options.timeout || 5000,
    }

    const req = https.request(reqOptions, (res) => {
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
 * Fetch with self-signed cert support
 */
async function fetchWithSelfSignedCert(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string; timeout?: number } = {}
): Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }> {
  // For HTTPS URLs, use custom https request
  if (url.startsWith("https://")) {
    const result = await httpsRequest(url, options)
    return {
      ok: result.ok,
      status: result.status,
      json: async () => JSON.parse(result.body),
      text: async () => result.body,
    }
  }

  // For HTTP URLs, use regular fetch
  const response = await fetch(url, {
    method: options.method,
    headers: options.headers,
    body: options.body,
  })
  return {
    ok: response.ok,
    status: response.status,
    json: () => response.json(),
    text: () => response.text(),
  }
}

/**
 * GET /api/n8n-status - Check N8N health and get basic info
 *
 * Force dynamic rendering to always get fresh status
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
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
          const data = await workflowsResponse.json()
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
        url: N8N_BASE_URL,
        message: "N8N is running",
        workflows,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }

    return NextResponse.json({
      healthy: false,
      url: N8N_BASE_URL,
      message: `Health check returned status ${healthResponse.status}`,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    const noCacheHeaders = {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }

    // Check for common connection errors
    if (message.includes("ECONNREFUSED")) {
      return NextResponse.json({
        healthy: false,
        url: N8N_BASE_URL,
        message: "Connection refused - N8N may not be running",
      }, { headers: noCacheHeaders })
    }

    if (message.includes("ETIMEDOUT") || message.includes("timeout")) {
      return NextResponse.json({
        healthy: false,
        url: N8N_BASE_URL,
        message: "Connection timed out - N8N may be unreachable",
      }, { headers: noCacheHeaders })
    }

    if (message.includes("CERT") || message.includes("certificate")) {
      return NextResponse.json({
        healthy: false,
        url: N8N_BASE_URL,
        message: "Certificate error - check HTTPS configuration",
      }, { headers: noCacheHeaders })
    }

    return NextResponse.json({
      healthy: false,
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
