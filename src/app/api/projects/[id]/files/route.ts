/**
 * Project Files API
 *
 * Lists all files in a project folder recursively and provides file content.
 *
 * Endpoints:
 * - GET: List all files (no path param) or get file content (with path param)
 *
 * Query params:
 * - basePath: Optional override for the project folder path
 * - path: When provided, returns the content of that specific file
 */

import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { promises as fs } from "fs"
import path from "path"
import { auth } from "@/lib/auth"

// Maximum file size for reading content (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024

// Directories to skip when scanning
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
  "target", // Rust
  "bin", // Go compiled binaries
  "obj", // .NET
]

// Files to skip
const SKIP_FILES = [
  ".DS_Store",
  "Thumbs.db",
  ".gitkeep",
]

interface FileNode {
  name: string
  path: string
  type: "file" | "directory"
  size?: number
  children?: FileNode[]
  extension?: string
}

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
  const claudiaProjectsBase = "/home/bill/claudia-projects"

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
 * Recursively scan a directory and build a file tree
 */
async function scanDirectory(
  dirPath: string,
  maxDepth: number = 10,
  currentDepth: number = 0
): Promise<FileNode[]> {
  if (currentDepth >= maxDepth) {
    return []
  }

  const nodes: FileNode[] = []

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    // Sort entries: directories first, then files, both alphabetically
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      // Skip hidden files/folders (except common config files)
      if (entry.name.startsWith(".") && ![".", ".."].includes(entry.name)) {
        // Allow some common hidden config files
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
        if (!allowedHidden.some((h) => entry.name.startsWith(h))) {
          continue
        }
      }

      // Skip certain files
      if (SKIP_FILES.includes(entry.name)) {
        continue
      }

      if (entry.isDirectory()) {
        // Skip certain directories
        if (SKIP_DIRECTORIES.includes(entry.name)) {
          continue
        }

        const children = await scanDirectory(fullPath, maxDepth, currentDepth + 1)

        nodes.push({
          name: entry.name,
          path: fullPath,
          type: "directory",
          children,
        })
      } else if (entry.isFile()) {
        try {
          const stats = await fs.stat(fullPath)
          const extension = path.extname(entry.name)

          nodes.push({
            name: entry.name,
            path: fullPath,
            type: "file",
            size: stats.size,
            extension: extension || undefined,
          })
        } catch {
          // Skip files we can't stat
        }
      }
    }
  } catch (error) {
    console.error(`[files] Error scanning directory ${dirPath}:`, error)
  }

  return nodes
}

/**
 * Calculate total stats from file tree
 */
function calculateStats(nodes: FileNode[]): { totalFiles: number; totalSize: number } {
  let totalFiles = 0
  let totalSize = 0

  const traverse = (items: FileNode[]) => {
    for (const item of items) {
      if (item.type === "file") {
        totalFiles++
        totalSize += item.size || 0
      } else if (item.children) {
        traverse(item.children)
      }
    }
  }

  traverse(nodes)
  return { totalFiles, totalSize }
}

/**
 * GET /api/projects/[id]/files
 *
 * Without path param: List all files in the project folder
 * With path param: Get the content of a specific file
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Authenticate user via session
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      )
    }

    const basePath = searchParams.get("basePath")
    const filePath = searchParams.get("path")

    // Get project directory
    const projectPath = await getProjectPath(projectId, basePath || undefined)

    if (!projectPath) {
      return NextResponse.json(
        {
          error: "Project folder not configured",
          message: "No project folder path is set for this project.",
          suggestion: "Go to the project's Files tab and set the project folder path, or edit the project settings to add a basePath.",
          helpUrl: `/projects/${projectId}?tab=files`,
          code: "BASEPATH_NOT_SET"
        },
        { status: 404 }
      )
    }

    // If a specific file path is requested, return its content
    if (filePath) {
      // Security: Ensure the file path is within the project directory
      const normalizedFilePath = path.normalize(filePath)
      const normalizedProjectPath = path.normalize(projectPath)

      if (!normalizedFilePath.startsWith(normalizedProjectPath)) {
        return NextResponse.json(
          { error: "Access denied: File is outside project directory" },
          { status: 403 }
        )
      }

      try {
        // Check if file exists and get stats
        const stats = await fs.stat(filePath)

        if (!stats.isFile()) {
          return NextResponse.json(
            { error: "Path is not a file" },
            { status: 400 }
          )
        }

        // Check file size
        if (stats.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            {
              error: "File too large",
              message: `File size (${(stats.size / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed size (5 MB)`
            },
            { status: 413 }
          )
        }

        // Read file content
        const content = await fs.readFile(filePath, "utf-8")

        return NextResponse.json({
          success: true,
          path: filePath,
          name: path.basename(filePath),
          size: stats.size,
          content,
        })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return NextResponse.json(
            { error: "File not found" },
            { status: 404 }
          )
        }
        throw error
      }
    }

    // Otherwise, list all files
    const files = await scanDirectory(projectPath)
    const stats = calculateStats(files)

    return NextResponse.json({
      success: true,
      projectId,
      basePath: projectPath,
      files,
      stats,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list files"
    console.error("[files] GET error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
