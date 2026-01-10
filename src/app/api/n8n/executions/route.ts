/**
 * N8N Executions API Route
 *
 * GET: List recent executions for user's workflows
 * Shows status, duration, and workflow name
 *
 * Uses server-side HTTPS handling for self-signed certificates.
 */

import { NextRequest, NextResponse } from "next/server"
import https from "https"
import {
  getUserN8NConfig,
  getUserWorkflowTag,
  getUserWorkflowPrefix,
} from "@/lib/data/user-settings"

const N8N_BASE_URL = process.env.NEXT_PUBLIC_N8N_URL || "https://192.168.245.211:5678"
const N8N_API_KEY = process.env.NEXT_PUBLIC_N8N_API_KEY || ""

// Force dynamic rendering
export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Make HTTPS request that accepts self-signed certificates
 */
function httpsRequest(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: string
    timeout?: number
  }
): Promise<{ ok: boolean; status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const reqOptions: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: options.headers || {},
      rejectUnauthorized: false, // Accept self-signed certificates
      timeout: options.timeout || 30000,
    }

    const req = https.request(reqOptions, (res) => {
      let body = ""
      res.on("data", (chunk) => {
        body += chunk
      })
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
 * Get N8N credentials for a user
 */
function getCredentials(userId: string | null): { baseUrl: string; apiKey: string } {
  if (!userId) {
    return { baseUrl: N8N_BASE_URL, apiKey: N8N_API_KEY }
  }

  const config = getUserN8NConfig(userId)

  if (config.mode === "personal" && config.personalInstance) {
    return {
      baseUrl: config.personalInstance.baseUrl,
      apiKey: config.personalInstance.apiKey,
    }
  }

  return { baseUrl: N8N_BASE_URL, apiKey: N8N_API_KEY }
}

/**
 * Check if workflow belongs to user (for shared instance isolation)
 */
function isUserWorkflow(
  userId: string,
  workflow: { name: string; tags?: Array<{ name: string } | string> }
): boolean {
  const config = getUserN8NConfig(userId)

  // Personal instance - all workflows belong to user
  if (config.mode === "personal") {
    return true
  }

  const userTag = getUserWorkflowTag(userId)
  const userPrefix = getUserWorkflowPrefix(userId)

  // Check tags
  if (workflow.tags) {
    const tagNames = workflow.tags.map((t) =>
      typeof t === "string" ? t : t.name
    )
    if (tagNames.includes(userTag)) {
      return true
    }
  }

  // Check name prefix
  if (workflow.name.includes(`[${userPrefix}]`)) {
    return true
  }

  return false
}

/**
 * Map N8N execution status to our format
 */
function mapExecutionStatus(
  execution: {
    finished: boolean
    status?: string
    stoppedAt?: string
  }
): "running" | "success" | "error" | "waiting" {
  if (!execution.finished) {
    return "running"
  }

  if (execution.status === "success") {
    return "success"
  }

  if (execution.status === "error" || execution.status === "failed") {
    return "error"
  }

  if (execution.status === "waiting") {
    return "waiting"
  }

  // Default based on whether it finished
  return execution.stoppedAt ? "success" : "running"
}

/**
 * Calculate duration in milliseconds
 */
function calculateDuration(startedAt: string, stoppedAt?: string): number | null {
  if (!stoppedAt) return null

  const start = new Date(startedAt).getTime()
  const end = new Date(stoppedAt).getTime()
  return end - start
}

interface N8NExecution {
  id: string
  workflowId: string
  finished: boolean
  mode: string
  startedAt: string
  stoppedAt?: string
  status?: string
  workflowData?: {
    name?: string
  }
}

interface N8NWorkflow {
  id: string
  name: string
  tags?: Array<{ name: string } | string>
}

/**
 * GET /api/n8n/executions - List user's workflow executions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const workflowId = searchParams.get("workflowId")
    const limit = parseInt(searchParams.get("limit") || "25", 10)

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      )
    }

    const { baseUrl, apiKey } = getCredentials(userId)
    const config = getUserN8NConfig(userId)

    // Build query params
    const queryParams = new URLSearchParams()
    if (workflowId) {
      queryParams.set("workflowId", workflowId)
    }
    queryParams.set("limit", String(limit))

    // Fetch executions from N8N
    const executionsUrl = `${baseUrl}/api/v1/executions?${queryParams.toString()}`
    const executionsResponse = await httpsRequest(executionsUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "X-N8N-API-KEY": apiKey } : {}),
      },
      timeout: 15000,
    })

    if (!executionsResponse.ok) {
      return NextResponse.json(
        { error: `N8N API error: ${executionsResponse.status}`, details: executionsResponse.body },
        { status: executionsResponse.status }
      )
    }

    let executionsData: { data?: N8NExecution[] } | N8NExecution[]

    try {
      executionsData = JSON.parse(executionsResponse.body)
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON response from N8N" },
        { status: 500 }
      )
    }

    // Extract executions array
    let executions: N8NExecution[]
    if (Array.isArray(executionsData)) {
      executions = executionsData
    } else if (executionsData && "data" in executionsData && Array.isArray(executionsData.data)) {
      executions = executionsData.data
    } else {
      executions = []
    }

    // For shared instances, we need to filter by user's workflows
    let userWorkflowIds: Set<string> | null = null

    if (config.mode === "shared") {
      // Fetch user's workflows to get their IDs
      const workflowsResponse = await httpsRequest(`${baseUrl}/api/v1/workflows`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "X-N8N-API-KEY": apiKey } : {}),
        },
        timeout: 15000,
      })

      if (workflowsResponse.ok) {
        try {
          const workflowsData = JSON.parse(workflowsResponse.body)
          let workflows: N8NWorkflow[]

          if (Array.isArray(workflowsData)) {
            workflows = workflowsData
          } else if (workflowsData?.data && Array.isArray(workflowsData.data)) {
            workflows = workflowsData.data
          } else {
            workflows = []
          }

          // Filter to user's workflows
          const userWorkflows = workflows.filter((w) => isUserWorkflow(userId, w))
          userWorkflowIds = new Set(userWorkflows.map((w) => w.id))
        } catch {
          // Continue without filtering if workflows fetch fails
          console.warn("Failed to fetch workflows for filtering")
        }
      }
    }

    // Filter executions to user's workflows (for shared instances)
    if (userWorkflowIds) {
      executions = executions.filter((e) => userWorkflowIds!.has(e.workflowId))
    }

    // Transform executions for response
    const transformedExecutions = executions.map((e) => {
      const status = mapExecutionStatus(e)
      const duration = calculateDuration(e.startedAt, e.stoppedAt)

      return {
        id: e.id,
        workflowId: e.workflowId,
        workflowName: e.workflowData?.name || null,
        finished: e.finished,
        mode: e.mode,
        startedAt: e.startedAt,
        stoppedAt: e.stoppedAt || null,
        status,
        duration,
        durationFormatted: duration ? formatDuration(duration) : null,
      }
    })

    // Sort by startedAt descending (most recent first)
    transformedExecutions.sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )

    return NextResponse.json({
      ok: true,
      data: transformedExecutions,
      total: transformedExecutions.length,
      mode: config.mode,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[n8n/executions] GET error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * Format duration in milliseconds to human readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${minutes}m`
}

/**
 * GET /api/n8n/executions/[id] - Get specific execution details
 * This is handled via query param since we're not using dynamic routes here
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, executionId, action } = body

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      )
    }

    const { baseUrl, apiKey } = getCredentials(userId)

    // Action: Get execution details
    if (action === "get" && executionId) {
      const response = await httpsRequest(`${baseUrl}/api/v1/executions/${executionId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "X-N8N-API-KEY": apiKey } : {}),
        },
      })

      if (!response.ok) {
        return NextResponse.json(
          { error: `Execution not found: ${response.status}` },
          { status: response.status }
        )
      }

      const execution = JSON.parse(response.body)

      return NextResponse.json({
        ok: true,
        data: execution,
      })
    }

    // Action: Stop execution
    if (action === "stop" && executionId) {
      const response = await httpsRequest(`${baseUrl}/api/v1/executions/${executionId}/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "X-N8N-API-KEY": apiKey } : {}),
        },
      })

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to stop execution: ${response.status}` },
          { status: response.status }
        )
      }

      return NextResponse.json({
        ok: true,
        stopped: true,
        executionId,
      })
    }

    // Action: Delete execution
    if (action === "delete" && executionId) {
      const response = await httpsRequest(`${baseUrl}/api/v1/executions/${executionId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "X-N8N-API-KEY": apiKey } : {}),
        },
      })

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to delete execution: ${response.status}` },
          { status: response.status }
        )
      }

      return NextResponse.json({
        ok: true,
        deleted: true,
        executionId,
      })
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[n8n/executions] POST error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
