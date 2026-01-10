/**
 * Open Web UI Health Check API Route
 *
 * Server-side endpoint for checking Open Web UI connection status.
 * This handles:
 * 1. HTTPS connections with self-signed certificates
 * 2. CORS issues that would prevent direct browser fetches
 * 3. Connection timeout handling
 */

import { NextResponse } from "next/server"
import https from "https"
import http from "http"

/**
 * Make an HTTP/HTTPS request that accepts self-signed certificates
 */
function makeRequest(url: string, options: {
  method?: string
  headers?: Record<string, string>
  timeout?: number
}): Promise<{ ok: boolean; status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === "https:"
    const httpModule = isHttps ? https : http

    const reqOptions: http.RequestOptions | https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: options.headers || {},
      timeout: options.timeout || 10000,
    }

    // Accept self-signed certificates for HTTPS
    if (isHttps) {
      (reqOptions as https.RequestOptions).rejectUnauthorized = false
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

    req.on("error", (error) => {
      reject(error)
    })

    req.on("timeout", () => {
      req.destroy()
      reject(new Error("Request timed out"))
    })

    req.end()
  })
}

// Force dynamic rendering to always get fresh status
export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/openwebui/health - Check Open Web UI connection
 *
 * Body: { url: string }
 * Returns: { healthy: boolean, message: string, version?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url) {
      return NextResponse.json(
        { healthy: false, message: "URL is required" },
        { status: 400 }
      )
    }

    // Validate URL format
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json(
        { healthy: false, message: "Invalid URL format" },
        { status: 400 }
      )
    }

    // Try to reach the Open Web UI instance
    // Open Web UI typically responds at the root path
    const healthUrl = `${parsedUrl.origin}/`

    try {
      const response = await makeRequest(healthUrl, {
        method: "GET",
        timeout: 10000,
        headers: {
          "User-Agent": "Claudia-Admin/1.0",
          "Accept": "text/html,application/json",
        },
      })

      if (response.ok) {
        // Try to extract version if available
        // Open Web UI typically includes version in the response or headers
        let version: string | undefined

        // Try to find version in the response body
        // This is a simple pattern match; adjust based on actual Open Web UI response
        const versionMatch = response.body.match(/version["\s:]+["']?([0-9]+\.[0-9]+\.?[0-9]*)/i)
        if (versionMatch) {
          version = versionMatch[1]
        }

        return NextResponse.json({
          healthy: true,
          message: "Connected to Open Web UI",
          version,
          url: parsedUrl.origin,
        }, {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        })
      }

      // Not a 2xx response
      return NextResponse.json({
        healthy: false,
        message: `Server returned status ${response.status}`,
        url: parsedUrl.origin,
      }, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      })

    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"

      // Check for common connection errors
      if (message.includes("ECONNREFUSED")) {
        return NextResponse.json({
          healthy: false,
          message: "Connection refused - server may not be running",
          url: parsedUrl.origin,
        }, {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        })
      }

      if (message.includes("ETIMEDOUT") || message.includes("timeout")) {
        return NextResponse.json({
          healthy: false,
          message: "Connection timed out - server may be unreachable",
          url: parsedUrl.origin,
        }, {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        })
      }

      if (message.includes("ENOTFOUND")) {
        return NextResponse.json({
          healthy: false,
          message: "Host not found - check the URL",
          url: parsedUrl.origin,
        }, {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        })
      }

      return NextResponse.json({
        healthy: false,
        message: `Connection failed: ${message}`,
        url: parsedUrl.origin,
      }, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      })
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { healthy: false, message: `Request error: ${message}` },
      { status: 500 }
    )
  }
}

/**
 * GET /api/openwebui/health - Health check endpoint info
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/openwebui/health",
    method: "POST",
    description: "Check Open Web UI connection status",
    body: {
      url: "string - The Open Web UI instance URL to check",
    },
    response: {
      healthy: "boolean - Whether the connection is successful",
      message: "string - Status message",
      version: "string? - Open Web UI version if detected",
      url: "string - The normalized URL",
    },
  })
}
