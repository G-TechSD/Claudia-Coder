/**
 * API endpoint for creating and managing temporary Claude Code sessions
 *
 * Creates timestamped folders in ~/claudia-projects/temp-sessions/
 * These can be resumed later from the multi-terminal dashboard
 */

import { NextRequest, NextResponse } from "next/server"
import { mkdir, writeFile, readdir, stat, readFile } from "fs/promises"
import { existsSync } from "fs"
import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import os from "os"

const execAsync = promisify(exec)

// Base directory for all Claudia project working directories
const CLAUDIA_PROJECTS_BASE = process.env.CLAUDIA_PROJECTS_BASE || path.join(os.homedir(), "claudia-projects")

// Temp sessions directory
const TEMP_SESSIONS_DIR = path.join(CLAUDIA_PROJECTS_BASE, "temp-sessions")

/**
 * Generate a timestamped session folder name
 */
function generateSessionFolderName(): string {
  const now = new Date()
  const timestamp = now.toISOString()
    .replace(/T/, '-')
    .replace(/:/g, '')
    .replace(/\..+/, '')
  return `session-${timestamp}`
}

/**
 * POST - Create a new temporary session folder
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { label } = body

    // Ensure base directories exist
    if (!existsSync(CLAUDIA_PROJECTS_BASE)) {
      await mkdir(CLAUDIA_PROJECTS_BASE, { recursive: true })
    }

    if (!existsSync(TEMP_SESSIONS_DIR)) {
      await mkdir(TEMP_SESSIONS_DIR, { recursive: true })
    }

    // Generate unique folder name
    const folderName = generateSessionFolderName()
    const sessionPath = path.join(TEMP_SESSIONS_DIR, folderName)

    // Create the session directory
    await mkdir(sessionPath, { recursive: true })

    // Initialize as git repository
    try {
      await execAsync(`git init`, { cwd: sessionPath })
    } catch (gitError) {
      console.warn(`[temp-session] Failed to initialize git repository: ${gitError instanceof Error ? gitError.message : "Unknown error"}`)
    }

    // Create .claudia/ folder structure
    const claudiaDir = path.join(sessionPath, ".claudia")
    await mkdir(claudiaDir, { recursive: true })
    await mkdir(path.join(claudiaDir, "status"), { recursive: true })
    await mkdir(path.join(claudiaDir, "requests"), { recursive: true })

    // Create session metadata
    const metadata = {
      type: "temp-session",
      label: label || `Quick Session ${folderName}`,
      folderName,
      createdAt: new Date().toISOString(),
      workingDirectory: sessionPath
    }

    await writeFile(
      path.join(claudiaDir, "session.json"),
      JSON.stringify(metadata, null, 2),
      "utf-8"
    )

    // Create a basic README
    const readme = `# Quick Session

Created: ${new Date().toLocaleString()}

This is a temporary Claude Code session folder.

## Usage
This folder was created for a quick Claude Code session without a specific project.
You can use it for experiments, one-off tasks, or quick coding sessions.

## Files
- \`.claudia/\` - Session metadata and status
`

    await writeFile(path.join(sessionPath, "README.md"), readme, "utf-8")

    console.log(`[temp-session] Created temp session: ${sessionPath}`)

    return NextResponse.json({
      success: true,
      sessionId: folderName,
      workingDirectory: sessionPath,
      label: metadata.label,
      createdAt: metadata.createdAt
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create temp session"
    console.error("[temp-session] Error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * GET - List all existing temp sessions
 */
export async function GET() {
  try {
    // Ensure directory exists
    if (!existsSync(TEMP_SESSIONS_DIR)) {
      return NextResponse.json({ sessions: [] })
    }

    const entries = await readdir(TEMP_SESSIONS_DIR, { withFileTypes: true })
    const sessions = []

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith("session-")) {
        continue
      }

      const sessionPath = path.join(TEMP_SESSIONS_DIR, entry.name)
      const metadataPath = path.join(sessionPath, ".claudia", "session.json")

      let metadata: {
        label?: string
        createdAt?: string
        type?: string
      } = {}

      try {
        if (existsSync(metadataPath)) {
          const content = await readFile(metadataPath, "utf-8")
          metadata = JSON.parse(content)
        }
      } catch {
        // Ignore metadata read errors
      }

      // Get folder stats for fallback date
      const stats = await stat(sessionPath)

      sessions.push({
        sessionId: entry.name,
        workingDirectory: sessionPath,
        label: metadata.label || entry.name,
        createdAt: metadata.createdAt || stats.birthtime.toISOString(),
        type: "temp-session"
      })
    }

    // Sort by creation date, newest first
    sessions.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json({ sessions })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list temp sessions"
    console.error("[temp-session] Error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
