/**
 * Dev Tools Install API
 *
 * POST - Start installation of a development tool
 * GET - Stream installation progress via SSE
 */

import { NextRequest, NextResponse } from "next/server"
import { spawn, IPty } from "node-pty"
import { EventEmitter } from "events"
import os from "os"
import path from "path"
import { DevToolId, InstallStartResponse, InstallProgressEvent } from "@/lib/dev-tools/types"
import { getToolConfig, checkToolInstalled } from "@/lib/dev-tools/tool-registry"

// Force dynamic rendering
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Active installation sessions
interface InstallSession {
  id: string
  toolId: DevToolId
  pty: IPty
  emitter: EventEmitter
  outputBuffer: string[]
  status: "running" | "completed" | "error"
  startedAt: Date
}

const installSessions = new Map<string, InstallSession>()

// Cleanup old sessions periodically
setInterval(() => {
  const now = new Date()
  for (const [id, session] of installSessions.entries()) {
    const age = now.getTime() - session.startedAt.getTime()
    // Clean up sessions older than 10 minutes or completed sessions older than 1 minute
    if (age > 10 * 60 * 1000 || (session.status !== "running" && age > 60 * 1000)) {
      console.log(`[dev-tools/install] Cleaning up session: ${id}`)
      try {
        session.pty.kill()
      } catch {
        // Ignore
      }
      session.emitter.removeAllListeners()
      installSessions.delete(id)
    }
  }
}, 30000)

/**
 * POST /api/dev-tools/install
 * Start installation of a tool
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { toolId } = body as { toolId: DevToolId }

    if (!toolId) {
      return NextResponse.json({ error: "toolId is required" }, { status: 400 })
    }

    const config = getToolConfig(toolId)
    if (!config) {
      return NextResponse.json({ error: `Unknown tool: ${toolId}` }, { status: 400 })
    }

    // Check if already installed
    const status = await checkToolInstalled(toolId)
    if (status.status === "installed") {
      return NextResponse.json({
        success: true,
        sessionId: "",
        toolId,
        message: `${config.name} is already installed (${status.version})`,
      } as InstallStartResponse)
    }

    // Generate session ID
    const sessionId = `install-${toolId}-${Date.now()}-${Math.random().toString(36).slice(2)}`

    // Create event emitter for this session
    const emitter = new EventEmitter()
    emitter.setMaxListeners(50)

    // Extend PATH
    const extendedPath = [
      path.join(os.homedir(), ".local/bin"),
      path.join(os.homedir(), ".npm-global/bin"),
      "/usr/local/bin",
      "/usr/bin",
      process.env.PATH || "",
    ].join(":")

    console.log(`[dev-tools/install] Starting installation of ${toolId}`)
    console.log(`[dev-tools/install] Command: ${config.installCommand}`)

    // Spawn the install command in a PTY
    const pty = spawn("bash", ["-c", config.installCommand], {
      name: "xterm-256color",
      cols: 120,
      rows: 24,
      cwd: os.homedir(),
      env: {
        ...process.env,
        TERM: "xterm-256color",
        HOME: process.env.HOME || os.homedir(),
        PATH: extendedPath,
        LANG: "en_US.UTF-8",
        LC_ALL: "en_US.UTF-8",
      },
    })

    console.log(`[dev-tools/install] PTY spawned with PID: ${pty.pid}`)

    // Create session
    const session: InstallSession = {
      id: sessionId,
      toolId,
      pty,
      emitter,
      outputBuffer: [],
      status: "running",
      startedAt: new Date(),
    }

    installSessions.set(sessionId, session)

    // Handle PTY data
    pty.onData((data: string) => {
      session.outputBuffer.push(data)
      if (session.outputBuffer.length > 200) {
        session.outputBuffer.shift()
      }
      emitter.emit("message", { type: "output", content: data } as InstallProgressEvent)
    })

    // Handle PTY exit
    pty.onExit(({ exitCode, signal }) => {
      console.log(`[dev-tools/install][${sessionId}] PTY exited with code ${exitCode}, signal ${signal}`)

      if (exitCode === 0) {
        session.status = "completed"
        emitter.emit("message", {
          type: "complete",
          status: "installed",
          content: `\n\n✓ ${config.name} installed successfully!\n`,
        } as InstallProgressEvent)
      } else {
        session.status = "error"
        emitter.emit("message", {
          type: "error",
          status: "error",
          error: `Installation failed with exit code ${exitCode}`,
          content: `\n\n✗ Installation failed with exit code ${exitCode}\n`,
        } as InstallProgressEvent)
      }

      // Clean up after a delay
      setTimeout(() => {
        installSessions.delete(sessionId)
      }, 60000)
    })

    return NextResponse.json({
      success: true,
      sessionId,
      toolId,
      message: `Installing ${config.name}...`,
    } as InstallStartResponse)
  } catch (error) {
    console.error("[dev-tools/install] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start installation" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/dev-tools/install
 * Stream installation progress via SSE
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get("sessionId")

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
  }

  const session = installSessions.get(sessionId)
  if (!session) {
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

      // Send initial connection message
      safeEnqueue(`data: ${JSON.stringify({ type: "connected", sessionId })}\n\n`)

      // Replay buffered output
      if (session.outputBuffer.length > 0) {
        const fullBuffer = session.outputBuffer.join("")
        safeEnqueue(`data: ${JSON.stringify({ type: "output", content: fullBuffer, replayed: true })}\n\n`)
      }

      // If already completed or error, send that status
      if (session.status !== "running") {
        safeEnqueue(`data: ${JSON.stringify({
          type: session.status === "completed" ? "complete" : "error",
          status: session.status === "completed" ? "installed" : "error",
        })}\n\n`)
      }

      // Listen for new messages
      const messageHandler = (message: InstallProgressEvent) => {
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

      // Cleanup on abort
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
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
