/**
 * API endpoint to ensure a project's working directory exists
 *
 * This endpoint:
 * 1. Gets the project by ID
 * 2. Determines the effective working directory
 * 3. Creates the directory if it doesn't exist
 * 4. Updates the project with the working directory path
 * 5. Returns the working directory path
 */

import { NextRequest, NextResponse } from "next/server"
import { mkdir } from "fs/promises"
import { existsSync } from "fs"

// Base directory for all Claudia project working directories
const CLAUDIA_PROJECTS_BASE = "/home/bill/claudia-projects"

/**
 * Generate a slug from a project name for use in directory paths
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "project"
}

/**
 * Generate the working directory path for a project
 */
function generateWorkingDirectoryPath(projectName: string, projectId?: string): string {
  const slug = generateSlug(projectName)
  const suffix = projectId ? `-${projectId.slice(0, 8)}` : ""
  return `${CLAUDIA_PROJECTS_BASE}/${slug}${suffix}`
}

/**
 * POST - Ensure working directory exists for a project
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, projectName, existingWorkingDirectory, basePath, repoLocalPath } = body

    if (!projectId || !projectName) {
      return NextResponse.json(
        { error: "projectId and projectName are required" },
        { status: 400 }
      )
    }

    // Determine the working directory to use
    let workingDirectory: string

    // Priority (consistent with getEffectiveWorkingDirectory):
    // 1. Existing project workingDirectory (if set and valid)
    // 2. basePath - the primary codebase location
    // 3. Repo's localPath (if set and valid)
    // 4. Generate new one
    if (existingWorkingDirectory) {
      workingDirectory = existingWorkingDirectory
    } else if (basePath) {
      workingDirectory = basePath
    } else if (repoLocalPath) {
      workingDirectory = repoLocalPath
    } else {
      workingDirectory = generateWorkingDirectoryPath(projectName, projectId)
    }

    console.log(`[ensure-working-directory] Project: ${projectName} (${projectId})`)
    console.log(`[ensure-working-directory] Working directory: ${workingDirectory}`)

    // Ensure the base directory exists
    if (!existsSync(CLAUDIA_PROJECTS_BASE)) {
      await mkdir(CLAUDIA_PROJECTS_BASE, { recursive: true })
      console.log(`[ensure-working-directory] Created base directory: ${CLAUDIA_PROJECTS_BASE}`)
    }

    // Create the working directory if it doesn't exist
    if (!existsSync(workingDirectory)) {
      await mkdir(workingDirectory, { recursive: true })
      console.log(`[ensure-working-directory] Created working directory: ${workingDirectory}`)
    } else {
      console.log(`[ensure-working-directory] Working directory already exists: ${workingDirectory}`)
    }

    return NextResponse.json({
      success: true,
      workingDirectory,
      created: !existsSync(workingDirectory)
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to ensure working directory"
    console.error("[ensure-working-directory] Error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
