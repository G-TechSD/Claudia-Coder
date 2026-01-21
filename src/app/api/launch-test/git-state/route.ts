/**
 * Git State API
 * POST /api/launch-test/git-state
 *
 * Returns the current git commit hash for a project,
 * used to enable rollback functionality after auto-fix operations.
 */

import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { repoPath } = body

  if (!repoPath) {
    return NextResponse.json(
      { error: "repoPath is required" },
      { status: 400 }
    )
  }

  // Expand ~ to home directory
  const expandedPath = repoPath.replace(/^~/, process.env.HOME || "/home/bill")

  console.log(`[GitState] Getting current commit hash for: ${expandedPath}`)

  try {
    // Get the current commit hash
    const { stdout: commitHash } = await execAsync("git rev-parse HEAD", {
      cwd: expandedPath,
      timeout: 10000
    })

    // Also get the commit message for display
    const { stdout: commitMessage } = await execAsync("git log -1 --pretty=%B", {
      cwd: expandedPath,
      timeout: 10000
    })

    // Check if there are uncommitted changes
    const { stdout: statusOutput } = await execAsync("git status --porcelain", {
      cwd: expandedPath,
      timeout: 10000
    })

    const hasUncommittedChanges = statusOutput.trim().length > 0

    return NextResponse.json({
      success: true,
      commitHash: commitHash.trim(),
      commitMessage: commitMessage.trim().split("\n")[0], // First line only
      hasUncommittedChanges,
      repoPath: expandedPath
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(`[GitState] Error getting git state: ${message}`)

    // Check if this is a git repo at all
    if (message.includes("not a git repository")) {
      return NextResponse.json({
        success: false,
        error: "Not a git repository",
        isGitRepo: false
      })
    }

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
