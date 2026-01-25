/**
 * VS Code (code-server) Session API
 *
 * POST - Start a new VS Code instance
 * GET - List running instances OR check instance health
 * DELETE - Stop an instance
 */

import { NextRequest, NextResponse } from "next/server"
import { spawn, ChildProcess } from "child_process"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import path from "path"
import os from "os"
import {
  VSCodeSessionOptions,
  VSCodeSessionResponse,
  StoredIframeSession,
} from "@/lib/dev-tools/types"
import { findBinaryPath, checkToolInstalled } from "@/lib/dev-tools/tool-registry"
import {
  allocatePort,
  releasePort,
  getAllAllocations,
  cleanupStaleAllocations,
} from "@/lib/dev-tools/port-manager"

// Import sandbox security
import {
  validateProjectPath,
  isPathProtected,
  logSecurityEvent,
  getUserSandboxDir,
  ensureUserSandbox,
} from "@/lib/security/sandbox"

// Force dynamic rendering
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Session storage file path
const SESSIONS_FILE = path.join(process.cwd(), ".local-storage", "vscode-sessions.json")

// Active VS Code instances
interface VSCodeInstance {
  id: string
  projectId: string
  workingDirectory: string
  port: number
  pid: number
  process: ChildProcess
  startedAt: Date
  status: "starting" | "running" | "stopped" | "error"
  url: string
  userId?: string
}

const instances = new Map<string, VSCodeInstance>()

// Paths to check for code-server binary
const CODE_SERVER_PATHS = [
  path.join(os.homedir(), ".local/bin/code-server"),
  "/usr/local/bin/code-server",
  "/usr/bin/code-server",
  "code-server",
]

/**
 * Load stored sessions from JSON file
 */
function loadStoredSessions(): StoredIframeSession[] {
  try {
    if (existsSync(SESSIONS_FILE)) {
      const data = readFileSync(SESSIONS_FILE, "utf-8")
      return JSON.parse(data)
    }
  } catch (error) {
    console.error("[vscode] Error loading stored sessions:", error)
  }
  return []
}

/**
 * Save sessions to JSON file
 */
function saveStoredSessions(storedSessions: StoredIframeSession[]): void {
  try {
    const dir = path.dirname(SESSIONS_FILE)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(SESSIONS_FILE, JSON.stringify(storedSessions, null, 2))
  } catch (error) {
    console.error("[vscode] Error saving sessions:", error)
  }
}

/**
 * Add or update a session in storage
 */
function updateStoredSession(instance: VSCodeInstance): void {
  const stored = loadStoredSessions()
  const index = stored.findIndex(s => s.id === instance.id)

  const storedSession: StoredIframeSession = {
    id: instance.id,
    toolId: "vscode",
    projectId: instance.projectId,
    workingDirectory: instance.workingDirectory,
    startedAt: instance.startedAt.toISOString(),
    status: instance.status,
    port: instance.port,
    pid: instance.pid,
    url: instance.url,
    lastActivity: new Date().toISOString(),
    userId: instance.userId,
  }

  if (index >= 0) {
    stored[index] = storedSession
  } else {
    stored.push(storedSession)
  }

  saveStoredSessions(stored)
}

/**
 * Remove a session from storage
 */
function removeStoredSession(instanceId: string): void {
  const stored = loadStoredSessions()
  const filtered = stored.filter(s => s.id !== instanceId)
  saveStoredSessions(filtered)
}

/**
 * Find the code-server executable
 */
function findCodeServerPath(): string | null {
  for (const cspath of CODE_SERVER_PATHS) {
    if (cspath !== "code-server" && existsSync(cspath)) {
      console.log(`[vscode] Found code-server at: ${cspath}`)
      return cspath
    }
  }
  return findBinaryPath("vscode") || "code-server"
}

/**
 * Check if code-server is ready by making HTTP request
 */
async function waitForCodeServer(port: number, maxRetries: number = 60): Promise<boolean> {
  console.log(`[vscode] Waiting for code-server on port ${port}...`)
  for (let i = 0; i < maxRetries; i++) {
    try {
      // First try the healthz endpoint
      const response = await fetch(`http://localhost:${port}/healthz`, {
        signal: AbortSignal.timeout(2000),
      })
      if (response.ok) {
        console.log(`[vscode] code-server is ready (healthz responded)`)
        return true
      }
    } catch {
      // Try the root endpoint as fallback
      try {
        const response = await fetch(`http://localhost:${port}/`, {
          signal: AbortSignal.timeout(2000),
        })
        if (response.ok || response.status === 302) {
          console.log(`[vscode] code-server is ready (root responded)`)
          return true
        }
      } catch {
        // Not ready yet
      }
    }
    if (i % 10 === 0) {
      console.log(`[vscode] Waiting... attempt ${i + 1}/${maxRetries}`)
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  return false
}

/**
 * Stop an instance
 */
function stopInstance(instanceId: string, removeFromStorage: boolean = false): void {
  const instance = instances.get(instanceId)
  if (!instance) return

  console.log(`[vscode] Stopping instance ${instanceId} (PID: ${instance.pid})`)

  try {
    instance.process.kill("SIGTERM")
    // Force kill after 5 seconds if still running
    setTimeout(() => {
      try {
        instance.process.kill("SIGKILL")
      } catch {
        // Already dead
      }
    }, 5000)
  } catch (e) {
    console.error(`[vscode][${instanceId}] Error killing process:`, e)
  }

  releasePort(instance.port)

  if (removeFromStorage) {
    removeStoredSession(instanceId)
  }

  instances.delete(instanceId)
}

// Cleanup stale allocations and instances periodically
setInterval(async () => {
  await cleanupStaleAllocations()

  // Check for dead instances
  for (const [id, instance] of instances.entries()) {
    if (instance.process.killed || instance.process.exitCode !== null) {
      console.log(`[vscode] Cleaning up dead instance: ${id}`)
      releasePort(instance.port)
      removeStoredSession(id)
      instances.delete(id)
    }
  }
}, 60000)

/**
 * POST - Start a new VS Code instance
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VSCodeSessionOptions & {
      userId?: string
      userRole?: string
    }

    const { projectId, workingDirectory, userId, userRole } = body

    console.log("[vscode] POST request received:", {
      projectId,
      workingDirectory,
    })

    if (!projectId || !workingDirectory) {
      return NextResponse.json(
        { error: "projectId and workingDirectory are required" },
        { status: 400 }
      )
    }

    // Check if code-server is installed
    const toolStatus = await checkToolInstalled("vscode")
    if (toolStatus.status !== "installed") {
      return NextResponse.json(
        {
          error: "VS Code (code-server) is not installed",
          installInstructions: "curl -fsSL https://code-server.dev/install.sh | sh",
        },
        { status: 400 }
      )
    }

    // Sandbox security validation
    // Check for admin status - allow if role is admin/owner, or if no role specified (development mode)
    const isAdmin = userRole === "admin" || userRole === "owner" || !userRole
    const isBetaTester = userRole === "beta" || userRole === "beta_tester"
    // Only sandbox beta testers - if role is not specified, assume development/admin mode
    const isSandboxed = isBetaTester

    console.log(`[vscode] User auth: userId=${userId}, userRole=${userRole || "(none - admin mode)"}, isAdmin=${isAdmin}, isSandboxed=${isSandboxed}`)

    if (isSandboxed && userId) {
      console.log(`[vscode] Sandbox mode enabled for user ${userId}`)

      // For sandboxed users, validate path is in their sandbox
      // But allow developer paths if they're accessing Claudia source (shouldn't happen for sandboxed users)
      const pathValidation = validateProjectPath(workingDirectory, userId, {
        requireInSandbox: true,
        allowProtectedPaths: false,
        allowDeveloperPaths: false, // Sandboxed users can't access dev paths
      })

      if (!pathValidation.valid) {
        logSecurityEvent({
          userId,
          eventType: "sandbox_violation",
          details: `Attempted to start VS Code in protected path: ${workingDirectory}`,
          inputPath: workingDirectory,
        })

        return NextResponse.json(
          {
            error: "Access denied: Working directory is outside your sandbox",
            details: pathValidation.error,
            sandboxDir: getUserSandboxDir(userId),
          },
          { status: 403 }
        )
      }

      ensureUserSandbox(userId)
    } else if (isAdmin) {
      console.log(`[vscode] Admin mode - skipping sandbox check for user ${userId}`)
    }

    // Check protected paths (admins can access developer paths like Claudia source)
    if (isPathProtected(workingDirectory, { allowDeveloperPaths: isAdmin })) {
      return NextResponse.json(
        { error: "Access denied: This path is protected" },
        { status: 403 }
      )
    }

    if (!existsSync(workingDirectory)) {
      return NextResponse.json(
        { error: `Working directory does not exist: ${workingDirectory}` },
        { status: 400 }
      )
    }

    // Check if there's already an instance for this project
    for (const [existingId, existingInstance] of instances.entries()) {
      if (existingInstance.projectId === projectId && existingInstance.status === "running") {
        return NextResponse.json({
          success: true,
          instanceId: existingId,
          port: existingInstance.port,
          url: existingInstance.url,
          pid: existingInstance.pid,
          message: "Reconnected to existing VS Code instance",
        } as VSCodeSessionResponse)
      }
    }

    const instanceId = `vscode-${Date.now()}-${Math.random().toString(36).slice(2)}`

    // Allocate a port
    const port = await allocatePort(instanceId, projectId, workingDirectory)
    if (!port) {
      return NextResponse.json(
        { error: "No available ports for VS Code instance" },
        { status: 503 }
      )
    }

    const codeServerPath = findCodeServerPath()
    if (!codeServerPath) {
      releasePort(port)
      return NextResponse.json(
        { error: "code-server binary not found" },
        { status: 500 }
      )
    }

    console.log(`[vscode] Starting code-server on port ${port}`)
    console.log(`[vscode] Binary: ${codeServerPath}`)
    console.log(`[vscode] Working directory: ${workingDirectory}`)

    // Start code-server
    // Bind to 0.0.0.0 to allow remote access (when accessing Claudia from another machine)
    // Get the proxy domain from request headers or use default
    const host = request.headers.get("host") || "localhost:8443"
    const proxyDomain = host.split(":")[0] // Extract hostname without port

    const args = [
      "--port",
      port.toString(),
      "--host",
      "0.0.0.0",
      "--auth",
      "none", // No authentication (rely on Claudia's auth)
      "--disable-telemetry",
      "--proxy-domain",
      proxyDomain, // Tell code-server about the proxy
      "--abs-proxy-base-path",
      `/vscode/${port}`, // Base path for nginx proxy
      "--trusted-origins",
      "*", // Trust all origins (we rely on nginx/Claudia auth)
      workingDirectory,
    ]

    const childProcess = spawn(codeServerPath, args, {
      cwd: workingDirectory,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        HOME: process.env.HOME || os.homedir(),
      },
    })

    // Don't let parent exit affect child
    childProcess.unref()

    const url = `http://localhost:${port}/?folder=${encodeURIComponent(workingDirectory)}`

    const instance: VSCodeInstance = {
      id: instanceId,
      projectId,
      workingDirectory,
      port,
      pid: childProcess.pid!,
      process: childProcess,
      startedAt: new Date(),
      status: "starting",
      url,
      userId,
    }

    instances.set(instanceId, instance)
    updateStoredSession(instance)

    // Handle process output
    childProcess.stdout?.on("data", (data) => {
      console.log(`[vscode][${instanceId}] stdout: ${data}`)
    })

    childProcess.stderr?.on("data", (data) => {
      console.error(`[vscode][${instanceId}] stderr: ${data}`)
    })

    // Handle process exit
    childProcess.on("exit", (code, signal) => {
      console.log(`[vscode][${instanceId}] Process exited with code ${code}, signal ${signal}`)
      instance.status = "stopped"
      releasePort(port)
      removeStoredSession(instanceId)
      instances.delete(instanceId)
    })

    childProcess.on("error", (err) => {
      console.error(`[vscode][${instanceId}] Process error:`, err)
      instance.status = "error"
      releasePort(port)
    })

    // Wait for code-server to be ready
    console.log(`[vscode][${instanceId}] Waiting for code-server to start...`)
    const ready = await waitForCodeServer(port)

    if (ready) {
      instance.status = "running"
      updateStoredSession(instance)
      console.log(`[vscode][${instanceId}] code-server is ready at ${url}`)

      return NextResponse.json({
        success: true,
        instanceId,
        port,
        url,
        pid: childProcess.pid!,
        message: "VS Code instance started",
      } as VSCodeSessionResponse)
    } else {
      // Server didn't start properly
      console.error(`[vscode][${instanceId}] code-server failed to start`)
      stopInstance(instanceId, true)

      return NextResponse.json(
        { error: "VS Code failed to start within timeout" },
        { status: 500 }
      )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start VS Code"
    console.error("[vscode] Error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET - List running instances OR check health
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const instanceId = searchParams.get("instanceId")
  const projectId = searchParams.get("projectId")
  const healthCheck = searchParams.get("health")

  // Health check for specific instance
  if (instanceId && healthCheck === "true") {
    const instance = instances.get(instanceId)
    if (!instance) {
      return NextResponse.json({ healthy: false, error: "Instance not found" }, { status: 404 })
    }

    try {
      const response = await fetch(`http://localhost:${instance.port}/healthz`, {
        signal: AbortSignal.timeout(2000),
      })
      return NextResponse.json({
        healthy: response.ok,
        status: instance.status,
        url: instance.url,
      })
    } catch {
      return NextResponse.json({
        healthy: false,
        status: instance.status,
        error: "Health check failed",
      })
    }
  }

  // List instances
  const storedSessions = loadStoredSessions()
  const allAllocations = getAllAllocations()

  // Enrich with live status
  let sessionsList: (StoredIframeSession & { isActive: boolean })[] = storedSessions.map(stored => {
    const liveInstance = instances.get(stored.id)
    return {
      ...stored,
      isActive: !!liveInstance,
      status: liveInstance?.status || stored.status,
    }
  })

  // Filter by projectId if specified
  if (projectId) {
    sessionsList = sessionsList.filter(s => s.projectId === projectId)
  }

  return NextResponse.json({
    instances: sessionsList,
    activeCount: sessionsList.filter(s => s.isActive).length,
    allocatedPorts: allAllocations.length,
  })
}

/**
 * DELETE - Stop an instance
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const instanceId = searchParams.get("instanceId")
    const removeFromStorage = searchParams.get("removeFromStorage") === "true"

    if (!instanceId) {
      return NextResponse.json({ error: "instanceId is required" }, { status: 400 })
    }

    const instance = instances.get(instanceId)
    if (!instance) {
      // Check if it's in storage
      const stored = loadStoredSessions().find(s => s.id === instanceId)
      if (stored && removeFromStorage) {
        removeStoredSession(instanceId)
        releasePort(stored.port)
        return NextResponse.json({ success: true, message: "Instance removed from storage" })
      }
      return NextResponse.json({ error: "Instance not found" }, { status: 404 })
    }

    stopInstance(instanceId, removeFromStorage)
    return NextResponse.json({ success: true, message: "VS Code instance stopped" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to stop instance"
    console.error("[vscode] Error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
