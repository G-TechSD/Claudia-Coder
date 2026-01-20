import { NextRequest, NextResponse } from "next/server"
import { spawn, IPty } from "node-pty"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { EventEmitter } from "events"
import path from "path"
import os from "os"

// Force dynamic rendering - prevents Next.js from pre-rendering this route during build
// This is required because node-pty is a native module that cannot be loaded during static analysis
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Import sandbox security module
import {
  validateProjectPath,
  isPathProtected,
  logSecurityEvent,
  getUserSandboxDir,
  ensureUserSandbox,
} from "@/lib/security/sandbox"

// Import prompt injection filter
import {
  filterPromptInjection,
  isInputSafe,
} from "@/lib/security/prompt-filter"

// Import security activity logging
import {
  logSecurityEvent as logSecurityActivityEvent,
} from "@/lib/security/activity-log"

// Mark unused imports for future use
void filterPromptInjection
void isInputSafe
void logSecurityActivityEvent

// Session storage file path
const SESSIONS_FILE = path.join(process.cwd(), ".local-storage", "claude-sessions.json")

// Stored session info (persisted to file)
interface StoredSession {
  id: string
  projectId: string
  workingDirectory: string
  bypassPermissions: boolean
  startedAt: string // ISO date string
  status: "starting" | "running" | "stopped" | "error" | "background"
  isBackground: boolean
  claudeSessionId?: string // Claude's internal session ID for --resume
  lastActivity?: string // ISO date string
  userId?: string // User ID for sandbox isolation
  isSandboxed?: boolean // Whether session is running in sandbox mode
}

// Active session with PTY (in-memory only)
interface ClaudeSession {
  id: string
  pty: IPty
  projectId: string
  workingDirectory: string
  bypassPermissions: boolean
  startedAt: Date
  status: "starting" | "running" | "stopped" | "error" | "background"
  emitter: EventEmitter
  outputBuffer: string[]
  isBackground: boolean
  claudeSessionId?: string // Claude's internal session ID for --resume
  userId?: string // User ID for sandbox isolation
  isSandboxed?: boolean // Whether session is running in sandbox mode
}

const sessions = new Map<string, ClaudeSession>()

// Paths to check for claude binary
const CLAUDE_PATHS = [
  path.join(os.homedir(), ".local/bin/claude"),
  "/usr/local/bin/claude",
  "/usr/bin/claude",
  "claude"
]

/**
 * Load stored sessions from JSON file
 */
function loadStoredSessions(): StoredSession[] {
  try {
    if (existsSync(SESSIONS_FILE)) {
      const data = readFileSync(SESSIONS_FILE, "utf-8")
      return JSON.parse(data)
    }
  } catch (error) {
    console.error("[claude-code] Error loading stored sessions:", error)
  }
  return []
}

/**
 * Save sessions to JSON file
 */
function saveStoredSessions(storedSessions: StoredSession[]): void {
  try {
    // Ensure directory exists
    const dir = path.dirname(SESSIONS_FILE)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(SESSIONS_FILE, JSON.stringify(storedSessions, null, 2))
    console.log(`[claude-code] Saved ${storedSessions.length} sessions to storage`)
  } catch (error) {
    console.error("[claude-code] Error saving sessions:", error)
  }
}

/**
 * Add or update a session in storage
 */
function updateStoredSession(session: ClaudeSession): void {
  const stored = loadStoredSessions()
  const index = stored.findIndex(s => s.id === session.id)

  const storedSession: StoredSession = {
    id: session.id,
    projectId: session.projectId,
    workingDirectory: session.workingDirectory,
    bypassPermissions: session.bypassPermissions,
    startedAt: session.startedAt.toISOString(),
    status: session.status,
    isBackground: session.isBackground,
    claudeSessionId: session.claudeSessionId,
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
function updateStoredSessionStatus(sessionId: string, status: StoredSession["status"], claudeSessionId?: string): void {
  const stored = loadStoredSessions()
  const session = stored.find(s => s.id === sessionId)

  if (session) {
    session.status = status
    session.lastActivity = new Date().toISOString()
    if (claudeSessionId) {
      session.claudeSessionId = claudeSessionId
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
function getProjectSessions(projectId: string): StoredSession[] {
  const stored = loadStoredSessions()
  return stored.filter(s => s.projectId === projectId)
}

/**
 * Find the claude executable
 */
function findClaudePath(): string | null {
  for (const path of CLAUDE_PATHS) {
    if (path !== "claude" && existsSync(path)) {
      console.log(`[claude-code] Found claude at: ${path}`)
      return path
    }
  }
  // Fallback to PATH lookup
  return "claude"
}

// Cleanup old sessions periodically
setInterval(() => {
  const now = new Date()
  for (const [id, session] of sessions.entries()) {
    const age = now.getTime() - session.startedAt.getTime()

    // Don't auto-cleanup background sessions unless they're very old (24 hours)
    if (session.isBackground) {
      if (age > 24 * 60 * 60 * 1000) {
        console.log(`[claude-code] Auto-cleaning old background session: ${id}`)
        cleanupSession(id, true)
      }
      continue
    }

    // Clean up non-background sessions older than 2 hours or stopped sessions older than 5 minutes
    if (age > 2 * 60 * 60 * 1000 ||
        (session.status === "stopped" && age > 5 * 60 * 1000)) {
      console.log(`[claude-code] Auto-cleaning old session: ${id}`)
      cleanupSession(id, true)
    }
  }
}, 60000)

/**
 * POST - Start a new Claude Code session or resume an existing one
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      projectId,
      workingDirectory,
      bypassPermissions = false,
      sessionId,
      isBackground = false,
      resume = false,
      resumeSessionId, // Claude's internal session ID to resume
      continueSession = false, // Use --continue flag to continue last session
      userId, // User ID for sandbox isolation
      userRole, // User role (admin, beta, etc.)
    } = body

    console.log("[claude-code] POST request received:", {
      projectId,
      workingDirectory,
      bypassPermissions,
      sessionId,
      isBackground,
      resume,
      resumeSessionId,
      continueSession,
      userId,
      userRole,
    })

    if (!projectId || !workingDirectory) {
      return NextResponse.json(
        { error: "projectId and workingDirectory are required" },
        { status: 400 }
      )
    }

    // ============================================
    // SANDBOX SECURITY VALIDATION
    // ============================================
    const isAdmin = userRole === "admin" || userRole === "owner"
    const isBetaTester = userRole === "beta" || userRole === "beta_tester"
    const isSandboxed = isBetaTester || (userId && !isAdmin)

    // For sandboxed users (beta testers), enforce strict path validation
    if (isSandboxed && userId) {
      console.log(`[claude-code] Sandbox mode enabled for user ${userId} (role: ${userRole})`)

      // Validate the working directory is within user's sandbox
      const pathValidation = validateProjectPath(workingDirectory, userId, {
        requireInSandbox: true,
        allowProtectedPaths: false,
      })

      if (!pathValidation.valid) {
        logSecurityEvent({
          userId,
          eventType: "sandbox_violation",
          details: `Attempted to start session in protected path: ${workingDirectory}`,
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

      // Ensure user sandbox directory exists
      ensureUserSandbox(userId)
    }

    // Even for non-sandboxed users, block access to absolutely protected paths
    if (isPathProtected(workingDirectory)) {
      logSecurityEvent({
        userId: userId || "unknown",
        eventType: "path_blocked",
        details: `Attempted to start session in protected path: ${workingDirectory}`,
        inputPath: workingDirectory,
      })

      return NextResponse.json(
        {
          error: "Access denied: This path is protected and cannot be accessed",
          hint: "Claudia platform source code and system files are protected",
        },
        { status: 403 }
      )
    }

    // Validate working directory exists
    if (!existsSync(workingDirectory)) {
      return NextResponse.json(
        { error: `Working directory does not exist: ${workingDirectory}` },
        { status: 400 }
      )
    }

    const id = sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2)}`

    // Check if session already exists in memory
    if (sessions.has(id)) {
      const existingSession = sessions.get(id)!
      // If it exists and is running, return it
      if (existingSession.status === "running" || existingSession.status === "starting") {
        return NextResponse.json({
          success: true,
          sessionId: id,
          message: "Reconnected to existing session",
          reconnected: true,
          status: existingSession.status
        })
      }
    }

    // Find claude executable
    const claudePath = findClaudePath()
    if (!claudePath) {
      return NextResponse.json(
        { error: "Claude Code CLI not found. Please ensure 'claude' is installed." },
        { status: 500 }
      )
    }

    console.log(`[claude-code] Starting PTY session ${id}`)
    console.log(`[claude-code] Using claude at: ${claudePath}`)
    console.log(`[claude-code] Working directory: ${workingDirectory}`)
    console.log(`[claude-code] Background mode: ${isBackground}`)
    console.log(`[claude-code] Resume mode: ${resume}, resumeSessionId: ${resumeSessionId}`)
    console.log(`[claude-code] Continue mode: ${continueSession}`)

    // Build command arguments
    const args: string[] = []

    if (bypassPermissions) {
      args.push("--dangerously-skip-permissions")
    }

    // Add resume flag if resuming a specific session
    if (resume && resumeSessionId) {
      args.push("--resume", resumeSessionId)
      console.log(`[claude-code] Resuming session with --resume ${resumeSessionId}`)
    }
    // Add continue flag to continue the most recent session
    else if (continueSession) {
      args.push("--continue")
      console.log(`[claude-code] Continuing last session with --continue`)
    }

    // Create event emitter for this session
    const emitter = new EventEmitter()
    emitter.setMaxListeners(50)

    // Extend PATH
    const extendedPath = [
      path.join(os.homedir(), ".local/bin"),
      "/usr/local/bin",
      "/usr/bin",
      process.env.PATH || ""
    ].join(":")

    // Spawn Claude with PTY for full interactive experience
    const pty = spawn(claudePath, args, {
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
      }
    })

    console.log(`[claude-code] PTY spawned with PID: ${pty.pid}`)

    // Create session object
    const session: ClaudeSession = {
      id,
      pty,
      projectId,
      workingDirectory,
      bypassPermissions,
      startedAt: new Date(),
      status: "starting",
      emitter,
      outputBuffer: [],
      isBackground,
      claudeSessionId: resumeSessionId,
      userId,
      isSandboxed,
    }

    sessions.set(id, session)

    // Save to persistent storage
    updateStoredSession(session)

    // Try to extract Claude's session ID from output
    let sessionIdExtracted = false

    // Handle PTY data (stdout + stderr combined)
    pty.onData((data: string) => {
      // Store in buffer for late-joining clients (keep last 200 chunks)
      session.outputBuffer.push(data)
      if (session.outputBuffer.length > 200) {
        session.outputBuffer.shift()
      }

      // Try to extract Claude's internal session ID from the output
      // Claude typically outputs something like "Session: abc123..." or similar
      if (!sessionIdExtracted && !session.claudeSessionId) {
        // Look for patterns like "session_id: xyz" or "Session ID: xyz" or just "Session xyz" at start
        const sessionMatch = data.match(/(?:session[_\s]?id|Session ID|Session)[:\s]+([a-zA-Z0-9_-]+)/i)
        if (sessionMatch) {
          session.claudeSessionId = sessionMatch[1]
          sessionIdExtracted = true
          updateStoredSession(session)
          console.log(`[claude-code][${id}] Extracted Claude session ID: ${session.claudeSessionId}`)
          // Emit the claudeSessionId to connected clients so they can store it
          emitter.emit("message", { type: "claude_session_id", claudeSessionId: session.claudeSessionId })
        }
      }

      // Update status to running after first output
      if (session.status === "starting") {
        session.status = isBackground ? "background" : "running"
        updateStoredSessionStatus(id, session.status)
        console.log(`[claude-code][${id}] Status changed to ${session.status}`)
      }

      // Emit to all connected SSE clients
      emitter.emit("message", { type: "output", content: data })
    })

    // Handle PTY exit
    pty.onExit(({ exitCode, signal }) => {
      console.log(`[claude-code][${id}] PTY exited with code ${exitCode}, signal ${signal}`)
      session.status = "stopped"
      updateStoredSessionStatus(id, "stopped")
      emitter.emit("message", { type: "exit", code: exitCode, signal })

      // Cleanup after a delay (but keep in storage for history)
      setTimeout(() => cleanupSession(id, false), 5000)
    })

    return NextResponse.json({
      success: true,
      sessionId: id,
      message: resume ? "Claude Code session resumed" : (continueSession ? "Claude Code session continued" : "Claude Code session started"),
      claudePath,
      pid: pty.pid,
      isBackground,
      resumed: resume && !!resumeSessionId,
      continued: continueSession,
      isSandboxed,
      sandboxDir: isSandboxed && userId ? getUserSandboxDir(userId) : undefined,
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start session"
    console.error("[claude-code] Error starting session:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * GET - Stream output from a session via Server-Sent Events OR list sessions
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get("sessionId")
  const listSessions = searchParams.get("list")
  const projectId = searchParams.get("projectId")

  // Handle session listing request
  if (listSessions === "true" || projectId) {
    console.log(`[claude-code] Listing sessions${projectId ? ` for project ${projectId}` : " (all)"}`)

    const storedSessions = projectId
      ? getProjectSessions(projectId)
      : loadStoredSessions()

    // Enrich with live status from in-memory sessions
    const enrichedSessions = storedSessions.map(stored => {
      const liveSession = sessions.get(stored.id)
      return {
        ...stored,
        isActive: !!liveSession,
        liveStatus: liveSession?.status || stored.status,
        hasConnectedClients: liveSession ? liveSession.emitter.listenerCount("message") > 0 : false
      }
    })

    // Sort by lastActivity descending (most recent first)
    enrichedSessions.sort((a, b) => {
      const aTime = a.lastActivity ? new Date(a.lastActivity).getTime() : 0
      const bTime = b.lastActivity ? new Date(b.lastActivity).getTime() : 0
      return bTime - aTime
    })

    return NextResponse.json({
      success: true,
      sessions: enrichedSessions,
      totalCount: enrichedSessions.length,
      activeCount: enrichedSessions.filter(s => s.isActive).length
    })
  }

  // Handle SSE streaming for a specific session
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
  }

  const session = sessions.get(sessionId)
  if (!session) {
    // Check if it exists in storage (could be a background session that needs revival)
    const stored = loadStoredSessions().find(s => s.id === sessionId)
    if (stored && stored.status === "background") {
      console.log(`[claude-code][${sessionId}] Session found in storage but not in memory. It may need to be resumed.`)
      return NextResponse.json({
        error: "Session not active in memory",
        stored: true,
        canResume: !!stored.claudeSessionId,
        claudeSessionId: stored.claudeSessionId
      }, { status: 410 }) // 410 Gone
    }
    console.error(`[claude-code][${sessionId}] SSE: Session not found - Available: ${Array.from(sessions.keys()).join(", ") || "none"}`)
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  const listenerCount = session.emitter.listenerCount("message")
  console.log(`[claude-code][${sessionId}] SSE connection requested (existing listeners: ${listenerCount})`)

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

      // Send initial connection message
      safeEnqueue(`data: ${JSON.stringify({ type: "connected", sessionId })}\n\n`)

      // Send current status
      safeEnqueue(`data: ${JSON.stringify({ type: "status", status: session.status })}\n\n`)

      // Replay buffered output for late-joining clients
      if (session.outputBuffer.length > 0) {
        console.log(`[claude-code][${sessionId}] Replaying ${session.outputBuffer.length} buffered chunks`)
        const fullBuffer = session.outputBuffer.join("")
        safeEnqueue(`data: ${JSON.stringify({ type: "output", content: fullBuffer, replayed: true })}\n\n`)
      }

      // Listen for new messages
      const messageHandler = (message: { type: string; content?: string; code?: number }) => {
        if (isControllerClosed) {
          session.emitter.removeListener("message", messageHandler)
          return
        }
        if (!safeEnqueue(`data: ${JSON.stringify(message)}\n\n`)) {
          session.emitter.removeListener("message", messageHandler)
        }
      }

      session.emitter.on("message", messageHandler)

      // Send periodic keepalive
      const keepaliveInterval = setInterval(() => {
        if (isControllerClosed) {
          clearInterval(keepaliveInterval)
          return
        }
        if (!safeEnqueue(`: keepalive\n\n`)) {
          clearInterval(keepaliveInterval)
        }
      }, 15000)

      // Cleanup function
      const cleanup = () => {
        const remainingListeners = session.emitter.listenerCount("message")
        console.log(`[claude-code][${sessionId}] SSE cleanup triggered (remaining listeners before cleanup: ${remainingListeners})`)
        isControllerClosed = true
        clearInterval(keepaliveInterval)
        session.emitter.removeListener("message", messageHandler)
        console.log(`[claude-code][${sessionId}] SSE cleanup complete (listeners after: ${session.emitter.listenerCount("message")})`)
      }

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        console.log(`[claude-code][${sessionId}] SSE abort signal received`)
        cleanup()
      })
    },

    cancel() {
      console.log(`[claude-code][${sessionId}] SSE stream cancelled by client`)
      isControllerClosed = true
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
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
      console.warn("[claude-code] PUT request missing sessionId")
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    // DEBUG: Log all active sessions
    console.log(`[claude-code][${sessionId}] PUT request - Active sessions: ${Array.from(sessions.keys()).join(", ") || "none"}`)

    const session = sessions.get(sessionId)
    if (!session) {
      console.error(`[claude-code][${sessionId}] Session not found! This can happen if:
  - Session was cleaned up due to timeout
  - Session was stopped by user
  - Session ID mismatch between client and server
  - Server was restarted (sessions are in-memory only)`)
      return NextResponse.json({
        error: "Session not found",
        hint: "The session may have been cleaned up or the server was restarted",
        availableSessions: Array.from(sessions.keys())
      }, { status: 404 })
    }

    // Handle resize request
    if (resize) {
      const { cols, rows } = resize
      if (cols && rows) {
        console.log(`[claude-code][${sessionId}] Resizing PTY to ${cols}x${rows}`)
        try {
          session.pty.resize(cols, rows)
          return NextResponse.json({ success: true, message: "Resized" })
        } catch (resizeError) {
          console.error(`[claude-code][${sessionId}] Resize failed:`, resizeError)
          return NextResponse.json({
            error: "Failed to resize PTY",
            details: resizeError instanceof Error ? resizeError.message : "Unknown error"
          }, { status: 500 })
        }
      }
    }

    // Handle input
    if (input !== undefined) {
      // Check session status
      if (session.status !== "running" && session.status !== "starting" && session.status !== "background") {
        console.warn(`[claude-code][${sessionId}] Cannot send input - session status: ${session.status}`)
        return NextResponse.json(
          { error: `Session is not running (status: ${session.status})` },
          { status: 400 }
        )
      }

      // ============================================
      // PROMPT INJECTION PROTECTION (for sandboxed/beta users)
      // ============================================
      if (session.isSandboxed && typeof input === "string" && input.length > 5) {
        // Quick check first for performance
        if (!isInputSafe(input)) {
          // Full analysis if quick check fails
          const filterResult = filterPromptInjection(input, {
            userId: session.userId,
            sessionId: sessionId,
            projectId: session.projectId,
            strict: true // Beta users get strict filtering
          })

          if (filterResult.blocked) {
            console.warn(`[claude-code][${sessionId}] PROMPT INJECTION BLOCKED for user ${session.userId}`)
            console.warn(`[claude-code][${sessionId}] Detected patterns:`, filterResult.detectedPatterns)

            // Log to security activity log
            logSecurityActivityEvent({
              userId: session.userId || "unknown",
              type: "injection_attempt",
              severity: "critical",
              details: {
                sessionId,
                projectId: session.projectId,
                patterns: filterResult.detectedPatterns,
                inputPreview: input.substring(0, 200),
                blocked: true
              }
            })

            return NextResponse.json({
              error: "Input blocked: Potential prompt injection detected",
              details: "Your input contains patterns that could be used to manipulate the AI system.",
              patterns: filterResult.detectedPatterns.map(p => p.pattern),
              hint: "Please rephrase your request using normal instructions."
            }, { status: 403 })
          }

          // Log suspicious but not blocked
          if (filterResult.detectedPatterns.length > 0) {
            console.log(`[claude-code][${sessionId}] Suspicious patterns detected but allowed:`, filterResult.detectedPatterns)
          }
        }
      }

      // Safely write to PTY
      try {
        console.log(`[claude-code][${sessionId}] Writing input (${input.length} chars): ${JSON.stringify(input.slice(0, 50))}${input.length > 50 ? "..." : ""}`)
        session.pty.write(input)

        // Update last activity
        updateStoredSessionStatus(sessionId, session.status)

        return NextResponse.json({ success: true, message: "Input sent" })
      } catch (writeError) {
        console.error(`[claude-code][${sessionId}] PTY write failed:`, writeError)
        // Check if PTY is still alive
        try {
          const pid = session.pty.pid
          console.log(`[claude-code][${sessionId}] PTY PID is ${pid}`)
        } catch {
          console.error(`[claude-code][${sessionId}] PTY appears to be dead`)
          session.status = "error"
          updateStoredSessionStatus(sessionId, "error")
        }
        return NextResponse.json({
          error: "Failed to write to PTY",
          details: writeError instanceof Error ? writeError.message : "Unknown error"
        }, { status: 500 })
      }
    }

    return NextResponse.json({ error: "No action specified" }, { status: 400 })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send input"
    console.error(`[claude-code]${sessionId ? `[${sessionId}]` : ""} PUT error:`, error)
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
      // Check if it exists in storage only
      const stored = loadStoredSessions().find(s => s.id === sessionId)
      if (stored && removeFromStorage) {
        removeStoredSession(sessionId)
        return NextResponse.json({ success: true, message: "Session removed from storage" })
      }
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    console.log(`[claude-code][${sessionId}] DELETE request - stopping session`)
    cleanupSession(sessionId, removeFromStorage)

    return NextResponse.json({ success: true, message: "Session stopped" })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to stop session"
    console.error("[claude-code] Error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Clean up a session
 */
function cleanupSession(sessionId: string, removeFromStorageFile: boolean = false) {
  const session = sessions.get(sessionId)
  if (!session) return

  console.log(`[claude-code] Cleaning up session ${sessionId}`)

  try {
    // Kill the PTY process
    session.pty.kill()
  } catch (e) {
    console.error(`[claude-code][${sessionId}] Error killing PTY:`, e)
  }

  // Notify listeners
  session.emitter.emit("message", { type: "complete" })
  session.emitter.removeAllListeners()

  // Update status in storage (don't remove, keep for history)
  if (removeFromStorageFile) {
    removeStoredSession(sessionId)
  } else {
    updateStoredSessionStatus(sessionId, "stopped")
  }

  // Remove from in-memory store
  sessions.delete(sessionId)
  console.log(`[claude-code][${sessionId}] Session removed from memory`)
}
