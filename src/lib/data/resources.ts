/**
 * Project Resources Data Store
 * Handles file attachments with IndexedDB for blob storage
 *
 * IMPORTANT: All resource data is user-scoped. Resources belong to specific users
 * and are stored in user-specific localStorage keys and IndexedDB databases.
 */

import {
  ProjectResource,
  ResourceType,
  ResourceStorageType,
  BrainDump,
  BrainDumpStatus,
  TranscriptionData
} from "./types"
import {
  getUserStorageItem,
  setUserStorageItem,
  getUserIndexedDBName,
  getUserBlobKey,
  USER_STORAGE_KEYS,
  dispatchStorageChange
} from "./user-storage"

// UUID generator
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

// Legacy storage keys (kept for migration purposes)
const LEGACY_RESOURCES_KEY = "claudia_resources"
const LEGACY_BRAIN_DUMPS_KEY = "claudia_brain_dumps"
const DB_NAME = "claudia-files"
const DB_VERSION = 1
const STORE_NAME = "resources"

// ============ IndexedDB Helpers ============

// Cache for database connections per user
const dbCache: Map<string, Promise<IDBDatabase>> = new Map()

/**
 * Open user-scoped IndexedDB database
 */
function openDatabase(userId?: string): Promise<IDBDatabase> {
  const dbName = userId ? getUserIndexedDBName(userId, "files") : DB_NAME

  if (dbCache.has(dbName)) {
    return dbCache.get(dbName)!
  }

  const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB not available on server"))
      return
    }

    const request = indexedDB.open(dbName, DB_VERSION)

    request.onerror = () => {
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" })
      }
    }
  })

  dbCache.set(dbName, dbPromise)
  return dbPromise
}

/**
 * Save a resource blob to IndexedDB
 * @param key - The blob key
 * @param blob - The blob data
 * @param metadata - Optional metadata
 * @param userId - The user ID (for user-scoped storage)
 */
export async function saveResourceBlob(
  key: string,
  blob: Blob,
  metadata?: { name: string; type: string },
  userId?: string
): Promise<void> {
  const db = await openDatabase(userId)
  const scopedKey = userId ? getUserBlobKey(userId, key) : key

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put({
      key: scopedKey,
      blob,
      metadata: metadata || {},
      uploadedAt: new Date().toISOString()
    })

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get a resource blob from IndexedDB
 * @param key - The blob key
 * @param userId - The user ID (for user-scoped storage)
 */
export async function getResourceBlob(key: string, userId?: string): Promise<Blob | null> {
  const db = await openDatabase(userId)
  const scopedKey = userId ? getUserBlobKey(userId, key) : key

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(scopedKey)

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.blob)
      } else {
        resolve(null)
      }
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Delete a resource blob from IndexedDB
 * @param key - The blob key
 * @param userId - The user ID (for user-scoped storage)
 */
export async function deleteResourceBlob(key: string, userId?: string): Promise<void> {
  const db = await openDatabase(userId)
  const scopedKey = userId ? getUserBlobKey(userId, key) : key

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(scopedKey)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get a URL for a resource blob
 * @param key - The blob key
 * @param userId - The user ID (for user-scoped storage)
 */
export async function getResourceBlobUrl(key: string, userId?: string): Promise<string | null> {
  const blob = await getResourceBlob(key, userId)
  if (!blob) return null
  return URL.createObjectURL(blob)
}

// ============ localStorage Helpers ============

/**
 * Get resources for a specific user
 */
function getStoredResourcesForUser(userId: string): ProjectResource[] {
  if (typeof window === "undefined") return []

  const userResources = getUserStorageItem<ProjectResource[]>(userId, USER_STORAGE_KEYS.RESOURCES)
  if (userResources) return userResources

  // Fallback to legacy storage
  const stored = localStorage.getItem(LEGACY_RESOURCES_KEY)
  return stored ? JSON.parse(stored) : []
}

/**
 * Save resources for a specific user
 */
function saveResourcesForUser(userId: string, resources: ProjectResource[]): void {
  if (typeof window === "undefined") return
  setUserStorageItem(userId, USER_STORAGE_KEYS.RESOURCES, resources)
  dispatchStorageChange(userId, USER_STORAGE_KEYS.RESOURCES, resources)
}

/**
 * @deprecated Use getStoredResourcesForUser instead
 */
function getStoredResources(): ProjectResource[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(LEGACY_RESOURCES_KEY)
  return stored ? JSON.parse(stored) : []
}

/**
 * @deprecated Use saveResourcesForUser instead
 */
function saveResources(resources: ProjectResource[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LEGACY_RESOURCES_KEY, JSON.stringify(resources))
}

/**
 * Get brain dumps for a specific user
 */
function getStoredBrainDumpsForUser(userId: string): BrainDump[] {
  if (typeof window === "undefined") return []

  const userDumps = getUserStorageItem<BrainDump[]>(userId, USER_STORAGE_KEYS.BRAIN_DUMPS)
  if (userDumps) return userDumps

  // Fallback to legacy storage
  const stored = localStorage.getItem(LEGACY_BRAIN_DUMPS_KEY)
  return stored ? JSON.parse(stored) : []
}

/**
 * Save brain dumps for a specific user
 */
function saveBrainDumpsForUser(userId: string, dumps: BrainDump[]): void {
  if (typeof window === "undefined") return
  setUserStorageItem(userId, USER_STORAGE_KEYS.BRAIN_DUMPS, dumps)
  dispatchStorageChange(userId, USER_STORAGE_KEYS.BRAIN_DUMPS, dumps)
}

/**
 * @deprecated Use getStoredBrainDumpsForUser instead
 */
function getStoredBrainDumps(): BrainDump[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(LEGACY_BRAIN_DUMPS_KEY)
  return stored ? JSON.parse(stored) : []
}

/**
 * @deprecated Use saveBrainDumpsForUser instead
 */
function saveBrainDumps(dumps: BrainDump[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LEGACY_BRAIN_DUMPS_KEY, JSON.stringify(dumps))
}

// ============ Resource Type Detection ============

export function detectResourceType(mimeType: string, filename: string): ResourceType {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("audio/")) return "audio"
  if (mimeType === "application/pdf") return "pdf"
  if (mimeType === "application/json" || filename.endsWith(".json")) return "json"
  if (mimeType === "text/csv" || filename.endsWith(".csv")) return "csv"
  if (mimeType === "text/markdown" || filename.endsWith(".md")) return "markdown"
  return "other"
}

// ============ Resource CRUD ============

/**
 * Get all resources for a user
 * @param userId - Required: The user ID
 */
export function getAllResources(userId?: string): ProjectResource[] {
  if (!userId) {
    console.warn("getAllResources called without userId - returning empty array for safety")
    return []
  }
  return getStoredResourcesForUser(userId)
}

/**
 * Get resources for a project
 * @param projectId - The project ID
 * @param userId - The user ID (for access control)
 */
export function getResourcesForProject(projectId: string, userId?: string): ProjectResource[] {
  const resources = userId ? getStoredResourcesForUser(userId) : getStoredResources()
  return resources.filter(r => r.projectId === projectId)
}

/**
 * Get a resource by ID
 * @param id - The resource ID
 * @param userId - The user ID (for access control)
 */
export function getResource(id: string, userId?: string): ProjectResource | null {
  const resources = userId ? getStoredResourcesForUser(userId) : getStoredResources()
  return resources.find(r => r.id === id) || null
}

/**
 * Create a new resource
 * @param data - Resource data
 * @param userId - The user ID (owner)
 */
export function createResource(
  data: Omit<ProjectResource, "id" | "createdAt" | "updatedAt">,
  userId?: string
): ProjectResource {
  const resources = userId ? getStoredResourcesForUser(userId) : getStoredResources()
  const now = new Date().toISOString()

  const resource: ProjectResource = {
    ...data,
    id: generateUUID(),
    createdAt: now,
    updatedAt: now
  }

  resources.push(resource)

  if (userId) {
    saveResourcesForUser(userId, resources)
  } else {
    saveResources(resources)
  }

  return resource
}

/**
 * Update a resource
 * @param id - The resource ID
 * @param updates - Partial updates
 * @param userId - The user ID (for access control)
 */
export function updateResource(
  id: string,
  updates: Partial<ProjectResource>,
  userId?: string
): ProjectResource | null {
  const resources = userId ? getStoredResourcesForUser(userId) : getStoredResources()
  const index = resources.findIndex(r => r.id === id)

  if (index === -1) return null

  resources[index] = {
    ...resources[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  if (userId) {
    saveResourcesForUser(userId, resources)
  } else {
    saveResources(resources)
  }

  return resources[index]
}

/**
 * Delete a resource
 * @param id - The resource ID
 * @param userId - The user ID (for access control)
 */
export async function deleteResource(id: string, userId?: string): Promise<boolean> {
  const resources = userId ? getStoredResourcesForUser(userId) : getStoredResources()
  const resource = resources.find(r => r.id === id)

  if (!resource) return false

  // Delete blob from IndexedDB if stored there
  if (resource.storage === "indexeddb" && resource.indexedDbKey) {
    try {
      await deleteResourceBlob(resource.indexedDbKey, userId)
    } catch (error) {
      console.error("Failed to delete blob:", error)
    }
  }

  const filtered = resources.filter(r => r.id !== id)

  if (userId) {
    saveResourcesForUser(userId, filtered)
  } else {
    saveResources(filtered)
  }

  return true
}

// ============ Resource Upload Helpers ============

/**
 * Upload a resource file
 * @param projectId - The project ID
 * @param file - The file to upload
 * @param description - Optional description
 * @param userId - The user ID (owner)
 */
export async function uploadResource(
  projectId: string,
  file: File,
  description?: string,
  userId?: string
): Promise<ProjectResource> {
  const indexedDbKey = `resource_${generateUUID()}`

  // Store blob in IndexedDB
  await saveResourceBlob(indexedDbKey, file, {
    name: file.name,
    type: file.type
  }, userId)

  // Create resource metadata
  const resource = createResource({
    projectId,
    name: file.name,
    type: detectResourceType(file.type, file.name),
    mimeType: file.type,
    size: file.size,
    storage: "indexeddb",
    indexedDbKey,
    description,
    tags: []
  }, userId)

  return resource
}

/**
 * Add a file path resource
 * @param projectId - The project ID
 * @param filePath - The file path
 * @param name - The file name
 * @param mimeType - The MIME type
 * @param size - The file size
 * @param description - Optional description
 * @param userId - The user ID (owner)
 */
export function addFilePathResource(
  projectId: string,
  filePath: string,
  name: string,
  mimeType: string,
  size: number,
  description?: string,
  userId?: string
): ProjectResource {
  return createResource({
    projectId,
    name,
    type: detectResourceType(mimeType, name),
    mimeType,
    size,
    storage: "filepath",
    filePath,
    description,
    tags: []
  }, userId)
}

// ============ Brain Dump CRUD ============

/**
 * Get all brain dumps for a user
 * @param userId - Required: The user ID
 */
export function getAllBrainDumps(userId?: string): BrainDump[] {
  if (!userId) {
    console.warn("getAllBrainDumps called without userId - returning empty array for safety")
    return []
  }
  return getStoredBrainDumpsForUser(userId)
}

/**
 * Get brain dumps for a project
 * @param projectId - The project ID
 * @param userId - The user ID (for access control)
 */
export function getBrainDumpsForProject(projectId: string, userId?: string): BrainDump[] {
  const dumps = userId ? getStoredBrainDumpsForUser(userId) : getStoredBrainDumps()
  return dumps.filter(d => d.projectId === projectId)
}

/**
 * Get a brain dump by ID
 * @param id - The brain dump ID
 * @param userId - The user ID (for access control)
 */
export function getBrainDump(id: string, userId?: string): BrainDump | null {
  const dumps = userId ? getStoredBrainDumpsForUser(userId) : getStoredBrainDumps()
  return dumps.find(d => d.id === id) || null
}

/**
 * Create a new brain dump
 * @param data - Brain dump data
 * @param userId - The user ID (owner)
 */
export function createBrainDump(
  data: Omit<BrainDump, "id" | "createdAt" | "updatedAt">,
  userId?: string
): BrainDump {
  const dumps = userId ? getStoredBrainDumpsForUser(userId) : getStoredBrainDumps()
  const now = new Date().toISOString()

  const dump: BrainDump = {
    ...data,
    id: generateUUID(),
    createdAt: now,
    updatedAt: now
  }

  dumps.push(dump)

  if (userId) {
    saveBrainDumpsForUser(userId, dumps)
  } else {
    saveBrainDumps(dumps)
  }

  return dump
}

/**
 * Update a brain dump
 * @param id - The brain dump ID
 * @param updates - Partial updates
 * @param userId - The user ID (for access control)
 */
export function updateBrainDump(
  id: string,
  updates: Partial<BrainDump>,
  userId?: string
): BrainDump | null {
  const dumps = userId ? getStoredBrainDumpsForUser(userId) : getStoredBrainDumps()
  const index = dumps.findIndex(d => d.id === id)

  if (index === -1) return null

  dumps[index] = {
    ...dumps[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  if (userId) {
    saveBrainDumpsForUser(userId, dumps)
  } else {
    saveBrainDumps(dumps)
  }

  return dumps[index]
}

/**
 * Delete a brain dump
 * @param id - The brain dump ID
 * @param userId - The user ID (for access control)
 */
export function deleteBrainDump(id: string, userId?: string): boolean {
  const dumps = userId ? getStoredBrainDumpsForUser(userId) : getStoredBrainDumps()
  const filtered = dumps.filter(d => d.id !== id)

  if (filtered.length === dumps.length) return false

  if (userId) {
    saveBrainDumpsForUser(userId, filtered)
  } else {
    saveBrainDumps(filtered)
  }

  return true
}

// ============ Brain Dump Helpers ============

/**
 * Create a brain dump from a recording
 * @param projectId - The project ID
 * @param resourceId - The resource ID
 * @param userId - The user ID (owner)
 */
export function createBrainDumpFromRecording(
  projectId: string,
  resourceId: string,
  userId?: string
): BrainDump {
  return createBrainDump({
    projectId,
    resourceId,
    status: "transcribing"
  }, userId)
}

/**
 * Update brain dump transcription
 * @param id - The brain dump ID
 * @param transcription - The transcription data
 * @param userId - The user ID (for access control)
 */
export function updateBrainDumpTranscription(
  id: string,
  transcription: TranscriptionData,
  userId?: string
): BrainDump | null {
  return updateBrainDump(id, {
    transcription,
    status: "processing"
  }, userId)
}

/**
 * Update brain dump status
 * @param id - The brain dump ID
 * @param status - The new status
 * @param userId - The user ID (for access control)
 */
export function updateBrainDumpStatus(
  id: string,
  status: BrainDumpStatus,
  userId?: string
): BrainDump | null {
  return updateBrainDump(id, { status }, userId)
}

// ============ Resource Queries ============

/**
 * Get resources by type
 * @param projectId - The project ID
 * @param type - The resource type
 * @param userId - The user ID (for access control)
 */
export function getResourcesByType(projectId: string, type: ResourceType, userId?: string): ProjectResource[] {
  return getResourcesForProject(projectId, userId).filter(r => r.type === type)
}

/**
 * Get audio resources for a project
 * @param projectId - The project ID
 * @param userId - The user ID (for access control)
 */
export function getAudioResources(projectId: string, userId?: string): ProjectResource[] {
  return getResourcesByType(projectId, "audio", userId)
}

/**
 * Get document resources for a project
 * @param projectId - The project ID
 * @param userId - The user ID (for access control)
 */
export function getDocumentResources(projectId: string, userId?: string): ProjectResource[] {
  return getResourcesForProject(projectId, userId).filter(r =>
    ["markdown", "json", "csv", "pdf", "other"].includes(r.type)
  )
}

/**
 * Get image resources for a project
 * @param projectId - The project ID
 * @param userId - The user ID (for access control)
 */
export function getImageResources(projectId: string, userId?: string): ProjectResource[] {
  return getResourcesByType(projectId, "image", userId)
}

// ============ Resource Stats ============

/**
 * Get resource statistics for a project
 * @param projectId - The project ID
 * @param userId - The user ID (for access control)
 */
export function getResourceStats(projectId: string, userId?: string): {
  total: number
  byType: Record<ResourceType, number>
  totalSize: number
} {
  const resources = getResourcesForProject(projectId, userId)

  const byType: Record<ResourceType, number> = {
    markdown: 0,
    json: 0,
    csv: 0,
    image: 0,
    audio: 0,
    pdf: 0,
    other: 0
  }

  let totalSize = 0

  for (const resource of resources) {
    byType[resource.type]++
    totalSize += resource.size
  }

  return {
    total: resources.length,
    byType,
    totalSize
  }
}

// ============ Format Helpers ============

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

export function getResourceIcon(type: ResourceType): string {
  switch (type) {
    case "markdown": return "FileText"
    case "json": return "Braces"
    case "csv": return "Table"
    case "image": return "Image"
    case "audio": return "Mic"
    case "pdf": return "FileText"
    default: return "File"
  }
}
