/**
 * Clear Generated Code API
 * Deletes all generated code while preserving user content and project configuration.
 *
 * LOGIC (inverted - preserve what matters, delete the rest):
 * 1. Check if file/folder matches PRESERVE patterns - if yes, keep it
 * 2. Everything else gets deleted
 *
 * PRESERVED (user content & project essentials):
 * - .claudia/ directory (project configuration, interview data)
 * - docs/ directory (user documentation)
 * - .git/ directory (version control)
 * - resources/ directory (user uploads)
 * - brain-dumps/ directory (user content)
 * - .env files (environment configuration)
 * - Key markdown files: KICKOFF.md, BUILD_PLAN.md, PRD.md, README.md
 *
 * DELETED (everything else):
 * - All code files, config files, build artifacts, dependencies
 */

import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs/promises"
import * as path from "path"
import os from "os"

/**
 * Expand ~ to home directory in a path
 */
function expandPath(p: string): string {
  if (!p) return p
  return p.replace(/^~/, os.homedir())
}

// Directories to PRESERVE (user content & project essentials)
const PRESERVE_DIRECTORIES = [
  ".claudia",      // Project configuration, interview data
  "docs",          // User documentation
  ".git",          // Version control
  "resources",     // User uploads
  "brain-dumps",   // User content
  "uploads",       // User uploads (alternative name)
  "attachments",   // User attachments
]

// Files to PRESERVE - exact matches
const PRESERVE_FILES = [
  // Environment files
  ".gitignore",
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.test",
  // Key project documentation
  "KICKOFF.md",
  "BUILD_PLAN.md",
  "PRD.md",
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "LICENSE.md",
]

// File patterns to preserve (startsWith checks)
const PRESERVE_FILE_PATTERNS = [
  ".env",  // Any .env.* file
]

interface ClearResult {
  deleted: string[]
  preserved: string[]
  errors: string[]
}

/**
 * Check if a path should be preserved (user content or project essentials)
 */
function shouldPreserve(name: string, isDirectory: boolean): boolean {
  // Check preserved directories
  if (isDirectory && PRESERVE_DIRECTORIES.includes(name)) {
    return true
  }

  // Check preserved files (exact match)
  if (!isDirectory && PRESERVE_FILES.includes(name)) {
    return true
  }

  // Check file patterns (startsWith)
  if (!isDirectory) {
    for (const pattern of PRESERVE_FILE_PATTERNS) {
      if (name.startsWith(pattern)) {
        return true
      }
    }
  }

  return false
}

/**
 * Recursively delete a directory
 */
async function deleteRecursive(targetPath: string): Promise<void> {
  try {
    const stats = await fs.stat(targetPath)

    if (stats.isDirectory()) {
      // Read contents and delete recursively
      const entries = await fs.readdir(targetPath)
      for (const entry of entries) {
        await deleteRecursive(path.join(targetPath, entry))
      }
      // Remove the now-empty directory
      await fs.rmdir(targetPath)
    } else {
      // Delete file
      await fs.unlink(targetPath)
    }
  } catch (error) {
    // Ignore errors for files that don't exist
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error
    }
  }
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
function generateWorkingDirectoryPath(projectName: string, projectId: string): string {
  const CLAUDIA_PROJECTS_BASE = process.env.CLAUDIA_PROJECTS_BASE || path.join(os.homedir(), "claudia-projects")
  const slug = generateSlug(projectName)
  const suffix = projectId ? `-${projectId.slice(0, 8)}` : ""
  return `${CLAUDIA_PROJECTS_BASE}/${slug}${suffix}`
}

/**
 * POST /api/projects/[id]/clear-generated
 * Clear generated code files from the project's working directory
 *
 * Request body:
 * - workingDirectory: string - The project's working directory path (REQUIRED)
 * - dryRun: boolean - If true, only preview what would be deleted (default: false)
 * - projectName: string - Project name for fallback path generation (optional)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    // Parse request body for options
    const body = await request.json().catch(() => ({}))
    const { dryRun = false, workingDirectory: providedWorkingDir, projectName } = body

    // Determine working directory - prefer provided, fallback to generated path
    let workingDirectory = providedWorkingDir
    if (!workingDirectory && projectName) {
      workingDirectory = generateWorkingDirectoryPath(projectName, projectId)
    }

    if (!workingDirectory) {
      return NextResponse.json(
        { success: false, error: "No working directory provided. Please provide workingDirectory in the request body." },
        { status: 400 }
      )
    }

    // Expand ~ to home directory
    workingDirectory = expandPath(workingDirectory)

    // Verify the directory exists
    try {
      await fs.access(workingDirectory)
    } catch {
      return NextResponse.json(
        { success: false, error: `Working directory does not exist: ${workingDirectory}` },
        { status: 400 }
      )
    }

    // Collect results
    const result: ClearResult = {
      deleted: [],
      preserved: [],
      errors: []
    }

    // Read directory contents
    const entries = await fs.readdir(workingDirectory, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = path.join(workingDirectory, entry.name)
      const isDirectory = entry.isDirectory()

      // Check if should preserve - if yes, keep it
      if (shouldPreserve(entry.name, isDirectory)) {
        result.preserved.push(entry.name)
        continue
      }

      // Everything else gets deleted
      if (dryRun) {
        result.deleted.push(entry.name)
      } else {
        try {
          await deleteRecursive(entryPath)
          result.deleted.push(entry.name)
        } catch (error) {
          result.errors.push(`Failed to delete ${entry.name}: ${error instanceof Error ? error.message : "Unknown error"}`)
        }
      }
    }

    return NextResponse.json({
      success: result.errors.length === 0,
      dryRun,
      workingDirectory,
      deleted: result.deleted,
      preserved: result.preserved,
      errors: result.errors,
      summary: dryRun
        ? `Would delete ${result.deleted.length} items, preserve ${result.preserved.length} items`
        : `Deleted ${result.deleted.length} items, preserved ${result.preserved.length} items${result.errors.length > 0 ? `, ${result.errors.length} errors` : ""}`
    })

  } catch (error) {
    console.error("[clear-generated] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/projects/[id]/clear-generated
 * Returns an error - use POST with workingDirectory in the body
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "GET method is not supported. Use POST with { dryRun: true, workingDirectory: '...' } in the request body to preview."
    },
    { status: 400 }
  )
}
