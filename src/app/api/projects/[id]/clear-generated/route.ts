/**
 * Clear Generated Code API
 * Deletes generated code files while preserving project documentation and configuration.
 *
 * This is useful when:
 * - You want to regenerate all code from scratch
 * - The AI generated invalid code and you want to start fresh
 * - You want to test packet execution from a clean state
 *
 * LOGIC:
 * 1. FIRST check if file/folder matches PRESERVE patterns - if yes, never delete
 * 2. THEN check if it matches DELETE patterns (generated code) - if yes, delete
 * 3. Otherwise, preserve by default (unless force flag is set)
 *
 * PRESERVED (never deleted):
 * - .claudia/ directory (project configuration)
 * - docs/ directory (all documentation)
 * - .git/ directory (version control)
 * - resources/ directory (user uploads)
 * - brain-dumps/ directory
 * - .env files (environment configuration)
 * - KICKOFF.md, BUILD_PLAN.md, PRD.md, README.md (specific markdown files)
 *
 * DELETED (generated code):
 * - Code files by extension: *.js, *.ts, *.jsx, *.tsx, *.css, *.html, *.json, etc.
 * - Common entry points: app.js, index.js, main.js, index.html, styles.css
 * - Generated directories: src/, lib/, components/, node_modules/, dist/, build/, etc.
 * - Config files: package.json, tsconfig.json, tailwind.config.*, etc.
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

// Directories to ALWAYS preserve (never delete)
const PRESERVE_DIRECTORIES = [
  ".claudia",
  "docs",
  ".git",
  "resources",
  "brain-dumps",
]

// Files to ALWAYS preserve (never delete) - exact matches
const PRESERVE_FILES = [
  ".gitignore",
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  "KICKOFF.md",
  "BUILD_PLAN.md",
  "PRD.md",
  "README.md",
]

// Generated code file extensions (should be deleted)
const GENERATED_CODE_EXTENSIONS = [
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".html",
  ".htm",
  ".vue",
  ".svelte",
  ".json",  // package.json, tsconfig.json, etc.
]

// Generated directories (should be deleted)
const GENERATED_DIRECTORIES = [
  "src",
  "lib",
  "components",
  "app",
  "pages",
  "node_modules",
  "dist",
  "build",
  ".next",
  "out",
  "public",
  "styles",
  "hooks",
  "utils",
  "types",
  "api",
  "test",
  "tests",
  "__tests__",
  "coverage",
  ".turbo",
  ".cache",
]

// Generated files by exact name (should be deleted)
const GENERATED_FILES = [
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "jsconfig.json",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "tailwind.config.js",
  "tailwind.config.ts",
  "postcss.config.js",
  "postcss.config.mjs",
  "eslint.config.js",
  "eslint.config.mjs",
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.json",
  ".prettierrc",
  ".prettierrc.js",
  ".prettierrc.json",
  "vite.config.js",
  "vite.config.ts",
  "webpack.config.js",
  "rollup.config.js",
  // Common generated entry point files
  "app.js",
  "index.js",
  "main.js",
  "index.html",
  "styles.css",
  "style.css",
]

interface ClearResult {
  deleted: string[]
  preserved: string[]
  errors: string[]
}

/**
 * Check if a path should be preserved (FIRST check - if true, never delete)
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

  // Check for .env files (various .env.* patterns)
  if (name.startsWith(".env")) {
    return true
  }

  return false
}

/**
 * Check if a path should be deleted (generated code)
 * Only called AFTER shouldPreserve returns false
 */
function shouldDelete(name: string, isDirectory: boolean): boolean {
  // Check generated directories
  if (isDirectory && GENERATED_DIRECTORIES.includes(name)) {
    return true
  }

  // Check generated files by exact name
  if (!isDirectory && GENERATED_FILES.includes(name)) {
    return true
  }

  // Check for generated code by extension
  if (!isDirectory) {
    const ext = path.extname(name).toLowerCase()
    if (GENERATED_CODE_EXTENSIONS.includes(ext)) {
      return true
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
 * Format: ~/claudia-projects/{project-slug}-{id-prefix}/
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
 * - force: boolean - If true, delete files not in preserve/delete lists (default: false)
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
    const { dryRun = false, force = false, workingDirectory: providedWorkingDir, projectName } = body

    // Determine working directory - prefer provided, fallback to generated path
    let workingDirectory = providedWorkingDir
    if (!workingDirectory && projectName) {
      // Generate a fallback path from project name
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

      // FIRST: Check if should preserve (never delete these)
      if (shouldPreserve(entry.name, isDirectory)) {
        result.preserved.push(entry.name)
        continue
      }

      // SECOND: Check if should delete (generated code)
      if (shouldDelete(entry.name, isDirectory)) {
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
        continue
      }

      // For items not matching preserve or delete patterns:
      // - With force flag: delete anything that's not a hidden file/directory
      // - Without force flag: preserve by default (safety)
      if (force && !entry.name.startsWith(".")) {
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
      } else {
        result.preserved.push(entry.name)
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
 *
 * GET is deprecated because the server cannot access localStorage to look up project data.
 * The client must provide the workingDirectory in a POST request body.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    {
      success: false,
      error: "GET method is not supported. Use POST with { dryRun: true, workingDirectory: '...' } in the request body to preview."
    },
    { status: 400 }
  )
}
