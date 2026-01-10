/**
 * Launch & Test API
 *
 * Unified endpoint for:
 * - Project type detection
 * - App launching and stopping
 * - Screenshot capture
 * - Visual verification on remote VM
 * - Feedback to work packet conversion
 *
 * Note: Port 3000 is reserved for Claudia Coder and should not be used.
 */

import { NextRequest, NextResponse } from "next/server"
import { exec, spawn, ChildProcess } from "child_process"
import { promisify } from "util"
import * as fs from "fs/promises"
import * as path from "path"
import { validatePort, getSuggestedPorts } from "@/lib/execution/port-config"

const execAsync = promisify(exec)

// Visual Testing VM configuration
const VISUAL_TEST_VM = {
  host: process.env.VISUAL_TEST_HOST || "172.18.22.114",
  user: process.env.VISUAL_TEST_USER || "johnny-test",
  sshKey: process.env.VISUAL_TEST_SSH_KEY || "~/.ssh/id_rsa",
  display: ":1"
}

// Store running processes
const runningProcesses = new Map<string, {
  process: ChildProcess
  projectId: string
  port: number
  startedAt: Date
}>()

// Project type detection patterns
const PROJECT_TYPES = {
  flutter: {
    files: ["pubspec.yaml"],
    packageJsonDeps: []
  },
  nextjs: {
    files: ["next.config.js", "next.config.mjs", "next.config.ts"],
    packageJsonDeps: ["next"]
  },
  react: {
    files: [],
    packageJsonDeps: ["react", "react-dom"]
  },
  vue: {
    files: ["vue.config.js", "src/App.vue"],
    packageJsonDeps: ["vue"]
  },
  django: {
    files: ["manage.py", "settings.py"],
    packageJsonDeps: []
  },
  fastapi: {
    files: [],
    packageJsonDeps: [],
    pythonImports: ["fastapi"]
  },
  node: {
    files: ["server.js", "app.js", "index.js"],
    packageJsonDeps: ["express"]
  },
  python: {
    files: ["main.py", "app.py", "requirements.txt"],
    packageJsonDeps: []
  }
}

/**
 * GET - Check status of running apps
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const projectId = url.searchParams.get("projectId")

  if (projectId) {
    // Find process for this project
    const entries = Array.from(runningProcesses.entries())
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

  // Return all running processes
  const processes = Array.from(runningProcesses.entries()).map(([id, info]) => ({
    processId: id,
    projectId: info.projectId,
    port: info.port,
    startedAt: info.startedAt
  }))

  return NextResponse.json({ processes })
}

/**
 * POST - Various launch-test operations
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { action } = body

  switch (action) {
    case "detect":
      return handleDetect(body)
    case "start":
      return handleStart(body)
    case "stop":
      return handleStop(body)
    case "screenshot":
      return handleScreenshot(body)
    case "build":
      return handleBuild(body)
    case "visual-verify":
      return handleVisualVerify(body)
    case "create-packets":
      return handleCreatePackets(body)
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }
}

/**
 * Detect project type from file structure
 */
async function handleDetect(body: { repoPath: string; projectId: string }) {
  const { repoPath } = body

  try {
    // Check for various project type indicators
    for (const [typeName, config] of Object.entries(PROJECT_TYPES)) {
      // Check for indicator files
      for (const file of config.files) {
        try {
          await fs.access(path.join(repoPath, file))
          return NextResponse.json({ projectType: typeName })
        } catch {
          // File doesn't exist, continue
        }
      }
    }

    // Check package.json for dependencies
    try {
      const packageJsonPath = path.join(repoPath, "package.json")
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"))
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      }

      for (const [typeName, config] of Object.entries(PROJECT_TYPES)) {
        for (const dep of config.packageJsonDeps) {
          if (allDeps[dep]) {
            return NextResponse.json({ projectType: typeName })
          }
        }
      }

      // Default to node if package.json exists
      return NextResponse.json({ projectType: "node" })
    } catch {
      // No package.json
    }

    // Check for Python projects
    try {
      await fs.access(path.join(repoPath, "requirements.txt"))
      return NextResponse.json({ projectType: "python" })
    } catch {
      // Not a Python project
    }

    return NextResponse.json({ projectType: null })
  } catch (error) {
    return NextResponse.json({
      projectType: null,
      error: error instanceof Error ? error.message : "Detection failed"
    })
  }
}

/**
 * Start the application
 */
async function handleStart(body: {
  projectId: string
  repoPath: string
  projectType: string
  command: string
  port: number
}) {
  const { projectId, repoPath, command, port } = body

  try {
    // Check if already running
    const entries = Array.from(runningProcesses.entries())
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

    // Check if port is reserved by Claudia or other services
    const portValidation = validatePort(port)
    if (!portValidation.valid) {
      return NextResponse.json({
        success: false,
        error: portValidation.error,
        isReserved: true,
        suggestedPorts: portValidation.suggestedPorts || getSuggestedPorts(port)
      })
    }

    // Check if port is in use by another process
    try {
      await execAsync(`lsof -i :${port}`, { timeout: 5000 })
      return NextResponse.json({
        success: false,
        error: `Port ${port} is already in use by another process`,
        isInUse: true,
        suggestedPorts: getSuggestedPorts(port)
      })
    } catch {
      // Port is free, continue
    }

    // Start the process
    const processId = `launch-${projectId}-${Date.now()}`

    const childProcess = spawn("bash", ["-c", command], {
      cwd: repoPath,
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: "development"
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true
    })

    // Store process reference
    runningProcesses.set(processId, {
      process: childProcess,
      projectId,
      port,
      startedAt: new Date()
    })

    // Handle process exit
    childProcess.on("exit", () => {
      runningProcesses.delete(processId)
    })

    childProcess.on("error", (err) => {
      console.error(`[Launch] Process error for ${projectId}:`, err)
      runningProcesses.delete(processId)
    })

    // Wait a bit for the app to start
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Check if process is still running
    if (!childProcess.pid) {
      return NextResponse.json({
        success: false,
        error: "Process failed to start"
      })
    }

    return NextResponse.json({
      success: true,
      processId,
      url: `http://localhost:${port}`,
      pid: childProcess.pid
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to start app"
    })
  }
}

/**
 * Stop the application
 */
async function handleStop(body: { processId: string }) {
  const { processId } = body

  const processInfo = runningProcesses.get(processId)
  if (!processInfo) {
    return NextResponse.json({
      success: false,
      error: "Process not found"
    })
  }

  try {
    // Kill the process group
    if (processInfo.process.pid) {
      process.kill(-processInfo.process.pid, "SIGTERM")
    }

    runningProcesses.delete(processId)

    return NextResponse.json({ success: true })
  } catch (error) {
    // Force kill if graceful shutdown fails
    try {
      if (processInfo.process.pid) {
        process.kill(-processInfo.process.pid, "SIGKILL")
      }
      runningProcesses.delete(processId)
      return NextResponse.json({ success: true })
    } catch {
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to stop"
      })
    }
  }
}

/**
 * Capture screenshot from visual testing VM
 */
async function handleScreenshot(body: {
  vmHost?: string
  vmUser?: string
  display?: string
  url?: string
}) {
  const host = body.vmHost || VISUAL_TEST_VM.host
  const user = body.vmUser || VISUAL_TEST_VM.user
  const display = body.display || VISUAL_TEST_VM.display

  try {
    const timestamp = Date.now()
    const remotePath = `/tmp/screenshot-${timestamp}.png`
    const localPath = `/tmp/screenshots/screenshot-${timestamp}.png`

    // Ensure local directory exists
    await fs.mkdir("/tmp/screenshots", { recursive: true })

    // Take screenshot on remote VM
    const screenshotCmd = `ssh -o StrictHostKeyChecking=no ${user}@${host} "export DISPLAY=${display} && scrot ${remotePath}"`
    await execAsync(screenshotCmd, { timeout: 30000 })

    // Copy screenshot to local
    const scpCmd = `scp -o StrictHostKeyChecking=no ${user}@${host}:${remotePath} ${localPath}`
    await execAsync(scpCmd, { timeout: 30000 })

    // Read and base64 encode
    const imageData = await fs.readFile(localPath)
    const base64 = `data:image/png;base64,${imageData.toString("base64")}`

    // Cleanup
    await execAsync(`ssh -o StrictHostKeyChecking=no ${user}@${host} "rm -f ${remotePath}"`, { timeout: 5000 }).catch(() => {})
    await fs.unlink(localPath).catch(() => {})

    return NextResponse.json({
      success: true,
      screenshot: base64
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Screenshot failed"
    })
  }
}

/**
 * Build the application
 */
async function handleBuild(body: {
  projectId: string
  repoPath: string
  projectType: string
  command: string
}) {
  const { repoPath, command } = body

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: repoPath,
      timeout: 300000, // 5 minute timeout
      maxBuffer: 50 * 1024 * 1024
    })

    return NextResponse.json({
      success: true,
      output: stdout + stderr
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Build failed",
      output: (error as { stdout?: string; stderr?: string }).stdout ||
              (error as { stderr?: string }).stderr || ""
    })
  }
}

/**
 * Run visual verification on testing VM
 */
async function handleVisualVerify(body: {
  vmHost?: string
  vmUser?: string
  display?: string
  url: string
  projectId: string
  feedbackItems: Array<{ id: string; text: string }>
}) {
  const host = body.vmHost || VISUAL_TEST_VM.host
  const user = body.vmUser || VISUAL_TEST_VM.user
  const display = body.display || VISUAL_TEST_VM.display
  const { url, feedbackItems } = body

  try {
    // Open URL in browser on VM
    const openCmd = `ssh -o StrictHostKeyChecking=no ${user}@${host} "export DISPLAY=${display} && firefox --new-window '${url}' &"`
    await execAsync(openCmd, { timeout: 10000 }).catch(() => {})

    // Wait for page load
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Take verification screenshot
    const timestamp = Date.now()
    const remotePath = `/tmp/verify-${timestamp}.png`
    const localPath = `/tmp/screenshots/verify-${timestamp}.png`

    await fs.mkdir("/tmp/screenshots", { recursive: true })

    const screenshotCmd = `ssh -o StrictHostKeyChecking=no ${user}@${host} "export DISPLAY=${display} && scrot ${remotePath}"`
    await execAsync(screenshotCmd, { timeout: 30000 })

    const scpCmd = `scp -o StrictHostKeyChecking=no ${user}@${host}:${remotePath} ${localPath}`
    await execAsync(scpCmd, { timeout: 30000 })

    const imageData = await fs.readFile(localPath)
    const base64 = `data:image/png;base64,${imageData.toString("base64")}`

    // Basic verification - check if page loaded (non-white screenshot)
    const stats = await fs.stat(localPath)
    const passed = stats.size > 10000 // Reasonable size indicates content loaded

    // Cleanup
    await execAsync(`ssh -o StrictHostKeyChecking=no ${user}@${host} "rm -f ${remotePath}"`, { timeout: 5000 }).catch(() => {})
    await fs.unlink(localPath).catch(() => {})

    // TODO: Implement more sophisticated visual checks
    // - OCR to verify text content
    // - Element detection for specific UI components
    // - Comparison with reference screenshots

    return NextResponse.json({
      success: true,
      passed,
      screenshot: base64,
      issues: passed ? [] : ["Page appears to be empty or not fully loaded"]
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      passed: false,
      error: error instanceof Error ? error.message : "Verification failed",
      issues: [error instanceof Error ? error.message : "Unknown error"]
    })
  }
}

/**
 * Convert feedback items to work packets
 */
async function handleCreatePackets(body: {
  projectId: string
  projectName: string
  feedbackItems: Array<{
    id: string
    text: string
    screenshot?: string
    timestamp: string
  }>
}) {
  const { projectId, projectName, feedbackItems } = body

  try {
    const packets = feedbackItems.map((feedback, index) => {
      // Parse feedback to determine type
      const text = feedback.text.toLowerCase()
      const isBug = text.includes("error") || text.includes("broken") ||
                    text.includes("crash") || text.includes("doesn't work") ||
                    text.includes("bug") || text.includes("fail")
      const isStyle = text.includes("color") || text.includes("font") ||
                      text.includes("size") || text.includes("spacing") ||
                      text.includes("layout") || text.includes("design") ||
                      text.includes("look") || text.includes("ugly")

      const type = isBug ? "bug_fix" : isStyle ? "ui_polish" : "enhancement"

      return {
        id: `feedback-packet-${Date.now()}-${index}`,
        feedbackId: feedback.id,
        title: `Fix: ${feedback.text.substring(0, 50)}${feedback.text.length > 50 ? "..." : ""}`,
        description: `User reported issue: "${feedback.text}"${
          feedback.screenshot ? "\n\nScreenshot attached for reference." : ""
        }`,
        type,
        priority: isBug ? "high" : "medium",
        tasks: [
          {
            id: `task-1`,
            description: `Investigate the reported issue: "${feedback.text}"`,
            completed: false
          },
          {
            id: `task-2`,
            description: "Implement fix based on investigation",
            completed: false
          },
          {
            id: `task-3`,
            description: "Verify fix resolves the reported issue",
            completed: false
          }
        ],
        acceptanceCriteria: [
          `The reported issue "${feedback.text.substring(0, 50)}..." is resolved`,
          "No regressions introduced",
          "Visual verification passes"
        ]
      }
    })

    // Store packets in localStorage via API response
    // (actual storage happens client-side)
    return NextResponse.json({
      success: true,
      packets,
      count: packets.length
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create packets",
      packets: []
    })
  }
}
