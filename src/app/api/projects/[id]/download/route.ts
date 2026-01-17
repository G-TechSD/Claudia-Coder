/**
 * Project Download API
 *
 * Generates and streams a ZIP file of all project files.
 *
 * Endpoints:
 * - GET: Generate and download a ZIP file of all project files
 *
 * Query params:
 * - basePath: Optional override for the project folder path
 */

import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import os from "os"
import archiver from "archiver"
import { Readable } from "stream"

// Directories to skip when creating archive
const SKIP_DIRECTORIES = [
  "node_modules",
  ".git",
  ".next",
  ".cache",
  "__pycache__",
  ".pytest_cache",
  ".venv",
  "venv",
  "dist",
  "build",
  "coverage",
  ".nyc_output",
  ".turbo",
  ".vercel",
  ".output",
  "vendor",
  "target",
  "bin",
  "obj",
]

// Files to skip
const SKIP_FILES = [
  ".DS_Store",
  "Thumbs.db",
]

// Maximum archive size (100MB)
const MAX_ARCHIVE_SIZE = 100 * 1024 * 1024

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Get the effective project path
 */
async function getProjectPath(projectId: string, basePath?: string): Promise<string | null> {
  // If basePath is explicitly provided, use it
  if (basePath) {
    try {
      await fs.access(basePath)
      return basePath
    } catch {
      return null
    }
  }

  // Default location for Claudia projects
  const claudiaProjectsBase = process.env.CLAUDIA_PROJECTS_BASE || path.join(os.homedir(), "claudia-projects")

  try {
    // List directories in the base and find one that matches the project ID
    const entries = await fs.readdir(claudiaProjectsBase, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Check if this directory belongs to our project
        const claudiaMetaPath = path.join(claudiaProjectsBase, entry.name, ".claudia")
        try {
          const metaContent = await fs.readFile(claudiaMetaPath, "utf-8")
          const meta = JSON.parse(metaContent)
          if (meta.projectId === projectId) {
            return path.join(claudiaProjectsBase, entry.name)
          }
        } catch {
          // No .claudia file or invalid JSON, skip
        }
      }
    }
  } catch {
    // Base directory doesn't exist or not readable
  }

  return null
}

/**
 * Check if a path should be skipped
 */
function shouldSkip(itemPath: string, name: string, isDirectory: boolean): boolean {
  // Skip hidden files/folders (except specific config files)
  if (name.startsWith(".")) {
    const allowedHidden = [
      ".env",
      ".env.local",
      ".env.example",
      ".gitignore",
      ".dockerignore",
      ".editorconfig",
      ".prettierrc",
      ".eslintrc",
      ".claudia",
    ]
    if (!allowedHidden.some((h) => name.startsWith(h))) {
      return true
    }
  }

  if (isDirectory) {
    return SKIP_DIRECTORIES.includes(name)
  }

  return SKIP_FILES.includes(name)
}

/**
 * Calculate total size of files to be archived
 */
async function calculateTotalSize(dirPath: string): Promise<number> {
  let totalSize = 0

  async function traverse(currentPath: string) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)

        if (shouldSkip(fullPath, entry.name, entry.isDirectory())) {
          continue
        }

        if (entry.isDirectory()) {
          await traverse(fullPath)
        } else if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath)
            totalSize += stats.size
          } catch {
            // Skip files we can't stat
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  await traverse(dirPath)
  return totalSize
}

/**
 * Convert Node.js stream to Web ReadableStream
 */
function nodeStreamToWebStream(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk))
      })

      nodeStream.on("end", () => {
        controller.close()
      })

      nodeStream.on("error", (error) => {
        controller.error(error)
      })
    },

    cancel() {
      nodeStream.destroy()
    },
  })
}

/**
 * GET /api/projects/[id]/download
 *
 * Generate and stream a ZIP file of all project files
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      )
    }

    const basePath = searchParams.get("basePath")

    // Get project directory
    const projectPath = await getProjectPath(projectId, basePath || undefined)

    if (!projectPath) {
      return NextResponse.json(
        {
          error: "Project folder not found",
          message: "The project folder doesn't exist or hasn't been initialized yet."
        },
        { status: 404 }
      )
    }

    // Check total size before creating archive
    const totalSize = await calculateTotalSize(projectPath)

    if (totalSize > MAX_ARCHIVE_SIZE) {
      return NextResponse.json(
        {
          error: "Project too large",
          message: `Total file size (${(totalSize / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed size (100 MB)`
        },
        { status: 413 }
      )
    }

    // Get project folder name for the ZIP filename
    const projectFolderName = path.basename(projectPath)
    const zipFilename = `${projectFolderName}.zip`

    // Create archiver instance
    const archive = archiver("zip", {
      zlib: { level: 6 }, // Compression level
    })

    // Handle archive errors
    archive.on("error", (err) => {
      console.error("[download] Archive error:", err)
      throw err
    })

    // Track added files for logging
    let fileCount = 0

    // Add files to archive recursively
    async function addToArchive(currentPath: string, relativePath: string = "") {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name)
          const entryRelativePath = relativePath
            ? path.join(relativePath, entry.name)
            : entry.name

          if (shouldSkip(fullPath, entry.name, entry.isDirectory())) {
            continue
          }

          if (entry.isDirectory()) {
            await addToArchive(fullPath, entryRelativePath)
          } else if (entry.isFile()) {
            archive.file(fullPath, { name: entryRelativePath })
            fileCount++
          }
        }
      } catch (error) {
        console.error(`[download] Error adding ${currentPath}:`, error)
      }
    }

    // Start adding files
    await addToArchive(projectPath)

    // Finalize the archive
    archive.finalize()

    console.log(`[download] Created archive with ${fileCount} files for project ${projectId}`)

    // Convert Node.js stream to Web ReadableStream
    const webStream = nodeStreamToWebStream(archive as unknown as Readable)

    // Return streaming response
    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create archive"
    console.error("[download] GET error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
