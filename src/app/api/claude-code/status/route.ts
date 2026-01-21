/**
 * Claude Code CLI Status Check API
 * Checks if the Claude CLI is installed and returns version info
 */

import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export async function GET() {
  try {
    // Run claude --version to check if CLI is installed and get version
    const { stdout, stderr } = await execAsync("claude --version", {
      timeout: 10000 // 10 second timeout
    })

    const output = stdout.trim() || stderr.trim()

    // Parse version from output (typically "claude vX.Y.Z" or similar)
    const versionMatch = output.match(/v?(\d+\.\d+\.\d+)/i)
    const version = versionMatch ? versionMatch[1] : output

    return NextResponse.json({
      status: "connected",
      installed: true,
      version,
      output
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    // Check for specific error types
    if (errorMessage.includes("ENOENT") || errorMessage.includes("not found") || errorMessage.includes("command not found")) {
      return NextResponse.json({
        status: "not_installed",
        installed: false,
        error: "Claude CLI is not installed. Install it with: npm install -g @anthropic-ai/claude-cli"
      })
    }

    // Some other error (maybe auth issue, network, etc.)
    return NextResponse.json({
      status: "error",
      installed: false,
      error: errorMessage
    })
  }
}
