/**
 * N8N Workflows API Route
 *
 * GET: List user's workflows from N8N API with proper isolation
 * POST: Create a new workflow with user prefix/tags
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
 * Generate workflow name with user prefix
 */
function generateWorkflowName(userId: string, baseName: string): string {
  const prefix = getUserWorkflowPrefix(userId)
  if (baseName.startsWith(`[${prefix}]`)) {
    return baseName
  }
  return `[${prefix}] ${baseName}`
}

/**
 * GET /api/n8n/workflows - List user's workflows
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      )
    }

    const { baseUrl, apiKey } = getCredentials(userId)
    const config = getUserN8NConfig(userId)

    // Fetch workflows from N8N
    const response = await httpsRequest(`${baseUrl}/api/v1/workflows`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "X-N8N-API-KEY": apiKey } : {}),
      },
      timeout: 15000,
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `N8N API error: ${response.status}`, details: response.body },
        { status: response.status }
      )
    }

    let data: { data?: unknown[] } | unknown[]

    try {
      data = JSON.parse(response.body)
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON response from N8N" },
        { status: 500 }
      )
    }

    // Extract workflows array from response
    let workflows: Array<{
      id: string
      name: string
      active: boolean
      createdAt: string
      updatedAt: string
      tags?: Array<{ name: string } | string>
    }>

    if (Array.isArray(data)) {
      workflows = data as typeof workflows
    } else if (data && "data" in data && Array.isArray(data.data)) {
      workflows = data.data as typeof workflows
    } else {
      workflows = []
    }

    // Filter workflows for shared instance
    if (config.mode === "shared") {
      workflows = workflows.filter((w) => isUserWorkflow(userId, w))
    }

    // Transform workflows for response
    const transformedWorkflows = workflows.map((w) => ({
      id: w.id,
      name: w.name,
      active: w.active,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      tags: w.tags?.map((t) => (typeof t === "string" ? t : t.name)) || [],
      isUserOwned: true,
    }))

    return NextResponse.json({
      ok: true,
      data: transformedWorkflows,
      total: transformedWorkflows.length,
      mode: config.mode,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[n8n/workflows] GET error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/n8n/workflows - Create a new workflow
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, name, nodes, connections, settings, tags } = body

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      )
    }

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      )
    }

    const { baseUrl, apiKey } = getCredentials(userId)
    const config = getUserN8NConfig(userId)
    const userTag = getUserWorkflowTag(userId)

    // Generate workflow name with user prefix
    const workflowName = generateWorkflowName(userId, name)

    // Build tags array with user tag for isolation
    const workflowTags = new Set<string>([
      ...config.defaultWorkflowTags,
      ...(tags || []),
    ])

    // Add user tag for shared instances
    if (config.mode === "shared") {
      workflowTags.add(userTag)
    }

    // Build workflow payload
    const workflowPayload = {
      name: workflowName,
      nodes: nodes || [],
      connections: connections || {},
      settings: settings || {},
      tags: Array.from(workflowTags),
    }

    // Create workflow in N8N
    const response = await httpsRequest(`${baseUrl}/api/v1/workflows`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "X-N8N-API-KEY": apiKey } : {}),
      },
      body: JSON.stringify(workflowPayload),
      timeout: 30000,
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `N8N API error: ${response.status}`, details: response.body },
        { status: response.status }
      )
    }

    let workflow: {
      id: string
      name: string
      active: boolean
      createdAt: string
      updatedAt: string
      tags?: Array<{ name: string } | string>
    }

    try {
      workflow = JSON.parse(response.body)
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON response from N8N" },
        { status: 500 }
      )
    }

    // Transform for response
    const transformedWorkflow = {
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      tags: workflow.tags?.map((t) => (typeof t === "string" ? t : t.name)) || [],
      isUserOwned: true,
    }

    return NextResponse.json({
      ok: true,
      data: transformedWorkflow,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[n8n/workflows] POST error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/n8n/workflows - Update a workflow
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, workflowId, ...updates } = body

    if (!userId || !workflowId) {
      return NextResponse.json(
        { error: "userId and workflowId are required" },
        { status: 400 }
      )
    }

    const { baseUrl, apiKey } = getCredentials(userId)
    const config = getUserN8NConfig(userId)

    // First, verify ownership
    const getResponse = await httpsRequest(`${baseUrl}/api/v1/workflows/${workflowId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "X-N8N-API-KEY": apiKey } : {}),
      },
    })

    if (!getResponse.ok) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      )
    }

    let existingWorkflow: { name: string; tags?: Array<{ name: string } | string> }
    try {
      existingWorkflow = JSON.parse(getResponse.body)
    } catch {
      return NextResponse.json(
        { error: "Invalid workflow data" },
        { status: 500 }
      )
    }

    // Verify ownership for shared instances
    if (config.mode === "shared" && !isUserWorkflow(userId, existingWorkflow)) {
      return NextResponse.json(
        { error: "Workflow does not belong to user" },
        { status: 403 }
      )
    }

    // Update workflow name if changing
    if (updates.name) {
      updates.name = generateWorkflowName(userId, updates.name)
    }

    // Update workflow
    const response = await httpsRequest(`${baseUrl}/api/v1/workflows/${workflowId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "X-N8N-API-KEY": apiKey } : {}),
      },
      body: JSON.stringify(updates),
      timeout: 30000,
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `N8N API error: ${response.status}` },
        { status: response.status }
      )
    }

    const workflow = JSON.parse(response.body)

    return NextResponse.json({
      ok: true,
      data: {
        ...workflow,
        tags: workflow.tags?.map((t: { name: string } | string) =>
          typeof t === "string" ? t : t.name
        ) || [],
        isUserOwned: true,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[n8n/workflows] PATCH error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/n8n/workflows - Delete a workflow
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const workflowId = searchParams.get("workflowId")

    if (!userId || !workflowId) {
      return NextResponse.json(
        { error: "userId and workflowId are required" },
        { status: 400 }
      )
    }

    const { baseUrl, apiKey } = getCredentials(userId)
    const config = getUserN8NConfig(userId)

    // First, verify ownership
    const getResponse = await httpsRequest(`${baseUrl}/api/v1/workflows/${workflowId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "X-N8N-API-KEY": apiKey } : {}),
      },
    })

    if (!getResponse.ok) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      )
    }

    const existingWorkflow = JSON.parse(getResponse.body)

    // Verify ownership for shared instances
    if (config.mode === "shared" && !isUserWorkflow(userId, existingWorkflow)) {
      return NextResponse.json(
        { error: "Workflow does not belong to user" },
        { status: 403 }
      )
    }

    // Delete workflow
    const response = await httpsRequest(`${baseUrl}/api/v1/workflows/${workflowId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "X-N8N-API-KEY": apiKey } : {}),
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `N8N API error: ${response.status}` },
        { status: response.status }
      )
    }

    return NextResponse.json({
      ok: true,
      deleted: true,
      workflowId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[n8n/workflows] DELETE error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
