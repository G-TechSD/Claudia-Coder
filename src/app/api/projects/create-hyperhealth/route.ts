/**
 * API endpoint to create the HyperHealth project
 *
 * POST /api/projects/create-hyperhealth
 *
 * This endpoint creates a pre-configured HyperHealth project and returns the
 * project data for the client to store in localStorage using createProject().
 *
 * Since localStorage is only accessible client-side, this API returns the
 * fully configured project data that the client should save.
 */

import { NextResponse } from "next/server"
import { mkdir } from "fs/promises"
import { existsSync } from "fs"

// UUID generator that works in all contexts
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// HyperHealth project configuration
const HYPERHEALTH_CONFIG = {
  name: "HyperHealth",
  description: "Personal health tracking and wellness companion app",
  workingDirectory: "/home/bill/claudia-projects/hyperhealth-08549d59",
  tags: ["health", "mobile", "nextjs", "typescript"],
  priority: "high" as const,
  status: "planning" as const
}

interface HyperHealthProject {
  id: string
  name: string
  description: string
  status: "planning" | "active" | "paused" | "completed" | "archived"
  priority: "low" | "medium" | "high" | "critical"
  createdAt: string
  updatedAt: string
  workingDirectory: string
  basePath: string
  repos: Array<{
    provider: "gitlab" | "github" | "local"
    id: number
    name: string
    path: string
    url: string
    localPath?: string
  }>
  packetIds: string[]
  tags: string[]
}

/**
 * POST - Create the HyperHealth project
 *
 * Returns the complete project object ready to be stored in localStorage.
 * The client should use createProject() or equivalent to persist this data.
 */
export async function POST() {
  try {
    const now = new Date().toISOString()
    const id = generateUUID()

    // Create the HyperHealth project object
    const project: HyperHealthProject = {
      id,
      name: HYPERHEALTH_CONFIG.name,
      description: HYPERHEALTH_CONFIG.description,
      status: HYPERHEALTH_CONFIG.status,
      priority: HYPERHEALTH_CONFIG.priority,
      createdAt: now,
      updatedAt: now,
      workingDirectory: HYPERHEALTH_CONFIG.workingDirectory,
      basePath: HYPERHEALTH_CONFIG.workingDirectory,
      repos: [],
      packetIds: [],
      tags: HYPERHEALTH_CONFIG.tags
    }

    // Ensure the working directory exists on the filesystem
    const workingDir = HYPERHEALTH_CONFIG.workingDirectory

    // Ensure base directory exists
    const baseDir = "/home/bill/claudia-projects"
    if (!existsSync(baseDir)) {
      await mkdir(baseDir, { recursive: true })
      console.log(`[create-hyperhealth] Created base directory: ${baseDir}`)
    }

    // Create the working directory if it doesn't exist
    let directoryCreated = false
    if (!existsSync(workingDir)) {
      await mkdir(workingDir, { recursive: true })
      directoryCreated = true
      console.log(`[create-hyperhealth] Created working directory: ${workingDir}`)
    } else {
      console.log(`[create-hyperhealth] Working directory already exists: ${workingDir}`)
    }

    console.log(`[create-hyperhealth] Created project: ${project.name} (${project.id})`)

    return NextResponse.json({
      success: true,
      project,
      workingDirectory: workingDir,
      directoryCreated,
      message: "HyperHealth project created successfully. Store this project in localStorage using createProject()."
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create HyperHealth project"
    console.error("[create-hyperhealth] Error:", error)

    // Check for specific errors
    if (message.includes("EACCES") || message.includes("permission")) {
      return NextResponse.json(
        {
          success: false,
          error: "Permission denied. Cannot create directory at the specified path."
        },
        { status: 403 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Preview the HyperHealth project configuration
 *
 * Returns the project configuration without creating it.
 * Useful for checking what will be created before calling POST.
 */
export async function GET() {
  try {
    const workingDir = HYPERHEALTH_CONFIG.workingDirectory
    const directoryExists = existsSync(workingDir)

    return NextResponse.json({
      success: true,
      preview: {
        name: HYPERHEALTH_CONFIG.name,
        description: HYPERHEALTH_CONFIG.description,
        workingDirectory: HYPERHEALTH_CONFIG.workingDirectory,
        tags: HYPERHEALTH_CONFIG.tags,
        priority: HYPERHEALTH_CONFIG.priority,
        status: HYPERHEALTH_CONFIG.status
      },
      directoryExists,
      message: "Use POST to create this project."
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to preview HyperHealth project"
    console.error("[create-hyperhealth] Preview error:", error)

    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    )
  }
}
