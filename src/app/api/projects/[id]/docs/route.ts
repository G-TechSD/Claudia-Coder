/**
 * Project Documents API
 *
 * Unified API for project documentation. Supports two storage modes:
 *
 * 1. Typed Documents (stored in .local-storage/projects/{projectId}/docs/)
 *    - vision: Product vision and goals
 *    - story: User stories and requirements
 *    - notes: General project notes
 *    - specs: Technical specifications
 *
 * 2. File-based Documents (stored in project working directory)
 *    - Any markdown file in the project's docs/ folder
 *
 * Endpoints:
 * - GET: List all documents (typed + file-based)
 * - POST: Create a new document (typed or file-based)
 */

import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import os from "os"
import {
  listDocs,
  createDoc,
  getDocsStats,
  type ProjectDocType,
  type ProjectDocListItem
} from "@/lib/data/project-docs"

// Docs subdirectory name within project working directory
const DOCS_DIR = "docs"

// Allowed file extensions
const ALLOWED_EXTENSIONS = [".md", ".markdown", ".txt"]

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Get project working directory from localStorage fallback or request
 */
async function getProjectWorkingDirectory(projectId: string, request?: NextRequest): Promise<string | null> {
  // Try to get from query params or body
  if (request) {
    const { searchParams } = new URL(request.url)
    const workingDir = searchParams.get("workingDirectory")
    if (workingDir) return workingDir
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
 * Ensure the docs directory exists
 */
async function ensureDocsDirectory(workingDirectory: string): Promise<string> {
  const docsPath = path.join(workingDirectory, DOCS_DIR)

  try {
    await fs.access(docsPath)
  } catch {
    // Create docs directory if it doesn't exist
    await fs.mkdir(docsPath, { recursive: true })
  }

  return docsPath
}

/**
 * List all markdown files in a directory (recursively)
 */
async function listMarkdownFiles(dirPath: string, basePath: string = ""): Promise<Array<{
  name: string
  path: string
  relativePath: string
  lastModified: string
}>> {
  const files: Array<{
    name: string
    path: string
    relativePath: string
    lastModified: string
  }> = []

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      const relativePath = basePath ? path.join(basePath, entry.name) : entry.name

      if (entry.isDirectory()) {
        // Recursively list files in subdirectories
        const subFiles = await listMarkdownFiles(fullPath, relativePath)
        files.push(...subFiles)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (ALLOWED_EXTENSIONS.includes(ext)) {
          const stats = await fs.stat(fullPath)
          files.push({
            name: entry.name,
            path: fullPath,
            relativePath,
            lastModified: stats.mtime.toISOString()
          })
        }
      }
    }
  } catch (error) {
    console.error(`[docs] Error listing files in ${dirPath}:`, error)
  }

  return files
}

/**
 * Read file content
 */
async function readFileContent(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf-8")
}

/**
 * GET /api/projects/[id]/docs
 * List all documents for a project (typed + file-based)
 *
 * Query params:
 * - type: Filter by document type (vision, story, notes, specs) - for typed docs only
 * - sortBy: Sort field (createdAt, updatedAt, title) - default: updatedAt
 * - sortOrder: Sort order (asc, desc) - default: desc
 * - includePreview: Include content preview (true/false) - default: false
 * - stats: Return stats instead of list (true/false) - default: false
 * - mode: "typed" | "files" | "all" - default: "all"
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

    const mode = searchParams.get("mode") || "all"

    // Check if stats are requested
    if (searchParams.get("stats") === "true") {
      const stats = await getDocsStats(projectId)
      return NextResponse.json({
        success: true,
        projectId,
        stats
      })
    }

    // Parse query params
    const type = searchParams.get("type") as ProjectDocType | null
    const sortBy = (searchParams.get("sortBy") as "createdAt" | "updatedAt" | "title") || "updatedAt"
    const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc"
    const includePreview = searchParams.get("includePreview") === "true"
    const previewLength = parseInt(searchParams.get("previewLength") || "200", 10)

    // Results object
    const result: {
      success: boolean
      projectId: string
      typedDocs: ProjectDocListItem[]
      fileDocs: Array<{
        name: string
        path: string
        content?: string
        lastModified: string
      }>
      workingDirectory?: string
      docsPath?: string
    } = {
      success: true,
      projectId,
      typedDocs: [],
      fileDocs: []
    }

    // Get typed docs (from .local-storage)
    if (mode === "typed" || mode === "all") {
      result.typedDocs = await listDocs(projectId, {
        type: type || undefined,
        sortBy,
        sortOrder,
        includePreview,
        previewLength
      })
    }

    // Get file-based docs (from working directory)
    if (mode === "files" || mode === "all") {
      const workingDirectory = await getProjectWorkingDirectory(projectId, request)

      if (workingDirectory) {
        result.workingDirectory = workingDirectory
        const docsPath = path.join(workingDirectory, DOCS_DIR)
        result.docsPath = docsPath

        // Check if docs directory exists
        try {
          await fs.access(docsPath)
          const docsFiles = await listMarkdownFiles(docsPath)

          // Also include root-level markdown files
          const rootFiles = await listMarkdownFiles(workingDirectory)
          const rootMdFiles = rootFiles.filter(f =>
            !f.relativePath.startsWith(DOCS_DIR) &&
            !f.relativePath.startsWith(".") &&
            !f.relativePath.startsWith("node_modules")
          )

          const allFiles = [...rootMdFiles, ...docsFiles]

          // Read content for each file if preview is requested
          result.fileDocs = await Promise.all(
            allFiles.map(async (file) => {
              const doc: {
                name: string
                path: string
                content?: string
                lastModified: string
              } = {
                name: file.name,
                path: file.path,
                lastModified: file.lastModified
              }

              if (includePreview) {
                const content = await readFileContent(file.path)
                doc.content = content.slice(0, previewLength)
                if (content.length > previewLength) {
                  doc.content += "..."
                }
              }

              return doc
            })
          )
        } catch {
          // Docs directory doesn't exist, check root for markdown files
          const rootFiles = await listMarkdownFiles(workingDirectory)

          result.fileDocs = await Promise.all(
            rootFiles.map(async (file) => {
              const doc: {
                name: string
                path: string
                content?: string
                lastModified: string
              } = {
                name: file.name,
                path: file.path,
                lastModified: file.lastModified
              }

              if (includePreview) {
                const content = await readFileContent(file.path)
                doc.content = content.slice(0, previewLength)
                if (content.length > previewLength) {
                  doc.content += "..."
                }
              }

              return doc
            })
          )
        }
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list documents"
    console.error("[docs] GET error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/projects/[id]/docs
 * Create a new document (typed or file-based)
 *
 * For typed docs (stored in .local-storage):
 * Body: {
 *   mode: "typed"
 *   type: "vision" | "story" | "notes" | "specs"
 *   title: string
 *   content: string
 *   tags?: string[]
 *   source?: "manual" | "linear" | "ai-generated"
 *   sourceRef?: string
 * }
 *
 * For file-based docs (stored in working directory):
 * Body: {
 *   mode?: "file" (default if no mode specified and no type)
 *   name: string
 *   content: string
 *   workingDirectory?: string
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      )
    }

    // Determine mode: if type is provided, it's a typed doc
    const mode = body.mode || (body.type ? "typed" : "file")

    // Handle typed docs (stored in .local-storage)
    if (mode === "typed") {
      const { type, title, content, tags, source, sourceRef } = body

      // Validate required fields
      if (!type) {
        return NextResponse.json(
          { error: "Document type is required for typed docs" },
          { status: 400 }
        )
      }

      if (!title) {
        return NextResponse.json(
          { error: "Document title is required" },
          { status: 400 }
        )
      }

      if (content === undefined || content === null) {
        return NextResponse.json(
          { error: "Document content is required" },
          { status: 400 }
        )
      }

      // Validate document type
      const validTypes: ProjectDocType[] = ["vision", "story", "notes", "specs"]
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { error: `Invalid document type. Must be one of: ${validTypes.join(", ")}` },
          { status: 400 }
        )
      }

      // Validate source if provided
      const validSources = ["manual", "linear", "ai-generated"]
      if (source && !validSources.includes(source)) {
        return NextResponse.json(
          { error: `Invalid source. Must be one of: ${validSources.join(", ")}` },
          { status: 400 }
        )
      }

      // Create the typed document
      const doc = await createDoc({
        projectId,
        type,
        title,
        content,
        tags,
        source,
        sourceRef
      })

      return NextResponse.json({
        success: true,
        mode: "typed",
        doc
      }, { status: 201 })
    }

    // Handle file-based docs (stored in working directory)
    const { name, content, workingDirectory: bodyWorkingDir } = body

    if (!name) {
      return NextResponse.json(
        { error: "File name is required" },
        { status: 400 }
      )
    }

    // Get working directory
    const workingDirectory = bodyWorkingDir || await getProjectWorkingDirectory(projectId, request)

    if (!workingDirectory) {
      return NextResponse.json(
        { error: "No working directory found for project. Please initialize the project folder first." },
        { status: 400 }
      )
    }

    // Ensure docs directory exists
    const docsPath = await ensureDocsDirectory(workingDirectory)

    // Sanitize filename
    const sanitizedName = name
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")

    const filePath = path.join(docsPath, sanitizedName)

    // Check if file already exists
    try {
      await fs.access(filePath)
      return NextResponse.json(
        { error: "A file with this name already exists" },
        { status: 409 }
      )
    } catch {
      // File doesn't exist, we can create it
    }

    // Write file
    await fs.writeFile(filePath, content || "", "utf-8")

    console.log(`[docs] Created file: ${filePath}`)

    return NextResponse.json({
      success: true,
      mode: "file",
      path: filePath,
      name: sanitizedName,
      message: "Document created successfully"
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create document"
    console.error("[docs] POST error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/projects/[id]/docs
 * Update an existing file-based document
 * For typed docs, use /api/projects/[id]/docs/[docId]
 *
 * Body: { path: string, content: string }
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()
    const { path: filePath, content } = body

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      )
    }

    if (!filePath) {
      return NextResponse.json(
        { error: "File path is required" },
        { status: 400 }
      )
    }

    // Security: Ensure the path is within the allowed directories
    const workingDirectory = await getProjectWorkingDirectory(projectId, request)
    if (workingDirectory && !filePath.startsWith(workingDirectory)) {
      return NextResponse.json(
        { error: "Access denied: File is outside project directory" },
        { status: 403 }
      )
    }

    // Ensure the file exists
    try {
      await fs.access(filePath)
    } catch {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      )
    }

    // Write file
    await fs.writeFile(filePath, content || "", "utf-8")

    console.log(`[docs] Updated file: ${filePath}`)

    return NextResponse.json({
      success: true,
      path: filePath,
      message: "Document updated successfully"
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update document"
    console.error("[docs] PUT error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/projects/[id]/docs
 * Delete a file-based document
 * For typed docs, use /api/projects/[id]/docs/[docId]
 *
 * Body: { path: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()
    const { path: filePath } = body

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      )
    }

    if (!filePath) {
      return NextResponse.json(
        { error: "File path is required" },
        { status: 400 }
      )
    }

    // Security: Ensure the path is within the allowed directories
    const workingDirectory = await getProjectWorkingDirectory(projectId, request)
    if (workingDirectory && !filePath.startsWith(workingDirectory)) {
      return NextResponse.json(
        { error: "Access denied: File is outside project directory" },
        { status: 403 }
      )
    }

    // Ensure the file exists
    try {
      await fs.access(filePath)
    } catch {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      )
    }

    // Delete file
    await fs.unlink(filePath)

    console.log(`[docs] Deleted file: ${filePath}`)

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully"
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete document"
    console.error("[docs] DELETE error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
