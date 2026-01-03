/**
 * Project Resources Data Store
 * Handles file attachments with IndexedDB for blob storage
 */

import {
  ProjectResource,
  ResourceType,
  ResourceStorageType,
  BrainDump,
  BrainDumpStatus,
  TranscriptionData
} from "./types"

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

const RESOURCES_KEY = "claudia_resources"
const BRAIN_DUMPS_KEY = "claudia_brain_dumps"
const DB_NAME = "claudia-files"
const DB_VERSION = 1
const STORE_NAME = "resources"

// ============ IndexedDB Helpers ============

let dbPromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB not available on server"))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

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

  return dbPromise
}

export async function saveResourceBlob(key: string, blob: Blob, metadata?: { name: string; type: string }): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put({
      key,
      blob,
      metadata: metadata || {},
      uploadedAt: new Date().toISOString()
    })

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getResourceBlob(key: string): Promise<Blob | null> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(key)

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

export async function deleteResourceBlob(key: string): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(key)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getResourceBlobUrl(key: string): Promise<string | null> {
  const blob = await getResourceBlob(key)
  if (!blob) return null
  return URL.createObjectURL(blob)
}

// ============ localStorage Helpers ============

function getStoredResources(): ProjectResource[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(RESOURCES_KEY)
  return stored ? JSON.parse(stored) : []
}

function saveResources(resources: ProjectResource[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(RESOURCES_KEY, JSON.stringify(resources))
}

function getStoredBrainDumps(): BrainDump[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(BRAIN_DUMPS_KEY)
  return stored ? JSON.parse(stored) : []
}

function saveBrainDumps(dumps: BrainDump[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(BRAIN_DUMPS_KEY, JSON.stringify(dumps))
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

export function getAllResources(): ProjectResource[] {
  return getStoredResources()
}

export function getResourcesForProject(projectId: string): ProjectResource[] {
  return getStoredResources().filter(r => r.projectId === projectId)
}

export function getResource(id: string): ProjectResource | null {
  return getStoredResources().find(r => r.id === id) || null
}

export function createResource(
  data: Omit<ProjectResource, "id" | "createdAt" | "updatedAt">
): ProjectResource {
  const resources = getStoredResources()
  const now = new Date().toISOString()

  const resource: ProjectResource = {
    ...data,
    id: generateUUID(),
    createdAt: now,
    updatedAt: now
  }

  resources.push(resource)
  saveResources(resources)
  return resource
}

export function updateResource(
  id: string,
  updates: Partial<ProjectResource>
): ProjectResource | null {
  const resources = getStoredResources()
  const index = resources.findIndex(r => r.id === id)

  if (index === -1) return null

  resources[index] = {
    ...resources[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  saveResources(resources)
  return resources[index]
}

export async function deleteResource(id: string): Promise<boolean> {
  const resources = getStoredResources()
  const resource = resources.find(r => r.id === id)

  if (!resource) return false

  // Delete blob from IndexedDB if stored there
  if (resource.storage === "indexeddb" && resource.indexedDbKey) {
    try {
      await deleteResourceBlob(resource.indexedDbKey)
    } catch (error) {
      console.error("Failed to delete blob:", error)
    }
  }

  const filtered = resources.filter(r => r.id !== id)
  saveResources(filtered)
  return true
}

// ============ Resource Upload Helpers ============

export async function uploadResource(
  projectId: string,
  file: File,
  description?: string
): Promise<ProjectResource> {
  const indexedDbKey = `resource_${generateUUID()}`

  // Store blob in IndexedDB
  await saveResourceBlob(indexedDbKey, file, {
    name: file.name,
    type: file.type
  })

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
  })

  return resource
}

export function addFilePathResource(
  projectId: string,
  filePath: string,
  name: string,
  mimeType: string,
  size: number,
  description?: string
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
  })
}

// ============ Brain Dump CRUD ============

export function getAllBrainDumps(): BrainDump[] {
  return getStoredBrainDumps()
}

export function getBrainDumpsForProject(projectId: string): BrainDump[] {
  return getStoredBrainDumps().filter(d => d.projectId === projectId)
}

export function getBrainDump(id: string): BrainDump | null {
  return getStoredBrainDumps().find(d => d.id === id) || null
}

export function createBrainDump(
  data: Omit<BrainDump, "id" | "createdAt" | "updatedAt">
): BrainDump {
  const dumps = getStoredBrainDumps()
  const now = new Date().toISOString()

  const dump: BrainDump = {
    ...data,
    id: generateUUID(),
    createdAt: now,
    updatedAt: now
  }

  dumps.push(dump)
  saveBrainDumps(dumps)
  return dump
}

export function updateBrainDump(
  id: string,
  updates: Partial<BrainDump>
): BrainDump | null {
  const dumps = getStoredBrainDumps()
  const index = dumps.findIndex(d => d.id === id)

  if (index === -1) return null

  dumps[index] = {
    ...dumps[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  saveBrainDumps(dumps)
  return dumps[index]
}

export function deleteBrainDump(id: string): boolean {
  const dumps = getStoredBrainDumps()
  const filtered = dumps.filter(d => d.id !== id)

  if (filtered.length === dumps.length) return false

  saveBrainDumps(filtered)
  return true
}

// ============ Brain Dump Helpers ============

export function createBrainDumpFromRecording(
  projectId: string,
  resourceId: string
): BrainDump {
  return createBrainDump({
    projectId,
    resourceId,
    status: "transcribing"
  })
}

export function updateBrainDumpTranscription(
  id: string,
  transcription: TranscriptionData
): BrainDump | null {
  return updateBrainDump(id, {
    transcription,
    status: "processing"
  })
}

export function updateBrainDumpStatus(
  id: string,
  status: BrainDumpStatus
): BrainDump | null {
  return updateBrainDump(id, { status })
}

// ============ Resource Queries ============

export function getResourcesByType(projectId: string, type: ResourceType): ProjectResource[] {
  return getResourcesForProject(projectId).filter(r => r.type === type)
}

export function getAudioResources(projectId: string): ProjectResource[] {
  return getResourcesByType(projectId, "audio")
}

export function getDocumentResources(projectId: string): ProjectResource[] {
  return getResourcesForProject(projectId).filter(r =>
    ["markdown", "json", "csv", "pdf", "other"].includes(r.type)
  )
}

export function getImageResources(projectId: string): ProjectResource[] {
  return getResourcesByType(projectId, "image")
}

// ============ Resource Stats ============

export function getResourceStats(projectId: string): {
  total: number
  byType: Record<ResourceType, number>
  totalSize: number
} {
  const resources = getResourcesForProject(projectId)

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
