/**
 * Unified Health Check API Route
 *
 * Server-side endpoint for checking ALL services at once:
 * - Claudia app status
 * - Ollama/LLM status
 * - n8n status
 * - Gitea status
 * - OpenWebUI status
 *
 * Returns consolidated health status for all integrated services.
 */

import { NextResponse } from "next/server"
import * as https from "https"
import * as http from "http"

// ============ Environment Configuration ============

const N8N_URL = process.env.NEXT_PUBLIC_N8N_URL || ""
const GITEA_URL = process.env.NEXT_PUBLIC_GITEA_URL || "http://localhost:3000"
const OPENWEBUI_URL = process.env.NEXT_PUBLIC_OPENWEBUI_URL || "http://localhost:8080"
const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434"

// ============ Types ============

interface ServiceStatus {
  status: "online" | "offline" | "not_configured" | "error"
  url?: string
  message?: string
  version?: string
  provider?: string
  model?: string
  workflows?: { total: number; active: number }
}

interface HealthResponse {
  claudia: ServiceStatus
  llm: ServiceStatus
  n8n: ServiceStatus
  gitea: ServiceStatus
  openwebui: ServiceStatus
  timestamp: string
  uptime: number
}

// ============ HTTP Request Helper ============

/**
 * Make an HTTP/HTTPS request that accepts self-signed certificates
 */
function makeRequest(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    timeout?: number
  }
): Promise<{ ok: boolean; status: number; body: string }> {
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
      timeout: options.timeout || 5000,
    }

    // Accept self-signed certificates for HTTPS
    if (isHttps) {
      (reqOptions as https.RequestOptions).rejectUnauthorized = false
    }

    const req = httpModule.request(reqOptions, (res) => {
      let body = ""
      res.on("data", (chunk) => {
        body += chunk
      })
      res.on("end", () => {
        resolve({
          ok:
            res.statusCode !== undefined &&
            res.statusCode >= 200 &&
            res.statusCode < 300,
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

// ============ Service Health Checkers ============

/**
 * Check Claudia app status
 * Always online since this endpoint is responding
 */
async function checkClaudiaHealth(): Promise<ServiceStatus> {
  return {
    status: "online",
    url: process.env.NEXTAUTH_URL || "http://localhost:3939",
    message: "Claudia is running",
  }
}

/**
 * Check Ollama/LLM status
 */
async function checkLLMHealth(): Promise<ServiceStatus> {
  if (!OLLAMA_URL) {
    return {
      status: "not_configured",
      message: "Ollama URL not configured",
    }
  }

  try {
    // Try Ollama API endpoint
    const response = await makeRequest(`${OLLAMA_URL}/api/tags`, {
      method: "GET",
      timeout: 5000,
      headers: {
        Accept: "application/json",
      },
    })

    if (response.ok) {
      // Parse models from response
      let model: string | undefined
      try {
        const data = JSON.parse(response.body)
        if (data.models && data.models.length > 0) {
          // Filter out embedding models
          const llmModels = data.models.filter((m: { name: string }) => {
            const name = m.name.toLowerCase()
            return !name.includes("embed") && !name.includes("embedding")
          })
          if (llmModels.length > 0) {
            model = llmModels[0].name
          }
        }
      } catch {
        // JSON parse failed, but service is online
      }

      return {
        status: "online",
        url: OLLAMA_URL,
        provider: "ollama",
        model: model || "unknown",
        message: "Ollama is running",
      }
    }

    return {
      status: "error",
      url: OLLAMA_URL,
      provider: "ollama",
      message: `Server returned status ${response.status}`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"

    if (message.includes("ECONNREFUSED")) {
      return {
        status: "offline",
        url: OLLAMA_URL,
        provider: "ollama",
        message: "Connection refused - Ollama may not be running",
      }
    }

    if (message.includes("ETIMEDOUT") || message.includes("timeout")) {
      return {
        status: "offline",
        url: OLLAMA_URL,
        provider: "ollama",
        message: "Connection timed out",
      }
    }

    return {
      status: "error",
      url: OLLAMA_URL,
      provider: "ollama",
      message: `Error: ${message}`,
    }
  }
}

/**
 * Check n8n status
 */
async function checkN8NHealth(): Promise<ServiceStatus> {
  if (!N8N_URL) {
    return {
      status: "not_configured",
      message: "n8n URL not configured. Set NEXT_PUBLIC_N8N_URL.",
    }
  }

  try {
    // Try n8n health endpoint
    const response = await makeRequest(`${N8N_URL}/healthz`, {
      method: "GET",
      timeout: 5000,
    })

    if (response.ok) {
      // Try to get workflow count
      let workflows: { total: number; active: number } | undefined
      const apiKey = process.env.NEXT_PUBLIC_N8N_API_KEY

      if (apiKey) {
        try {
          const workflowsResponse = await makeRequest(
            `${N8N_URL}/api/v1/workflows`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                "X-N8N-API-KEY": apiKey,
              },
              timeout: 5000,
            }
          )

          if (workflowsResponse.ok) {
            const data = JSON.parse(workflowsResponse.body) as {
              data?: { active: boolean }[]
            }
            const workflowList = data.data || []
            workflows = {
              total: workflowList.length,
              active: workflowList.filter((w) => w.active).length,
            }
          }
        } catch {
          // Workflow fetch failed, but health check passed
        }
      }

      return {
        status: "online",
        url: N8N_URL,
        message: "n8n is running",
        workflows,
      }
    }

    return {
      status: "error",
      url: N8N_URL,
      message: `Server returned status ${response.status}`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"

    if (message.includes("ECONNREFUSED")) {
      return {
        status: "offline",
        url: N8N_URL,
        message: "Connection refused - n8n may not be running",
      }
    }

    if (message.includes("ETIMEDOUT") || message.includes("timeout")) {
      return {
        status: "offline",
        url: N8N_URL,
        message: "Connection timed out",
      }
    }

    return {
      status: "error",
      url: N8N_URL,
      message: `Error: ${message}`,
    }
  }
}

/**
 * Check Gitea status
 */
async function checkGiteaHealth(): Promise<ServiceStatus> {
  if (!GITEA_URL) {
    return {
      status: "not_configured",
      message: "Gitea URL not configured",
    }
  }

  try {
    // Try Gitea version endpoint
    const response = await makeRequest(`${GITEA_URL}/api/v1/version`, {
      method: "GET",
      timeout: 5000,
      headers: {
        "User-Agent": "Claudia-Admin/1.0",
        Accept: "application/json",
      },
    })

    if (response.ok) {
      // Parse version from response
      let version: string | undefined
      try {
        const data = JSON.parse(response.body)
        if (data && typeof data.version === "string") {
          version = data.version
        }
      } catch {
        // JSON parse failed, try regex fallback
        const versionMatch = response.body.match(/"version"\s*:\s*"([^"]+)"/)
        if (versionMatch) {
          version = versionMatch[1]
        }
      }

      return {
        status: "online",
        url: GITEA_URL,
        message: "Gitea is running",
        version,
      }
    }

    return {
      status: "error",
      url: GITEA_URL,
      message: `Server returned status ${response.status}`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"

    if (message.includes("ECONNREFUSED")) {
      return {
        status: "offline",
        url: GITEA_URL,
        message: "Connection refused - Gitea may not be running",
      }
    }

    if (message.includes("ETIMEDOUT") || message.includes("timeout")) {
      return {
        status: "offline",
        url: GITEA_URL,
        message: "Connection timed out",
      }
    }

    if (message.includes("ENOTFOUND")) {
      return {
        status: "offline",
        url: GITEA_URL,
        message: "Host not found - check the URL",
      }
    }

    return {
      status: "error",
      url: GITEA_URL,
      message: `Error: ${message}`,
    }
  }
}

/**
 * Check OpenWebUI status
 */
async function checkOpenWebUIHealth(): Promise<ServiceStatus> {
  if (!OPENWEBUI_URL) {
    return {
      status: "not_configured",
      message: "OpenWebUI URL not configured",
    }
  }

  try {
    // Try OpenWebUI root endpoint
    const response = await makeRequest(`${OPENWEBUI_URL}/`, {
      method: "GET",
      timeout: 5000,
      headers: {
        "User-Agent": "Claudia-Admin/1.0",
        Accept: "text/html,application/json",
      },
    })

    if (response.ok) {
      // Try to extract version if available
      let version: string | undefined
      const versionMatch = response.body.match(
        /version["\s:]+["']?([0-9]+\.[0-9]+\.?[0-9]*)/i
      )
      if (versionMatch) {
        version = versionMatch[1]
      }

      return {
        status: "online",
        url: OPENWEBUI_URL,
        message: "OpenWebUI is running",
        version,
      }
    }

    return {
      status: "error",
      url: OPENWEBUI_URL,
      message: `Server returned status ${response.status}`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"

    if (message.includes("ECONNREFUSED")) {
      return {
        status: "offline",
        url: OPENWEBUI_URL,
        message: "Connection refused - OpenWebUI may not be running",
      }
    }

    if (message.includes("ETIMEDOUT") || message.includes("timeout")) {
      return {
        status: "offline",
        url: OPENWEBUI_URL,
        message: "Connection timed out",
      }
    }

    if (message.includes("ENOTFOUND")) {
      return {
        status: "offline",
        url: OPENWEBUI_URL,
        message: "Host not found - check the URL",
      }
    }

    return {
      status: "error",
      url: OPENWEBUI_URL,
      message: `Error: ${message}`,
    }
  }
}

// ============ API Route ============

// Force dynamic rendering to always get fresh status
export const dynamic = "force-dynamic"
export const revalidate = 0

// Common no-cache headers
const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
}

/**
 * GET /api/health/services - Check all services at once
 *
 * Returns unified health status for all integrated services
 */
export async function GET() {
  try {
    // Check all services in parallel for faster response
    const [claudia, llm, n8n, gitea, openwebui] = await Promise.all([
      checkClaudiaHealth(),
      checkLLMHealth(),
      checkN8NHealth(),
      checkGiteaHealth(),
      checkOpenWebUIHealth(),
    ])

    const response: HealthResponse = {
      claudia,
      llm,
      n8n,
      gitea,
      openwebui,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }

    return NextResponse.json(response, {
      status: 200,
      headers: noCacheHeaders,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json(
      {
        error: `Health check failed: ${message}`,
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: noCacheHeaders,
      }
    )
  }
}

/**
 * HEAD /api/health/services - Lightweight health check
 */
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: noCacheHeaders,
  })
}
