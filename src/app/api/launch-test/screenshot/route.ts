/**
 * Screenshot Capture API
 * POST /api/launch-test/screenshot
 *
 * Captures screenshots from the visual testing VM
 */

import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import * as fs from "fs/promises"
import * as path from "path"

const execAsync = promisify(exec)

// Visual Testing VM configuration
// NOTE: VISUAL_TEST_HOST must be set via environment variable - no hardcoded fallback
const VISUAL_TEST_VM = {
  host: process.env.VISUAL_TEST_HOST || "",
  user: process.env.VISUAL_TEST_USER || "localhost",
  sshKey: process.env.VISUAL_TEST_SSH_KEY || "~/.ssh/id_rsa",
  display: ":1"
}

// Check if visual testing VM is configured
const isVisualTestConfigured = (): boolean => {
  return !!process.env.VISUAL_TEST_HOST && process.env.VISUAL_TEST_HOST.length > 0
}

export async function POST(request: NextRequest) {
  // Check if visual testing is configured
  if (!isVisualTestConfigured()) {
    return NextResponse.json({
      success: false,
      error: "Visual testing VM not configured. Set VISUAL_TEST_HOST environment variable.",
      notConfigured: true
    }, { status: 503 })
  }

  const body = await request.json()
  const {
    vmHost = VISUAL_TEST_VM.host,
    vmUser = VISUAL_TEST_VM.user,
    display = VISUAL_TEST_VM.display,
    url
  } = body

  const timestamp = Date.now()
  const remotePath = `/tmp/screenshot-${timestamp}.png`
  const localDir = "/tmp/claudia-screenshots"
  const localPath = path.join(localDir, `screenshot-${timestamp}.png`)

  try {
    // Ensure local directory exists
    await fs.mkdir(localDir, { recursive: true })

    // Build SSH command options
    const sshOpts = "-o StrictHostKeyChecking=no -o ConnectTimeout=10"

    // If URL provided, open it in browser first
    if (url) {
      console.log(`[Screenshot] Opening URL: ${url}`)
      try {
        // Try to open URL in Firefox on the VM
        await execAsync(
          `ssh ${sshOpts} ${vmUser}@${vmHost} "export DISPLAY=${display} && firefox --new-window '${url}' &"`,
          { timeout: 15000 }
        )
        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 3000))
      } catch (err) {
        console.warn("[Screenshot] Could not open URL:", err)
        // Continue anyway - maybe the page is already open
      }
    }

    // Take screenshot on remote VM using scrot
    console.log(`[Screenshot] Taking screenshot on ${vmHost}`)
    const screenshotCmd = `ssh ${sshOpts} ${vmUser}@${vmHost} "export DISPLAY=${display} && scrot ${remotePath}"`

    try {
      await execAsync(screenshotCmd, { timeout: 30000 })
    } catch {
      // Try alternative method using gnome-screenshot
      console.warn("[Screenshot] scrot failed, trying gnome-screenshot")
      const altCmd = `ssh ${sshOpts} ${vmUser}@${vmHost} "export DISPLAY=${display} && gnome-screenshot -f ${remotePath}"`
      await execAsync(altCmd, { timeout: 30000 })
    }

    // Copy screenshot to local machine
    console.log(`[Screenshot] Copying to local: ${localPath}`)
    const scpCmd = `scp ${sshOpts} ${vmUser}@${vmHost}:${remotePath} ${localPath}`
    await execAsync(scpCmd, { timeout: 30000 })

    // Read and convert to base64
    const imageData = await fs.readFile(localPath)
    const base64 = `data:image/png;base64,${imageData.toString("base64")}`

    // Get file size for logging
    const stats = await fs.stat(localPath)
    console.log(`[Screenshot] Captured ${stats.size} bytes`)

    // Cleanup remote file
    await execAsync(
      `ssh ${sshOpts} ${vmUser}@${vmHost} "rm -f ${remotePath}"`,
      { timeout: 5000 }
    ).catch(() => {})

    // Cleanup local file (optional - keep for debugging)
    // await fs.unlink(localPath).catch(() => {})

    return NextResponse.json({
      success: true,
      screenshot: base64,
      size: stats.size,
      path: localPath
    })

  } catch (error) {
    console.error("[Screenshot] Error:", error)

    // Attempt cleanup
    try {
      await execAsync(
        `ssh -o StrictHostKeyChecking=no ${vmUser}@${vmHost} "rm -f ${remotePath}"`,
        { timeout: 5000 }
      )
    } catch {
      // Ignore cleanup errors
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Screenshot capture failed",
      details: error instanceof Error ? error.stack : undefined
    })
  }
}

/**
 * GET - Check VM connectivity
 */
export async function GET() {
  // Check if visual testing is configured
  if (!isVisualTestConfigured()) {
    return NextResponse.json({
      connected: false,
      configured: false,
      error: "Visual testing VM not configured. Set VISUAL_TEST_HOST environment variable."
    })
  }

  const { host, user, display } = VISUAL_TEST_VM

  try {
    // Test SSH connection
    const result = await execAsync(
      `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${user}@${host} "echo ok && xdotool getdisplaygeometry"`,
      { timeout: 10000 }
    )

    const lines = result.stdout.trim().split("\n")
    const displayInfo = lines[1] || "unknown"

    return NextResponse.json({
      connected: true,
      host,
      user,
      display,
      resolution: displayInfo
    })

  } catch (error) {
    return NextResponse.json({
      connected: false,
      host,
      user,
      display,
      error: error instanceof Error ? error.message : "Connection failed"
    })
  }
}
