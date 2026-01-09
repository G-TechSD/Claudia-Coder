import { NextRequest, NextResponse } from "next/server"
import { spawn, IPty } from "node-pty"
import { existsSync } from "fs"
import { EventEmitter } from "events"

// Store active sessions with PTY
interface ClaudeSession {
  id: string
  pty: IPty
  projectId: string
  workingDirectory: string
  bypassPermissions: boolean
  startedAt: Date
  status: "starting" | "running" | "stopped" | "error"
  emitter: EventEmitter
  outputBuffer: string[]
}

const sessions = new Map<string, ClaudeSession>()

// Paths to check for claude binary
const CLAUDE_PATHS = [
  "/home/bill/.local/bin/claude",
  "/usr/local/bin/claude",
  "/usr/bin/claude",
  "claude"
]

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
    // Clean up sessions older than 2 hours or stopped sessions older than 5 minutes
    if (age > 2 * 60 * 60 * 1000 ||
        (session.status === "stopped" && age > 5 * 60 * 1000)) {
      console.log(`[claude-code] Auto-cleaning old session: ${id}`)
      cleanupSession(id)
    }
  }
}, 60000)

/**
 * POST - Start a new Claude Code session with full PTY
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, workingDirectory, bypassPermissions = false, sessionId } = body

    console.log("[claude-code] POST request received:", { projectId, workingDirectory, bypassPermissions, sessionId })

    if (!projectId || !workingDirectory) {
      return NextResponse.json(
        { error: "projectId and workingDirectory are required" },
        { status: 400 }
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

    // Check if session already exists
    if (sessions.has(id)) {
      return NextResponse.json(
        { error: "Session already exists", sessionId: id },
        { status: 409 }
      )
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

    // Build command arguments
    const args: string[] = []

    if (bypassPermissions) {
      args.push("--dangerously-skip-permissions")
    }

    // Create event emitter for this session
    const emitter = new EventEmitter()
    emitter.setMaxListeners(50)

    // Extend PATH
    const extendedPath = [
      "/home/bill/.local/bin",
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
        HOME: process.env.HOME || "/home/bill",
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
      outputBuffer: []
    }

    sessions.set(id, session)

    // Handle PTY data (stdout + stderr combined)
    pty.onData((data: string) => {
      // Store in buffer for late-joining clients (keep last 200 chunks)
      session.outputBuffer.push(data)
      if (session.outputBuffer.length > 200) {
        session.outputBuffer.shift()
      }

      // Update status to running after first output
      if (session.status === "starting") {
        session.status = "running"
        console.log(`[claude-code][${id}] Status changed to running`)
      }

      // Emit to all connected SSE clients
      emitter.emit("message", { type: "output", content: data })
    })

    // Handle PTY exit
    pty.onExit(({ exitCode, signal }) => {
      console.log(`[claude-code][${id}] PTY exited with code ${exitCode}, signal ${signal}`)
      session.status = "stopped"
      emitter.emit("message", { type: "exit", code: exitCode, signal })

      // Cleanup after a delay
      setTimeout(() => cleanupSession(id), 5000)
    })

    return NextResponse.json({
      success: true,
      sessionId: id,
      message: "Claude Code session started",
      claudePath,
      pid: pty.pid
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
 * GET - Stream output from a session via Server-Sent Events
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get("sessionId")

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
  }

  const session = sessions.get(sessionId)
  if (!session) {
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
      if (session.status !== "running" && session.status !== "starting") {
        console.warn(`[claude-code][${sessionId}] Cannot send input - session status: ${session.status}`)
        return NextResponse.json(
          { error: `Session is not running (status: ${session.status})` },
          { status: 400 }
        )
      }

      // Safely write to PTY
      try {
        console.log(`[claude-code][${sessionId}] Writing input (${input.length} chars): ${JSON.stringify(input.slice(0, 50))}${input.length > 50 ? "..." : ""}`)
        session.pty.write(input)
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

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    const session = sessions.get(sessionId)
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    console.log(`[claude-code][${sessionId}] DELETE request - stopping session`)
    cleanupSession(sessionId)

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
function cleanupSession(sessionId: string) {
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

  // Remove from store
  sessions.delete(sessionId)
  console.log(`[claude-code][${sessionId}] Session removed`)
}
