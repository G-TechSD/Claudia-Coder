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

// Visual Testing VM configuration
// NOTE: VISUAL_TEST_HOST must be set via environment variable - no hardcoded fallback
const VISUAL_TEST_VM = {
  host: process.env.VISUAL_TEST_HOST || "",
  user: process.env.VISUAL_TEST_USER || "localhost",
  display: ":1"
}

// Check if visual testing VM is configured
const isVisualTestConfigured = (): boolean => {
  return !!process.env.VISUAL_TEST_HOST && process.env.VISUAL_TEST_HOST.length > 0
}

// FeedbackItem interface kept for future use
// interface FeedbackItem {
//   id: string
//   text: string
//   screenshot?: string
// }

export async function POST(request: NextRequest) {
  // Check if visual testing is configured
  if (!isVisualTestConfigured()) {
    return NextResponse.json({
      success: false,
      passed: false,
      error: "Visual testing VM not configured. Set VISUAL_TEST_HOST environment variable.",
      notConfigured: true,
      issues: ["Visual testing VM not configured"]
    }, { status: 503 })
  }

  const body = await request.json()
  const {
    vmHost = VISUAL_TEST_VM.host,
    vmUser = VISUAL_TEST_VM.user,
    display = VISUAL_TEST_VM.display,
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
  const sshOpts = "-o StrictHostKeyChecking=no -o ConnectTimeout=10"
  const localDir = "/tmp/claudia-verify"
  const screenshotPath = path.join(localDir, `verify-${projectId}-${timestamp}.png`)
  const remotePath = `/tmp/verify-${timestamp}.png`

  const issues: string[] = []
  let screenshot: string | null = null
  let passed = true

  try {
    // Ensure local directory exists
    await fs.mkdir(localDir, { recursive: true })

    console.log(`[VisualVerify] Starting verification for ${url}`)

    // Step 1: Check VM connectivity
    console.log(`[VisualVerify] Checking VM connectivity...`)
    try {
      await execAsync(
        `ssh ${sshOpts} ${vmUser}@${vmHost} "echo connected"`,
        { timeout: 10000 }
      )
    } catch (connErr) {
      throw new Error(`Cannot connect to visual testing VM: ${connErr}`)
    }

    // Step 2: Open URL in browser
    console.log(`[VisualVerify] Opening URL in browser...`)
    try {
      // Kill any existing Firefox instances first (clean state)
      await execAsync(
        `ssh ${sshOpts} ${vmUser}@${vmHost} "pkill firefox || true"`,
        { timeout: 5000 }
      ).catch(() => {})

      await new Promise(resolve => setTimeout(resolve, 1000))

      // Open fresh browser
      await execAsync(
        `ssh ${sshOpts} ${vmUser}@${vmHost} "export DISPLAY=${display} && firefox '${url}' &"`,
        { timeout: 10000 }
      )

      // Wait for page to fully load
      await new Promise(resolve => setTimeout(resolve, 5000))
    } catch (browserErr) {
      console.warn("[VisualVerify] Browser open had issues:", browserErr)
      // Continue - browser might already be open
    }

    // Step 3: Handle certificate warnings (common with local dev servers)
    console.log(`[VisualVerify] Checking for certificate warnings...`)
    try {
      // Use keyboard navigation to accept cert warnings
      // This is a common pattern for self-signed certs
      await execAsync(
        `ssh ${sshOpts} ${vmUser}@${vmHost} "export DISPLAY=${display} && xdotool key Tab Tab Tab Tab Tab Tab Return && sleep 1 && xdotool key Tab Tab Tab Return"`,
        { timeout: 10000 }
      ).catch(() => {})

      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch {
      // Ignore - might not have cert warning
    }

    // Step 4: Take screenshot
    console.log(`[VisualVerify] Taking screenshot...`)
    try {
      await execAsync(
        `ssh ${sshOpts} ${vmUser}@${vmHost} "export DISPLAY=${display} && scrot ${remotePath}"`,
        { timeout: 30000 }
      )

      // Copy to local
      await execAsync(
        `scp ${sshOpts} ${vmUser}@${vmHost}:${remotePath} ${screenshotPath}`,
        { timeout: 30000 }
      )

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
        // Run tesseract on remote VM
        const ocrOutput = `/tmp/ocr-${timestamp}.txt`
        await execAsync(
          `ssh ${sshOpts} ${vmUser}@${vmHost} "tesseract ${remotePath} ${ocrOutput.replace('.txt', '')} 2>/dev/null && cat ${ocrOutput}"`,
          { timeout: 60000 }
        ).then(({ stdout }) => {
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
        }).catch(() => {
          console.log("[VisualVerify] OCR not available or failed")
        })
      } catch {
        // OCR is optional
      }
    }

    // Step 6: Cleanup
    await execAsync(
      `ssh ${sshOpts} ${vmUser}@${vmHost} "rm -f ${remotePath} /tmp/ocr-${timestamp}*"`,
      { timeout: 5000 }
    ).catch(() => {})

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
 * GET - Check visual testing VM status
 */
export async function GET() {
  // Check if visual testing is configured
  if (!isVisualTestConfigured()) {
    return NextResponse.json({
      status: "not_configured",
      configured: false,
      error: "Visual testing VM not configured. Set VISUAL_TEST_HOST environment variable."
    })
  }

  const { host, user, display } = VISUAL_TEST_VM
  const sshOpts = "-o StrictHostKeyChecking=no -o ConnectTimeout=5"

  try {
    const { stdout } = await execAsync(
      `ssh ${sshOpts} ${user}@${host} "export DISPLAY=${display} && xdotool getdisplaygeometry && which firefox && which scrot && which tesseract"`,
      { timeout: 15000 }
    )

    const lines = stdout.trim().split("\n")

    return NextResponse.json({
      status: "ready",
      host,
      user,
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
      host,
      user,
      display,
      error: error instanceof Error ? error.message : "Cannot connect to VM"
    })
  }
}
