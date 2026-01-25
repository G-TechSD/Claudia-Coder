/**
 * Server-Side Wiki Storage
 *
 * This module provides server-side file operations for wiki document storage.
 * The file ~/.claudia-data/wiki-documents.json is the SOURCE OF TRUTH for all wiki docs.
 *
 * IMPORTANT: This module should ONLY be imported in server-side code (API routes).
 * Do not import this in client-side components or pages.
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

// Wiki document types
export type WikiDocType =
  | "architecture"
  | "api"
  | "component"
  | "changelog"
  | "guide"
  | "reference"
  | "runbook"
  | "decision"
  | "custom"

// Wiki document interface
export interface WikiDocument {
  id: string
  title: string
  slug: string
  content: string
  type: WikiDocType
  tags: string[]
  parentId?: string
  projectId?: string
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
  version: number
  isPublished: boolean
}

// Special project IDs for wiki scopes
export const GLOBAL_WIKI_ID = "__global__"
export const CLAUDIA_CODER_WIKI_ID = "__claudia_coder__"

// Server-side storage location
const DATA_DIR = process.env.CLAUDIA_DATA_DIR || path.join(os.homedir(), ".claudia-data")
const WIKI_FILE = path.join(DATA_DIR, "wiki-documents.json")

// UUID generator for server-side use
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

/**
 * Ensure the data directory exists
 */
async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
  } catch {
    // Directory might already exist
  }
}

/**
 * Read wiki documents from the server-side JSON file
 */
export async function readWikiFile(): Promise<WikiDocument[]> {
  try {
    await ensureDataDir()
    const content = await fs.readFile(WIKI_FILE, "utf-8")
    return JSON.parse(content) as WikiDocument[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return []
    }
    console.error("[server-wiki] Error reading wiki file:", error)
    throw error
  }
}

/**
 * Write wiki documents to the server-side JSON file
 * Uses atomic write (temp file + rename) to prevent corruption
 */
async function writeWikiFile(documents: WikiDocument[]): Promise<void> {
  await ensureDataDir()
  const tempPath = `${WIKI_FILE}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(documents, null, 2), "utf-8")
  await fs.rename(tempPath, WIKI_FILE)
}

/**
 * Generate a URL-friendly slug
 */
function generateSlug(title: string, existingSlugs: string[]): string {
  let baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  let slug = baseSlug
  let counter = 1

  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`
    counter++
  }

  return slug
}

/**
 * Get all wiki documents
 */
export async function getAllWikiDocuments(): Promise<WikiDocument[]> {
  return readWikiFile()
}

/**
 * Get wiki documents for a specific user
 * Includes user's docs and public/Claudia Coder docs
 */
export async function getWikiDocumentsForUser(userId: string): Promise<WikiDocument[]> {
  const allDocs = await readWikiFile()

  return allDocs.filter(
    (doc) =>
      doc.createdBy === userId ||
      doc.projectId === CLAUDIA_CODER_WIKI_ID ||
      doc.projectId === GLOBAL_WIKI_ID ||
      doc.isPublished
  )
}

/**
 * Get a single wiki document by ID
 */
export async function getWikiDocumentById(id: string): Promise<WikiDocument | null> {
  const allDocs = await readWikiFile()
  return allDocs.find((d) => d.id === id) || null
}

/**
 * Get wiki documents by project ID
 */
export async function getWikiDocumentsByProject(projectId: string): Promise<WikiDocument[]> {
  const allDocs = await readWikiFile()
  return allDocs.filter((d) => d.projectId === projectId)
}

/**
 * Get wiki documents by type
 */
export async function getWikiDocumentsByType(type: WikiDocType): Promise<WikiDocument[]> {
  const allDocs = await readWikiFile()
  return allDocs.filter((d) => d.type === type)
}

/**
 * Search wiki documents by title or content
 */
export async function searchWikiDocuments(query: string): Promise<WikiDocument[]> {
  const allDocs = await readWikiFile()
  const lowerQuery = query.toLowerCase()
  return allDocs.filter(
    (d) =>
      d.title.toLowerCase().includes(lowerQuery) ||
      d.content.toLowerCase().includes(lowerQuery) ||
      d.tags.some((t) => t.toLowerCase().includes(lowerQuery))
  )
}

/**
 * Create a new wiki document
 */
export async function createWikiDocument(
  data: Omit<WikiDocument, "id" | "slug" | "createdAt" | "updatedAt" | "version">
): Promise<WikiDocument> {
  const documents = await readWikiFile()
  const existingSlugs = documents.map((d) => d.slug)

  const now = new Date().toISOString()
  const document: WikiDocument = {
    ...data,
    id: `wiki_${generateUUID()}`,
    slug: generateSlug(data.title, existingSlugs),
    createdAt: now,
    updatedAt: now,
    version: 1,
  }

  documents.push(document)
  await writeWikiFile(documents)

  console.log(`[server-wiki] Created document ${document.id}: ${document.title}`)
  return document
}

/**
 * Update an existing wiki document
 */
export async function updateWikiDocument(
  id: string,
  updates: Partial<Omit<WikiDocument, "id" | "createdAt" | "createdBy">>
): Promise<WikiDocument | null> {
  const documents = await readWikiFile()
  const index = documents.findIndex((d) => d.id === id)

  if (index === -1) return null

  const existing = documents[index]

  // If title changed, regenerate slug
  let newSlug = existing.slug
  if (updates.title && updates.title !== existing.title) {
    const otherSlugs = documents.filter((d) => d.id !== id).map((d) => d.slug)
    newSlug = generateSlug(updates.title, otherSlugs)
  }

  documents[index] = {
    ...existing,
    ...updates,
    slug: newSlug,
    updatedAt: new Date().toISOString(),
    version: existing.version + 1,
  }

  await writeWikiFile(documents)
  console.log(`[server-wiki] Updated document ${id}`)
  return documents[index]
}

/**
 * Delete a wiki document
 */
export async function deleteWikiDocument(id: string): Promise<boolean> {
  const documents = await readWikiFile()
  const filtered = documents.filter((d) => d.id !== id)

  if (filtered.length === documents.length) return false

  await writeWikiFile(filtered)
  console.log(`[server-wiki] Deleted document ${id}`)
  return true
}

/**
 * Bulk create wiki documents (for seeding)
 * Skips documents with titles that already exist
 */
export async function bulkCreateWikiDocuments(
  docs: Omit<WikiDocument, "id" | "slug" | "createdAt" | "updatedAt" | "version">[]
): Promise<{ created: WikiDocument[]; skipped: string[] }> {
  const documents = await readWikiFile()
  const existingTitles = new Set(documents.map((d) => d.title))
  const existingSlugs = documents.map((d) => d.slug)

  const created: WikiDocument[] = []
  const skipped: string[] = []
  const now = new Date().toISOString()

  for (const data of docs) {
    if (existingTitles.has(data.title)) {
      skipped.push(data.title)
      continue
    }

    const document: WikiDocument = {
      ...data,
      id: `wiki_${generateUUID()}`,
      slug: generateSlug(data.title, existingSlugs),
      createdAt: now,
      updatedAt: now,
      version: 1,
    }

    documents.push(document)
    existingSlugs.push(document.slug)
    existingTitles.add(document.title)
    created.push(document)
  }

  if (created.length > 0) {
    await writeWikiFile(documents)
    console.log(`[server-wiki] Bulk created ${created.length} documents, skipped ${skipped.length}`)
  }

  return { created, skipped }
}

// Document type labels for UI
export const WIKI_DOC_TYPE_LABELS: Record<WikiDocType, string> = {
  architecture: "Architecture",
  api: "API Reference",
  component: "Component",
  changelog: "Change Log",
  guide: "Guide",
  reference: "Reference",
  runbook: "Runbook",
  decision: "Decision Record",
  custom: "Custom",
}
