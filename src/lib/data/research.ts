/**
 * Research Data Store
 * Storage and management for standalone "Has This Been Done Before?" research
 *
 * This allows users to research any idea/concept without first creating a project.
 * If the research shows the idea is unique/worthy, they can create a project from it.
 *
 * IMPORTANT: All research data is user-scoped. Research entries belong to specific users
 * and are stored in user-specific localStorage keys.
 */

import type {
  PriorArtResearch,
  PriorArtRecommendation
} from "./types"
import {
  getUserStorageItem,
  setUserStorageItem,
  USER_STORAGE_KEYS,
  dispatchStorageChange
} from "./user-storage"

// ============ Types ============

export type ResearchStatus = "pending" | "researching" | "completed" | "failed"
export type ResearchRecommendation = PriorArtRecommendation

export interface ResearchEntry {
  id: string
  topic: string
  description: string
  status: ResearchStatus
  createdAt: string
  updatedAt: string

  // Research findings (populated after research completes)
  findings?: PriorArtResearch

  // Quick summary fields for list display
  recommendation?: ResearchRecommendation
  competitorCount?: number
  marketSaturation?: "low" | "medium" | "high" | "oversaturated"
  confidenceLevel?: "low" | "medium" | "high"

  // Link to project if one is created from this research
  convertedToProjectId?: string
  convertedAt?: string

  // Tags for organization
  tags: string[]

  // User notes
  notes?: string
}

// ============ Storage ============

// Legacy storage key (kept for migration purposes)
const LEGACY_STORAGE_KEY = "claudia_research"

// UUID generator that works in all contexts
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
 * Get research entries for a specific user
 */
function getStoredResearchForUser(userId: string): ResearchEntry[] {
  if (typeof window === "undefined") return []

  const userResearch = getUserStorageItem<ResearchEntry[]>(userId, USER_STORAGE_KEYS.RESEARCH)
  if (userResearch) return userResearch

  // Fallback to legacy storage
  const stored = localStorage.getItem(LEGACY_STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

/**
 * Save research entries for a specific user
 */
function saveResearchForUser(userId: string, entries: ResearchEntry[]): void {
  if (typeof window === "undefined") return
  setUserStorageItem(userId, USER_STORAGE_KEYS.RESEARCH, entries)
  dispatchStorageChange(userId, USER_STORAGE_KEYS.RESEARCH, entries)
}

/**
 * @deprecated Use getStoredResearchForUser instead
 */
function getStoredResearch(): ResearchEntry[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(LEGACY_STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

/**
 * @deprecated Use saveResearchForUser instead
 */
function saveResearch(entries: ResearchEntry[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(entries))
}

// ============ CRUD Operations ============

/**
 * Get all research entries for a user
 * @param options - Filter options including userId (required)
 */
export function getAllResearch(options?: {
  status?: ResearchStatus
  recommendation?: ResearchRecommendation
  includeConverted?: boolean
  userId?: string
}): ResearchEntry[] {
  if (!options?.userId) {
    console.warn("getAllResearch called without userId - returning empty array for safety")
    return []
  }

  let entries = getStoredResearchForUser(options.userId)

  if (options?.status) {
    entries = entries.filter(e => e.status === options.status)
  }

  if (options?.recommendation) {
    entries = entries.filter(e => e.recommendation === options.recommendation)
  }

  if (!options?.includeConverted) {
    entries = entries.filter(e => !e.convertedToProjectId)
  }

  return entries.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

/**
 * Get a single research entry by ID
 * @param id - The research entry ID
 * @param userId - The user ID (for access control)
 */
export function getResearch(id: string, userId?: string): ResearchEntry | null {
  const entries = userId ? getStoredResearchForUser(userId) : getStoredResearch()
  return entries.find(e => e.id === id) || null
}

/**
 * Create a new research entry
 * @param data - Research entry data
 * @param userId - The user ID (owner)
 */
export function createResearch(
  data: Omit<ResearchEntry, "id" | "createdAt" | "updatedAt">,
  userId?: string
): ResearchEntry {
  const entries = userId ? getStoredResearchForUser(userId) : getStoredResearch()
  const now = new Date().toISOString()

  const entry: ResearchEntry = {
    ...data,
    id: generateUUID(),
    createdAt: now,
    updatedAt: now
  }

  entries.push(entry)

  if (userId) {
    saveResearchForUser(userId, entries)
  } else {
    saveResearch(entries)
  }

  return entry
}

/**
 * Update an existing research entry
 * @param id - The research entry ID
 * @param updates - Partial updates
 * @param userId - The user ID (for access control)
 */
export function updateResearch(
  id: string,
  updates: Partial<Omit<ResearchEntry, "id" | "createdAt">>,
  userId?: string
): ResearchEntry | null {
  const entries = userId ? getStoredResearchForUser(userId) : getStoredResearch()
  const index = entries.findIndex(e => e.id === id)

  if (index === -1) return null

  entries[index] = {
    ...entries[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  if (userId) {
    saveResearchForUser(userId, entries)
  } else {
    saveResearch(entries)
  }

  return entries[index]
}

/**
 * Delete a research entry permanently
 * @param id - The research entry ID
 * @param userId - The user ID (for access control)
 */
export function deleteResearch(id: string, userId?: string): boolean {
  const entries = userId ? getStoredResearchForUser(userId) : getStoredResearch()
  const filtered = entries.filter(e => e.id !== id)

  if (filtered.length === entries.length) return false

  if (userId) {
    saveResearchForUser(userId, filtered)
  } else {
    saveResearch(filtered)
  }

  return true
}

// ============ Research Operations ============

/**
 * Update research with findings
 * @param id - The research entry ID
 * @param findings - The research findings
 * @param userId - The user ID (for access control)
 */
export function updateResearchFindings(
  id: string,
  findings: PriorArtResearch,
  userId?: string
): ResearchEntry | null {
  return updateResearch(id, {
    status: "completed",
    findings,
    recommendation: findings.recommendation,
    competitorCount: findings.totalCompetitorsFound,
    marketSaturation: findings.marketSaturation,
    confidenceLevel: findings.confidenceLevel
  }, userId)
}

/**
 * Mark research as failed
 * @param id - The research entry ID
 * @param error - Optional error message
 * @param userId - The user ID (for access control)
 */
export function markResearchFailed(
  id: string,
  error?: string,
  userId?: string
): ResearchEntry | null {
  const entry = getResearch(id, userId)
  if (!entry) return null

  return updateResearch(id, {
    status: "failed",
    notes: error ? `Research failed: ${error}` : entry.notes
  }, userId)
}

/**
 * Mark research as converted to a project
 * @param id - The research entry ID
 * @param projectId - The created project ID
 * @param userId - The user ID (for access control)
 */
export function markResearchConverted(
  id: string,
  projectId: string,
  userId?: string
): ResearchEntry | null {
  return updateResearch(id, {
    convertedToProjectId: projectId,
    convertedAt: new Date().toISOString()
  }, userId)
}

// ============ Statistics ============

/**
 * Get research statistics for a user
 * @param userId - Required: The user ID
 */
export function getResearchStats(userId: string): {
  total: number
  byStatus: Record<ResearchStatus, number>
  byRecommendation: Record<ResearchRecommendation, number>
  converted: number
} {
  if (!userId) {
    return {
      total: 0,
      byStatus: { pending: 0, researching: 0, completed: 0, failed: 0 },
      byRecommendation: { pursue: 0, pivot: 0, abandon: 0, undetermined: 0 },
      converted: 0
    }
  }

  const entries = getStoredResearchForUser(userId)

  const byStatus: Record<ResearchStatus, number> = {
    pending: 0,
    researching: 0,
    completed: 0,
    failed: 0
  }

  const byRecommendation: Record<ResearchRecommendation, number> = {
    pursue: 0,
    pivot: 0,
    abandon: 0,
    undetermined: 0
  }

  let converted = 0

  for (const entry of entries) {
    byStatus[entry.status]++
    if (entry.recommendation) {
      byRecommendation[entry.recommendation]++
    }
    if (entry.convertedToProjectId) {
      converted++
    }
  }

  return {
    total: entries.length,
    byStatus,
    byRecommendation,
    converted
  }
}

/**
 * Search research entries for a user
 * @param query - Search query
 * @param userId - Required: The user ID
 */
export function searchResearch(query: string, userId: string): ResearchEntry[] {
  if (!userId) return []

  const entries = getStoredResearchForUser(userId)
  const lower = query.toLowerCase()

  return entries.filter(e =>
    e.topic.toLowerCase().includes(lower) ||
    e.description.toLowerCase().includes(lower) ||
    e.tags.some(t => t.toLowerCase().includes(lower)) ||
    e.notes?.toLowerCase().includes(lower)
  )
}

// ============ Helper Functions ============

/**
 * Create a new empty research entry
 * @param topic - The research topic
 * @param userId - The user ID (owner)
 */
export function createEmptyResearch(topic: string = "New Research", userId?: string): ResearchEntry {
  return createResearch({
    topic,
    description: "",
    status: "pending",
    tags: []
  }, userId)
}

/**
 * Get research entries that recommend pursuing
 * @param userId - Required: The user ID
 */
export function getWorthyIdeas(userId: string): ResearchEntry[] {
  return getAllResearch({
    status: "completed",
    recommendation: "pursue",
    includeConverted: false,
    userId
  })
}

/**
 * Get research entries that haven't been started
 * @param userId - Required: The user ID
 */
export function getPendingResearch(userId: string): ResearchEntry[] {
  return getAllResearch({ status: "pending", userId })
}
