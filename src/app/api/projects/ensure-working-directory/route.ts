/**
 * API endpoint to ensure a project's working directory exists
 *
 * This endpoint:
 * 1. Gets the project by ID
 * 2. Determines the effective working directory
 * 3. Creates the directory if it doesn't exist
 * 4. Creates the .claudia/ folder with basic config
 * 5. Updates the project with the working directory path
 * 6. Returns the working directory path
 */

import { NextRequest, NextResponse } from "next/server"
import { mkdir, writeFile } from "fs/promises"
import { existsSync } from "fs"
import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import os from "os"

const execAsync = promisify(exec)

// Base directory for all Claudia project working directories
const CLAUDIA_PROJECTS_BASE = process.env.CLAUDIA_PROJECTS_BASE || path.join(os.homedir(), "claudia-projects")

/**
 * Expand ~ to home directory in paths
 */
function expandPath(p: string): string {
  return p.replace(/^~/, os.homedir())
}

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
 *
 * Creates the project folder and initializes basic .claudia/ structure
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, projectName, projectDescription, existingWorkingDirectory, basePath, repoLocalPath } = body

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
      workingDirectory = expandPath(existingWorkingDirectory)
    } else if (basePath) {
      workingDirectory = expandPath(basePath)
    } else if (repoLocalPath) {
      workingDirectory = expandPath(repoLocalPath)
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

    // Track if we created new directories
    let created = false

    // Create the working directory if it doesn't exist
    if (!existsSync(workingDirectory)) {
      await mkdir(workingDirectory, { recursive: true })
      console.log(`[ensure-working-directory] Created working directory: ${workingDirectory}`)
      created = true

      // Initialize as git repository
      try {
        await execAsync(`git init`, { cwd: workingDirectory })
        console.log(`[ensure-working-directory] Initialized git repository in: ${workingDirectory}`)
      } catch (gitError) {
        console.warn(`[ensure-working-directory] Failed to initialize git repository: ${gitError instanceof Error ? gitError.message : "Unknown error"}`)
        // Non-fatal error - continue
      }
    } else {
      console.log(`[ensure-working-directory] Working directory already exists: ${workingDirectory}`)

      // Check if it's already a git repo, initialize if not
      const gitDir = path.join(workingDirectory, ".git")
      if (!existsSync(gitDir)) {
        try {
          await execAsync(`git init`, { cwd: workingDirectory })
          console.log(`[ensure-working-directory] Initialized git repository in existing directory: ${workingDirectory}`)
        } catch (gitError) {
          console.warn(`[ensure-working-directory] Failed to initialize git repository: ${gitError instanceof Error ? gitError.message : "Unknown error"}`)
        }
      }
    }

    // Create .claudia/ folder structure
    const claudiaDir = path.join(workingDirectory, ".claudia")
    const statusDir = path.join(claudiaDir, "status")
    const requestsDir = path.join(claudiaDir, "requests")

    if (!existsSync(claudiaDir)) {
      await mkdir(claudiaDir, { recursive: true })
      console.log(`[ensure-working-directory] Created .claudia directory: ${claudiaDir}`)
    }

    if (!existsSync(statusDir)) {
      await mkdir(statusDir, { recursive: true })
      console.log(`[ensure-working-directory] Created status directory: ${statusDir}`)
    }

    if (!existsSync(requestsDir)) {
      await mkdir(requestsDir, { recursive: true })
      console.log(`[ensure-working-directory] Created requests directory: ${requestsDir}`)
    }

    // Create basic config.json if it doesn't exist
    const configPath = path.join(claudiaDir, "config.json")
    if (!existsSync(configPath)) {
      const basicConfig = {
        projectId,
        projectName,
        projectDescription: projectDescription || "",
        createdAt: new Date().toISOString(),
        workingDirectory,
        version: "1.0.0"
      }
      await writeFile(configPath, JSON.stringify(basicConfig, null, 2), "utf-8")
      console.log(`[ensure-working-directory] Created config.json: ${configPath}`)
    }

    return NextResponse.json({
      success: true,
      workingDirectory,
      created,
      claudiaInitialized: true
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
