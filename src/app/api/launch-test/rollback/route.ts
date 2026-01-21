/**
 * Git Rollback API
 * POST /api/launch-test/rollback
 *
 * Reverts the repository to a specified commit hash,
 * used when auto-fix operations break the application.
 */

import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { repoPath, commitHash } = body

  if (!repoPath) {
    return NextResponse.json(
      { error: "repoPath is required" },
      { status: 400 }
    )
  }

  if (!commitHash) {
    return NextResponse.json(
      { error: "commitHash is required" },
      { status: 400 }
    )
  }

  // Validate commit hash format (prevent command injection)
  if (!/^[a-f0-9]{7,40}$/i.test(commitHash)) {
    return NextResponse.json(
      { error: "Invalid commit hash format" },
      { status: 400 }
    )
  }

  // Expand ~ to home directory
  const expandedPath = repoPath.replace(/^~/, process.env.HOME || "/home/bill")

  console.log(`[Rollback] Rolling back ${expandedPath} to commit ${commitHash}`)

  try {
    // First, verify the commit exists
    await execAsync(`git cat-file -e ${commitHash}`, {
      cwd: expandedPath,
      timeout: 10000
    })

    // Get current state for logging
    const { stdout: currentHash } = await execAsync("git rev-parse HEAD", {
      cwd: expandedPath,
      timeout: 10000
    })

    console.log(`[Rollback] Current commit: ${currentHash.trim()}`)
    console.log(`[Rollback] Target commit: ${commitHash}`)

    // Perform a hard reset to the target commit
    // This discards all changes since that commit
    const { stdout: resetOutput, stderr: resetError } = await execAsync(
      `git reset --hard ${commitHash}`,
      {
        cwd: expandedPath,
        timeout: 30000
      }
    )

    console.log(`[Rollback] Reset output: ${resetOutput}`)
    if (resetError) {
      console.log(`[Rollback] Reset stderr: ${resetError}`)
    }

    // Get the commit message for confirmation
    const { stdout: commitMessage } = await execAsync("git log -1 --pretty=%B", {
      cwd: expandedPath,
      timeout: 10000
    })

    return NextResponse.json({
      success: true,
      message: `Successfully rolled back to commit ${commitHash}`,
      commitHash: commitHash,
      commitMessage: commitMessage.trim().split("\n")[0],
      previousCommit: currentHash.trim(),
      repoPath: expandedPath
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(`[Rollback] Error during rollback: ${message}`)

    // Provide specific error messages
    if (message.includes("Not a valid object name")) {
      return NextResponse.json(
        { success: false, error: `Commit ${commitHash} does not exist in this repository` },
        { status: 400 }
      )
    }

    if (message.includes("not a git repository")) {
      return NextResponse.json(
        { success: false, error: "Not a git repository" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
