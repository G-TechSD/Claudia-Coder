/**
 * Claudia Execution API
 * Executes work packets using:
 * - LOCAL MODE (Default): LM Studio - works completely offline, no subscriptions, FREE
 * - TURBO MODE: Claude Code CLI - higher quality, cloud-powered, requires API subscription
 * - N8N MODE: N8N workflow orchestration - handles iteration loops and quality validation
 *
 * EXECUTION MODE PRIORITY:
 * 1. If explicit mode is set in options, use it
 * 2. If project-level provider is configured, use that provider
 * 3. If global default model is configured, use that provider
 * 4. AUTO mode: Prefer LOCAL first (free), only fall back to Claude Code if local unavailable
 *
 * IMPORTANT: Claude Code (turbo) should ONLY be used if:
 * - Explicitly selected by user in UI
 * - Explicitly set as project default
 * - Explicitly set as global default
 * It should NOT automatically default to Claude Code just because it's available.
 *
 * N8N MODE triggers an external N8N workflow that handles the iteration loop,
 * quality validation, and progress tracking. Results are delivered via callback.
 *
 * MANDATORY QUALITY GATES:
 * All execution modes enforce mandatory quality gates before marking code as complete:
 * 1. Tests MUST pass (npm test / flutter test)
 * 2. TypeScript types MUST check (tsc --noEmit)
 * 3. Build MUST succeed (npm run build)
 * If ANY gate fails, execution returns { success: false } with error details.
 */

import { NextRequest, NextResponse } from "next/server"
import { exec, spawn } from "child_process"
import { promisify } from "util"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import https from "https"
import { generateWithLocalLLM, getAvailableServer } from "@/lib/llm/local-llm"
import { db } from "@/lib/auth/db"
import {
  isBetaTester,
  checkBetaLimitsServer,
  incrementExecutionCountServer,
  BETA_MAX_DAILY_EXECUTIONS,
} from "@/lib/beta/restrictions"
import {
  checkBudget,
  recordUsage,
  getUserApiKey,
} from "@/lib/beta/api-budget"
import { writeRunContext } from "@/lib/ai/run-context"

// Path to store activity events for API access (curl calls don't have localStorage)
const ACTIVITY_EVENTS_FILE = path.join(process.cwd(), ".local-storage", "activity-events.json")
const ACTIVITY_EVENTS_BACKUP_FILE = path.join(process.cwd(), ".local-storage", "activity-events.backup.json")

// Maximum number of events to keep in the file (increased to prevent data loss)
const MAX_STORED_EVENTS = 1000

// Minimum events threshold - refuse to write if we're losing more than this percentage of events
const MIN_EVENTS_SAFETY_THRESHOLD = 0.5 // Don't write if new data is less than 50% of existing

// Create an HTTPS agent that accepts self-signed certificates (for N8N)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})

/**
 * Fetch with self-signed cert support for HTTPS URLs
 */
async function fetchWithSelfSignedCert(url: string, options: RequestInit = {}): Promise<Response> {
  if (url.startsWith("https://")) {
    return fetch(url, {
      ...options,
      // @ts-expect-error - Node.js fetch supports 'agent' option but it's not in the TS types
      agent: httpsAgent,
    })
  }
  return fetch(url, options)
}

const execAsync = promisify(exec)

/**
 * Expand ~ to home directory in paths
 */
function expandPath(p: string): string {
  if (!p) return p
  return p.replace(/^~/, os.homedir())
}

// Timeout for Claude Code execution (10 minutes)
const EXECUTION_TIMEOUT_MS = 10 * 60 * 1000

// SSH configuration for remote execution
// NOTE: If CLAUDE_CODE_HOST is not set, remote execution will be skipped and local execution will be used
const SSH_HOST = process.env.CLAUDE_CODE_HOST || ""
const SSH_USER = process.env.CLAUDE_CODE_USER || "localhost"
const SSH_KEY_PATH = process.env.CLAUDE_CODE_SSH_KEY || "~/.ssh/id_rsa"

// Check if remote execution is configured
const isRemoteConfigured = (): boolean => {
  return !!process.env.CLAUDE_CODE_HOST && process.env.CLAUDE_CODE_HOST.length > 0
}

// Execution mode: "local" (LM Studio - free), "turbo" (Claude Code - paid), "n8n" (N8N workflow), "cloud" (Google/OpenAI)
type ExecutionMode = "local" | "turbo" | "n8n" | "auto" | "cloud"

// N8N configuration (HTTPS with self-signed cert)
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "http://localhost:5678/webhook/claudia-execute"
const CLAUDIA_CALLBACK_URL = process.env.CLAUDIA_CALLBACK_URL || "http://localhost:3000/api/n8n-callback"

interface ExecutionRequest {
  projectId: string
  projectName: string
  repoPath: string
  packet: {
    id: string
    title: string
    description: string
    type: string
    priority: string
    tasks: Array<{ id: string; description: string; completed: boolean }>
    acceptanceCriteria: string[]
  }
  // Project-level model settings (override global defaults)
  projectModelId?: string
  projectProviderId?: string
  options?: {
    maxIterations?: number
    runTests?: boolean
    createCommit?: boolean
    createPR?: boolean
    useRemote?: boolean // Run on remote VM vs local Claude CLI
    mode?: ExecutionMode // "local" = LM Studio (free), "turbo" = Claude Code (paid)
    preferredServer?: string // Which LM Studio server to use (local-llm-server/local-llm-server-2)
    skipQualityGates?: boolean // Skip quality gates (not recommended) - marks packets as "unverified"
    selectedModel?: string // Selected model ID (e.g., "claude-sonnet-4-20250514", "claude-opus-4-20250514")
    selectedProvider?: string // Selected provider (e.g., "claude-code", "lmstudio")
  }
}

interface ExecutionEvent {
  type: "start" | "iteration" | "file_change" | "test_run" | "thinking" | "complete" | "error"
  timestamp: string
  message: string
  detail?: string
  iteration?: number
  progress?: number
  files?: string[]
}

/**
 * Activity event format for persistence (includes additional fields for activity page)
 */
interface StoredActivityEvent {
  id: string
  type: "success" | "error" | "pending" | "running"
  message: string
  timestamp: string
  projectId?: string
  projectName?: string
  packetId?: string
  packetTitle?: string
  mode?: string
  detail?: string
}

/**
 * Save execution events to file for API access
 * This allows activity to show up even when executions happen via curl/API calls
 *
 * SAFETY FEATURES:
 * 1. Creates backup before writing
 * 2. Validates JSON before writing
 * 3. Refuses to write if it would lose more than 50% of existing events
 * 4. Atomic write (write to temp file, then rename)
 */
async function persistActivityEvents(
  events: ExecutionEvent[],
  projectId: string,
  projectName: string,
  packetId: string,
  packetTitle: string,
  mode: string,
  success: boolean
): Promise<void> {
  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(ACTIVITY_EVENTS_FILE), { recursive: true })

    // Read existing events with robust error handling
    let existingEvents: StoredActivityEvent[] = []
    let existingEventCount = 0

    try {
      const data = await fs.readFile(ACTIVITY_EVENTS_FILE, "utf-8")
      const parsed = JSON.parse(data)

      // Validate that parsed data is an array
      if (Array.isArray(parsed)) {
        existingEvents = parsed
        existingEventCount = existingEvents.length
        console.log(`[persistActivityEvents] Loaded ${existingEventCount} existing events`)
      } else {
        console.warn("[persistActivityEvents] File contained non-array data, starting fresh but creating backup")
        // Create a backup of the corrupted file
        await fs.copyFile(ACTIVITY_EVENTS_FILE, ACTIVITY_EVENTS_BACKUP_FILE + ".corrupted." + Date.now()).catch(() => {})
      }
    } catch (readError) {
      const err = readError as NodeJS.ErrnoException
      if (err.code === "ENOENT") {
        // File doesn't exist - this is OK for first run
        console.log("[persistActivityEvents] No existing events file, starting fresh")
      } else if (err instanceof SyntaxError) {
        // JSON parse error - try to recover from backup
        console.error("[persistActivityEvents] JSON parse error, attempting recovery from backup")
        try {
          const backupData = await fs.readFile(ACTIVITY_EVENTS_BACKUP_FILE, "utf-8")
          const backupParsed = JSON.parse(backupData)
          if (Array.isArray(backupParsed)) {
            existingEvents = backupParsed
            existingEventCount = existingEvents.length
            console.log(`[persistActivityEvents] Recovered ${existingEventCount} events from backup`)
          }
        } catch (backupError) {
          console.error("[persistActivityEvents] Could not recover from backup:", backupError)
        }
      } else {
        console.error("[persistActivityEvents] Unexpected read error:", readError)
        // Don't lose data - if we can't read, don't write
        return
      }
    }

    // Create a summary event for this execution
    const summaryEvent: StoredActivityEvent = {
      id: `exec-${packetId}-${Date.now()}`,
      type: success ? "success" : "error",
      message: success
        ? `Completed: ${packetTitle}`
        : `Failed: ${packetTitle}`,
      timestamp: new Date().toISOString(),
      projectId,
      projectName,
      packetId,
      packetTitle,
      mode,
      detail: events.length > 0 ? events[events.length - 1].message : undefined
    }

    // Check for duplicate events (same packet ID within last minute)
    const oneMinuteAgo = Date.now() - 60000
    const isDuplicate = existingEvents.some(e =>
      e.packetId === packetId &&
      new Date(e.timestamp).getTime() > oneMinuteAgo
    )

    if (!isDuplicate) {
      // Add the summary event
      existingEvents.push(summaryEvent)
    } else {
      console.log(`[persistActivityEvents] Skipping duplicate event for packet ${packetId}`)
    }

    // Keep only the most recent events (but never delete more than necessary)
    let eventsToWrite = existingEvents
    if (existingEvents.length > MAX_STORED_EVENTS) {
      eventsToWrite = existingEvents.slice(-MAX_STORED_EVENTS)
      console.log(`[persistActivityEvents] Trimming from ${existingEvents.length} to ${MAX_STORED_EVENTS} events`)
    }

    // SAFETY CHECK: Don't write if we would lose more than 50% of existing events
    // This protects against bugs that might accidentally clear the data
    if (existingEventCount > 10 && eventsToWrite.length < existingEventCount * MIN_EVENTS_SAFETY_THRESHOLD) {
      console.error(`[persistActivityEvents] SAFETY ABORT: Would lose too many events (${existingEventCount} -> ${eventsToWrite.length})`)
      return
    }

    // Create backup before writing (if we have existing data)
    if (existingEventCount > 0) {
      try {
        await fs.copyFile(ACTIVITY_EVENTS_FILE, ACTIVITY_EVENTS_BACKUP_FILE)
        console.log(`[persistActivityEvents] Created backup with ${existingEventCount} events`)
      } catch (backupError) {
        // Backup failed - log but continue (the main file might not exist yet)
        console.warn("[persistActivityEvents] Could not create backup:", backupError)
      }
    }

    // Write to temp file first (atomic write pattern)
    const tempFile = ACTIVITY_EVENTS_FILE + ".tmp"
    const jsonContent = JSON.stringify(eventsToWrite, null, 2)

    // Validate JSON before writing
    try {
      JSON.parse(jsonContent) // Verify it's valid JSON
    } catch (validateError) {
      console.error("[persistActivityEvents] Generated invalid JSON, aborting write")
      return
    }

    await fs.writeFile(tempFile, jsonContent, "utf-8")

    // Rename temp file to actual file (atomic on most filesystems)
    await fs.rename(tempFile, ACTIVITY_EVENTS_FILE)

    console.log(`[persistActivityEvents] Successfully wrote ${eventsToWrite.length} events`)
  } catch (error) {
    console.error("[persistActivityEvents] Failed to save events:", error)
    // Don't throw - this is a non-critical operation
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const events: ExecutionEvent[] = []

  const emit = (type: ExecutionEvent["type"], message: string, detail?: string, extra?: Partial<ExecutionEvent>) => {
    events.push({
      type,
      timestamp: new Date().toISOString(),
      message,
      detail,
      ...extra
    })
  }

  try {
    // Check beta tester limits before execution
    const sessionToken = request.cookies.get("better-auth.session_token")?.value
    if (sessionToken) {
      const userResult = db.prepare(`
        SELECT u.id, u.role
        FROM session s
        JOIN user u ON s.userId = u.id
        WHERE s.token = ?
      `).get(sessionToken) as { id: string; role: string } | undefined

      if (userResult && isBetaTester(userResult.role)) {
        const betaLimits = await checkBetaLimitsServer(userResult.id)

        if (!betaLimits.canExecute) {
          emit("error", "Beta execution limit reached", `You have reached your daily limit of ${BETA_MAX_DAILY_EXECUTIONS} executions.`)
          return NextResponse.json({
            success: false,
            events,
            error: `Beta execution limit reached. You have used ${betaLimits.current.executions}/${BETA_MAX_DAILY_EXECUTIONS} executions today. Limit resets at midnight.`,
            code: "BETA_EXECUTION_LIMIT",
            betaLimits: {
              current: betaLimits.current.executions,
              limit: BETA_MAX_DAILY_EXECUTIONS,
              remaining: betaLimits.remaining.executions,
            },
            duration: Date.now() - startTime
          }, { status: 429 })
        }

        // Increment execution count for beta user
        await incrementExecutionCountServer(userResult.id)

        // Check API budget for beta users
        const budgetCheck = await checkBudget(userResult.id)
        if (!budgetCheck.allowed) {
          emit("error", "API budget exceeded", budgetCheck.message)
          return NextResponse.json({
            success: false,
            events,
            error: budgetCheck.message || "API budget exceeded. Add your own API key in Settings to continue.",
            code: "BETA_BUDGET_EXCEEDED",
            budget: {
              remaining: budgetCheck.remaining,
              percentUsed: budgetCheck.percentUsed,
              usingOwnKey: budgetCheck.usingOwnKey,
            },
            duration: Date.now() - startTime
          }, { status: 429 })
        }

        // Store user info for later usage recording
        // @ts-expect-error - Adding custom property to request for later use
        request.betaUserId = userResult.id
        // @ts-expect-error - Adding custom property
        request.isBetaTester = true
        // @ts-expect-error - Adding custom property
        request.usingOwnKey = budgetCheck.usingOwnKey
      }
    }

    const body: ExecutionRequest = await request.json()
    const { projectName, repoPath: rawRepoPath, packet, projectModelId, projectProviderId, options = {} } = body

    // Expand ~ in repoPath to the actual home directory
    const repoPath = expandPath(rawRepoPath)

    // Determine execution mode based on model selection hierarchy:
    // 1. Explicit mode in options (user selected in UI)
    // 2. Project-level model settings
    // 3. Global settings (via getEffectiveDefaultModel - handled client-side)
    // 4. Auto-detect available backends (NO automatic Claude API)
    let mode = options.mode || "auto"

    // If project has specific model settings, use them to determine mode
    if (!options.mode && projectProviderId) {
      // Map provider to execution mode
      if (projectProviderId === "lmstudio" || projectProviderId === "ollama" || projectProviderId === "custom") {
        mode = "local"
        // Set preferred server if available
        if (projectModelId && !options.preferredServer) {
          options.preferredServer = projectModelId
        }
      } else if (projectProviderId === "anthropic") {
        mode = "turbo" // Claude Code uses Anthropic
      } else if (projectProviderId === "claude-code") {
        // Claude Code Max uses the same turbo execution path (Claude CLI)
        // but authenticates via Max subscription instead of API key
        mode = "turbo"
      } else if (projectProviderId === "n8n") {
        mode = "n8n"
      } else if (projectProviderId === "google" || projectProviderId === "openai") {
        // Cloud providers (Google, OpenAI) use the cloud execution mode
        mode = "cloud"
      }
    }

    // Write run context for AI before starting execution
    try {
      await writeRunContext(repoPath, body.projectId, packet)
    } catch (contextError) {
      console.warn("[claude-execute] Failed to write run context (non-fatal):", contextError)
    }

    emit("start", `Starting processing: ${packet.title}`, `Project: ${projectName}`, { progress: 0 })

    // Build the prompt
    const prompt = buildClaudePrompt(packet)

    let result: {
      success: boolean
      output: string
      filesChanged: string[]
      mode: string
      executionId?: string
      async?: boolean
      unverified?: boolean
      qualityGates?: {
        passed: boolean
        tests: { success: boolean; output: string }
        typeCheck: { success: boolean; output: string; errorCount?: number }
        build: { success: boolean; output: string }
      } | null
    }

    // Determine execution mode
    if (mode === "n8n") {
      // N8N Mode: Trigger N8N workflow, N8N handles iteration loop
      emit("thinking", "Using N8N Mode...", "Workflow orchestration with quality loops")
      const n8nResult = await triggerN8NWorkflow(body, emit)

      if (n8nResult.async) {
        // N8N returns immediately, results come via callback
        // IMPORTANT: success: false because work is NOT done yet - it's just triggered
        // The actual success will come when N8N callback completes
        emit("thinking", "N8N workflow triggered", `Execution ID: ${n8nResult.executionId}`, { progress: 10 })
        // Persist events for API access (async N8N - mark as pending since it's still running)
        await persistActivityEvents(events, body.projectId, projectName, packet.id, packet.title, "n8n", false)
        return NextResponse.json({
          success: false,
          status: "pending",
          packetId: packet.id,
          events,
          async: true,
          executionId: n8nResult.executionId,
          message: "Workflow triggered but work is still in progress. Results will be delivered via callback when complete.",
          duration: Date.now() - startTime,
          mode: "n8n"
        })
      }

      result = { ...n8nResult, mode: "n8n" }
    } else if (mode === "local") {
      // Force LM Studio (free, offline)
      emit("thinking", "Using Local Mode (LM Studio)...", "Free, works offline")
      result = await executeWithLMStudio(prompt, repoPath, packet, options, emit)
    } else if (mode === "turbo") {
      // Force Claude Code (paid, higher quality)
      emit("thinking", "Using Turbo Mode (Claude Code)...", "Premium, cloud-powered")
      const claudeResult = await executeWithClaudeCode(prompt, repoPath, options, emit, body.projectId)
      result = { ...claudeResult, mode: "turbo" }
    } else if (mode === "cloud") {
      // Cloud provider mode (Google, OpenAI) - route through local LLM infrastructure
      // The selected provider and model are passed via options and used for activity display
      const providerName = options.selectedProvider === "google" ? "Google" : options.selectedProvider === "openai" ? "OpenAI" : "Cloud"
      const modelName = options.selectedModel || "cloud model"
      emit("thinking", `Using Cloud Mode (${providerName})...`, `Model: ${modelName}`)

      // Note: Currently routes to local LLM for actual execution
      // TODO: Implement direct cloud provider API calls for packet execution
      const cloudResult = await executeWithLMStudio(prompt, repoPath, packet, options, emit)
      result = { ...cloudResult, mode: "cloud" }
    } else {
      // Auto mode: Prefer LOCAL mode first (free, no API costs)
      // Only use Claude Code if local is not available
      // Claude Code should NOT be automatically selected - it requires explicit configuration
      const lmStudioAvailable = await getAvailableServer()

      if (lmStudioAvailable) {
        emit("thinking", `Using Local Mode (${lmStudioAvailable.name})...`, "Free, works offline")
        result = await executeWithLMStudio(prompt, repoPath, packet, options, emit)
      } else {
        // Fall back to Claude Code only if local is not available
        const claudeAvailable = await checkLocalClaudeAvailable()
        if (claudeAvailable) {
          emit("thinking", "No local LLM available, using Claude Code...", "Falling back to cloud-powered mode")
          const claudeResult = await executeWithClaudeCode(prompt, repoPath, options, emit, body.projectId)
          result = { ...claudeResult, mode: "turbo" }
        } else {
          // Persist failure event - no backend available
          await persistActivityEvents(events, body.projectId, projectName, packet.id, packet.title, "none", false)
          return NextResponse.json({
            success: false,
            events,
            error: "No execution backend available. Start LM Studio or install Claude Code CLI.",
            duration: Date.now() - startTime
          })
        }
      }
    }

    if (!result.success) {
      emit("error", "Execution failed", result.output)
      // Persist failure event
      await persistActivityEvents(events, body.projectId, projectName, packet.id, packet.title, result.mode, false)
      return NextResponse.json({
        success: false,
        events,
        error: result.output,
        duration: Date.now() - startTime,
        mode: result.mode,
        qualityGates: result.qualityGates || null
      })
    }

    emit("complete", `Completed: ${packet.title}`, `${result.filesChanged.length} files modified (${result.mode} mode)`, { progress: 100 })

    // Record API usage for beta testers (estimate cost based on duration/mode)
    // @ts-expect-error - Custom property added earlier
    const betaUserId = request.betaUserId as string | undefined
    // @ts-expect-error - Custom property added earlier
    const isBetaUser = request.isBetaTester as boolean | undefined
    // @ts-expect-error - Custom property added earlier
    const usingOwnKey = request.usingOwnKey as boolean | undefined

    let usageInfo: { spent?: number; budget?: number } = {}
    if (betaUserId && isBetaUser && !usingOwnKey) {
      // Estimate cost based on execution mode and duration
      // These are rough estimates - in production, use actual API cost tracking
      const durationMinutes = (Date.now() - startTime) / 60000
      let estimatedCost = 0

      if (result.mode === "turbo") {
        // Claude Code API is approximately $0.015/1K input tokens, $0.075/1K output tokens
        // Rough estimate: $0.10-$0.50 per execution depending on complexity
        estimatedCost = Math.min(0.50, 0.10 + (durationMinutes * 0.05))
      } else if (result.mode === "n8n") {
        // N8N uses Claude API as well
        estimatedCost = Math.min(0.30, 0.08 + (durationMinutes * 0.03))
      }
      // Local mode (LM Studio) is free, no cost recorded

      if (estimatedCost > 0) {
        const usageResult = await recordUsage(betaUserId, estimatedCost)
        usageInfo = { spent: usageResult.newTotal, budget: usageResult.budget }
        emit("thinking", `API usage recorded: $${estimatedCost.toFixed(3)}`, `Total spent: $${usageResult.newTotal.toFixed(2)}/${usageResult.budget.toFixed(2)}`)
      }
    }

    // Persist success event
    await persistActivityEvents(events, body.projectId, projectName, packet.id, packet.title, result.mode, true)

    return NextResponse.json({
      success: true,
      packetId: packet.id,
      events,
      filesChanged: result.filesChanged,
      output: result.output,
      duration: Date.now() - startTime,
      mode: result.mode,
      unverified: result.unverified || false, // True if quality gates were skipped
      qualityGates: result.qualityGates || null,
      ...(usageInfo.spent !== undefined && {
        apiUsage: {
          cost: usageInfo.spent,
          budget: usageInfo.budget,
        }
      })
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    emit("error", "Execution failed", message)

    // Persist error event (we may not have full context here)
    try {
      const body = await request.clone().json().catch(() => ({})) as Partial<ExecutionRequest>
      await persistActivityEvents(
        events,
        body.projectId || "unknown",
        body.projectName || "Unknown Project",
        body.packet?.id || "unknown",
        body.packet?.title || "Unknown Task",
        "unknown",
        false
      )
    } catch {
      // Ignore persistence errors in catch block
    }

    return NextResponse.json({
      success: false,
      events,
      error: message,
      duration: Date.now() - startTime
    }, { status: 500 })
  }
}

/**
 * Setup project-scoped MCP configuration for Claude Code
 * Writes a .mcp.json file to the project directory that Claude Code will automatically read
 */
async function setupProjectMCP(
  projectId: string,
  repoPath: string
): Promise<void> {
  try {
    // Read project from storage to get MCP settings
    // We use a simple storage approach here since we're in an API route
    const projectsFile = path.join(process.cwd(), ".local-storage", "projects.json")

    let projects: Array<{
      id: string
      mcpSettings?: {
        enabledServers: string[]
        customServers?: Array<{
          id: string
          name: string
          command: string
          args?: string[]
          env?: Record<string, string>
        }>
      }
    }> = []

    try {
      const projectsData = await fs.readFile(projectsFile, "utf-8")
      projects = JSON.parse(projectsData)
    } catch {
      // No projects file or invalid JSON - skip MCP setup
      return
    }

    const project = projects.find(p => p.id === projectId)
    if (!project?.mcpSettings?.enabledServers?.length) {
      // No MCP settings configured for this project
      return
    }

    // Read global MCP server configurations
    const mcpStorageFile = path.join(process.cwd(), ".local-storage", "mcp-servers.json")
    let mcpServers: Array<{
      id: string
      name: string
      command: string
      args: string[]
      env?: Record<string, string>
      enabled: boolean
    }> = []

    try {
      const mcpData = await fs.readFile(mcpStorageFile, "utf-8")
      const mcpStorage = JSON.parse(mcpData)
      mcpServers = mcpStorage.servers || []
    } catch {
      // No MCP servers file - skip MCP setup
      return
    }

    // Build MCP configuration for this project
    const mcpConfig: {
      mcpServers: Record<string, {
        command: string
        args?: string[]
        env?: Record<string, string>
      }>
    } = { mcpServers: {} }

    // Add enabled servers from global config
    for (const serverId of project.mcpSettings.enabledServers) {
      const server = mcpServers.find(s => s.id === serverId && s.enabled)
      if (server) {
        mcpConfig.mcpServers[server.name] = {
          command: server.command,
          args: server.args?.length ? server.args : undefined,
          env: server.env && Object.keys(server.env).length ? server.env : undefined
        }
      }
    }

    // Add project-specific custom servers
    if (project.mcpSettings.customServers?.length) {
      for (const server of project.mcpSettings.customServers) {
        mcpConfig.mcpServers[server.name] = {
          command: server.command,
          args: server.args?.length ? server.args : undefined,
          env: server.env && Object.keys(server.env).length ? server.env : undefined
        }
      }
    }

    // Only write if we have servers to configure
    if (Object.keys(mcpConfig.mcpServers).length > 0) {
      const mcpConfigPath = path.join(repoPath, ".mcp.json")
      await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), "utf-8")
      console.log(`[setupProjectMCP] Wrote MCP config with ${Object.keys(mcpConfig.mcpServers).length} servers to ${mcpConfigPath}`)
    }
  } catch (error) {
    // MCP setup is non-critical - log and continue
    console.warn("[setupProjectMCP] Failed to setup project MCP:", error)
  }
}

/**
 * Execute with Claude Code CLI (Turbo Mode - paid)
 * Wraps the local/remote Claude CLI execution with MANDATORY quality gates
 */
async function executeWithClaudeCode(
  prompt: string,
  repoPath: string,
  options: ExecutionRequest["options"],
  emit: (type: ExecutionEvent["type"], message: string, detail?: string, extra?: Partial<ExecutionEvent>) => void,
  projectId?: string
): Promise<{ success: boolean; output: string; filesChanged: string[]; unverified?: boolean; qualityGates?: { passed: boolean; tests: { success: boolean; output: string }; typeCheck: { success: boolean; output: string; errorCount?: number }; build: { success: boolean; output: string } } | null }> {
  // Setup project-specific MCP configuration if available
  if (projectId) {
    await setupProjectMCP(projectId, repoPath)
  }

  // Determine execution mode - prefer local when available
  const localAvailable = await checkLocalClaudeAvailable()
  const useLocal = localAvailable && (options?.useRemote === false || options?.useRemote === undefined)

  let result: { success: boolean; output: string; filesChanged: string[]; qualityGates?: { passed: boolean; tests: { success: boolean; output: string }; typeCheck: { success: boolean; output: string; errorCount?: number }; build: { success: boolean; output: string } } }

  if (useLocal) {
    result = await executeLocally(prompt, repoPath, options)
  } else {
    result = await executeRemotely(prompt, repoPath, options)
  }

  // If execution failed, return immediately
  if (!result.success) {
    return result
  }

  // Check if quality gates should be skipped
  if (options?.skipQualityGates) {
    emit("thinking", "SKIPPING quality gates (user requested)", "WARNING: Code is NOT verified!")
    return {
      success: true,
      output: `${result.output}\n\n=== WARNING: QUALITY GATES SKIPPED ===\nCode was NOT verified. Tests, TypeScript, and Build checks were skipped at user request.\nUse this code at your own risk.`,
      filesChanged: result.filesChanged,
      unverified: true,
      qualityGates: null
    }
  }

  // MANDATORY QUALITY GATES - No code is "complete" without passing these
  if (result.filesChanged.length > 0) {
    // Install dependencies if package.json was created/modified (required for TypeScript compilation)
    const installResult = await installDependenciesIfNeeded(repoPath, result.filesChanged, emit)
    if (!installResult.success) {
      return {
        success: false,
        output: `DEPENDENCY INSTALLATION FAILED - Cannot run quality gates.\n\n${installResult.output}\n\nClaude Code Output:\n${result.output}`,
        filesChanged: result.filesChanged
      }
    }

    emit("thinking", "Running MANDATORY quality gates...", "Tests, TypeScript, and Build must all pass")

    const qualityResult = await runQualityGates(repoPath, emit)

    if (!qualityResult.passed) {
      // Quality gates failed - return failure with gate details
      return {
        success: false,
        output: `QUALITY GATES FAILED - Code is NOT production-ready.\n\n${qualityResult.summary}\n\nClaude Code Output:\n${result.output}\n\nFiles changed: ${result.filesChanged.join(", ")}`,
        filesChanged: result.filesChanged,
        qualityGates: {
          passed: false,
          tests: qualityResult.tests,
          typeCheck: qualityResult.typeCheck,
          build: qualityResult.build
        }
      }
    }

    // Quality gates passed - return success with enhanced output
    return {
      success: true,
      output: `${result.output}\n\n=== QUALITY GATES: ALL PASSED ===\n- Tests: PASSED\n- TypeScript: PASSED\n- Build: PASSED`,
      filesChanged: result.filesChanged,
      qualityGates: {
        passed: true,
        tests: qualityResult.tests,
        typeCheck: qualityResult.typeCheck,
        build: qualityResult.build
      }
    }
  }

  return { ...result, qualityGates: undefined }
}

/**
 * Trigger N8N workflow for execution (N8N Mode)
 * N8N handles the iteration loop, quality validation, and progress tracking.
 * Claudia just triggers and receives results via callback.
 */
async function triggerN8NWorkflow(
  request: ExecutionRequest,
  emit: (type: ExecutionEvent["type"], message: string, detail?: string, extra?: Partial<ExecutionEvent>) => void
): Promise<{
  success: boolean
  output: string
  filesChanged: string[]
  executionId?: string
  async?: boolean
}> {
  const { projectId, projectName, repoPath, packet, options } = request

  // Generate a unique session ID for tracking
  const sessionId = `claudia-${projectId}-${packet.id}-${Date.now()}`

  emit("thinking", "Preparing N8N workflow request...", `Session: ${sessionId}`)

  // Build the webhook payload
  const webhookPayload = {
    sessionId,
    callbackUrl: CLAUDIA_CALLBACK_URL,
    task: {
      type: packet.type || "code_gen",
      projectId,
      projectName,
      packetId: packet.id,
      title: packet.title,
      description: packet.description,
      tasks: packet.tasks,
      acceptanceCriteria: packet.acceptanceCriteria,
      priority: packet.priority,
      qualityThreshold: 80, // Default quality threshold
      maxIterations: options?.maxIterations || 5
    },
    context: {
      repoPath,
      runTests: options?.runTests ?? true,
      createCommit: options?.createCommit ?? false,
      createPR: options?.createPR ?? false
    },
    metadata: {
      triggeredAt: new Date().toISOString(),
      triggeredBy: "claudia-execution-api"
    }
  }

  try {
    emit("thinking", "Triggering N8N workflow...", N8N_WEBHOOK_URL)

    const response = await fetchWithSelfSignedCert(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Claudia-Session": sessionId
      },
      body: JSON.stringify(webhookPayload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      emit("error", "N8N webhook failed", `Status: ${response.status} - ${errorText}`)
      return {
        success: false,
        output: `N8N webhook returned ${response.status}: ${errorText}`,
        filesChanged: []
      }
    }

    const result = await response.json()

    emit("thinking", "N8N workflow accepted", `Execution ID: ${result.executionId || sessionId}`)

    // N8N workflows are async - they return immediately and send results via callback
    return {
      success: true,
      output: "N8N workflow triggered successfully. Results will be delivered via callback.",
      filesChanged: [],
      executionId: result.executionId || sessionId,
      async: true
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    emit("error", "Failed to trigger N8N workflow", message)

    // Check for common errors
    if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
      return {
        success: false,
        output: `Cannot connect to N8N at ${N8N_WEBHOOK_URL}. Ensure N8N is running and accessible.`,
        filesChanged: []
      }
    }

    if (message.includes("ETIMEDOUT")) {
      return {
        success: false,
        output: `Connection to N8N timed out. Check network connectivity to ${N8N_WEBHOOK_URL}`,
        filesChanged: []
      }
    }

    return {
      success: false,
      output: `Failed to trigger N8N workflow: ${message}`,
      filesChanged: []
    }
  }
}

/**
 * Check if N8N is reachable (handles self-signed HTTPS certs)
 */
async function checkN8NAvailable(): Promise<boolean> {
  try {
    // Try to reach the N8N webhook - expect 404 for GET (webhook only accepts POST)
    // or 200 if n8n is running with a test endpoint
    const url = new URL(N8N_WEBHOOK_URL)
    const healthUrl = `${url.protocol}//${url.host}/healthz`

    const response = await fetchWithSelfSignedCert(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(5000)
    })

    // N8N returns 200 for health check
    return response.ok
  } catch {
    // If health check fails, try the webhook URL directly with HEAD
    try {
      const response = await fetchWithSelfSignedCert(N8N_WEBHOOK_URL, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000)
      })
      // Even a 405 (Method Not Allowed) means n8n is reachable
      return response.status === 405 || response.ok
    } catch {
      return false
    }
  }
}

/**
 * Execute with LM Studio (Local Mode - free, works offline)
 * Uses local LLM to generate code changes and applies them directly
 */
async function executeWithLMStudio(
  _prompt: string,
  repoPath: string,
  packet: ExecutionRequest["packet"],
  options: ExecutionRequest["options"],
  emit: (type: ExecutionEvent["type"], message: string, detail?: string, extra?: Partial<ExecutionEvent>) => void
): Promise<{ success: boolean; output: string; filesChanged: string[]; mode: string; unverified?: boolean; qualityGates?: { passed: boolean; tests: { success: boolean; output: string }; typeCheck: { success: boolean; output: string; errorCount?: number }; build: { success: boolean; output: string } } | null }> {
  const filesChanged: string[] = []
  const maxIterations = options?.maxIterations || 5
  let lastOutput = ""
  let lastErrorFeedback: ErrorFeedback | undefined = undefined
  let lastQualityResult: QualityGateResult | undefined = undefined

  try {
    // Read existing files in the project to understand context
    const projectContext = await gatherProjectContext(repoPath)

    // CHECK: Is this a research/inquiry task?
    // Research tasks produce markdown documents, not code
    if (isResearchOrInquiryTask(packet)) {
      emit("start", "Research/Inquiry Task Detected", "Generating analysis document...")

      const researchPrompt = buildResearchPrompt(packet, projectContext)

      const response = await generateWithLocalLLM(
        RESEARCH_SYSTEM_PROMPT,
        researchPrompt,
        {
          temperature: 0.7, // Higher creativity for research
          max_tokens: 8192,
          preferredServer: options?.preferredServer
        }
      )

      if (response.error) {
        emit("error", "Research generation failed", response.error)
        return {
          success: false,
          output: `Research generation failed: ${response.error}`,
          filesChanged: [],
          mode: "local",
          qualityGates: null
        }
      }

      emit("thinking", `Processing research response from ${response.server}...`, response.model)

      // Parse for document output
      const docOutput = parseDocumentOutput(response.content)

      if (docOutput) {
        // Generate proper filename from packet title if using fallback path
        let docPath = docOutput.path
        if (docPath === ".claudia/docs/response.md") {
          const docSlug = generateDocumentSlug(packet.title)
          docPath = `.claudia/docs/${docSlug}.md`
        }

        // Ensure the .claudia/docs directory exists
        const fullDocPath = path.join(repoPath, docPath)
        await fs.mkdir(path.dirname(fullDocPath), { recursive: true })

        // Add header with packet info
        const docContent = `---
title: "${packet.title}"
type: ${packet.type}
generated: ${new Date().toISOString()}
packet_id: ${packet.id}
---

${docOutput.content}
`

        await fs.writeFile(fullDocPath, docContent, "utf-8")
        filesChanged.push(docPath)

        emit("file_change", `Created research document: ${docPath}`, undefined, {
          files: [docPath]
        })

        emit("complete", "Research document generated successfully", docPath)

        return {
          success: true,
          output: `Research complete. Document saved to: ${docPath}\n\n${response.content.substring(0, 500)}...`,
          filesChanged,
          mode: "local",
          // Research tasks don't need quality gates - just document generation
          qualityGates: {
            passed: true,
            tests: { success: true, output: "Skipped - research task" },
            typeCheck: { success: true, output: "Skipped - research task" },
            build: { success: true, output: "Skipped - research task" }
          }
        }
      } else {
        // Even if parsing failed, save the raw response as a document
        const docSlug = generateDocumentSlug(packet.title)
        const docPath = `.claudia/docs/${docSlug}.md`
        const fullDocPath = path.join(repoPath, docPath)
        await fs.mkdir(path.dirname(fullDocPath), { recursive: true })

        const docContent = `---
title: "${packet.title}"
type: ${packet.type}
generated: ${new Date().toISOString()}
packet_id: ${packet.id}
---

# ${packet.title}

${response.content}
`
        await fs.writeFile(fullDocPath, docContent, "utf-8")
        filesChanged.push(docPath)

        emit("file_change", `Created research document: ${docPath}`, undefined, {
          files: [docPath]
        })

        emit("complete", "Research document generated", docPath)

        return {
          success: true,
          output: `Research complete. Document saved to: ${docPath}`,
          filesChanged,
          mode: "local",
          qualityGates: {
            passed: true,
            tests: { success: true, output: "Skipped - research task" },
            typeCheck: { success: true, output: "Skipped - research task" },
            build: { success: true, output: "Skipped - research task" }
          }
        }
      }
    }

    // STANDARD CODING TASK FLOW (continues from here if not research)

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      const isFixIteration = !!lastErrorFeedback

      emit("iteration", `Iteration ${iteration}/${maxIterations}`,
        isFixIteration ? "🔧 FIX MODE: Correcting errors from previous iteration..." : "Analyzing and generating code...", {
        iteration,
        progress: Math.round((iteration / maxIterations) * 80)
      })

      // Build the LM Studio prompt with structured output format
      // Pass error feedback if quality gates failed in previous iteration
      const lmPrompt = buildLMStudioPrompt(packet, projectContext, iteration, lastOutput, lastErrorFeedback)

      // Generate with local LLM
      const response = await generateWithLocalLLM(
        LMSTUDIO_SYSTEM_PROMPT,
        lmPrompt,
        {
          temperature: isFixIteration ? 0.1 : 0.3, // Even lower temp for fix iterations
          max_tokens: 8192, // Large for full file contents
          preferredServer: options?.preferredServer
        }
      )

      if (response.error) {
        emit("error", `LM Studio error (iter ${iteration})`, response.error)
        continue
      }

      emit("thinking", `Processing response from ${response.server}...`, response.model)

      // Parse the response for file operations
      const operations = parseFileOperations(response.content)

      if (operations.length === 0) {
        emit("thinking", `No file changes in iteration ${iteration}`, "Checking if complete...")
        // Check if the LLM thinks we're done
        if (response.content.toLowerCase().includes("complete") ||
            response.content.toLowerCase().includes("all tasks done") ||
            response.content.toLowerCase().includes("no further changes")) {
          // LLM thinks done - verify with quality gates before accepting
          if (!options?.skipQualityGates && filesChanged.length > 0) {
            emit("thinking", "LM Studio indicates complete - verifying with quality gates...", "")

            // Install deps first if needed
            const installResult = await installDependenciesIfNeeded(repoPath, filesChanged, emit)
            if (installResult.success) {
              const qualityResult = await runQualityGates(repoPath, emit)
              if (qualityResult.passed) {
                emit("complete", "LM Studio task complete - all quality gates passed", `After ${iteration} iterations`)
                return {
                  success: true,
                  output: `Completed with LM Studio. ${filesChanged.length} files modified.\n\nQuality Gates: ALL PASSED`,
                  filesChanged,
                  mode: "local",
                  qualityGates: {
                    passed: true,
                    tests: qualityResult.tests,
                    typeCheck: qualityResult.typeCheck,
                    build: qualityResult.build
                  }
                }
              } else {
                // Quality gates failed but LLM thought it was done - build feedback and continue
                emit("thinking", "LLM indicated complete but quality gates failed", "Will attempt to fix errors...")
                lastErrorFeedback = await buildErrorFeedback(repoPath, qualityResult)
                lastQualityResult = qualityResult
                continue
              }
            }
          }
          emit("complete", "LM Studio indicates task complete", `After ${iteration} iterations`)
          break
        }
        continue
      }

      // Apply file operations
      for (const op of operations) {
        try {
          const fullPath = path.isAbsolute(op.path) ? op.path : path.join(repoPath, op.path)

          if (op.operation === "create" || op.operation === "update") {
            // Ensure directory exists
            await fs.mkdir(path.dirname(fullPath), { recursive: true })
            await fs.writeFile(fullPath, op.content, "utf-8")
            // Track unique files changed
            if (!filesChanged.includes(op.path)) {
              filesChanged.push(op.path)
            }
            emit("file_change", `${op.operation === "create" ? "Created" : "Updated"}: ${op.path}`, undefined, {
              files: [op.path]
            })
          } else if (op.operation === "delete") {
            await fs.unlink(fullPath).catch(() => {})
            emit("file_change", `Deleted: ${op.path}`)
          }
        } catch (err) {
          emit("error", `Failed to ${op.operation} ${op.path}`, err instanceof Error ? err.message : "Unknown error")
        }
      }

      lastOutput = response.content

      // Run quality gates WITHIN the iteration if not skipping
      // This enables the error feedback loop
      if (!options?.skipQualityGates && filesChanged.length > 0) {
        emit("thinking", `Running quality gates after iteration ${iteration}...`, "Checking Tests, TypeScript, Build")

        // Install dependencies if package.json was created/modified
        const installResult = await installDependenciesIfNeeded(repoPath, filesChanged, emit)
        if (!installResult.success) {
          emit("error", "Dependency installation failed", installResult.output)
          lastErrorFeedback = {
            buildErrors: { errorOutput: `Dependency installation failed:\n${installResult.output}` }
          }
          continue // Try again in next iteration
        }

        const qualityResult = await runQualityGates(repoPath, emit)
        lastQualityResult = qualityResult

        if (qualityResult.passed) {
          // Quality gates passed! Create commit and return success
          emit("complete", "All quality gates passed!", `Completed in ${iteration} iteration(s)`)

          if (options?.createCommit) {
            emit("thinking", "Creating commit...", `${filesChanged.length} files changed - All quality gates passed`)
            await createGitCommit(repoPath, packet.title, filesChanged)
          }

          return {
            success: true,
            output: `Completed with LM Studio. ${filesChanged.length} files modified.\n\nQuality Gates: ALL PASSED\n- Tests: PASSED\n- TypeScript: PASSED\n- Build: PASSED`,
            filesChanged,
            mode: "local",
            qualityGates: {
              passed: true,
              tests: qualityResult.tests,
              typeCheck: qualityResult.typeCheck,
              build: qualityResult.build
            }
          }
        } else {
          // Quality gates failed - build error feedback for next iteration
          emit("thinking", `Quality gates failed (iteration ${iteration})`, "Will attempt to fix errors in next iteration...")
          lastErrorFeedback = await buildErrorFeedback(repoPath, qualityResult)
          // Continue to next iteration with error feedback
        }
      }
    }

    // Check if quality gates should be skipped - only runs if loop completed without early return
    if (filesChanged.length > 0 && options?.skipQualityGates) {
      emit("thinking", "SKIPPING quality gates (user requested)", "WARNING: Code is NOT verified!")

      // Create commit even without quality gates if requested
      if (options?.createCommit) {
        emit("thinking", "Creating commit...", `${filesChanged.length} files changed - UNVERIFIED`)
        await createGitCommit(repoPath, packet.title + " (UNVERIFIED)", filesChanged)
      }

      return {
        success: true,
        output: `Completed with LM Studio. ${filesChanged.length} files modified.\n\n=== WARNING: QUALITY GATES SKIPPED ===\nCode was NOT verified. Tests, TypeScript, and Build checks were skipped at user request.\nUse this code at your own risk.`,
        filesChanged,
        mode: "local",
        unverified: true,
        qualityGates: null
      }
    }

    // If we reached here with files changed, it means max iterations were exhausted without passing quality gates
    if (filesChanged.length > 0 && lastQualityResult && !lastQualityResult.passed) {
      emit("error", `Max iterations (${maxIterations}) reached - quality gates still failing`, lastQualityResult.summary.substring(0, 500))
      return {
        success: false,
        output: `MAX ITERATIONS REACHED - Quality gates still failing after ${maxIterations} attempts.\n\n${lastQualityResult.summary}\n\nFiles changed: ${filesChanged.join(", ")}\n\nThe LLM was unable to fix all errors. Manual intervention may be required.`,
        filesChanged,
        mode: "local",
        qualityGates: {
          passed: false,
          tests: lastQualityResult.tests,
          typeCheck: lastQualityResult.typeCheck,
          build: lastQualityResult.build
        }
      }
    }

    // If we get here with files but no quality result, run quality gates one final time
    // (This handles edge cases where the loop exited early)
    if (filesChanged.length > 0 && !lastQualityResult) {
      emit("thinking", "Running final quality gates check...", "")
      const installResult = await installDependenciesIfNeeded(repoPath, filesChanged, emit)
      if (installResult.success) {
        const finalQualityResult = await runQualityGates(repoPath, emit)
        if (finalQualityResult.passed) {
          if (options?.createCommit) {
            await createGitCommit(repoPath, packet.title, filesChanged)
          }
          return {
            success: true,
            output: `Completed with LM Studio. ${filesChanged.length} files modified.\n\nQuality Gates: ALL PASSED`,
            filesChanged,
            mode: "local",
            qualityGates: {
              passed: true,
              tests: finalQualityResult.tests,
              typeCheck: finalQualityResult.typeCheck,
              build: finalQualityResult.build
            }
          }
        } else {
          return {
            success: false,
            output: `QUALITY GATES FAILED.\n\n${finalQualityResult.summary}\n\nFiles changed: ${filesChanged.join(", ")}`,
            filesChanged,
            mode: "local",
            qualityGates: {
              passed: false,
              tests: finalQualityResult.tests,
              typeCheck: finalQualityResult.typeCheck,
              build: finalQualityResult.build
            }
          }
        }
      }
    }

    return {
      success: false,
      output: "No files were generated or modified. The LM Studio model did not produce any file changes for this packet.",
      filesChanged,
      mode: "local",
      qualityGates: undefined // No files changed, so no quality gates were run
    }

  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : "LM Studio execution failed",
      filesChanged,
      mode: "local",
      qualityGates: undefined
    }
  }
}

// System prompt for LM Studio code generation
const LMSTUDIO_SYSTEM_PROMPT = `You are Claudia Coder, an expert AI developer. You write PRODUCTION-QUALITY code.

When given a task, respond with file operations in this EXACT format:

===FILE: path/to/file.ext===
OPERATION: create|update|delete
---CONTENT---
[Full file content here]
---END---

Rules:
1. Include the COMPLETE file content, not snippets
2. Use relative paths from project root
3. One ===FILE=== block per file
4. Write clean, well-documented code
5. Follow existing project patterns
6. Handle errors and edge cases
7. Make it accessible (WCAG 2.1 AA)
8. Make it responsive and polished

If the task is complete and no more changes needed, say "COMPLETE - all tasks done"
`

// System prompt for research/inquiry/non-coding tasks
const RESEARCH_SYSTEM_PROMPT = `You are Claudia, an expert analyst and advisor. You provide thorough, well-researched responses.

When given a research task, inquiry, or non-coding request, provide a comprehensive response in markdown format.

Output your response in this EXACT format:

===DOCUMENT: .claudia/docs/{appropriate-filename}.md===
---CONTENT---
# [Title based on the task]

[Your comprehensive response here, using proper markdown formatting]

## Key Findings
- [Finding 1]
- [Finding 2]

## Recommendations
- [Recommendation 1]
- [Recommendation 2]

## Summary
[Brief summary of your analysis/findings]

---
*Generated by Claudia on [date]*
---END---

Guidelines:
1. Be thorough and well-organized
2. Use proper markdown formatting (headers, lists, tables, code blocks)
3. Cite sources or reasoning when making claims
4. Provide actionable recommendations when appropriate
5. Include relevant examples or case studies
6. Structure content for easy reading
7. Be direct and practical, not vague or overly academic
8. If the task involves comparison, use tables
9. If the task involves steps/processes, use numbered lists
10. Always end with a clear summary or conclusion

For business/strategy tasks: Focus on practical implications and ROI
For research tasks: Focus on findings, evidence, and implications
For advisory tasks: Focus on pros/cons and clear recommendations
`

/**
 * Detect if a packet is a research/inquiry/non-coding task
 * These tasks should output markdown documents instead of code
 */
function isResearchOrInquiryTask(packet: ExecutionRequest["packet"]): boolean {
  // Explicit research type
  if (packet.type === "research" || packet.type === "docs" || packet.type === "analysis") {
    return true
  }

  // If type is explicitly "feature", "bugfix", "refactor", or "test" - it's a coding task
  // Only override with research detection for ambiguous types
  const codingTypes = ["feature", "bugfix", "refactor", "test", "infrastructure", "integration"]
  if (codingTypes.includes(packet.type)) {
    return false  // Respect the explicit type - it's a coding task
  }

  // Check title and description for research/inquiry indicators
  const text = `${packet.title} ${packet.description}`.toLowerCase()

  // Research/inquiry keywords
  const researchKeywords = [
    "research", "investigate", "analyze", "analyse", "evaluate",
    "assess", "compare", "study", "explore", "understand", "learn about",
    "find out", "look into", "recommend", "advise", "suggest", "strategy",
    "planning", "plan for", "how to", "what is", "what are", "why", "when should",
    "best practice", "pros and cons", "options for", "alternatives",
    "feasibility", "market", "competitive", "analysis", "report"
  ]

  // Coding keywords - if these are present, it's likely a coding task
  const codingKeywords = [
    "implement", "create component", "build feature", "fix bug", "refactor",
    "add endpoint", "write function", "create class", "add method",
    "update code", "modify", "change the", "add to", "remove from",
    "integrate", "connect", "wire up", "hook up", "api endpoint",
    "database", "schema", "migration", "test for", "unit test",
    "create", "build", "code", "develop", "component"
  ]

  // Check for research indicators
  const hasResearchKeywords = researchKeywords.some(kw => text.includes(kw))
  const hasCodingKeywords = codingKeywords.some(kw => text.includes(kw))

  // If it has coding keywords, it's NOT a research task
  if (hasCodingKeywords) {
    return false
  }

  // If it has research keywords and no coding keywords, it's a research task
  if (hasResearchKeywords) {
    return true
  }

  // Check tasks for research nature
  const taskTexts = packet.tasks.map(t => t.description.toLowerCase()).join(" ")
  const tasksAreResearch = researchKeywords.some(kw => taskTexts.includes(kw))
  const tasksAreCoding = codingKeywords.some(kw => taskTexts.includes(kw))

  if (tasksAreCoding) {
    return false
  }

  if (tasksAreResearch) {
    return true
  }

  return false
}

/**
 * Parse document output from research task response
 */
interface DocumentOutput {
  path: string
  content: string
}

function parseDocumentOutput(response: string): DocumentOutput | null {
  // Pattern: ===DOCUMENT: path/to/file.md===\n---CONTENT---\n...\n---END---
  const docPattern = /===DOCUMENT:\s*(.+?)===\s*\n---CONTENT---\n([\s\S]*?)(?:---END---|$)/i

  const match = docPattern.exec(response)
  if (match) {
    return {
      path: match[1].trim(),
      content: match[2].trim()
    }
  }

  // Fallback: if response is just markdown without our format, wrap it
  if (response.includes("#") && !response.includes("===FILE:")) {
    return {
      path: ".claudia/docs/response.md",
      content: response.trim()
    }
  }

  return null
}

/**
 * Generate a slug from packet title for document filename
 */
function generateDocumentSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50)
}

/**
 * Error feedback context for retry prompts
 */
interface ErrorFeedback {
  typeErrors?: {
    errorOutput: string
    errorCount: number
    tsconfigContent?: string
    failingFiles?: Array<{ path: string; content: string }>
  }
  testErrors?: {
    errorOutput: string
  }
  buildErrors?: {
    errorOutput: string
  }
}

/**
 * Build the prompt for LM Studio execution
 * Includes detailed error feedback when quality gates fail
 */
function buildLMStudioPrompt(
  packet: ExecutionRequest["packet"],
  projectContext: string,
  iteration: number,
  previousOutput: string,
  errorFeedback?: ErrorFeedback
): string {
  const taskList = packet.tasks.map((t, i) => `${i + 1}. ${t.description}`).join("\n")
  const criteria = packet.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")

  let prompt = `# Task: ${packet.title}

## Description
${packet.description}

## Tasks to Complete
${taskList}

## Acceptance Criteria
${criteria}

## Current Project Structure
${projectContext}
`

  // Add error feedback if this is a retry after quality gate failure
  if (iteration > 1 && errorFeedback) {
    prompt += `

## ⚠️ QUALITY GATE ERRORS - FIX THESE FIRST!

The previous iteration failed quality gates. You MUST fix these errors before proceeding.
`

    if (errorFeedback.typeErrors && errorFeedback.typeErrors.errorCount > 0) {
      prompt += `
### TypeScript Compilation Errors (${errorFeedback.typeErrors.errorCount} errors)

\`\`\`
${errorFeedback.typeErrors.errorOutput.substring(0, 3000)}
\`\`\`
`

      // Include tsconfig so the model understands the rules
      if (errorFeedback.typeErrors.tsconfigContent) {
        prompt += `
### tsconfig.json (MUST follow these rules)

\`\`\`json
${errorFeedback.typeErrors.tsconfigContent}
\`\`\`

IMPORTANT TypeScript rules to follow:
- If "verbatimModuleSyntax": true, you MUST use \`import type { ... }\` for type-only imports
- If "erasableSyntaxOnly": true, you CANNOT use \`enum\` - use \`const\` objects instead
- If "strict": true, all variables must have proper types, no implicit any
- If "noUnusedLocals": true, remove any unused imports/variables
`
      }

      // Include content of failing files
      if (errorFeedback.typeErrors.failingFiles && errorFeedback.typeErrors.failingFiles.length > 0) {
        prompt += `
### Files with errors (current content)

`
        for (const file of errorFeedback.typeErrors.failingFiles.slice(0, 3)) {
          prompt += `#### ${file.path}
\`\`\`typescript
${file.content.substring(0, 2000)}
\`\`\`

`
        }
      }
    }

    if (errorFeedback.testErrors) {
      prompt += `
### Test Failures

\`\`\`
${errorFeedback.testErrors.errorOutput.substring(0, 2000)}
\`\`\`
`
    }

    if (errorFeedback.buildErrors) {
      prompt += `
### Build Errors

\`\`\`
${errorFeedback.buildErrors.errorOutput.substring(0, 2000)}
\`\`\`
`
    }

    prompt += `
FIX ALL THE ABOVE ERRORS. Output corrected files using the ===FILE=== format.
Do NOT add new features until all errors are fixed.
`
  } else if (iteration > 1 && previousOutput) {
    prompt += `

## Previous Iteration Output
${previousOutput.substring(0, 2000)}

Continue from where you left off. What files need to be created or updated next?
`
  } else {
    prompt += `

Start implementing. Output file operations using the ===FILE=== format.
`
  }

  return prompt
}

/**
 * Build the prompt for research/inquiry tasks
 * These tasks produce markdown documents instead of code
 */
function buildResearchPrompt(
  packet: ExecutionRequest["packet"],
  projectContext: string
): string {
  const taskList = packet.tasks.map((t, i) => `${i + 1}. ${t.description}`).join("\n")
  const criteria = packet.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")
  const docSlug = generateDocumentSlug(packet.title)

  return `# Research Task: ${packet.title}

## Description
${packet.description}

## Tasks to Complete
${taskList}

## What We're Looking For
${criteria}

## Project Context
${projectContext}

## Output Instructions
Provide your response as a markdown document. Use the filename: .claudia/docs/${docSlug}.md

Remember to:
- Be thorough and well-organized
- Use proper markdown formatting
- Include actionable recommendations
- End with a clear summary
- Add today's date to the footer

Start your research response now.
`
}

/**
 * Gather project context (file tree, key files) for LM Studio
 */
async function gatherProjectContext(repoPath: string): Promise<string> {
  try {
    // Get directory listing
    const files = await listFilesRecursive(repoPath, 3, 50) // Max depth 3, max 50 files
    const fileTree = files.map(f => `  ${f}`).join("\n")

    // Try to read key configuration files
    let configContent = ""
    const keyFiles = ["package.json", "tsconfig.json", "pubspec.yaml", "Cargo.toml", "go.mod", "requirements.txt"]

    for (const keyFile of keyFiles) {
      try {
        const content = await fs.readFile(path.join(repoPath, keyFile), "utf-8")
        configContent += `\n### ${keyFile}\n\`\`\`\n${content.substring(0, 1000)}\n\`\`\`\n`
        break // Only include first found
      } catch {
        // File doesn't exist, continue
      }
    }

    return `File tree:\n${fileTree}\n${configContent}`
  } catch {
    return "Unable to read project structure"
  }
}

/**
 * List files recursively (with depth and count limits)
 */
async function listFilesRecursive(
  dir: string,
  maxDepth: number,
  maxFiles: number,
  currentDepth: number = 0,
  files: string[] = []
): Promise<string[]> {
  if (currentDepth > maxDepth || files.length >= maxFiles) {
    return files
  }

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (files.length >= maxFiles) break

      // Skip common non-essential directories
      if (entry.isDirectory() && ["node_modules", ".git", "dist", "build", ".dart_tool", "__pycache__"].includes(entry.name)) {
        continue
      }

      const relativePath = path.relative(process.cwd(), path.join(dir, entry.name))

      if (entry.isFile()) {
        files.push(entry.name)
      } else if (entry.isDirectory()) {
        files.push(`${entry.name}/`)
        await listFilesRecursive(path.join(dir, entry.name), maxDepth, maxFiles, currentDepth + 1, files)
      }
    }
  } catch {
    // Ignore errors
  }

  return files
}

/**
 * Parse file operations from LM Studio response
 */
interface FileOperation {
  path: string
  operation: "create" | "update" | "delete"
  content: string
}

/**
 * Clean content by removing markdown artifacts that LM models often include
 */
function cleanFileContent(content: string): string {
  let cleaned = content

  // Remove leading/trailing markdown code fences
  cleaned = cleaned.replace(/^```[\w]*\n?/, "")
  cleaned = cleaned.replace(/\n?```\s*$/, "")

  // Remove any trailing file markers that leaked in
  cleaned = cleaned.replace(/\n===FILE:[\s\S]*$/, "")

  // Remove trailing --- markers (used as file delimiters)
  cleaned = cleaned.replace(/\n?---+\s*$/, "")

  // Remove orphaned CONTENT markers
  cleaned = cleaned.replace(/\n?---CONTENT---\s*$/, "")
  cleaned = cleaned.replace(/\n?---END---\s*$/, "")

  // Trim whitespace but preserve internal formatting
  cleaned = cleaned.trimEnd()

  return cleaned
}

function parseFileOperations(response: string): FileOperation[] {
  const operations: FileOperation[] = []

  // Pattern: ===FILE: path/to/file===\nOPERATION: create|update|delete\n---CONTENT---\n...\n---END---
  // Make ---END--- optional since many LM models forget it
  const filePattern = /===FILE:\s*(.+?)===\s*\nOPERATION:\s*(create|update|delete)\s*\n---CONTENT---\n([\s\S]*?)(?:---END---|(?=\n===FILE:)|$)/gi

  let match
  while ((match = filePattern.exec(response)) !== null) {
    operations.push({
      path: match[1].trim(),
      operation: match[2].toLowerCase() as "create" | "update" | "delete",
      content: cleanFileContent(match[3])
    })
  }

  // Also try alternative format: ```filepath\n...content...\n```
  if (operations.length === 0) {
    const altPattern = /```(\S+)\n([\s\S]*?)```/g
    while ((match = altPattern.exec(response)) !== null) {
      const filepath = match[1]
      // Only treat as file if it looks like a path
      if (filepath.includes("/") || filepath.includes(".")) {
        operations.push({
          path: filepath,
          operation: "create",
          content: cleanFileContent(match[2])
        })
      }
    }
  }

  return operations
}

/**
 * Detect source files in a project to determine if package.json is needed
 */
async function detectSourceFiles(repoPath: string): Promise<{ hasTypeScript: boolean; hasReact: boolean; hasVite: boolean }> {
  const result = { hasTypeScript: false, hasReact: false, hasVite: false }

  try {
    // Check for TypeScript files
    const { stdout: tsFiles } = await execAsync("find . -name '*.ts' -o -name '*.tsx' | head -5", {
      cwd: repoPath,
      timeout: 5000
    }).catch(() => ({ stdout: "" }))
    result.hasTypeScript = tsFiles.trim().length > 0
    result.hasReact = tsFiles.includes(".tsx")

    // Check for vite.config
    try {
      await fs.access(path.join(repoPath, "vite.config.ts"))
      result.hasVite = true
    } catch {
      try {
        await fs.access(path.join(repoPath, "vite.config.js"))
        result.hasVite = true
      } catch {
        // No vite config
      }
    }
  } catch {
    // Ignore errors in detection
  }

  return result
}

/**
 * Create a missing package.json for TypeScript/React projects
 */
async function createMissingPackageJson(
  repoPath: string,
  sourceInfo: { hasTypeScript: boolean; hasReact: boolean; hasVite: boolean }
): Promise<{ success: boolean; error?: string }> {
  const packageJson: Record<string, unknown> = {
    name: path.basename(repoPath).toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    version: "0.0.1",
    private: true,
    type: "module",
    scripts: {
      dev: sourceInfo.hasVite ? "vite" : "tsc --watch",
      build: sourceInfo.hasVite ? "tsc && vite build" : "tsc",
      lint: "eslint .",
      test: "vitest"
    },
    dependencies: {} as Record<string, string>,
    devDependencies: {} as Record<string, string>
  }

  // Add React dependencies if needed
  if (sourceInfo.hasReact) {
    (packageJson.dependencies as Record<string, string>)["react"] = "^18.3.1";
    (packageJson.dependencies as Record<string, string>)["react-dom"] = "^18.3.1";
    (packageJson.devDependencies as Record<string, string>)["@types/react"] = "^18.3.18";
    (packageJson.devDependencies as Record<string, string>)["@types/react-dom"] = "^18.3.5"
  }

  // Add TypeScript dependencies
  if (sourceInfo.hasTypeScript) {
    (packageJson.devDependencies as Record<string, string>)["typescript"] = "~5.6.2";
    (packageJson.devDependencies as Record<string, string>)["@types/node"] = "^22.10.0"
  }

  // Add Vite dependencies if needed
  if (sourceInfo.hasVite) {
    (packageJson.devDependencies as Record<string, string>)["vite"] = "^6.0.5";
    (packageJson.devDependencies as Record<string, string>)["@vitejs/plugin-react"] = "^4.3.4";
    (packageJson.devDependencies as Record<string, string>)["vitest"] = "^2.1.8";
    (packageJson.devDependencies as Record<string, string>)["@testing-library/react"] = "^16.1.0";
    (packageJson.devDependencies as Record<string, string>)["@testing-library/jest-dom"] = "^6.6.3"
  }

  try {
    await fs.writeFile(
      path.join(repoPath, "package.json"),
      JSON.stringify(packageJson, null, 2),
      "utf-8"
    )
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

/**
 * Install dependencies if package.json was created or modified
 * This ensures node_modules exists before TypeScript compilation
 */
async function installDependenciesIfNeeded(
  repoPath: string,
  filesChanged: string[],
  emit: (type: ExecutionEvent["type"], message: string, detail?: string, extra?: Partial<ExecutionEvent>) => void
): Promise<{ success: boolean; output: string }> {
  // Check if package.json is in the files changed
  const packageJsonChanged = filesChanged.some(f =>
    f === "package.json" ||
    f.endsWith("/package.json") ||
    f === path.join(repoPath, "package.json")
  )

  if (!packageJsonChanged) {
    // Also check if package.json exists but node_modules doesn't
    const packageJsonPath = path.join(repoPath, "package.json")
    const nodeModulesPath = path.join(repoPath, "node_modules")

    try {
      await fs.access(packageJsonPath)
      try {
        await fs.access(nodeModulesPath)
        // Both exist, no need to install
        return { success: true, output: "Dependencies already installed" }
      } catch {
        // package.json exists but node_modules doesn't - need to install
        emit("thinking", "node_modules missing, installing dependencies...", "Required for TypeScript compilation")
      }
    } catch {
      // No package.json exists - check if this is a JS/TS project that needs one
      const srcFiles = await detectSourceFiles(repoPath)
      if (srcFiles.hasTypeScript || srcFiles.hasReact) {
        emit("thinking", "Source files detected but no package.json - creating one...", "Required for TypeScript/React projects")
        const created = await createMissingPackageJson(repoPath, srcFiles)
        if (!created.success) {
          return { success: false, output: `Failed to create package.json: ${created.error}` }
        }
        emit("thinking", "Created package.json, installing dependencies...", "Running npm install")
      } else {
        // Not a Node.js project
        return { success: true, output: "No package.json found - skipping dependency installation" }
      }
    }
  } else {
    emit("thinking", "package.json changed, installing dependencies...", "Running npm install --legacy-peer-deps")
  }

  // Helper to detect and format user-friendly error messages
  const getUserFriendlyError = (output: string): string => {
    if (output.includes("No matching version found")) {
      return "The AI specified a package version that doesn't exist. This is a code generation issue. The generated package.json contains invalid version specifications."
    }
    if (output.includes("ERESOLVE")) {
      return "Package dependency conflict. The generated code has incompatible dependencies. The AI may have specified packages with conflicting peer dependencies."
    }
    if (output.includes("MODULE_NOT_FOUND") || output.includes("Cannot find module")) {
      return "A required module is missing. The build configuration may be incorrect, or the AI referenced a package that isn't installed."
    }
    if (output.includes("npm ERR! code ENOENT")) {
      return "A required file or directory was not found. The project structure may be incomplete."
    }
    if (output.includes("npm ERR! code E404")) {
      return "A package was not found in the npm registry. The AI may have referenced a non-existent package name."
    }
    if (output.includes("EACCES") || output.includes("permission denied")) {
      return "Permission denied. There may be a file system permission issue in the project directory."
    }
    return ""
  }

  // Try installation with different strategies
  const installStrategies = [
    { name: "npm install --legacy-peer-deps", cmd: "npm install --legacy-peer-deps" },
    { name: "npm install", cmd: "npm install" },
    { name: "npm install --force", cmd: "npm install --force" }
  ]

  let lastError = ""
  let lastOutput = ""

  for (const strategy of installStrategies) {
    try {
      emit("thinking", `Trying: ${strategy.name}...`, "Installing dependencies")

      const { stdout, stderr } = await execAsync(strategy.cmd, {
        cwd: repoPath,
        timeout: 300000, // 5 minutes for npm install
        env: {
          ...process.env,
          PATH: process.env.PATH
        }
      })

      const output = stdout + (stderr ? `\n${stderr}` : "")
      emit("thinking", "Dependencies installed successfully", `${strategy.name} completed`)

      return { success: true, output }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "npm install failed"
      const stdout = (error as { stdout?: string }).stdout || ""
      const stderr = (error as { stderr?: string }).stderr || ""
      lastOutput = `${stdout}\n${stderr}\n${errorMessage}`
      lastError = errorMessage

      // Check if we should try the next strategy
      const shouldRetry = lastOutput.includes("ERESOLVE") ||
                          lastOutput.includes("peer dep") ||
                          lastOutput.includes("Could not resolve dependency")

      if (!shouldRetry && strategy !== installStrategies[installStrategies.length - 1]) {
        // If it's not a dependency resolution issue and not the last strategy, try the next one
        emit("thinking", `${strategy.name} failed, trying alternative...`, errorMessage.substring(0, 200))
        continue
      } else if (shouldRetry && strategy !== installStrategies[installStrategies.length - 1]) {
        // Dependency conflict, try next strategy
        emit("thinking", `${strategy.name} had dependency conflicts, trying alternative...`, errorMessage.substring(0, 200))
        continue
      }
    }
  }

  // All strategies failed
  const friendlyError = getUserFriendlyError(lastOutput)
  const errorDetail = friendlyError
    ? `${friendlyError}\n\nTechnical details:\n${lastError.substring(0, 500)}`
    : lastError.substring(0, 500)

  emit("error", "Failed to install dependencies", errorDetail)

  return {
    success: false,
    output: `npm install failed after trying multiple strategies:\n\n${friendlyError || "See technical details below."}\n\nFull output:\n${lastOutput}`
  }
}

/**
 * Run project tests
 *
 * IMPORTANT: If no test script is configured, this returns success.
 * This allows initial project setup to pass quality gates even without tests.
 * Tests only fail if they exist AND fail.
 */
async function runProjectTests(repoPath: string): Promise<{ success: boolean; output: string; skipped?: boolean }> {
  try {
    // Detect project type and run appropriate tests
    const packageJsonPath = path.join(repoPath, "package.json")
    const pubspec = path.join(repoPath, "pubspec.yaml")

    // Check for Node.js project (package.json)
    try {
      await fs.access(packageJsonPath)

      // Read package.json to check if test script exists
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8")
      const packageJson = JSON.parse(packageJsonContent)

      // Check if a test script is defined
      if (!packageJson.scripts?.test) {
        // No test script defined - return success but mark as skipped
        return {
          success: true,
          output: "No test script defined in package.json - tests not validated",
          skipped: true
        }
      }

      // Check if test script is the default npm placeholder that exits with error
      const testScript = packageJson.scripts.test
      if (testScript.includes('echo "Error: no test specified"') ||
          testScript === 'echo "Error: no test specified" && exit 1') {
        // Default npm init placeholder - treat as no tests configured
        return {
          success: true,
          output: "Default npm test placeholder detected - tests not validated",
          skipped: true
        }
      }

      // Test script exists and is not a placeholder - run npm test
      const { stdout, stderr } = await execAsync("npm test", {
        cwd: repoPath,
        timeout: 120000 // 2 minutes for tests
      })

      return { success: true, output: stdout + stderr, skipped: false }

    } catch (accessError) {
      // No package.json - check for Flutter project
      try {
        await fs.access(pubspec)

        // Flutter project - run flutter test
        const { stdout, stderr } = await execAsync("flutter test", {
          cwd: repoPath,
          timeout: 120000 // 2 minutes for tests
        })

        return { success: true, output: stdout + stderr, skipped: false }
      } catch {
        // No package.json or pubspec.yaml - no test framework detected
        return { success: true, output: "No test framework detected - tests not validated", skipped: true }
      }
    }
  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : "Test execution failed",
      skipped: false
    }
  }
}

/**
 * Run TypeScript type checking (tsc --noEmit)
 */
async function runTypeCheck(repoPath: string): Promise<{ success: boolean; output: string; errorCount: number; skipped?: boolean }> {
  try {
    // Check if this is a TypeScript project
    const tsconfigPath = path.join(repoPath, "tsconfig.json")
    try {
      await fs.access(tsconfigPath)
    } catch {
      // No tsconfig.json - not a TypeScript project, skip type checking
      return { success: true, output: "No tsconfig.json found - TypeScript not validated", errorCount: 0, skipped: true }
    }

    // Run tsc --noEmit to check types without generating output
    const { stdout, stderr } = await execAsync("npx tsc --noEmit", {
      cwd: repoPath,
      timeout: 120000 // 2 minutes for type checking
    })

    return { success: true, output: stdout + stderr, errorCount: 0, skipped: false }
  } catch (error) {
    const errorOutput = error instanceof Error ? error.message : "Type check failed"
    const stdout = (error as { stdout?: string }).stdout || ""
    const stderr = (error as { stderr?: string }).stderr || ""
    const fullOutput = `${stdout}\n${stderr}\n${errorOutput}`

    // Check if the error is "No inputs were found in config file" - this means
    // tsconfig.json exists but there are no .ts/.tsx files to check
    if (fullOutput.includes("error TS18003") || fullOutput.includes("No inputs were found in config file")) {
      return {
        success: true,
        output: "No TypeScript files found - skipping type check",
        errorCount: 0,
        skipped: true
      }
    }

    // Count TypeScript errors (lines starting with path:line:col - error TS)
    const errorMatches = fullOutput.match(/error TS\d+/g)
    const errorCount = errorMatches ? errorMatches.length : 1

    return {
      success: false,
      output: fullOutput,
      errorCount,
      skipped: false
    }
  }
}

/**
 * Run build verification (npm run build)
 */
async function runBuildCheck(repoPath: string): Promise<{ success: boolean; output: string; skipped?: boolean }> {
  try {
    // Check if package.json exists and has a build script
    const packageJsonPath = path.join(repoPath, "package.json")
    try {
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8")
      const packageJson = JSON.parse(packageJsonContent)

      if (!packageJson.scripts?.build) {
        return { success: true, output: "No build script defined in package.json - build not validated", skipped: true }
      }
    } catch {
      // Check for other project types
      const pubspecPath = path.join(repoPath, "pubspec.yaml")
      try {
        await fs.access(pubspecPath)
        // Flutter project - use flutter build
        const { stdout, stderr } = await execAsync("flutter build apk --debug", {
          cwd: repoPath,
          timeout: 300000 // 5 minutes for Flutter build
        })
        return { success: true, output: stdout + stderr, skipped: false }
      } catch {
        return { success: true, output: "No package.json or pubspec.yaml found - build not validated", skipped: true }
      }
    }

    // Run npm run build
    const { stdout, stderr } = await execAsync("npm run build", {
      cwd: repoPath,
      timeout: 300000 // 5 minutes for build
    })

    return { success: true, output: stdout + stderr, skipped: false }
  } catch (error) {
    const errorOutput = error instanceof Error ? error.message : "Build failed"
    const stdout = (error as { stdout?: string }).stdout || ""
    const stderr = (error as { stderr?: string }).stderr || ""

    return {
      success: false,
      output: `Build failed:\n${stdout}\n${stderr}\n${errorOutput}`,
      skipped: false
    }
  }
}

/**
 * Quality Gate Results
 */
interface QualityGateResult {
  passed: boolean
  tests: { success: boolean; output: string; skipped?: boolean }
  typeCheck: { success: boolean; output: string; errorCount: number; skipped?: boolean }
  build: { success: boolean; output: string; skipped?: boolean }
  summary: string
  skippedCount: number
  validatedCount: number
}

/**
 * Build error feedback context from quality gate results
 * This provides detailed context to help the LLM fix the errors
 */
async function buildErrorFeedback(
  repoPath: string,
  qualityResult: QualityGateResult
): Promise<ErrorFeedback> {
  const feedback: ErrorFeedback = {}

  // Build TypeScript error feedback with tsconfig and failing file contents
  if (!qualityResult.typeCheck.success && !qualityResult.typeCheck.skipped) {
    feedback.typeErrors = {
      errorOutput: qualityResult.typeCheck.output,
      errorCount: qualityResult.typeCheck.errorCount
    }

    // Read tsconfig.json to include in feedback
    try {
      const tsconfigPath = path.join(repoPath, "tsconfig.json")
      const tsconfigContent = await fs.readFile(tsconfigPath, "utf-8")
      feedback.typeErrors.tsconfigContent = tsconfigContent

      // Also check for tsconfig.app.json which may have stricter settings
      try {
        const tsconfigAppPath = path.join(repoPath, "tsconfig.app.json")
        const tsconfigAppContent = await fs.readFile(tsconfigAppPath, "utf-8")
        feedback.typeErrors.tsconfigContent += `\n\n// tsconfig.app.json (may override above)\n${tsconfigAppContent}`
      } catch {
        // No tsconfig.app.json
      }
    } catch {
      // No tsconfig.json
    }

    // Extract failing file paths from TypeScript error output
    // Format: src/file.ts(10,5): error TS2345: ...
    const filePathRegex = /^([^(\s]+\.tsx?)\(/gm
    const failingFilePaths = new Set<string>()
    let match
    while ((match = filePathRegex.exec(qualityResult.typeCheck.output)) !== null) {
      failingFilePaths.add(match[1])
    }

    // Read content of failing files (up to 3)
    const failingFiles: Array<{ path: string; content: string }> = []
    for (const filePath of Array.from(failingFilePaths).slice(0, 3)) {
      try {
        const fullPath = path.join(repoPath, filePath)
        const content = await fs.readFile(fullPath, "utf-8")
        failingFiles.push({ path: filePath, content })
      } catch {
        // File doesn't exist or can't be read
      }
    }
    feedback.typeErrors.failingFiles = failingFiles
  }

  // Build test error feedback
  if (!qualityResult.tests.success && !qualityResult.tests.skipped) {
    feedback.testErrors = {
      errorOutput: qualityResult.tests.output
    }
  }

  // Build build error feedback
  if (!qualityResult.build.success && !qualityResult.build.skipped) {
    feedback.buildErrors = {
      errorOutput: qualityResult.build.output
    }
  }

  return feedback
}

/**
 * Run all quality gates - MANDATORY for execution completion
 * Tests MUST pass, types MUST check, build MUST succeed
 */
async function runQualityGates(
  repoPath: string,
  emit: (type: ExecutionEvent["type"], message: string, detail?: string, extra?: Partial<ExecutionEvent>) => void
): Promise<QualityGateResult> {
  const results: QualityGateResult = {
    passed: false,
    tests: { success: false, output: "" },
    typeCheck: { success: false, output: "", errorCount: 0 },
    build: { success: false, output: "" },
    summary: "",
    skippedCount: 0,
    validatedCount: 0
  }

  // 1. Run Tests
  emit("test_run", "Quality Gate 1/3: Running tests...", "Tests MUST pass")
  results.tests = await runProjectTests(repoPath)
  if (!results.tests.success) {
    results.summary = `QUALITY GATE FAILED: Tests did not pass.\n\n${results.tests.output}`
    emit("error", "Quality Gate FAILED: Tests", results.tests.output.substring(0, 500))
    return results
  }
  if (results.tests.skipped) {
    results.skippedCount++
    emit("thinking", "Tests skipped (no test framework)", "Proceeding to type check...")
  } else {
    results.validatedCount++
    emit("thinking", "Tests passed", "Proceeding to type check...")
  }

  // 2. Run TypeScript Check
  emit("test_run", "Quality Gate 2/3: Running TypeScript check...", "Types MUST be valid")
  results.typeCheck = await runTypeCheck(repoPath)
  if (!results.typeCheck.success) {
    results.summary = `QUALITY GATE FAILED: TypeScript errors (${results.typeCheck.errorCount} errors).\n\n${results.typeCheck.output}`
    emit("error", "Quality Gate FAILED: TypeScript", `${results.typeCheck.errorCount} type errors found`)
    return results
  }
  if (results.typeCheck.skipped) {
    results.skippedCount++
    emit("thinking", "Type check skipped (no tsconfig)", "Proceeding to build...")
  } else {
    results.validatedCount++
    emit("thinking", "Type check passed", "Proceeding to build...")
  }

  // 3. Run Build
  emit("test_run", "Quality Gate 3/3: Running build...", "Build MUST succeed")
  results.build = await runBuildCheck(repoPath)
  if (!results.build.success) {
    results.summary = `QUALITY GATE FAILED: Build failed.\n\n${results.build.output}`
    emit("error", "Quality Gate FAILED: Build", results.build.output.substring(0, 500))
    return results
  }
  if (results.build.skipped) {
    results.skippedCount++
  } else {
    results.validatedCount++
  }

  // All quality gates passed!
  results.passed = true

  // Build detailed summary based on what was actually validated vs skipped
  const validatedGates: string[] = []
  const skippedGates: string[] = []

  if (results.tests.skipped) skippedGates.push("Tests")
  else validatedGates.push("Tests")

  if (results.typeCheck.skipped) skippedGates.push("TypeScript")
  else validatedGates.push("TypeScript")

  if (results.build.skipped) skippedGates.push("Build")
  else validatedGates.push("Build")

  if (skippedGates.length === 0) {
    results.summary = `All quality gates passed: ${validatedGates.join(", ")} validated`
    emit("thinking", "All quality gates PASSED", "Code is production-ready!")
  } else if (validatedGates.length === 0) {
    results.summary = `Quality gates completed with warnings: All gates skipped (${skippedGates.join(", ")} - no configuration found)`
    emit("thinking", "Quality gates completed", `Warning: All gates skipped - ${skippedGates.join(", ")} not configured`)
  } else {
    results.summary = `Quality gates passed: ${validatedGates.join(", ")} validated | ${skippedGates.join(", ")} skipped (not configured)`
    emit("thinking", "Quality gates PASSED with skips", `Validated: ${validatedGates.join(", ")} | Skipped: ${skippedGates.join(", ")}`)
  }

  return results
}

/**
 * Create a git commit for the changes
 */
async function createGitCommit(repoPath: string, message: string, files: string[]): Promise<void> {
  try {
    // Check if git repo
    await execAsync("git status", { cwd: repoPath })

    // Add files
    for (const file of files) {
      await execAsync(`git add "${file}"`, { cwd: repoPath }).catch(() => {})
    }

    // Commit
    const commitMsg = `${message}\n\nGenerated by Claudia Coder (Local Mode)`
    await execAsync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: repoPath })
  } catch {
    // Git operations failed, continue without commit
  }
}

/**
 * Build prompt for Claude Code execution
 */
function buildClaudePrompt(packet: ExecutionRequest["packet"]): string {
  const taskList = packet.tasks.map((t, i) => `${i + 1}. ${t.description}`).join("\n")
  const criteria = packet.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")

  return `# Task: ${packet.title}

## Description
${packet.description}

## Tasks to Complete
${taskList}

## Acceptance Criteria
${criteria}

## QUALITY STANDARDS (Non-Negotiable)

You are Claudia Coder - you build PRODUCTION-QUALITY software. Every deliverable must meet these standards:

### Code Quality
- Clean, readable, self-documenting code
- Proper error handling and edge cases
- No hardcoded values - use constants and configuration
- DRY principles - extract common patterns
- TypeScript strict mode compatible (if applicable)

### UI/UX Excellence
- Modern, polished visual design
- Smooth animations and transitions
- Responsive across all screen sizes
- Accessible (WCAG 2.1 AA minimum)
- Intuitive user interactions

### Architecture
- Clear separation of concerns
- Modular, reusable components
- Proper file organization
- Scalable patterns that grow with the app

### Testing & Reliability
- Comprehensive test coverage
- Handle loading, error, and empty states
- Graceful degradation when things fail
- Performance optimized

### Documentation
- Clear README with setup instructions
- Inline comments for complex logic only
- Type definitions that serve as documentation

## Instructions
1. Read existing code to understand patterns
2. Implement with the quality standards above
3. Write tests to verify the implementation
4. Iterate until the code is polished, not just working
5. The goal is EXCELLENCE, not just completion

Work autonomously. Do not stop until the deliverable is production-ready.
If something feels hacky, refactor it. If the UI feels rough, polish it.
You represent Claudia Coder - make her proud.`
}

/**
 * Execute on remote VM via SSH
 */
async function executeRemotely(
  prompt: string,
  repoPath: string,
  options: ExecutionRequest["options"]
): Promise<{ success: boolean; output: string; filesChanged: string[] }> {
  // Escape prompt for shell - handle single quotes and special characters
  const escapedPrompt = escapeForShell(prompt)

  // Build Claude Code command with print mode for non-interactive execution
  const maxTurns = options?.maxIterations || 10
  const selectedModel = options?.selectedModel

  // Build the Claude CLI command with optional model flag
  let claudeCmd = `claude --print --dangerously-skip-permissions --max-turns ${maxTurns}`
  if (selectedModel) {
    claudeCmd += ` --model ${selectedModel}`
  }

  // SSH command to run on remote
  // Use heredoc style to avoid shell escaping issues with complex prompts
  // IMPORTANT: We explicitly unset ANTHROPIC_API_KEY on the remote so the CLI uses Max subscription
  const sshCmd = `ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${SSH_USER}@${SSH_HOST} "cd ${repoPath} && unset ANTHROPIC_API_KEY && echo '${escapedPrompt}' | ${claudeCmd}"`

  console.log("[executeRemotely] Starting SSH execution to", SSH_HOST)
  console.log("[executeRemotely] Repo path:", repoPath)
  console.log("[executeRemotely] Max turns:", maxTurns)
  console.log("[executeRemotely] Selected model:", selectedModel || "default")

  // Build environment for SSH command
  // Remove ANTHROPIC_API_KEY from local env as well (though the remote unset is more important)
  const sshEnv: NodeJS.ProcessEnv = {
    ...process.env,
    // Ensure SSH key path is expanded
    HOME: process.env.HOME,
    // UNSET API key so CLI uses Max subscription, not API credits
    ANTHROPIC_API_KEY: undefined
  }

  try {
    const { stdout, stderr } = await execAsync(sshCmd, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large outputs
      timeout: EXECUTION_TIMEOUT_MS,
      env: sshEnv
    })

    // Combine stdout and stderr for complete output
    const fullOutput = stdout + (stderr ? `\n[stderr]: ${stderr}` : "")

    // Parse files changed from Claude Code output
    const filesChanged = parseFilesChanged(fullOutput)

    console.log("[executeRemotely] Execution completed successfully")
    console.log("[executeRemotely] Files changed:", filesChanged.length)

    return {
      success: true,
      output: fullOutput,
      filesChanged
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "SSH execution failed"
    const errorOutput = (error as { stdout?: string; stderr?: string }).stdout || ""
    const errorStderr = (error as { stderr?: string }).stderr || ""

    console.error("[executeRemotely] Execution failed:", errorMessage)

    // Check for specific error types
    if (errorMessage.includes("ETIMEDOUT") || errorMessage.includes("timeout")) {
      return {
        success: false,
        output: `Execution timed out after ${EXECUTION_TIMEOUT_MS / 60000} minutes.\n\nPartial output:\n${errorOutput}\n${errorStderr}`,
        filesChanged: parseFilesChanged(errorOutput)
      }
    }

    if (errorMessage.includes("Permission denied") || errorMessage.includes("publickey")) {
      return {
        success: false,
        output: `SSH authentication failed. Check that the SSH key at ${SSH_KEY_PATH} is valid and has access to ${SSH_USER}@${SSH_HOST}`,
        filesChanged: []
      }
    }

    if (errorMessage.includes("Connection refused") || errorMessage.includes("No route to host")) {
      return {
        success: false,
        output: `Cannot connect to remote host ${SSH_HOST}. Ensure the VM is running and accessible.`,
        filesChanged: []
      }
    }

    return {
      success: false,
      output: `Execution failed: ${errorMessage}\n\nOutput:\n${errorOutput}\n${errorStderr}`,
      filesChanged: parseFilesChanged(errorOutput)
    }
  }
}

/**
 * Execute locally (when Claude Code is installed on this machine)
 * Uses --output-format stream-json for real-time streaming output
 */
async function executeLocally(
  prompt: string,
  repoPath: string,
  options: ExecutionRequest["options"]
): Promise<{ success: boolean; output: string; filesChanged: string[] }> {
  const maxTurns = options?.maxIterations || 10
  const selectedModel = options?.selectedModel

  console.log("[executeLocally] Starting local execution")
  console.log("[executeLocally] Repo path:", repoPath)
  console.log("[executeLocally] Max turns:", maxTurns)
  console.log("[executeLocally] Selected model:", selectedModel || "default")

  return new Promise((resolve) => {
    // Use --print with --output-format stream-json for real-time updates
    // This outputs JSON objects as they happen, enabling better progress tracking
    // Note: --verbose is required when using --print with --output-format stream-json
    const args = [
      "--print",
      "--verbose",
      "--dangerously-skip-permissions",
      "--max-turns", String(maxTurns),
      "--output-format", "stream-json"
    ]

    // Add model flag if a specific model is selected (e.g., claude-sonnet-4-20250514, claude-opus-4-20250514)
    if (selectedModel) {
      args.push("--model", selectedModel)
    }

    console.log("[executeLocally] Spawning: claude", args.join(" "))

    // Build environment for Claude CLI
    // IMPORTANT: We explicitly UNSET ANTHROPIC_API_KEY so the CLI uses the Max subscription
    // instead of consuming API credits. The user has a Max subscription configured in the CLI.
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      // Ensure Claude can find necessary tools
      PATH: process.env.PATH,
      // Force color output for better readability
      FORCE_COLOR: "1",
      // Ensure proper encoding
      LANG: "en_US.UTF-8",
      LC_ALL: "en_US.UTF-8",
      // UNSET API key so CLI uses Max subscription, not API credits
      ANTHROPIC_API_KEY: undefined
    }

    const child = spawn("claude", args, {
      cwd: repoPath,
      env: childEnv,
      stdio: ["pipe", "pipe", "pipe"]
    })

    let stdout = ""
    let stderr = ""
    const filesChanged: string[] = []
    let lastProgressMessage = ""

    // Write the prompt to stdin
    child.stdin.write(prompt)
    child.stdin.end()

    // Process stdout - parse stream-json output
    child.stdout.on("data", (data: Buffer) => {
      const chunk = data.toString()
      stdout += chunk

      // Parse streaming JSON output line by line
      const lines = chunk.split("\n").filter(line => line.trim())
      for (const line of lines) {
        try {
          const jsonLine = JSON.parse(line)

          // Handle different message types from Claude Code stream-json format
          if (jsonLine.type === "assistant" && jsonLine.message?.content) {
            // Assistant is thinking/responding
            const content = Array.isArray(jsonLine.message.content)
              ? jsonLine.message.content.map((c: { text?: string }) => c.text || "").join("")
              : jsonLine.message.content
            if (content) {
              lastProgressMessage = content.substring(0, 200)
              console.log("[executeLocally] Assistant:", lastProgressMessage)
            }
          } else if (jsonLine.type === "content_block_delta" && jsonLine.delta?.text) {
            // Streaming text delta
            lastProgressMessage = jsonLine.delta.text.substring(0, 200)
          } else if (jsonLine.type === "tool_use" || jsonLine.type === "tool_result") {
            // Tool usage - extract file operations
            const toolName = jsonLine.name || jsonLine.tool_name
            const toolInput = jsonLine.input || jsonLine.tool_input || {}

            console.log("[executeLocally] Tool:", toolName, toolInput.file_path || toolInput.path || "")

            // Track file changes from tool usage
            if (toolName === "Write" || toolName === "Edit") {
              const filePath = toolInput.file_path || toolInput.path
              if (filePath && !filesChanged.includes(filePath)) {
                filesChanged.push(filePath)
                console.log("[executeLocally] File changed:", filePath)
              }
            }
          } else if (jsonLine.type === "result") {
            // Final result
            console.log("[executeLocally] Result received")
          } else if (jsonLine.type === "system" || jsonLine.type === "error") {
            // System message or error
            console.log("[executeLocally] System/Error:", jsonLine.message || jsonLine.error || JSON.stringify(jsonLine))
          }
        } catch {
          // Not JSON or partial JSON - could be plain text output
          // Log progress if it looks like a status update
          if (chunk.includes("Thinking") || chunk.includes("Editing") || chunk.includes("Creating") ||
              chunk.includes("Reading") || chunk.includes("Writing") || chunk.includes("Searching")) {
            console.log("[executeLocally] Progress:", chunk.substring(0, 100))
          }
        }
      }
    })

    // Collect stderr
    child.stderr.on("data", (data: Buffer) => {
      const chunk = data.toString()
      stderr += chunk
      // Log stderr for debugging
      if (chunk.trim()) {
        console.log("[executeLocally] stderr:", chunk.substring(0, 200))
      }
    })

    // Handle timeout
    const timeoutId = setTimeout(() => {
      console.error("[executeLocally] Execution timed out, killing process")
      child.kill("SIGTERM")
      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL")
        }
      }, 5000)
    }, EXECUTION_TIMEOUT_MS)

    // Handle completion
    child.on("close", (code) => {
      clearTimeout(timeoutId)

      // Also parse the full output for any files we might have missed
      const additionalFiles = parseFilesChanged(stdout)
      for (const file of additionalFiles) {
        if (!filesChanged.includes(file)) {
          filesChanged.push(file)
        }
      }

      // Build human-readable output from the stream-json data
      let humanOutput = ""
      try {
        // Try to extract text content from stream-json for human-readable output
        const lines = stdout.split("\n").filter(line => line.trim())
        const textParts: string[] = []

        for (const line of lines) {
          try {
            const json = JSON.parse(line)
            if (json.type === "assistant" && json.message?.content) {
              const content = Array.isArray(json.message.content)
                ? json.message.content.map((c: { type?: string; text?: string }) => c.type === "text" ? c.text : "").join("")
                : json.message.content
              if (content) textParts.push(content)
            } else if (json.type === "content_block_delta" && json.delta?.text) {
              textParts.push(json.delta.text)
            } else if (json.type === "result" && json.result) {
              textParts.push(`\n=== Result ===\n${JSON.stringify(json.result, null, 2)}`)
            }
          } catch {
            // Not JSON, include as-is if non-empty
            if (line.trim() && !line.startsWith("{")) {
              textParts.push(line)
            }
          }
        }

        humanOutput = textParts.join("") || stdout
      } catch {
        humanOutput = stdout
      }

      const fullOutput = humanOutput + (stderr ? `\n[stderr]: ${stderr}` : "")

      console.log("[executeLocally] Process exited with code:", code)
      console.log("[executeLocally] Files changed:", filesChanged.length)

      if (code === 0) {
        resolve({
          success: true,
          output: fullOutput,
          filesChanged
        })
      } else {
        resolve({
          success: false,
          output: `Claude Code exited with code ${code}\n\n${fullOutput}`,
          filesChanged
        })
      }
    })

    // Handle spawn errors
    child.on("error", (error) => {
      clearTimeout(timeoutId)
      console.error("[executeLocally] Spawn error:", error.message)

      if (error.message.includes("ENOENT")) {
        resolve({
          success: false,
          output: "Claude Code CLI not found. Ensure 'claude' is installed and in PATH.",
          filesChanged: []
        })
      } else {
        resolve({
          success: false,
          output: `Failed to start Claude Code: ${error.message}`,
          filesChanged: []
        })
      }
    })
  })
}

/**
 * Escape a string for safe use in shell commands (single-quoted context)
 */
function escapeForShell(str: string): string {
  // For single-quoted strings, we need to:
  // 1. Replace single quotes with: '\'' (end quote, escaped quote, start quote)
  // 2. Handle other special characters
  return str
    .replace(/'/g, "'\\''")
    .replace(/\\/g, "\\\\")
    .replace(/\$/g, "\\$")
    .replace(/`/g, "\\`")
    .replace(/!/g, "\\!")
}

/**
 * Parse Claude Code output to extract list of files changed
 * Claude Code typically outputs file operations like:
 * - "Created file: /path/to/file"
 * - "Modified: /path/to/file"
 * - "Editing /path/to/file"
 * - Also look for git status indicators
 */
function parseFilesChanged(output: string): string[] {
  const filesSet = new Set<string>()

  // Pattern 1: "Created file: /path" or "Created: /path"
  const createdPattern = /(?:Created|Creating)\s+(?:file:?\s*)?([\/\w\-_.]+\.\w+)/gi
  let match
  while ((match = createdPattern.exec(output)) !== null) {
    if (match[1] && !match[1].includes("...")) {
      filesSet.add(match[1])
    }
  }

  // Pattern 2: "Modified: /path" or "Edited: /path"
  const modifiedPattern = /(?:Modified|Edited|Editing|Updated|Updating)\s*:?\s*([\/\w\-_.]+\.\w+)/gi
  while ((match = modifiedPattern.exec(output)) !== null) {
    if (match[1] && !match[1].includes("...")) {
      filesSet.add(match[1])
    }
  }

  // Pattern 3: Look for file paths in Write/Edit tool usage
  const toolPattern = /(?:Write|Edit)\s+tool.*?(?:file_path|path)\s*[=:]\s*["']?([\/\w\-_.]+\.\w+)["']?/gi
  while ((match = toolPattern.exec(output)) !== null) {
    if (match[1]) {
      filesSet.add(match[1])
    }
  }

  // Pattern 4: Git diff output (shows changed files)
  const gitDiffPattern = /^(?:\+\+\+|---)\s+[ab]?\/(.+)$/gm
  while ((match = gitDiffPattern.exec(output)) !== null) {
    if (match[1] && match[1] !== "/dev/null") {
      filesSet.add(match[1])
    }
  }

  // Pattern 5: Lines starting with file path indicators
  const filePathPattern = /^\s*(?:[\+\-M\?]|\s{2})\s+(src\/[\w\-_./]+\.\w+)/gm
  while ((match = filePathPattern.exec(output)) !== null) {
    if (match[1]) {
      filesSet.add(match[1])
    }
  }

  return Array.from(filesSet).sort()
}

/**
 * Check if Claude CLI is available locally
 */
async function checkLocalClaudeAvailable(): Promise<boolean> {
  try {
    await execAsync("which claude", { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

/**
 * Check if remote host is reachable via SSH
 * Returns false if CLAUDE_CODE_HOST is not configured
 */
async function checkRemoteAvailable(): Promise<boolean> {
  // If remote host is not configured, return false immediately
  if (!isRemoteConfigured()) {
    return false
  }

  try {
    await execAsync(
      `ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=no -o ConnectTimeout=5 -o BatchMode=yes ${SSH_USER}@${SSH_HOST} "echo ok"`,
      { timeout: 10000 }
    )
    return true
  } catch {
    return false
  }
}

/**
 * GET endpoint - check execution capability
 * Reports Local Mode (LM Studio), Turbo Mode (Claude Code), and N8N Mode
 */
export async function GET() {
  // Check all backends in parallel
  const [claudeLocalAvailable, claudeRemoteAvailable, lmStudioServer, n8nAvailable] = await Promise.all([
    checkLocalClaudeAvailable(),
    checkRemoteAvailable(),
    getAvailableServer(),
    checkN8NAvailable()
  ])

  const lmStudioAvailable = lmStudioServer !== null

  // Determine recommended mode priority: local > n8n > turbo
  // LOCAL mode is preferred (free, no API costs)
  // Claude Code (turbo) should only be used if explicitly configured
  let recommendedMode: ExecutionMode | "none" = "none"
  if (lmStudioAvailable) {
    recommendedMode = "local"
  } else if (n8nAvailable) {
    recommendedMode = "n8n"
  } else if (claudeLocalAvailable || claudeRemoteAvailable) {
    recommendedMode = "turbo"
  }

  return NextResponse.json({
    // Overall availability
    available: n8nAvailable || lmStudioAvailable || claudeLocalAvailable || claudeRemoteAvailable,

    // N8N Mode - Workflow orchestration with quality loops
    n8nMode: {
      available: n8nAvailable,
      webhookUrl: N8N_WEBHOOK_URL,
      callbackUrl: CLAUDIA_CALLBACK_URL,
      description: "Workflow orchestration with quality validation loops"
    },

    // Local Mode (LM Studio) - FREE, works offline
    localMode: {
      available: lmStudioAvailable,
      server: lmStudioServer?.name || null,
      model: lmStudioServer?.currentModel || null,
      description: "Free, works offline - no internet required"
    },

    // Turbo Mode (Claude Code) - PAID, higher quality
    turboMode: {
      available: claudeLocalAvailable || claudeRemoteAvailable,
      local: claudeLocalAvailable,
      remote: claudeRemoteAvailable,
      remoteHost: SSH_HOST,
      description: "Premium, cloud-powered - requires API subscription"
    },

    // Recommended mode
    recommendedMode,

    // Legacy fields for backward compatibility
    remote: {
      host: SSH_HOST,
      user: SSH_USER,
      available: claudeRemoteAvailable
    },
    local: {
      available: claudeLocalAvailable,
    },
    modes: [
      ...(n8nAvailable ? ["n8n"] : []),
      ...(lmStudioAvailable ? ["local"] : []),
      ...(claudeLocalAvailable || claudeRemoteAvailable ? ["turbo"] : [])
    ]
  })
}
