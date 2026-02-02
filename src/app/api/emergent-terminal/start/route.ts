/**
 * Emergent Terminal Server Start/Stop API
 *
 * Spawns the Emergent Terminal server as a background process.
 */

import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/middleware"
import { spawn } from "child_process"
import * as fs from "fs"
import * as path from "path"
import * as https from "https"

// Health check that accepts self-signed certificates
async function checkEmergentHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "localhost",
        port: 3100,
        path: "/api/health",
        method: "GET",
        rejectUnauthorized: false, // Accept self-signed certs
        timeout: 1000,
      },
      (res) => {
        resolve(res.statusCode === 200)
      }
    )
    req.on("error", () => resolve(false))
    req.on("timeout", () => {
      req.destroy()
      resolve(false)
    })
    req.end()
  })
}

const STORAGE_DIR = path.join(process.cwd(), ".local-storage")
const PID_FILE = path.join(STORAGE_DIR, "emergent-server.pid")
const LOG_FILE = path.join(STORAGE_DIR, "emergent-server.log")

// Cache for status checks to prevent rapid polling (2 second cache to allow 3s polling interval)
let lastStatusCheck: { time: number; result: { running: boolean; responding: boolean; pid: number | null } } | null = null
const STATUS_CACHE_TTL_MS = 2000

function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true })
  }
}

function getStoredPid(): number | null {
  try {
    if (fs.existsSync(PID_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8").trim(), 10)
      // Check if process is still running
      try {
        process.kill(pid, 0)
        return pid
      } catch {
        // Process not running, clean up
        fs.unlinkSync(PID_FILE)
      }
    }
  } catch (err) {
    console.error("[Emergent Start] Error reading PID file:", err)
  }
  return null
}

function savePid(pid: number): void {
  ensureStorageDir()
  fs.writeFileSync(PID_FILE, pid.toString())
}

function clearPid(): void {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE)
    }
  } catch {
    // Ignore errors
  }
}

// POST - Start the server
export async function POST(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if already running via PID file
    const existingPid = getStoredPid()
    if (existingPid) {
      return NextResponse.json({
        success: true,
        message: "Server already running",
        pid: existingPid,
        alreadyRunning: true,
      })
    }

    // Also check if server is responding (may have been started externally)
    const alreadyResponding = await checkEmergentHealth()
    if (alreadyResponding) {
      return NextResponse.json({
        success: true,
        message: "Server already running (started externally)",
        alreadyRunning: true,
      })
    }

    ensureStorageDir()

    // Open log file for output
    const logFd = fs.openSync(LOG_FILE, "a")

    // Find npx path
    const npxPath = process.platform === "win32" ? "npx.cmd" : "npx"

    // Start the server using npx tsx directly
    const serverProcess = spawn(npxPath, ["tsx", "src/emergent-terminal/server.ts"], {
      cwd: process.cwd(),
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: {
        ...process.env,
        FORCE_COLOR: "1",
      },
    })

    // Close the file descriptor in the parent
    fs.closeSync(logFd)

    // Let the child run independently
    serverProcess.unref()

    if (serverProcess.pid) {
      savePid(serverProcess.pid)

      // Wait for server to start
      let attempts = 0
      const maxAttempts = 10
      let serverOnline = false

      while (attempts < maxAttempts && !serverOnline) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        serverOnline = await checkEmergentHealth()
        attempts++
      }

      if (serverOnline) {
        return NextResponse.json({
          success: true,
          message: "Server started successfully",
          pid: serverProcess.pid,
        })
      } else {
        // Check if process is still running
        try {
          process.kill(serverProcess.pid, 0)
          return NextResponse.json({
            success: true,
            message: "Server starting (may take a moment)",
            pid: serverProcess.pid,
          })
        } catch {
          clearPid()
          // Read last few lines of log
          let logTail = ""
          try {
            const log = fs.readFileSync(LOG_FILE, "utf-8")
            const lines = log.split("\n").filter(Boolean)
            logTail = lines.slice(-5).join("\n")
          } catch {
            // Ignore
          }
          return NextResponse.json(
            {
              error: "Server process exited unexpectedly",
              log: logTail,
            },
            { status: 500 }
          )
        }
      }
    } else {
      return NextResponse.json({ error: "Failed to start server - no PID" }, { status: 500 })
    }
  } catch (error) {
    console.error("[Emergent Start] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to start server",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

// Helper to find and kill process by port
async function killProcessOnPort(port: number): Promise<boolean> {
  const { execSync } = await import("child_process")
  try {
    // Find process using the port (works on Linux/Mac)
    const result = execSync(`lsof -ti :${port} 2>/dev/null || fuser ${port}/tcp 2>/dev/null`, {
      encoding: "utf-8",
    }).trim()

    if (result) {
      const pids = result.split("\n").filter(Boolean)
      for (const pidStr of pids) {
        const pid = parseInt(pidStr.trim(), 10)
        if (!isNaN(pid)) {
          try {
            process.kill(pid, "SIGTERM")
            console.log(`[Emergent Stop] Killed process ${pid} on port ${port}`)
          } catch {
            // Try SIGKILL if SIGTERM fails
            try {
              process.kill(pid, "SIGKILL")
            } catch {
              // Process already dead
            }
          }
        }
      }
      return true
    }
  } catch {
    // lsof/fuser not available or no process found
  }
  return false
}

// DELETE - Stop the server
export async function DELETE(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let killed = false
    const pid = getStoredPid()

    // First try killing by stored PID
    if (pid) {
      try {
        // Try killing the process group first (negative PID)
        process.kill(-pid, "SIGTERM")
        killed = true
      } catch {
        // If that fails, try killing just the process
        try {
          process.kill(pid, "SIGTERM")
          killed = true
        } catch {
          // Process already dead
        }
      }
      clearPid()
    }

    // Also try killing by port in case server was started externally
    const killedByPort = await killProcessOnPort(3100)
    killed = killed || killedByPort

    // Wait a moment and verify it's stopped
    await new Promise((resolve) => setTimeout(resolve, 500))
    const stillRunning = await checkEmergentHealth()

    if (stillRunning) {
      // Force kill by port
      await killProcessOnPort(3100)
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    return NextResponse.json({
      success: true,
      message: killed ? "Server stopped" : "Server not running",
    })
  } catch (error) {
    console.error("[Emergent Stop] Error:", error)
    return NextResponse.json({ error: "Failed to stop server" }, { status: 500 })
  }
}

// GET - Check server status (with caching to prevent rapid polling)
export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Return cached result if still valid
    const now = Date.now()
    if (lastStatusCheck && (now - lastStatusCheck.time) < STATUS_CACHE_TTL_MS) {
      return NextResponse.json(lastStatusCheck.result)
    }

    const pid = getStoredPid()

    // Always check if server is actually responding (it may have been started externally)
    const serverResponding = await checkEmergentHealth()

    const result = {
      running: pid !== null || serverResponding,
      responding: serverResponding,
      pid,
    }

    // Cache the result
    lastStatusCheck = { time: now, result }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[Emergent Status] Error:", error)
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 })
  }
}
