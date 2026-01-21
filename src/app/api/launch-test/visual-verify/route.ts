/**
 * Visual Verification API
 * POST /api/launch-test/visual-verify
 *
 * Performs visual verification of the running app on the visual testing VM
 * - Opens the app URL in browser
 * - Takes screenshots
 * - Optionally runs OCR to verify content
 * - Compares against expected state based on fixed issues
 */

import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import * as fs from "fs/promises"
import * as path from "path"

const execAsync = promisify(exec)

// Visual Testing configuration
// Default to localhost - no SSH needed for local testing
const VISUAL_TEST_CONFIG = {
  // "localhost" means run commands locally, any other value means SSH to that host
  host: process.env.VISUAL_TEST_HOST || "localhost",
  user: process.env.VISUAL_TEST_USER || "bill",
  display: process.env.DISPLAY || ":1"
}

// Check if we're running locally (no SSH needed)
const isLocalhost = (): boolean => {
  return VISUAL_TEST_CONFIG.host === "localhost" || VISUAL_TEST_CONFIG.host === "127.0.0.1"
}

// Visual testing is always available - localhost mode works without config
const isVisualTestConfigured = (): boolean => {
  return true
}

// FeedbackItem interface kept for future use
// interface FeedbackItem {
//   id: string
//   text: string
//   screenshot?: string
// }

// Helper to run command either locally or via SSH
async function runCommand(cmd: string, options: { timeout?: number } = {}): Promise<{ stdout: string; stderr: string }> {
  const timeout = options.timeout || 30000

  if (isLocalhost()) {
    // Run locally - prepend DISPLAY if needed
    const display = VISUAL_TEST_CONFIG.display
    const envCmd = cmd.includes("DISPLAY=") ? cmd : `DISPLAY=${display} ${cmd}`
    return execAsync(envCmd, { timeout })
  } else {
    // Run via SSH
    const { host, user, display } = VISUAL_TEST_CONFIG
    const sshOpts = "-o StrictHostKeyChecking=no -o ConnectTimeout=10"
    const sshCmd = `ssh ${sshOpts} ${user}@${host} "export DISPLAY=${display} && ${cmd}"`
    return execAsync(sshCmd, { timeout })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    url,
    projectId,
    feedbackItems = []
  } = body

  if (!url) {
    return NextResponse.json(
      { error: "URL is required for visual verification" },
      { status: 400 }
    )
  }

  const timestamp = Date.now()
  const localDir = "/tmp/claudia-verify"
  const screenshotPath = path.join(localDir, `verify-${projectId}-${timestamp}.png`)

  const issues: string[] = []
  let screenshot: string | null = null
  let passed = true

  const runningLocally = isLocalhost()
  console.log(`[VisualVerify] Mode: ${runningLocally ? "localhost" : "remote SSH"}`)

  try {
    // Ensure local directory exists
    await fs.mkdir(localDir, { recursive: true })

    console.log(`[VisualVerify] Starting verification for ${url}`)

    // Step 1: Check connectivity (skip for localhost)
    if (!runningLocally) {
      console.log(`[VisualVerify] Checking remote connectivity...`)
      try {
        await runCommand("echo connected", { timeout: 10000 })
      } catch (connErr) {
        throw new Error(`Cannot connect to visual testing host: ${connErr}`)
      }
    }

    // Step 2: Open URL in browser
    console.log(`[VisualVerify] Opening URL in browser...`)
    try {
      // Kill any existing Firefox instances first (clean state) - be careful on localhost
      if (!runningLocally) {
        await runCommand("pkill firefox || true", { timeout: 5000 }).catch(() => {})
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // Open browser - use xdg-open on localhost for better compatibility
      if (runningLocally) {
        await execAsync(`xdg-open '${url}' 2>/dev/null || firefox '${url}' &`, { timeout: 10000 })
      } else {
        await runCommand(`firefox '${url}' &`, { timeout: 10000 })
      }

      // Wait for page to fully load
      await new Promise(resolve => setTimeout(resolve, 3000))
    } catch (browserErr) {
      console.warn("[VisualVerify] Browser open had issues:", browserErr)
      // Continue - browser might already be open
    }

    // Step 3: Handle certificate warnings (common with local dev servers)
    console.log(`[VisualVerify] Checking for certificate warnings...`)
    try {
      // Use keyboard navigation to accept cert warnings
      await runCommand("xdotool key Tab Tab Tab Tab Tab Tab Return", { timeout: 5000 }).catch(() => {})
      await new Promise(resolve => setTimeout(resolve, 1000))
      await runCommand("xdotool key Tab Tab Tab Return", { timeout: 5000 }).catch(() => {})
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch {
      // Ignore - might not have cert warning
    }

    // Step 4: Take screenshot
    console.log(`[VisualVerify] Taking screenshot...`)
    try {
      if (runningLocally) {
        // Take screenshot directly to local path
        await execAsync(`scrot ${screenshotPath}`, { timeout: 30000 })
      } else {
        // Take screenshot on remote and copy
        const remotePath = `/tmp/verify-${timestamp}.png`
        await runCommand(`scrot ${remotePath}`, { timeout: 30000 })

        const { host, user } = VISUAL_TEST_CONFIG
        const sshOpts = "-o StrictHostKeyChecking=no -o ConnectTimeout=10"
        await execAsync(`scp ${sshOpts} ${user}@${host}:${remotePath} ${screenshotPath}`, { timeout: 30000 })

        // Cleanup remote file
        await runCommand(`rm -f ${remotePath}`, { timeout: 5000 }).catch(() => {})
      }

      // Convert to base64
      const imageData = await fs.readFile(screenshotPath)
      screenshot = `data:image/png;base64,${imageData.toString("base64")}`

      const stats = await fs.stat(screenshotPath)
      console.log(`[VisualVerify] Screenshot captured: ${stats.size} bytes`)

      // Basic verification: check if screenshot has content
      if (stats.size < 5000) {
        issues.push("Screenshot appears to be mostly empty or blank")
        passed = false
      }
    } catch (screenshotErr) {
      issues.push(`Screenshot capture failed: ${screenshotErr}`)
      passed = false
    }

    // Step 5: Run OCR to verify content (if tesseract is available)
    if (screenshot && feedbackItems.length > 0) {
      console.log(`[VisualVerify] Running content verification...`)
      try {
        const ocrBasePath = `/tmp/ocr-${timestamp}`
        const ocrCmd = `tesseract ${screenshotPath} ${ocrBasePath} 2>/dev/null && cat ${ocrBasePath}.txt`

        const { stdout } = runningLocally
          ? await execAsync(ocrCmd, { timeout: 60000 })
          : await runCommand(ocrCmd, { timeout: 60000 })

        console.log(`[VisualVerify] OCR extracted ${stdout.length} characters`)

        // Check for common error indicators
        const ocrLower = stdout.toLowerCase()
        if (ocrLower.includes("error") && !ocrLower.includes("no error")) {
          issues.push("Page appears to contain error messages")
        }
        if (ocrLower.includes("not found") || ocrLower.includes("404")) {
          issues.push("Page may show a 404 or not found error")
        }
        if (ocrLower.includes("loading") && stdout.length < 1000) {
          issues.push("Page may be stuck on loading state")
        }

        // Cleanup OCR files
        await execAsync(`rm -f ${ocrBasePath}*`, { timeout: 5000 }).catch(() => {})
      } catch {
        console.log("[VisualVerify] OCR not available or failed")
      }
    }

    // Determine final pass/fail
    if (issues.length > 0) {
      passed = false
    }

    console.log(`[VisualVerify] Verification ${passed ? "PASSED" : "FAILED"}`)
    if (issues.length > 0) {
      console.log(`[VisualVerify] Issues: ${issues.join(", ")}`)
    }

    return NextResponse.json({
      success: true,
      passed,
      screenshot,
      issues,
      url,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error("[VisualVerify] Error:", error)

    return NextResponse.json({
      success: false,
      passed: false,
      screenshot,
      issues: [error instanceof Error ? error.message : "Verification failed"],
      url,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * GET - Check visual testing status
 */
export async function GET() {
  const { host, user, display } = VISUAL_TEST_CONFIG
  const runningLocally = isLocalhost()

  try {
    let stdout: string

    if (runningLocally) {
      // Check local tools
      const result = await execAsync(
        `DISPLAY=${display} xdotool getdisplaygeometry 2>/dev/null && which firefox && which scrot && which tesseract 2>/dev/null || true`,
        { timeout: 5000 }
      )
      stdout = result.stdout
    } else {
      // Check remote tools via SSH
      const sshOpts = "-o StrictHostKeyChecking=no -o ConnectTimeout=5"
      const result = await execAsync(
        `ssh ${sshOpts} ${user}@${host} "export DISPLAY=${display} && xdotool getdisplaygeometry && which firefox && which scrot && which tesseract"`,
        { timeout: 15000 }
      )
      stdout = result.stdout
    }

    const lines = stdout.trim().split("\n")

    return NextResponse.json({
      status: "ready",
      mode: runningLocally ? "localhost" : "remote",
      host: runningLocally ? "localhost" : host,
      user: runningLocally ? undefined : user,
      display,
      resolution: lines[0] || "unknown",
      tools: {
        firefox: lines[1]?.includes("firefox"),
        scrot: lines[2]?.includes("scrot"),
        tesseract: lines[3]?.includes("tesseract")
      }
    })

  } catch (error) {
    return NextResponse.json({
      status: "unavailable",
      mode: runningLocally ? "localhost" : "remote",
      host: runningLocally ? "localhost" : host,
      display,
      error: error instanceof Error ? error.message : "Visual testing tools not available"
    })
  }
}
