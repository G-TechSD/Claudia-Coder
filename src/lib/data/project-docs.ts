/**
 * Project Documents Data Store
 * Markdown file storage for project documentation
 *
 * Stores documents in: .local-storage/projects/{projectId}/docs/
 * Each document is a markdown file with metadata stored in a companion JSON file
 *
 * Document types:
 * - vision: Product vision and goals
 * - story: User stories and requirements
 * - notes: General project notes
 * - specs: Technical specifications
 */

import "server-only"

import { promises as fs } from "fs"
import path from "path"

// ============ Types ============

export type ProjectDocType = "vision" | "story" | "notes" | "specs"

export interface ProjectDoc {
  id: string
  projectId: string
  type: ProjectDocType
  title: string
  content: string
  createdAt: string
  updatedAt: string

  // Optional metadata
  tags?: string[]
  source?: "manual" | "linear" | "ai-generated"
  sourceRef?: string // e.g., Linear issue ID if extracted from Linear
  version?: number
}

export interface ProjectDocMetadata {
  id: string
  projectId: string
  type: ProjectDocType
  title: string
  createdAt: string
  updatedAt: string
  tags?: string[]
  source?: "manual" | "linear" | "ai-generated"
  sourceRef?: string
  version?: number
  fileName: string // Name of the markdown file
}

export interface ProjectDocListItem {
  id: string
  type: ProjectDocType
  title: string
  createdAt: string
  updatedAt: string
  tags?: string[]
  source?: ProjectDoc["source"]
  contentPreview?: string
}

// ============ Storage Configuration ============

const STORAGE_BASE = ".local-storage/projects"

// ============ UUID Generator ============

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

// ============ Path Helpers ============

/**
 * Get the docs directory path for a project
 */
export function getProjectDocsPath(projectId: string): string {
  const projectRoot = process.cwd()
  return path.join(projectRoot, STORAGE_BASE, projectId, "docs")
}

/**
 * Get the path for a specific document
 */
function getDocFilePath(projectId: string, docId: string): string {
  return path.join(getProjectDocsPath(projectId), `${docId}.md`)
}

/**
 * Get the index file path for a project's docs
 */
function getDocsIndexPath(projectId: string): string {
  return path.join(getProjectDocsPath(projectId), "_index.json")
}

// ============ Storage Operations ============

/**
 * Ensure the docs directory exists for a project
 */
export async function ensureProjectDocsDirectory(projectId: string): Promise<string> {
  const docsPath = getProjectDocsPath(projectId)
  await fs.mkdir(docsPath, { recursive: true })
  return docsPath
}

/**
 * Read the docs index for a project
 */
async function readDocsIndex(projectId: string): Promise<ProjectDocMetadata[]> {
  try {
    const indexPath = getDocsIndexPath(projectId)
    const content = await fs.readFile(indexPath, "utf-8")
    return JSON.parse(content)
  } catch (_err) {
    // Index doesn't exist yet, return empty array
    return []
  }
}

/**
 * Write the docs index for a project
 */
async function writeDocsIndex(projectId: string, index: ProjectDocMetadata[]): Promise<void> {
  await ensureProjectDocsDirectory(projectId)
  const indexPath = getDocsIndexPath(projectId)
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2))
}

// ============ CRUD Operations ============

/**
 * Create a new document for a project
 */
export async function createDoc(data: {
  projectId: string
  type: ProjectDocType
  title: string
  content: string
  tags?: string[]
  source?: ProjectDoc["source"]
  sourceRef?: string
}): Promise<ProjectDoc> {
  const docId = generateUUID()
  const now = new Date().toISOString()

  const doc: ProjectDoc = {
    id: docId,
    projectId: data.projectId,
    type: data.type,
    title: data.title,
    content: data.content,
    createdAt: now,
    updatedAt: now,
    tags: data.tags || [],
    source: data.source || "manual",
    sourceRef: data.sourceRef,
    version: 1
  }

  // Ensure directory exists
  await ensureProjectDocsDirectory(data.projectId)

  // Write markdown file
  const mdPath = getDocFilePath(data.projectId, docId)
  const mdContent = formatMarkdownWithFrontmatter(doc)
  await fs.writeFile(mdPath, mdContent)

  // Update index
  const index = await readDocsIndex(data.projectId)
  const metadata: ProjectDocMetadata = {
    id: docId,
    projectId: data.projectId,
    type: data.type,
    title: data.title,
    createdAt: now,
    updatedAt: now,
    tags: data.tags,
    source: data.source || "manual",
    sourceRef: data.sourceRef,
    version: 1,
    fileName: `${docId}.md`
  }
  index.push(metadata)
  await writeDocsIndex(data.projectId, index)

  console.log(`[project-docs] Created doc ${docId} for project ${data.projectId}: ${data.title}`)

  return doc
}

/**
 * Get a document by ID
 */
export async function getDoc(projectId: string, docId: string): Promise<ProjectDoc | null> {
  try {
    const mdPath = getDocFilePath(projectId, docId)
    const content = await fs.readFile(mdPath, "utf-8")
    return parseMarkdownWithFrontmatter(projectId, docId, content)
  } catch (_err) {
    console.log(`[project-docs] Doc not found: ${projectId}/${docId}`)
    return null
  }
}

/**
 * Update a document
 */
export async function updateDoc(
  projectId: string,
  docId: string,
  updates: Partial<Pick<ProjectDoc, "title" | "content" | "tags" | "type">>
): Promise<ProjectDoc | null> {
  const existing = await getDoc(projectId, docId)
  if (!existing) return null

  const now = new Date().toISOString()
  const updated: ProjectDoc = {
    ...existing,
    ...updates,
    updatedAt: now,
    version: (existing.version || 0) + 1
  }

  // Write updated markdown file
  const mdPath = getDocFilePath(projectId, docId)
  const mdContent = formatMarkdownWithFrontmatter(updated)
  await fs.writeFile(mdPath, mdContent)

  // Update index
  const index = await readDocsIndex(projectId)
  const idx = index.findIndex(m => m.id === docId)
  if (idx >= 0) {
    index[idx] = {
      ...index[idx],
      title: updated.title,
      type: updated.type,
      tags: updated.tags,
      updatedAt: now,
      version: updated.version
    }
    await writeDocsIndex(projectId, index)
  }

  console.log(`[project-docs] Updated doc ${docId}: ${updated.title}`)

  return updated
}

/**
 * Delete a document
 */
export async function deleteDoc(projectId: string, docId: string): Promise<boolean> {
  try {
    const mdPath = getDocFilePath(projectId, docId)
    await fs.unlink(mdPath)

    // Update index
    const index = await readDocsIndex(projectId)
    const filtered = index.filter(m => m.id !== docId)
    await writeDocsIndex(projectId, filtered)

    console.log(`[project-docs] Deleted doc ${docId}`)

    return true
  } catch (err) {
    console.error(`[project-docs] Failed to delete doc ${docId}:`, err)
    return false
  }
}

/**
 * List all documents for a project
 */
export async function listDocs(
  projectId: string,
  options?: {
    type?: ProjectDocType
    sortBy?: "createdAt" | "updatedAt" | "title"
    sortOrder?: "asc" | "desc"
    includePreview?: boolean
    previewLength?: number
  }
): Promise<ProjectDocListItem[]> {
  const index = await readDocsIndex(projectId)
  let items = [...index]

  // Filter by type
  if (options?.type) {
    items = items.filter(m => m.type === options.type)
  }

  // Sort
  const sortBy = options?.sortBy || "updatedAt"
  const sortOrder = options?.sortOrder || "desc"

  items.sort((a, b) => {
    let comparison = 0
    if (sortBy === "title") {
      comparison = a.title.localeCompare(b.title)
    } else {
      comparison = new Date(a[sortBy]).getTime() - new Date(b[sortBy]).getTime()
    }
    return sortOrder === "desc" ? -comparison : comparison
  })

  // Build list items
  const result: ProjectDocListItem[] = []

  for (const meta of items) {
    const item: ProjectDocListItem = {
      id: meta.id,
      type: meta.type,
      title: meta.title,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      tags: meta.tags,
      source: meta.source
    }

    // Add content preview if requested
    if (options?.includePreview) {
      try {
        const doc = await getDoc(projectId, meta.id)
        if (doc) {
          const previewLength = options.previewLength || 200
          item.contentPreview = doc.content
            .replace(/^#.*\n/gm, "") // Remove headings
            .replace(/\n+/g, " ") // Collapse newlines
            .trim()
            .slice(0, previewLength)
          if (doc.content.length > previewLength) {
            item.contentPreview += "..."
          }
        }
      } catch {
        // Skip preview on error
      }
    }

    result.push(item)
  }

  return result
}

/**
 * Get documents by type
 */
export async function getDocsByType(
  projectId: string,
  type: ProjectDocType
): Promise<ProjectDoc[]> {
  const index = await readDocsIndex(projectId)
  const docsOfType = index.filter(m => m.type === type)

  const docs: ProjectDoc[] = []
  for (const meta of docsOfType) {
    const doc = await getDoc(projectId, meta.id)
    if (doc) docs.push(doc)
  }

  return docs
}

// ============ Markdown Formatting ============

/**
 * Format a document as markdown with YAML frontmatter
 */
function formatMarkdownWithFrontmatter(doc: ProjectDoc): string {
  const frontmatter = [
    "---",
    `id: ${doc.id}`,
    `type: ${doc.type}`,
    `title: "${doc.title.replace(/"/g, '\\"')}"`,
    `createdAt: ${doc.createdAt}`,
    `updatedAt: ${doc.updatedAt}`,
  ]

  if (doc.tags && doc.tags.length > 0) {
    frontmatter.push(`tags: [${doc.tags.map(t => `"${t}"`).join(", ")}]`)
  }

  if (doc.source) {
    frontmatter.push(`source: ${doc.source}`)
  }

  if (doc.sourceRef) {
    frontmatter.push(`sourceRef: "${doc.sourceRef}"`)
  }

  if (doc.version) {
    frontmatter.push(`version: ${doc.version}`)
  }

  frontmatter.push("---", "")

  return frontmatter.join("\n") + doc.content
}

/**
 * Parse a markdown file with YAML frontmatter
 */
function parseMarkdownWithFrontmatter(
  projectId: string,
  docId: string,
  content: string
): ProjectDoc | null {
  // Check for frontmatter
  if (!content.startsWith("---")) {
    // No frontmatter, return as plain content
    return {
      id: docId,
      projectId,
      type: "notes",
      title: extractTitleFromMarkdown(content),
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }

  // Find the end of frontmatter
  const endIndex = content.indexOf("---", 3)
  if (endIndex === -1) {
    return null
  }

  const frontmatterStr = content.slice(3, endIndex).trim()
  const bodyContent = content.slice(endIndex + 3).trim()

  // Parse frontmatter (simple YAML parsing)
  const frontmatter: Record<string, unknown> = {}
  const lines = frontmatterStr.split("\n")

  for (const line of lines) {
    const colonIndex = line.indexOf(":")
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    let value: unknown = line.slice(colonIndex + 1).trim()

    // Parse arrays
    if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      const arrayStr = value.slice(1, -1)
      value = arrayStr
        .split(",")
        .map(s => s.trim().replace(/^["']|["']$/g, ""))
        .filter(s => s.length > 0)
    }
    // Parse quoted strings
    else if (typeof value === "string" && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\"/g, '"')
    }
    // Parse numbers
    else if (typeof value === "string" && /^\d+$/.test(value)) {
      value = parseInt(value, 10)
    }

    frontmatter[key] = value
  }

  return {
    id: docId,
    projectId,
    type: (frontmatter.type as ProjectDocType) || "notes",
    title: (frontmatter.title as string) || extractTitleFromMarkdown(bodyContent),
    content: bodyContent,
    createdAt: (frontmatter.createdAt as string) || new Date().toISOString(),
    updatedAt: (frontmatter.updatedAt as string) || new Date().toISOString(),
    tags: frontmatter.tags as string[] | undefined,
    source: frontmatter.source as ProjectDoc["source"],
    sourceRef: frontmatter.sourceRef as string | undefined,
    version: frontmatter.version as number | undefined
  }
}

/**
 * Extract a title from markdown content
 */
function extractTitleFromMarkdown(content: string): string {
  // Look for first heading
  const headingMatch = content.match(/^#\s+(.+)$/m)
  if (headingMatch) {
    return headingMatch[1].trim()
  }

  // Take first line
  const firstLine = content.split("\n")[0].trim()
  if (firstLine.length > 0 && firstLine.length <= 100) {
    return firstLine
  }

  // Truncate first line
  if (firstLine.length > 100) {
    return firstLine.slice(0, 97) + "..."
  }

  return "Untitled Document"
}

// ============ Document Type Helpers ============

/**
 * Get display name for a document type
 */
export function getDocTypeDisplayName(type: ProjectDocType): string {
  switch (type) {
    case "vision": return "Vision"
    case "story": return "Story"
    case "notes": return "Notes"
    case "specs": return "Specs"
    default: return type
  }
}

/**
 * Get icon name for a document type (for UI)
 */
export function getDocTypeIcon(type: ProjectDocType): string {
  switch (type) {
    case "vision": return "Eye"
    case "story": return "BookOpen"
    case "notes": return "FileText"
    case "specs": return "Code"
    default: return "File"
  }
}

// ============ Stats ============

export interface ProjectDocsStats {
  total: number
  byType: Record<ProjectDocType, number>
  recentlyUpdated: ProjectDocListItem[]
}

/**
 * Get statistics for a project's docs
 */
export async function getDocsStats(projectId: string): Promise<ProjectDocsStats> {
  const docs = await listDocs(projectId, { sortBy: "updatedAt", sortOrder: "desc" })

  const byType: Record<ProjectDocType, number> = {
    vision: 0,
    story: 0,
    notes: 0,
    specs: 0
  }

  for (const doc of docs) {
    if (byType[doc.type] !== undefined) {
      byType[doc.type]++
    }
  }

  return {
    total: docs.length,
    byType,
    recentlyUpdated: docs.slice(0, 5)
  }
}

// ============ Extraction Helpers ============

/**
 * Create a vision document from extracted Linear comments
 * This is called when importing a project from Linear with nuance extraction
 */
export async function createVisionFromLinearExtraction(
  projectId: string,
  data: {
    projectName: string
    extractedVision: string
    decisions?: string[]
    requirements?: string[]
    constraints?: string[]
    sourceIssueId?: string
  }
): Promise<ProjectDoc> {
  const content = formatVisionDocument(data)

  return createDoc({
    projectId,
    type: "vision",
    title: `${data.projectName} Vision`,
    content,
    tags: ["extracted", "linear"],
    source: "linear",
    sourceRef: data.sourceIssueId
  })
}

/**
 * Create a story document from extracted Linear comments
 */
export async function createStoryFromLinearExtraction(
  projectId: string,
  data: {
    title: string
    summary: string
    requirements?: string[]
    acceptanceCriteria?: string[]
    context?: string[]
    sourceIssueId?: string
  }
): Promise<ProjectDoc> {
  const content = formatStoryDocument(data)

  return createDoc({
    projectId,
    type: "story",
    title: data.title,
    content,
    tags: ["extracted", "linear"],
    source: "linear",
    sourceRef: data.sourceIssueId
  })
}

/**
 * Format a vision document from extracted data
 */
function formatVisionDocument(data: {
  projectName: string
  extractedVision: string
  decisions?: string[]
  requirements?: string[]
  constraints?: string[]
}): string {
  const sections: string[] = []

  sections.push(`# ${data.projectName} Vision\n`)
  sections.push(data.extractedVision)

  if (data.decisions && data.decisions.length > 0) {
    sections.push("\n## Key Decisions\n")
    sections.push(data.decisions.map(d => `- ${d}`).join("\n"))
  }

  if (data.requirements && data.requirements.length > 0) {
    sections.push("\n## Requirements\n")
    sections.push(data.requirements.map(r => `- ${r}`).join("\n"))
  }

  if (data.constraints && data.constraints.length > 0) {
    sections.push("\n## Constraints\n")
    sections.push(data.constraints.map(c => `- ${c}`).join("\n"))
  }

  return sections.join("\n")
}

/**
 * Format a story document from extracted data
 */
function formatStoryDocument(data: {
  title: string
  summary: string
  requirements?: string[]
  acceptanceCriteria?: string[]
  context?: string[]
}): string {
  const sections: string[] = []

  sections.push(`# ${data.title}\n`)
  sections.push(data.summary)

  if (data.requirements && data.requirements.length > 0) {
    sections.push("\n## Requirements\n")
    sections.push(data.requirements.map(r => `- ${r}`).join("\n"))
  }

  if (data.acceptanceCriteria && data.acceptanceCriteria.length > 0) {
    sections.push("\n## Acceptance Criteria\n")
    sections.push(data.acceptanceCriteria.map(ac => `- [ ] ${ac}`).join("\n"))
  }

  if (data.context && data.context.length > 0) {
    sections.push("\n## Context\n")
    sections.push(data.context.map(c => `- ${c}`).join("\n"))
  }

  return sections.join("\n")
}
