/**
 * Project Folder Scanner Service
 *
 * Watches .claudia/status/ and .claudia/requests/ folders for updates.
 * Parses markdown files with YAML frontmatter and returns structured data.
 */

import * as fs from "fs/promises"
import * as path from "path"

// ============ Types ============

export interface ClaudiaStatusUpdate {
  id: string
  timestamp: string
  status: "working" | "waiting" | "completed" | "error" | "paused"
  phase?: string
  progress?: number
  message: string
  details?: string
  filePath: string
}

export interface ClaudiaRequest {
  id: string
  timestamp: string
  type: "approval" | "input" | "clarification" | "decision" | "file_access"
  priority: "low" | "normal" | "high" | "critical"
  title: string
  description: string
  options?: string[]
  context?: Record<string, unknown>
  timeout?: number
  filePath: string
}

export interface ScanResult {
  statusUpdates: ClaudiaStatusUpdate[]
  requests: ClaudiaRequest[]
  errors: string[]
}

export interface FolderWatcher {
  start: () => void
  stop: () => void
  isRunning: () => boolean
}

// ============ YAML Frontmatter Parser ============

interface ParsedFrontmatter {
  frontmatter: Record<string, unknown>
  content: string
}

/**
 * Parse YAML frontmatter from a markdown file.
 * Supports simple key-value pairs, arrays, and nested objects.
 */
function parseFrontmatter(fileContent: string): ParsedFrontmatter {
  const frontmatter: Record<string, unknown> = {}
  let content = fileContent

  // Check for frontmatter delimiters
  const frontmatterMatch = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)

  if (!frontmatterMatch) {
    return { frontmatter: {}, content: fileContent }
  }

  const yamlContent = frontmatterMatch[1]
  content = frontmatterMatch[2]

  // Parse YAML-like content
  const lines = yamlContent.split("\n")
  let currentKey: string | null = null
  let currentArray: string[] | null = null

  for (const line of lines) {
    const trimmedLine = line.trim()

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue
    }

    // Check for array item
    if (trimmedLine.startsWith("- ") && currentKey && currentArray !== null) {
      currentArray.push(trimmedLine.substring(2).trim())
      continue
    }

    // Save previous array if exists
    if (currentArray !== null && currentKey) {
      frontmatter[currentKey] = currentArray
      currentArray = null
    }

    // Parse key-value pair
    const colonIndex = trimmedLine.indexOf(":")
    if (colonIndex > 0) {
      const key = trimmedLine.substring(0, colonIndex).trim()
      const value = trimmedLine.substring(colonIndex + 1).trim()

      currentKey = key

      if (value === "") {
        // Could be an array or object following
        currentArray = []
      } else if (value === "true" || value === "false") {
        frontmatter[key] = value === "true"
      } else if (!isNaN(Number(value)) && value !== "") {
        frontmatter[key] = Number(value)
      } else {
        // String value - remove quotes if present
        frontmatter[key] = value.replace(/^["']|["']$/g, "")
      }
    }
  }

  // Save final array if exists
  if (currentArray !== null && currentKey) {
    frontmatter[currentKey] = currentArray
  }

  return { frontmatter, content }
}

// ============ File Parsing Functions ============

/**
 * Parse a status update markdown file.
 *
 * Expected format:
 * ---
 * id: unique-id
 * timestamp: 2024-01-09T12:00:00Z
 * status: working
 * phase: implementation
 * progress: 50
 * ---
 *
 * Status message here...
 *
 * ## Details
 * Additional details...
 */
export function parseStatusUpdate(content: string, filePath: string = ""): ClaudiaStatusUpdate | null {
  try {
    const { frontmatter, content: body } = parseFrontmatter(content)

    // Validate required fields
    if (!frontmatter.status) {
      return null
    }

    // Extract message from body (first paragraph)
    const bodyLines = body.trim().split("\n\n")
    const message = bodyLines[0]?.trim() || ""

    // Extract details (everything after first paragraph)
    const details = bodyLines.slice(1).join("\n\n").trim() || undefined

    return {
      id: String(frontmatter.id || generateId()),
      timestamp: String(frontmatter.timestamp || new Date().toISOString()),
      status: validateStatus(String(frontmatter.status)),
      phase: frontmatter.phase ? String(frontmatter.phase) : undefined,
      progress: typeof frontmatter.progress === "number" ? frontmatter.progress : undefined,
      message,
      details,
      filePath
    }
  } catch (error) {
    console.error("Failed to parse status update:", error)
    return null
  }
}

/**
 * Parse a request markdown file.
 *
 * Expected format:
 * ---
 * id: unique-id
 * timestamp: 2024-01-09T12:00:00Z
 * type: approval
 * priority: high
 * title: Request Title
 * timeout: 300
 * options:
 *   - Option 1
 *   - Option 2
 * ---
 *
 * Description of the request...
 *
 * ## Context
 * Additional context...
 */
export function parseRequest(content: string, filePath: string = ""): ClaudiaRequest | null {
  try {
    const { frontmatter, content: body } = parseFrontmatter(content)

    // Validate required fields
    if (!frontmatter.type || !frontmatter.title) {
      return null
    }

    // Extract description from body (first paragraph)
    const bodyLines = body.trim().split("\n\n")
    const description = bodyLines[0]?.trim() || ""

    // Parse context section if present
    let context: Record<string, unknown> | undefined
    const contextMatch = body.match(/##\s*Context\s*\n([\s\S]*?)(?=\n##|$)/)
    if (contextMatch) {
      try {
        // Try to parse as key-value pairs
        const contextLines = contextMatch[1].trim().split("\n")
        context = {}
        for (const line of contextLines) {
          const colonIndex = line.indexOf(":")
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim()
            const value = line.substring(colonIndex + 1).trim()
            context[key] = value
          }
        }
      } catch {
        // Ignore context parsing errors
      }
    }

    return {
      id: String(frontmatter.id || generateId()),
      timestamp: String(frontmatter.timestamp || new Date().toISOString()),
      type: validateRequestType(String(frontmatter.type)),
      priority: validatePriority(String(frontmatter.priority || "normal")),
      title: String(frontmatter.title),
      description,
      options: Array.isArray(frontmatter.options)
        ? frontmatter.options.map(String)
        : undefined,
      context,
      timeout: typeof frontmatter.timeout === "number" ? frontmatter.timeout : undefined,
      filePath
    }
  } catch (error) {
    console.error("Failed to parse request:", error)
    return null
  }
}

// ============ Validation Helpers ============

function validateStatus(status: string): ClaudiaStatusUpdate["status"] {
  const validStatuses = ["working", "waiting", "completed", "error", "paused"]
  return validStatuses.includes(status)
    ? status as ClaudiaStatusUpdate["status"]
    : "working"
}

function validateRequestType(type: string): ClaudiaRequest["type"] {
  const validTypes = ["approval", "input", "clarification", "decision", "file_access"]
  return validTypes.includes(type)
    ? type as ClaudiaRequest["type"]
    : "input"
}

function validatePriority(priority: string): ClaudiaRequest["priority"] {
  const validPriorities = ["low", "normal", "high", "critical"]
  return validPriorities.includes(priority)
    ? priority as ClaudiaRequest["priority"]
    : "normal"
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// ============ Folder Scanning ============

/**
 * Scan a project's .claudia folder for new/updated files.
 */
export async function scanProjectFolder(projectPath: string): Promise<ScanResult> {
  const result: ScanResult = {
    statusUpdates: [],
    requests: [],
    errors: []
  }

  const claudiaPath = path.join(projectPath, ".claudia")
  const statusPath = path.join(claudiaPath, "status")
  const requestsPath = path.join(claudiaPath, "requests")

  // Scan status updates
  try {
    const statusFiles = await getMarkdownFiles(statusPath)
    for (const filePath of statusFiles) {
      try {
        const content = await fs.readFile(filePath, "utf-8")
        const statusUpdate = parseStatusUpdate(content, filePath)
        if (statusUpdate) {
          result.statusUpdates.push(statusUpdate)
        }
      } catch (error) {
        result.errors.push(`Failed to read status file ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }
  } catch (error) {
    // Status folder might not exist
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      result.errors.push(`Failed to scan status folder: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  // Scan requests
  try {
    const requestFiles = await getMarkdownFiles(requestsPath)
    for (const filePath of requestFiles) {
      try {
        const content = await fs.readFile(filePath, "utf-8")
        const request = parseRequest(content, filePath)
        if (request) {
          result.requests.push(request)
        }
      } catch (error) {
        result.errors.push(`Failed to read request file ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }
  } catch (error) {
    // Requests folder might not exist
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      result.errors.push(`Failed to scan requests folder: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  // Sort by timestamp (newest first)
  result.statusUpdates.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
  result.requests.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return result
}

/**
 * Get all markdown files in a directory (non-recursive).
 */
async function getMarkdownFiles(dirPath: string): Promise<string[]> {
  const files: string[] = []

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".markdown"))) {
        files.push(path.join(dirPath, entry.name))
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error
    }
  }

  return files
}

// ============ File Processing ============

/**
 * Mark files as processed by moving them to a processed/ subdirectory.
 * Creates the processed/ directory if it doesn't exist.
 */
export async function markFilesProcessed(files: string[]): Promise<void> {
  for (const filePath of files) {
    try {
      const dir = path.dirname(filePath)
      const processedDir = path.join(dir, "processed")
      const fileName = path.basename(filePath)
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const processedFileName = `${timestamp}_${fileName}`

      // Ensure processed directory exists
      await fs.mkdir(processedDir, { recursive: true })

      // Move file to processed directory
      const newPath = path.join(processedDir, processedFileName)
      await fs.rename(filePath, newPath)
    } catch (error) {
      console.error(`Failed to mark file as processed: ${filePath}`, error)
      throw error
    }
  }
}

// ============ Folder Watcher ============

/**
 * Create a folder watcher that monitors .claudia/status/ and .claudia/requests/
 * for changes and calls the onUpdate callback with scan results.
 *
 * Uses fs.watch for native filesystem watching with debouncing.
 */
export function createFolderWatcher(
  projectPath: string,
  onUpdate: (result: ScanResult) => void,
  options: { debounceMs?: number; initialScan?: boolean } = {}
): FolderWatcher {
  const { debounceMs = 500, initialScan = true } = options

  const claudiaPath = path.join(projectPath, ".claudia")
  const statusPath = path.join(claudiaPath, "status")
  const requestsPath = path.join(claudiaPath, "requests")

  let abortControllers: AbortController[] = []
  let debounceTimeout: NodeJS.Timeout | null = null
  let running = false

  const triggerScan = async () => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
    }

    debounceTimeout = setTimeout(async () => {
      try {
        const result = await scanProjectFolder(projectPath)
        onUpdate(result)
      } catch (error) {
        console.error("Scan failed:", error)
        onUpdate({
          statusUpdates: [],
          requests: [],
          errors: [`Scan failed: ${error instanceof Error ? error.message : "Unknown error"}`]
        })
      }
    }, debounceMs)
  }

  const watchDirectory = async (dirPath: string): Promise<void> => {
    try {
      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true })

      const ac = new AbortController()
      abortControllers.push(ac)

      // Use fs.watch with AbortController for cleanup
      const watcher = fs.watch(dirPath, { signal: ac.signal })

      // Handle watch events
      ;(async () => {
        try {
          for await (const event of watcher) {
            if (event.filename?.endsWith(".md") || event.filename?.endsWith(".markdown")) {
              triggerScan()
            }
          }
        } catch (error) {
          // AbortError is expected when stopping
          if ((error as Error).name !== "AbortError") {
            console.error(`Watch error for ${dirPath}:`, error)
          }
        }
      })()
    } catch (error) {
      console.error(`Failed to watch ${dirPath}:`, error)
    }
  }

  return {
    start: async () => {
      if (running) return
      running = true

      // Start watching directories
      await Promise.all([
        watchDirectory(statusPath),
        watchDirectory(requestsPath)
      ])

      // Perform initial scan if requested
      if (initialScan) {
        triggerScan()
      }
    },

    stop: () => {
      running = false

      // Clear debounce timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout)
        debounceTimeout = null
      }

      // Abort all watchers
      for (const ac of abortControllers) {
        ac.abort()
      }
      abortControllers = []
    },

    isRunning: () => running
  }
}

// ============ Utility Functions ============

/**
 * Ensure the .claudia directory structure exists for a project.
 */
export async function ensureClaudiaStructure(projectPath: string): Promise<void> {
  const claudiaPath = path.join(projectPath, ".claudia")
  const statusPath = path.join(claudiaPath, "status")
  const requestsPath = path.join(claudiaPath, "requests")

  await fs.mkdir(statusPath, { recursive: true })
  await fs.mkdir(requestsPath, { recursive: true })
}

/**
 * Write a status update file to the project's .claudia/status/ folder.
 */
export async function writeStatusUpdate(
  projectPath: string,
  status: Omit<ClaudiaStatusUpdate, "id" | "timestamp" | "filePath">
): Promise<string> {
  const statusPath = path.join(projectPath, ".claudia", "status")
  await fs.mkdir(statusPath, { recursive: true })

  const id = generateId()
  const timestamp = new Date().toISOString()
  const fileName = `${timestamp.replace(/[:.]/g, "-")}_${status.status}.md`
  const filePath = path.join(statusPath, fileName)

  let content = `---
id: ${id}
timestamp: ${timestamp}
status: ${status.status}
`

  if (status.phase) {
    content += `phase: ${status.phase}\n`
  }
  if (status.progress !== undefined) {
    content += `progress: ${status.progress}\n`
  }

  content += `---

${status.message}
`

  if (status.details) {
    content += `
## Details

${status.details}
`
  }

  await fs.writeFile(filePath, content, "utf-8")
  return filePath
}

/**
 * Write a request file to the project's .claudia/requests/ folder.
 */
export async function writeRequest(
  projectPath: string,
  request: Omit<ClaudiaRequest, "id" | "timestamp" | "filePath">
): Promise<string> {
  const requestsPath = path.join(projectPath, ".claudia", "requests")
  await fs.mkdir(requestsPath, { recursive: true })

  const id = generateId()
  const timestamp = new Date().toISOString()
  const fileName = `${timestamp.replace(/[:.]/g, "-")}_${request.type}_${request.priority}.md`
  const filePath = path.join(requestsPath, fileName)

  let content = `---
id: ${id}
timestamp: ${timestamp}
type: ${request.type}
priority: ${request.priority}
title: "${request.title.replace(/"/g, '\\"')}"
`

  if (request.timeout !== undefined) {
    content += `timeout: ${request.timeout}\n`
  }

  if (request.options && request.options.length > 0) {
    content += `options:\n`
    for (const option of request.options) {
      content += `  - ${option}\n`
    }
  }

  content += `---

${request.description}
`

  if (request.context && Object.keys(request.context).length > 0) {
    content += `
## Context

`
    for (const [key, value] of Object.entries(request.context)) {
      content += `${key}: ${JSON.stringify(value)}\n`
    }
  }

  await fs.writeFile(filePath, content, "utf-8")
  return filePath
}

/**
 * Delete old processed files that are older than the specified days.
 */
export async function cleanupProcessedFiles(
  projectPath: string,
  maxAgeDays: number = 7
): Promise<number> {
  const claudiaPath = path.join(projectPath, ".claudia")
  const processedDirs = [
    path.join(claudiaPath, "status", "processed"),
    path.join(claudiaPath, "requests", "processed")
  ]

  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000
  const now = Date.now()
  let deletedCount = 0

  for (const dir of processedDirs) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(dir, entry.name)
          const stats = await fs.stat(filePath)
          if (now - stats.mtimeMs > maxAgeMs) {
            await fs.unlink(filePath)
            deletedCount++
          }
        }
      }
    } catch (error) {
      // Directory might not exist, ignore
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error(`Failed to cleanup ${dir}:`, error)
      }
    }
  }

  return deletedCount
}
