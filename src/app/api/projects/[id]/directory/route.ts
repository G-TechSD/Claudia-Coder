/**
 * Project Working Directory API
 *
 * Ensures project working directories exist at /home/bill/claudia-projects/{project-slug}/
 *
 * Endpoints:
 * - POST: Create working directory for project if not exists
 * - GET: Return working directory path and status
 */

import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import { stat } from "fs/promises"
import path from "path"

// Base directory for all Claudia project working directories
const CLAUDIA_PROJECTS_BASE = "/home/bill/claudia-projects"

/**
 * Generate a slug from a project name for use in directory paths
 * e.g., "My Cool Project" -> "my-cool-project"
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-")         // Replace spaces with hyphens
    .replace(/-+/g, "-")          // Replace multiple hyphens with single
    .replace(/^-|-$/g, "")        // Remove leading/trailing hyphens
    || "project"                   // Fallback if empty
}

/**
 * Generate the working directory path for a project
 * Format: /home/bill/claudia-projects/{project-slug}-{short-id}/
 */
function generateWorkingDirectoryPath(projectName: string, projectId: string): string {
  const slug = generateSlug(projectName)
  // Add a short ID suffix to avoid collisions
  const suffix = projectId ? `-${projectId.slice(0, 8)}` : ""
  return `${CLAUDIA_PROJECTS_BASE}/${slug}${suffix}`
}

/**
 * Check if a directory exists
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await stat(dirPath)
    return stats.isDirectory()
  } catch {
    return false
  }
}

/**
 * Get directory info (size, file count, etc.)
 */
async function getDirectoryInfo(dirPath: string): Promise<{
  exists: boolean
  fileCount?: number
  totalSize?: number
  createdAt?: Date
  modifiedAt?: Date
}> {
  try {
    const stats = await stat(dirPath)
    if (!stats.isDirectory()) {
      return { exists: false }
    }

    // Count files in directory
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    let fileCount = 0
    let totalSize = 0

    for (const entry of entries) {
      if (entry.isFile()) {
        fileCount++
        try {
          const fileStat = await stat(path.join(dirPath, entry.name))
          totalSize += fileStat.size
        } catch {
          // Skip files we can't stat
        }
      } else if (entry.isDirectory()) {
        fileCount++ // Count directories too
      }
    }

    return {
      exists: true,
      fileCount,
      totalSize,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime
    }
  } catch {
    return { exists: false }
  }
}

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]/directory
 * Return working directory path and status
 *
 * Query params:
 * - name: Project name (optional if project exists in storage)
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)
    const projectName = searchParams.get("name")

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      )
    }

    // Generate path - we need a name, so use a fallback based on ID if not provided
    const name = projectName || `project-${projectId.slice(0, 8)}`
    const workingDirectory = generateWorkingDirectoryPath(name, projectId)

    // Get directory info
    const dirInfo = await getDirectoryInfo(workingDirectory)

    return NextResponse.json({
      success: true,
      projectId,
      workingDirectory,
      exists: dirInfo.exists,
      info: dirInfo.exists ? {
        fileCount: dirInfo.fileCount,
        totalSize: dirInfo.totalSize,
        createdAt: dirInfo.createdAt?.toISOString(),
        modifiedAt: dirInfo.modifiedAt?.toISOString()
      } : null
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get directory info"
    console.error("[projects/directory] GET error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/projects/[id]/directory
 * Create working directory for project if not exists
 *
 * Body: { name: string, workingDirectory?: string }
 * - name: Project name (required for generating slug)
 * - workingDirectory: Custom path (optional, overrides generated path)
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()
    const { name: projectName, workingDirectory: customPath } = body

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      )
    }

    if (!projectName && !customPath) {
      return NextResponse.json(
        { error: "Project name or workingDirectory is required" },
        { status: 400 }
      )
    }

    // Determine the working directory path
    let workingDirectory: string
    if (customPath) {
      // Use custom path if provided
      workingDirectory = customPath
    } else {
      // Generate from project name
      workingDirectory = generateWorkingDirectoryPath(projectName, projectId)
    }

    // Check if already exists
    const exists = await directoryExists(workingDirectory)

    if (exists) {
      // Directory already exists, return info
      const dirInfo = await getDirectoryInfo(workingDirectory)

      return NextResponse.json({
        success: true,
        created: false,
        message: "Working directory already exists",
        projectId,
        workingDirectory,
        info: {
          fileCount: dirInfo.fileCount,
          totalSize: dirInfo.totalSize,
          createdAt: dirInfo.createdAt?.toISOString(),
          modifiedAt: dirInfo.modifiedAt?.toISOString()
        }
      })
    }

    // Ensure base directory exists
    const baseExists = await directoryExists(CLAUDIA_PROJECTS_BASE)
    if (!baseExists) {
      await fs.mkdir(CLAUDIA_PROJECTS_BASE, { recursive: true })
      console.log(`[projects/directory] Created base directory: ${CLAUDIA_PROJECTS_BASE}`)
    }

    // Create project working directory
    await fs.mkdir(workingDirectory, { recursive: true })
    console.log(`[projects/directory] Created working directory: ${workingDirectory}`)

    // Create a .claudia file to mark this as a Claudia-managed directory
    const claudiaMetaPath = path.join(workingDirectory, ".claudia")
    const metadata = {
      projectId,
      projectName,
      createdAt: new Date().toISOString(),
      managedBy: "claudia-admin"
    }
    await fs.writeFile(claudiaMetaPath, JSON.stringify(metadata, null, 2))

    // Get final directory info
    const dirInfo = await getDirectoryInfo(workingDirectory)

    return NextResponse.json({
      success: true,
      created: true,
      message: "Working directory created successfully",
      projectId,
      workingDirectory,
      info: {
        fileCount: dirInfo.fileCount,
        totalSize: dirInfo.totalSize,
        createdAt: dirInfo.createdAt?.toISOString(),
        modifiedAt: dirInfo.modifiedAt?.toISOString()
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create working directory"
    console.error("[projects/directory] POST error:", message)

    // Check for specific errors
    if (message.includes("EACCES") || message.includes("permission")) {
      return NextResponse.json(
        { error: "Permission denied. Cannot create directory at the specified path." },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
