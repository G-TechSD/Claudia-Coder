/**
 * Start Application API
 * POST /api/launch-test/start
 */

import { NextRequest, NextResponse } from "next/server"
import { spawn, ChildProcess, exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

// Store running processes globally
declare global {
  // eslint-disable-next-line no-var
  var launchTestProcesses: Map<string, {
    process: ChildProcess
    projectId: string
    port: number
    startedAt: Date
  }>
}

if (!global.launchTestProcesses) {
  global.launchTestProcesses = new Map()
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { projectId, repoPath, projectType, command, port } = body

  if (!projectId || !repoPath || !command || !port) {
    return NextResponse.json(
      { error: "Missing required fields: projectId, repoPath, command, port" },
      { status: 400 }
    )
  }

  try {
    // Check if already running for this project
    const entries = Array.from(global.launchTestProcesses.entries())
    for (const [processId, info] of entries) {
      if (info.projectId === projectId) {
        return NextResponse.json({
          success: true,
          processId,
          url: `http://localhost:${info.port}`,
          message: "App already running"
        })
      }
    }

    // Check if port is in use
    try {
      await execAsync(`lsof -i :${port}`, { timeout: 5000 })
      return NextResponse.json({
        success: false,
        error: `Port ${port} is already in use`
      })
    } catch {
      // Port is free, continue
    }

    // Generate process ID
    const processId = `launch-${projectId}-${Date.now()}`

    // Determine the actual command based on project type
    let finalCommand = command

    // For Flutter web, ensure we use a specific port
    if (projectType === "flutter") {
      finalCommand = `flutter run -d chrome --web-port=${port}`
    }

    console.log(`[Launch] Starting: ${finalCommand} in ${repoPath}`)

    // Start the process
    const childProcess = spawn("bash", ["-c", finalCommand], {
      cwd: repoPath,
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: "development",
        BROWSER: "none" // Prevent auto-opening browser
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true
    })

    // Collect output for debugging
    let stdout = ""
    let stderr = ""

    childProcess.stdout?.on("data", (data: Buffer) => {
      const output = data.toString()
      stdout += output
      console.log(`[Launch ${processId}] stdout:`, output.substring(0, 200))
    })

    childProcess.stderr?.on("data", (data: Buffer) => {
      const output = data.toString()
      stderr += output
      console.log(`[Launch ${processId}] stderr:`, output.substring(0, 200))
    })

    // Store process reference
    global.launchTestProcesses.set(processId, {
      process: childProcess,
      projectId,
      port,
      startedAt: new Date()
    })

    // Handle process exit
    childProcess.on("exit", (code) => {
      console.log(`[Launch ${processId}] Process exited with code ${code}`)
      global.launchTestProcesses.delete(processId)
    })

    childProcess.on("error", (err) => {
      console.error(`[Launch ${processId}] Process error:`, err)
      global.launchTestProcesses.delete(processId)
    })

    // Don't wait for the process - it's a long-running dev server
    // Just give it a moment to start
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Check if process is still running
    if (!childProcess.pid || childProcess.exitCode !== null) {
      global.launchTestProcesses.delete(processId)
      return NextResponse.json({
        success: false,
        error: `Process failed to start: ${stderr || "Unknown error"}`,
        stdout,
        stderr
      })
    }

    // Unref so the process continues after API response
    childProcess.unref()

    return NextResponse.json({
      success: true,
      processId,
      url: `http://localhost:${port}`,
      pid: childProcess.pid
    })

  } catch (error) {
    console.error("[Launch] Error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to start app"
    })
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const projectId = url.searchParams.get("projectId")

  if (projectId) {
    const entries = Array.from(global.launchTestProcesses.entries())
    for (const [processId, info] of entries) {
      if (info.projectId === projectId) {
        return NextResponse.json({
          running: true,
          processId,
          port: info.port,
          startedAt: info.startedAt
        })
      }
    }
    return NextResponse.json({ running: false })
  }

  const processes = Array.from(global.launchTestProcesses.entries()).map(([id, info]) => ({
    processId: id,
    projectId: info.projectId,
    port: info.port,
    startedAt: info.startedAt
  }))

  return NextResponse.json({ processes })
}
