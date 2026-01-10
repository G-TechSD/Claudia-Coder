/**
 * N8N Workflow Generation API
 *
 * POST: Generate N8N workflow from natural language description
 * Uses Beast LLM server with gpt-oss-20b model
 *
 * Features:
 * - Natural language to workflow conversion
 * - Pattern detection and template hints
 * - Workflow validation
 * - Optional save to N8N instance
 */

import { NextRequest, NextResponse } from "next/server"
import * as https from "https"
import * as http from "http"
import {
  generateWorkflow,
  validateWorkflow,
  detectWorkflowPattern,
  createWorkflowFromPattern,
  createEmptyWorkflow,
  WORKFLOW_PATTERNS,
  N8NWorkflow,
  WorkflowPatternKey
} from "@/lib/ai/workflow-generator"

// ============ Types ============

interface GenerateRequest {
  description: string
  patternHint?: WorkflowPatternKey
  includeErrorHandling?: boolean
  additionalContext?: string
  saveToN8N?: boolean
  workflowName?: string
  n8nCredentials?: {
    baseUrl: string
    apiKey: string
  }
}

interface GenerateResponse {
  success: boolean
  workflow?: N8NWorkflow
  savedToN8N?: boolean
  n8nWorkflowId?: string
  error?: string
  warnings?: string[]
  detectedPattern?: WorkflowPatternKey | null
  llmResponse?: string
  server?: string
  model?: string
}

// ============ N8N API Helper ============

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
      rejectUnauthorized: false,
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
 * Save workflow to N8N instance
 */
async function saveWorkflowToN8N(
  workflow: N8NWorkflow,
  credentials: { baseUrl: string; apiKey: string }
): Promise<{ success: boolean; workflowId?: string; error?: string }> {
  try {
    const url = `${credentials.baseUrl}/api/v1/workflows`

    const response = await httpsRequest(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-N8N-API-KEY": credentials.apiKey
      },
      body: JSON.stringify(workflow),
      timeout: 30000
    })

    if (!response.ok) {
      return {
        success: false,
        error: `N8N API error: ${response.status} - ${response.body}`
      }
    }

    const data = JSON.parse(response.body)
    return {
      success: true,
      workflowId: data.id
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save to N8N"
    }
  }
}

// ============ API Routes ============

/**
 * POST /api/n8n/generate
 * Generate N8N workflow from natural language description
 */
export async function POST(request: NextRequest): Promise<NextResponse<GenerateResponse>> {
  try {
    const body: GenerateRequest = await request.json()

    // Validate request
    if (!body.description || body.description.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: "Description is required"
      }, { status: 400 })
    }

    const warnings: string[] = []

    // Detect workflow pattern if not provided
    let patternHint = body.patternHint
    const detectedPattern = detectWorkflowPattern(body.description)

    if (!patternHint && detectedPattern) {
      patternHint = detectedPattern
      warnings.push(`Auto-detected workflow pattern: ${WORKFLOW_PATTERNS[detectedPattern].name}`)
    }

    // Generate workflow using LLM
    console.log(`[N8N Generate] Generating workflow for: "${body.description.substring(0, 100)}..."`)

    const generationResult = await generateWorkflow({
      description: body.description,
      patternHint,
      includeErrorHandling: body.includeErrorHandling,
      additionalContext: body.additionalContext
    })

    if (!generationResult.success || !generationResult.workflow) {
      // If LLM generation failed, try to create from pattern template
      if (patternHint) {
        warnings.push(`LLM generation failed, using pattern template: ${generationResult.error}`)

        const templateWorkflow = createWorkflowFromPattern(
          body.workflowName || "Generated Workflow",
          patternHint
        )

        // Validate template workflow
        const validation = validateWorkflow(templateWorkflow)
        if (!validation.valid) {
          return NextResponse.json({
            success: false,
            error: `Template validation failed: ${validation.errors.join(", ")}`,
            detectedPattern
          }, { status: 500 })
        }

        // Optionally save to N8N
        let savedToN8N = false
        let n8nWorkflowId: string | undefined

        if (body.saveToN8N) {
          const n8nCreds = body.n8nCredentials || {
            baseUrl: process.env.N8N_URL || process.env.NEXT_PUBLIC_N8N_URL || "",
            apiKey: process.env.N8N_API_KEY || process.env.NEXT_PUBLIC_N8N_API_KEY || ""
          }

          if (n8nCreds.baseUrl && n8nCreds.apiKey) {
            const saveResult = await saveWorkflowToN8N(templateWorkflow, n8nCreds)
            savedToN8N = saveResult.success
            n8nWorkflowId = saveResult.workflowId

            if (!saveResult.success) {
              warnings.push(`Failed to save to N8N: ${saveResult.error}`)
            }
          } else {
            warnings.push("N8N credentials not configured, skipping save")
          }
        }

        return NextResponse.json({
          success: true,
          workflow: templateWorkflow,
          savedToN8N,
          n8nWorkflowId,
          warnings,
          detectedPattern
        })
      }

      return NextResponse.json({
        success: false,
        error: generationResult.error || "Workflow generation failed",
        llmResponse: generationResult.llmResponse,
        server: generationResult.server,
        model: generationResult.model,
        detectedPattern
      }, { status: 500 })
    }

    // Apply custom workflow name if provided
    if (body.workflowName) {
      generationResult.workflow.name = body.workflowName
    }

    // Validate generated workflow
    const validation = validateWorkflow(generationResult.workflow)
    if (!validation.valid) {
      warnings.push(...validation.errors.map(e => `Validation warning: ${e}`))
    }

    // Optionally save to N8N
    let savedToN8N = false
    let n8nWorkflowId: string | undefined

    if (body.saveToN8N) {
      const n8nCreds = body.n8nCredentials || {
        baseUrl: process.env.N8N_URL || process.env.NEXT_PUBLIC_N8N_URL || "",
        apiKey: process.env.N8N_API_KEY || process.env.NEXT_PUBLIC_N8N_API_KEY || ""
      }

      if (n8nCreds.baseUrl && n8nCreds.apiKey) {
        const saveResult = await saveWorkflowToN8N(generationResult.workflow, n8nCreds)
        savedToN8N = saveResult.success
        n8nWorkflowId = saveResult.workflowId

        if (!saveResult.success) {
          warnings.push(`Failed to save to N8N: ${saveResult.error}`)
        }
      } else {
        warnings.push("N8N credentials not configured, skipping save")
      }
    }

    return NextResponse.json({
      success: true,
      workflow: generationResult.workflow,
      savedToN8N,
      n8nWorkflowId,
      warnings: warnings.length > 0 ? warnings : undefined,
      detectedPattern,
      llmResponse: generationResult.llmResponse,
      server: generationResult.server,
      model: generationResult.model
    })

  } catch (error) {
    console.error("[N8N Generate] Error:", error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    }, { status: 500 })
  }
}

/**
 * GET /api/n8n/generate
 * Get available workflow patterns and templates
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    patterns: Object.entries(WORKFLOW_PATTERNS).map(([key, pattern]) => {
      const p = pattern as { name: string; description: string; nodeSequence: readonly string[] }
      return {
        key,
        name: p.name,
        description: p.description,
        nodeSequence: [...p.nodeSequence]
      }
    }),
    usage: {
      description: "POST a JSON body with the following fields:",
      fields: {
        description: "Required. Natural language description of the workflow you want to create.",
        patternHint: "Optional. One of the pattern keys to guide generation.",
        includeErrorHandling: "Optional. Boolean to include error handling nodes.",
        additionalContext: "Optional. Extra context for the LLM.",
        saveToN8N: "Optional. Boolean to save the workflow to your N8N instance.",
        workflowName: "Optional. Custom name for the workflow.",
        n8nCredentials: "Optional. { baseUrl: string, apiKey: string } for custom N8N instance."
      },
      example: {
        description: "Create a webhook that receives order data, validates it, and sends a Slack notification for high-value orders",
        patternHint: "WEBHOOK_PROCESS_RESPOND",
        includeErrorHandling: true,
        saveToN8N: true,
        workflowName: "Order Notification Workflow"
      }
    }
  })
}

/**
 * PUT /api/n8n/generate
 * Create workflow from pattern template (no LLM)
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as {
      pattern: WorkflowPatternKey
      name?: string
      saveToN8N?: boolean
      n8nCredentials?: { baseUrl: string; apiKey: string }
    }

    if (!body.pattern || !WORKFLOW_PATTERNS[body.pattern]) {
      return NextResponse.json({
        success: false,
        error: `Invalid pattern. Available patterns: ${Object.keys(WORKFLOW_PATTERNS).join(", ")}`
      }, { status: 400 })
    }

    const workflow = createWorkflowFromPattern(
      body.name || WORKFLOW_PATTERNS[body.pattern].name,
      body.pattern
    )

    // Optionally save to N8N
    let savedToN8N = false
    let n8nWorkflowId: string | undefined
    const warnings: string[] = []

    if (body.saveToN8N) {
      const n8nCreds = body.n8nCredentials || {
        baseUrl: process.env.N8N_URL || process.env.NEXT_PUBLIC_N8N_URL || "",
        apiKey: process.env.N8N_API_KEY || process.env.NEXT_PUBLIC_N8N_API_KEY || ""
      }

      if (n8nCreds.baseUrl && n8nCreds.apiKey) {
        const saveResult = await saveWorkflowToN8N(workflow, n8nCreds)
        savedToN8N = saveResult.success
        n8nWorkflowId = saveResult.workflowId

        if (!saveResult.success) {
          warnings.push(`Failed to save to N8N: ${saveResult.error}`)
        }
      } else {
        warnings.push("N8N credentials not configured, skipping save")
      }
    }

    return NextResponse.json({
      success: true,
      workflow,
      savedToN8N,
      n8nWorkflowId,
      warnings: warnings.length > 0 ? warnings : undefined,
      pattern: body.pattern
    })

  } catch (error) {
    console.error("[N8N Generate] Template error:", error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    }, { status: 500 })
  }
}
