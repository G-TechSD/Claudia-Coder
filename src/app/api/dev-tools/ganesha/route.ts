/**
 * Ganesha AI Session API
 *
 * POST - Start a new Ganesha session
 * GET - Stream output from a session via SSE OR list sessions
 * PUT - Send input to a running session
 * DELETE - Stop a session
 */

import { NextRequest, NextResponse } from "next/server"
import { spawn, IPty } from "node-pty"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { EventEmitter } from "events"
import path from "path"
import os from "os"
import {
  GaneshaSessionOptions,
  GaneshaSessionResponse,
  StoredTerminalSession,
  GaneshaMode,
} from "@/lib/dev-tools/types"
import { findBinaryPath, checkToolInstalled } from "@/lib/dev-tools/tool-registry"

// Import sandbox security module
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
const SESSIONS_FILE = path.join(process.cwd(), ".local-storage", "ganesha-sessions.json")

// Active session with PTY (in-memory only)
interface GaneshaSession {
  id: string
  pty: IPty
  projectId: string
  workingDirectory: string
  mode: GaneshaMode
  startedAt: Date
  status: "starting" | "running" | "stopped" | "error" | "background"
  emitter: EventEmitter
  outputBuffer: string[]
  isBackground: boolean
  ganeshaSessionId?: string
  userId?: string
  isSandboxed?: boolean
}

const sessions = new Map<string, GaneshaSession>()

// Paths to check for ganesha binary
const GANESHA_PATHS = [
  path.join(os.homedir(), ".local/bin/ganesha"),
  "/usr/local/bin/ganesha",
  "/usr/bin/ganesha",
  "ganesha",
]

/**
 * Load stored sessions from JSON file
 */
function loadStoredSessions(): StoredTerminalSession[] {
  try {
    if (existsSync(SESSIONS_FILE)) {
      const data = readFileSync(SESSIONS_FILE, "utf-8")
      return JSON.parse(data)
    }
  } catch (error) {
    console.error("[ganesha] Error loading stored sessions:", error)
  }
  return []
}

/**
 * Save sessions to JSON file
 */
function saveStoredSessions(storedSessions: StoredTerminalSession[]): void {
  try {
    const dir = path.dirname(SESSIONS_FILE)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(SESSIONS_FILE, JSON.stringify(storedSessions, null, 2))
  } catch (error) {
    console.error("[ganesha] Error saving sessions:", error)
  }
}

/**
 * Add or update a session in storage
 */
function updateStoredSession(session: GaneshaSession): void {
  const stored = loadStoredSessions()
  const index = stored.findIndex(s => s.id === session.id)

  const storedSession: StoredTerminalSession = {
    id: session.id,
    toolId: "ganesha",
    projectId: session.projectId,
    workingDirectory: session.workingDirectory,
    startedAt: session.startedAt.toISOString(),
    status: session.status,
    isBackground: session.isBackground,
    ganeshaSessionId: session.ganeshaSessionId,
    mode: session.mode,
    lastActivity: new Date().toISOString(),
    userId: session.userId,
    isSandboxed: session.isSandboxed,
  }

  if (index >= 0) {
    stored[index] = storedSession
  } else {
    stored.push(storedSession)
  }

  saveStoredSessions(stored)
}

/**
 * Update just the status of a stored session
 */
function updateStoredSessionStatus(
  sessionId: string,
  status: StoredTerminalSession["status"],
  ganeshaSessionId?: string
): void {
  const stored = loadStoredSessions()
  const session = stored.find(s => s.id === sessionId)

  if (session) {
    session.status = status
    session.lastActivity = new Date().toISOString()
    if (ganeshaSessionId) {
      session.ganeshaSessionId = ganeshaSessionId
    }
    saveStoredSessions(stored)
  }
}

/**
 * Remove a session from storage
 */
function removeStoredSession(sessionId: string): void {
  const stored = loadStoredSessions()
  const filtered = stored.filter(s => s.id !== sessionId)
  saveStoredSessions(filtered)
}

/**
 * Get sessions for a specific project
 */
function getProjectSessions(projectId: string): StoredTerminalSession[] {
  const stored = loadStoredSessions()
  return stored.filter(s => s.projectId === projectId)
}

/**
 * Find the ganesha executable
 */
function findGaneshaPath(): string | null {
  for (const gpath of GANESHA_PATHS) {
    if (gpath !== "ganesha" && existsSync(gpath)) {
      console.log(`[ganesha] Found ganesha at: ${gpath}`)
      return gpath
    }
  }
  // Fallback to PATH lookup
  return findBinaryPath("ganesha") || "ganesha"
}

/**
 * Clean up a session
 */
function cleanupSession(sessionId: string, removeFromStorageFile: boolean = false) {
  const session = sessions.get(sessionId)
  if (!session) return

  console.log(`[ganesha] Cleaning up session ${sessionId}`)

  try {
    session.pty.kill()
  } catch (e) {
    console.error(`[ganesha][${sessionId}] Error killing PTY:`, e)
  }

  session.emitter.emit("message", { type: "complete" })
  session.emitter.removeAllListeners()

  if (removeFromStorageFile) {
    removeStoredSession(sessionId)
  } else {
    updateStoredSessionStatus(sessionId, "stopped")
  }

  sessions.delete(sessionId)
}

// Cleanup old sessions periodically
setInterval(() => {
  const now = new Date()
  for (const [id, session] of sessions.entries()) {
    const age = now.getTime() - session.startedAt.getTime()

    if (session.isBackground) {
      if (age > 24 * 60 * 60 * 1000) {
        console.log(`[ganesha] Auto-cleaning old background session: ${id}`)
        cleanupSession(id, true)
      }
      continue
    }

    if (
      age > 2 * 60 * 60 * 1000 ||
      (session.status === "stopped" && age > 5 * 60 * 1000)
    ) {
      console.log(`[ganesha] Auto-cleaning old session: ${id}`)
      cleanupSession(id, true)
    }
  }
}, 60000)

/**
 * POST - Start a new Ganesha session
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GaneshaSessionOptions & {
      sessionId?: string
      isBackground?: boolean
      userId?: string
      userRole?: string
    }

    const {
      projectId,
      workingDirectory,
      mode = "interactive",
      fluxDuration = "30m",
      resumeLast = false,
      resumeSessionId,
      bypassPermissions = false,
      sessionId: providedSessionId,
      isBackground = false,
      userId,
      userRole,
    } = body

    console.log("[ganesha] POST request received:", {
      projectId,
      workingDirectory,
      mode,
      fluxDuration,
      resumeLast,
      resumeSessionId,
      isBackground,
    })

    if (!projectId || !workingDirectory) {
      return NextResponse.json(
        { error: "projectId and workingDirectory are required" },
        { status: 400 }
      )
    }

    // Check if Ganesha is installed
    const toolStatus = await checkToolInstalled("ganesha")
    if (toolStatus.status !== "installed") {
      return NextResponse.json(
        {
          error: "Ganesha AI is not installed",
          installInstructions: "curl -sSL https://ganesha.dev/install.sh | bash",
        },
        { status: 400 }
      )
    }

    // Sandbox security validation
    const isAdmin = userRole === "admin" || userRole === "owner"
    const isBetaTester = userRole === "beta" || userRole === "beta_tester"
    const isSandboxed = isBetaTester || (!!userId && !isAdmin)

    if (isSandboxed && userId) {
      console.log(`[ganesha] Sandbox mode enabled for user ${userId}`)

      const pathValidation = validateProjectPath(workingDirectory, userId, {
        requireInSandbox: true,
        allowProtectedPaths: false,
      })

      if (!pathValidation.valid) {
        logSecurityEvent({
          userId,
          eventType: "sandbox_violation",
          details: `Attempted to start Ganesha session in protected path: ${workingDirectory}`,
          inputPath: workingDirectory,
        })

        return NextResponse.json(
          {
            error: "Access denied: Working directory is outside your sandbox",
            details: pathValidation.error,
            suggestion: pathValidation.suggestion,
            sandboxDir: getUserSandboxDir(userId),
          },
          { status: 403 }
        )
      }

      ensureUserSandbox(userId)
    }

    if (isPathProtected(workingDirectory)) {
      logSecurityEvent({
        userId: userId || "unknown",
        eventType: "path_blocked",
        details: `Attempted to start Ganesha session in protected path: ${workingDirectory}`,
        inputPath: workingDirectory,
      })

      return NextResponse.json(
        {
          error: "Access denied: This path is protected and cannot be accessed",
        },
        { status: 403 }
      )
    }

    if (!existsSync(workingDirectory)) {
      return NextResponse.json(
        { error: `Working directory does not exist: ${workingDirectory}` },
        { status: 400 }
      )
    }

    const id =
      providedSessionId ||
      `ganesha-${Date.now()}-${Math.random().toString(36).slice(2)}`

    // Check if session already exists
    if (sessions.has(id)) {
      const existingSession = sessions.get(id)!
      if (
        existingSession.status === "running" ||
        existingSession.status === "starting"
      ) {
        return NextResponse.json({
          success: true,
          sessionId: id,
          message: "Reconnected to existing session",
          mode: existingSession.mode,
        } as GaneshaSessionResponse)
      }
    }

    const ganeshaPath = findGaneshaPath()
    if (!ganeshaPath) {
      return NextResponse.json(
        { error: "Ganesha binary not found" },
        { status: 500 }
      )
    }

    console.log(`[ganesha] Starting PTY session ${id}`)
    console.log(`[ganesha] Using ganesha at: ${ganeshaPath}`)
    console.log(`[ganesha] Working directory: ${workingDirectory}`)
    console.log(`[ganesha] Mode: ${mode}`)

    // Build command arguments
    const args: string[] = []

    // Add mode flag
    // Note: interactive mode is the default for Ganesha, no flag needed
    switch (mode) {
      case "interactive":
        // No flag needed - Ganesha defaults to interactive mode
        break
      case "auto":
        args.push("--auto")
        break
      case "flux":
        args.push("--flux")
        if (fluxDuration) {
          args.push(fluxDuration)
        }
        break
    }

    if (bypassPermissions) {
      args.push("--dangerously-skip-permissions")
    }

    // Add resume flag if resuming
    if (resumeLast) {
      args.push("--last")
    } else if (resumeSessionId) {
      args.push("--resume", resumeSessionId)
    }

    // Create event emitter
    const emitter = new EventEmitter()
    emitter.setMaxListeners(50)

    // Extend PATH
    const extendedPath = [
      path.join(os.homedir(), ".local/bin"),
      "/usr/local/bin",
      "/usr/bin",
      process.env.PATH || "",
    ].join(":")

    // Spawn Ganesha with PTY
    const pty = spawn(ganeshaPath, args, {
      name: "xterm-256color",
      cols: 120,
      rows: 40,
      cwd: workingDirectory,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        FORCE_COLOR: "3",
        HOME: process.env.HOME || os.homedir(),
        PATH: extendedPath,
        LANG: "en_US.UTF-8",
        LC_ALL: "en_US.UTF-8",
      },
    })

    console.log(`[ganesha] PTY spawned with PID: ${pty.pid}`)

    // Create session object
    const session: GaneshaSession = {
      id,
      pty,
      projectId,
      workingDirectory,
      mode,
      startedAt: new Date(),
      status: "starting",
      emitter,
      outputBuffer: [],
      isBackground,
      ganeshaSessionId: resumeSessionId,
      userId,
      isSandboxed,
    }

    sessions.set(id, session)
    updateStoredSession(session)

    // Handle PTY data
    pty.onData((data: string) => {
      session.outputBuffer.push(data)
      if (session.outputBuffer.length > 200) {
        session.outputBuffer.shift()
      }

      if (session.status === "starting") {
        session.status = isBackground ? "background" : "running"
        updateStoredSessionStatus(id, session.status)
      }

      emitter.emit("message", { type: "output", content: data })
    })

    // Handle PTY exit
    pty.onExit(({ exitCode, signal }) => {
      console.log(
        `[ganesha][${id}] PTY exited with code ${exitCode}, signal ${signal}`
      )
      session.status = "stopped"
      updateStoredSessionStatus(id, "stopped")
      emitter.emit("message", { type: "exit", code: exitCode, signal })

      setTimeout(() => cleanupSession(id, false), 5000)
    })

    return NextResponse.json({
      success: true,
      sessionId: id,
      message: resumeLast
        ? "Ganesha session resumed"
        : "Ganesha session started",
      pid: pty.pid,
      mode,
      resumed: resumeLast || !!resumeSessionId,
      isSandboxed,
      sandboxDir: isSandboxed && userId ? getUserSandboxDir(userId) : undefined,
    } as GaneshaSessionResponse)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start session"
    console.error("[ganesha] Error starting session:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET - Stream output from a session via SSE OR list sessions
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get("sessionId")
  const listSessions = searchParams.get("list")
  const projectId = searchParams.get("projectId")

  // Handle session listing request
  if (listSessions === "true" || projectId) {
    const storedSessions = projectId
      ? getProjectSessions(projectId)
      : loadStoredSessions()

    const enrichedSessions = storedSessions.map(stored => {
      const liveSession = sessions.get(stored.id)
      return {
        ...stored,
        isActive: !!liveSession,
        liveStatus: liveSession?.status || stored.status,
        hasConnectedClients: liveSession
          ? liveSession.emitter.listenerCount("message") > 0
          : false,
      }
    })

    enrichedSessions.sort((a, b) => {
      const aTime = a.lastActivity ? new Date(a.lastActivity).getTime() : 0
      const bTime = b.lastActivity ? new Date(b.lastActivity).getTime() : 0
      return bTime - aTime
    })

    return NextResponse.json({
      success: true,
      sessions: enrichedSessions,
      totalCount: enrichedSessions.length,
      activeCount: enrichedSessions.filter(s => s.isActive).length,
    })
  }

  // Handle SSE streaming
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
  }

  const session = sessions.get(sessionId)
  if (!session) {
    const stored = loadStoredSessions().find(s => s.id === sessionId)
    if (stored && stored.status === "background") {
      return NextResponse.json(
        {
          error: "Session not active in memory",
          stored: true,
          canResume: !!stored.ganeshaSessionId,
          ganeshaSessionId: stored.ganeshaSessionId,
        },
        { status: 410 }
      )
    }
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  // Create SSE stream
  const encoder = new TextEncoder()
  let isControllerClosed = false

  const stream = new ReadableStream({
    start(controller) {
      const safeEnqueue = (data: string): boolean => {
        if (isControllerClosed) return false
        try {
          controller.enqueue(encoder.encode(data))
          return true
        } catch {
          isControllerClosed = true
          return false
        }
      }

      safeEnqueue(`data: ${JSON.stringify({ type: "connected", sessionId })}\n\n`)
      safeEnqueue(
        `data: ${JSON.stringify({ type: "status", status: session.status, mode: session.mode })}\n\n`
      )

      if (session.outputBuffer.length > 0) {
        const fullBuffer = session.outputBuffer.join("")
        safeEnqueue(
          `data: ${JSON.stringify({ type: "output", content: fullBuffer, replayed: true })}\n\n`
        )
      }

      const messageHandler = (message: { type: string; content?: string }) => {
        if (isControllerClosed) {
          session.emitter.removeListener("message", messageHandler)
          return
        }
        if (!safeEnqueue(`data: ${JSON.stringify(message)}\n\n`)) {
          session.emitter.removeListener("message", messageHandler)
        }
      }

      session.emitter.on("message", messageHandler)

      const keepaliveInterval = setInterval(() => {
        if (isControllerClosed) {
          clearInterval(keepaliveInterval)
          return
        }
        if (!safeEnqueue(`: keepalive\n\n`)) {
          clearInterval(keepaliveInterval)
        }
      }, 15000)

      request.signal.addEventListener("abort", () => {
        isControllerClosed = true
        clearInterval(keepaliveInterval)
        session.emitter.removeListener("message", messageHandler)
      })
    },

    cancel() {
      isControllerClosed = true
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

/**
 * PUT - Send input to a running session
 */
export async function PUT(request: NextRequest) {
  let sessionId: string | undefined

  try {
    const body = await request.json()
    const { sessionId: sid, input, resize } = body
    sessionId = sid

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    const session = sessions.get(sessionId)
    if (!session) {
      return NextResponse.json(
        {
          error: "Session not found",
          hint: "The session may have been cleaned up or the server was restarted",
        },
        { status: 404 }
      )
    }

    // Handle resize request
    if (resize) {
      const { cols, rows } = resize
      if (cols && rows) {
        session.pty.resize(cols, rows)
        return NextResponse.json({ success: true, message: "Resized" })
      }
    }

    // Handle input
    if (input !== undefined) {
      if (
        session.status !== "running" &&
        session.status !== "starting" &&
        session.status !== "background"
      ) {
        return NextResponse.json(
          { error: `Session is not running (status: ${session.status})` },
          { status: 400 }
        )
      }

      session.pty.write(input)
      updateStoredSessionStatus(sessionId, session.status)
      return NextResponse.json({ success: true, message: "Input sent" })
    }

    return NextResponse.json({ error: "No action specified" }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send input"
    console.error(`[ganesha] PUT error:`, error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE - Stop a session
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")
    const removeFromStorage = searchParams.get("removeFromStorage") === "true"

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    const session = sessions.get(sessionId)
    if (!session) {
      const stored = loadStoredSessions().find(s => s.id === sessionId)
      if (stored && removeFromStorage) {
        removeStoredSession(sessionId)
        return NextResponse.json({ success: true, message: "Session removed from storage" })
      }
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    cleanupSession(sessionId, removeFromStorage)
    return NextResponse.json({ success: true, message: "Session stopped" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to stop session"
    console.error("[ganesha] Error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
