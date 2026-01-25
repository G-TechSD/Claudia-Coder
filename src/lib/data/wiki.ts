/**
 * Documentation Wiki - Data Layer
 *
 * Provides storage and retrieval for wiki documents including:
 * - Code documentation
 * - Change logs
 * - Architecture notes
 * - API references
 */

import { getUserStorageKey, getUserStorageItem, setUserStorageItem } from "./user-storage"

// Storage key
const WIKI_STORAGE_KEY = "wiki_documents"

// Document types for categorization
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
  parentId?: string // For nested documents
  projectId?: string // Optional project association
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
  version: number
  isPublished: boolean
}

// Version history entry
export interface WikiVersion {
  id: string
  documentId: string
  content: string
  version: number
  createdAt: string
  createdBy: string
  changeNote?: string
}

// Wiki tree node for navigation
export interface WikiTreeNode {
  document: WikiDocument
  children: WikiTreeNode[]
}

// Get all wiki documents
export function getWikiDocuments(userId?: string): WikiDocument[] {
  if (!userId) return []
  const docs = getUserStorageItem<WikiDocument[]>(userId, WIKI_STORAGE_KEY)
  return docs || []
}

// Get a single document by ID
export function getWikiDocument(id: string, userId?: string): WikiDocument | null {
  const docs = getWikiDocuments(userId)
  return docs.find(d => d.id === id) || null
}

// Get a single document by slug
export function getWikiDocumentBySlug(slug: string, userId?: string): WikiDocument | null {
  const docs = getWikiDocuments(userId)
  return docs.find(d => d.slug === slug) || null
}

// Get documents by type
export function getWikiDocumentsByType(type: WikiDocType, userId?: string): WikiDocument[] {
  const docs = getWikiDocuments(userId)
  return docs.filter(d => d.type === type)
}

// Special project ID for global/system documentation
export const GLOBAL_WIKI_ID = "__global__"
export const CLAUDIA_CODER_WIKI_ID = "__claudia_coder__"

// Get documents by project
export function getWikiDocumentsByProject(projectId: string, userId?: string): WikiDocument[] {
  const docs = getWikiDocuments(userId)
  return docs.filter(d => d.projectId === projectId)
}

// Get global documents (no project association)
export function getGlobalWikiDocuments(userId?: string): WikiDocument[] {
  const docs = getWikiDocuments(userId)
  return docs.filter(d => !d.projectId || d.projectId === GLOBAL_WIKI_ID || d.projectId === CLAUDIA_CODER_WIKI_ID)
}

// Get Claudia Coder system documentation
export function getClaudiaCoderDocs(userId?: string): WikiDocument[] {
  const docs = getWikiDocuments(userId)
  return docs.filter(d => d.projectId === CLAUDIA_CODER_WIKI_ID)
}

// Get documents by tag
export function getWikiDocumentsByTag(tag: string, userId?: string): WikiDocument[] {
  const docs = getWikiDocuments(userId)
  return docs.filter(d => d.tags.includes(tag))
}

// Search documents by title or content
export function searchWikiDocuments(query: string, userId?: string): WikiDocument[] {
  const docs = getWikiDocuments(userId)
  const lowerQuery = query.toLowerCase()
  return docs.filter(d =>
    d.title.toLowerCase().includes(lowerQuery) ||
    d.content.toLowerCase().includes(lowerQuery) ||
    d.tags.some(t => t.toLowerCase().includes(lowerQuery))
  )
}

// Generate a URL-friendly slug
export function generateSlug(title: string, existingSlugs: string[]): string {
  let baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  let slug = baseSlug
  let counter = 1

  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`
    counter++
  }

  return slug
}

// Create a new document
export function createWikiDocument(
  doc: Omit<WikiDocument, 'id' | 'slug' | 'createdAt' | 'updatedAt' | 'version'>,
  userId?: string
): WikiDocument {
  const docs = getWikiDocuments(userId)
  const existingSlugs = docs.map(d => d.slug)

  const newDoc: WikiDocument = {
    ...doc,
    id: `wiki_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    slug: generateSlug(doc.title, existingSlugs),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  }

  docs.push(newDoc)
  if (userId) setUserStorageItem(userId, WIKI_STORAGE_KEY, docs)

  return newDoc
}

// Update an existing document
export function updateWikiDocument(
  id: string,
  updates: Partial<Omit<WikiDocument, 'id' | 'createdAt' | 'createdBy'>>,
  userId?: string
): WikiDocument | null {
  const docs = getWikiDocuments(userId)
  const index = docs.findIndex(d => d.id === id)

  if (index === -1) return null

  const existingDoc = docs[index]

  // If title changed, regenerate slug
  let newSlug = existingDoc.slug
  if (updates.title && updates.title !== existingDoc.title) {
    const otherSlugs = docs.filter(d => d.id !== id).map(d => d.slug)
    newSlug = generateSlug(updates.title, otherSlugs)
  }

  const updatedDoc: WikiDocument = {
    ...existingDoc,
    ...updates,
    slug: newSlug,
    updatedAt: new Date().toISOString(),
    version: existingDoc.version + 1,
  }

  docs[index] = updatedDoc
  if (userId) setUserStorageItem(userId, WIKI_STORAGE_KEY, docs)

  return updatedDoc
}

// Delete a document
export function deleteWikiDocument(id: string, userId?: string): boolean {
  const docs = getWikiDocuments(userId)
  const index = docs.findIndex(d => d.id === id)

  if (index === -1) return false

  docs.splice(index, 1)
  if (userId) setUserStorageItem(userId, WIKI_STORAGE_KEY, docs)

  return true
}

// Build tree structure from flat documents
export function buildWikiTree(userId?: string): WikiTreeNode[] {
  const docs = getWikiDocuments(userId)
  const docMap = new Map<string, WikiDocument>()
  const childrenMap = new Map<string, WikiDocument[]>()

  // Index documents
  docs.forEach(doc => {
    docMap.set(doc.id, doc)
    if (doc.parentId) {
      const siblings = childrenMap.get(doc.parentId) || []
      siblings.push(doc)
      childrenMap.set(doc.parentId, siblings)
    }
  })

  // Build tree recursively
  function buildNode(doc: WikiDocument): WikiTreeNode {
    const children = childrenMap.get(doc.id) || []
    return {
      document: doc,
      children: children.map(buildNode).sort((a, b) =>
        a.document.title.localeCompare(b.document.title)
      )
    }
  }

  // Get root documents (no parent)
  const rootDocs = docs.filter(d => !d.parentId)
  return rootDocs.map(buildNode).sort((a, b) =>
    a.document.title.localeCompare(b.document.title)
  )
}

// Get all unique tags
export function getAllWikiTags(userId?: string): string[] {
  const docs = getWikiDocuments(userId)
  const tagsSet = new Set<string>()
  docs.forEach(doc => doc.tags.forEach(tag => tagsSet.add(tag)))
  return Array.from(tagsSet).sort()
}

// Version history storage
const VERSION_STORAGE_KEY = "wiki_versions"

// Get version history for a document
export function getWikiVersions(documentId: string, userId?: string): WikiVersion[] {
  if (!userId) return []
  const versions = getUserStorageItem<WikiVersion[]>(userId, VERSION_STORAGE_KEY) || []
  return versions
    .filter(v => v.documentId === documentId)
    .sort((a, b) => b.version - a.version)
}

// Save a version snapshot
export function saveWikiVersion(
  documentId: string,
  content: string,
  version: number,
  createdBy: string,
  changeNote?: string,
  userId?: string
): WikiVersion | null {
  if (!userId) return null
  const versions = getUserStorageItem<WikiVersion[]>(userId, VERSION_STORAGE_KEY) || []

  const newVersion: WikiVersion = {
    id: `wikiversion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    documentId,
    content,
    version,
    createdAt: new Date().toISOString(),
    createdBy,
    changeNote
  }

  versions.push(newVersion)
  setUserStorageItem(userId, VERSION_STORAGE_KEY, versions)

  return newVersion
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
  custom: "Custom"
}

// Document type icons (Lucide icon names)
export const WIKI_DOC_TYPE_ICONS: Record<WikiDocType, string> = {
  architecture: "Building2",
  api: "Plug",
  component: "Component",
  changelog: "History",
  guide: "BookOpen",
  reference: "FileText",
  runbook: "Terminal",
  decision: "Scale",
  custom: "File"
}
