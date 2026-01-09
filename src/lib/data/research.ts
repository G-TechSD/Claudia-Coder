/**
 * Research Data Store
 * Storage and management for standalone "Has This Been Done Before?" research
 *
 * This allows users to research any idea/concept without first creating a project.
 * If the research shows the idea is unique/worthy, they can create a project from it.
 */

import type {
  PriorArtResearch,
  CompetitorAnalysis,
  MarketGapAnalysis,
  PriorArtRecommendation
} from "./types"

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

const STORAGE_KEY = "claudia_research"

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

function getStoredResearch(): ResearchEntry[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

function saveResearch(entries: ResearchEntry[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

// ============ CRUD Operations ============

/**
 * Get all research entries
 */
export function getAllResearch(options?: {
  status?: ResearchStatus
  recommendation?: ResearchRecommendation
  includeConverted?: boolean
}): ResearchEntry[] {
  let entries = getStoredResearch()

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
 */
export function getResearch(id: string): ResearchEntry | null {
  const entries = getStoredResearch()
  return entries.find(e => e.id === id) || null
}

/**
 * Create a new research entry
 */
export function createResearch(
  data: Omit<ResearchEntry, "id" | "createdAt" | "updatedAt">
): ResearchEntry {
  const entries = getStoredResearch()
  const now = new Date().toISOString()

  const entry: ResearchEntry = {
    ...data,
    id: generateUUID(),
    createdAt: now,
    updatedAt: now
  }

  entries.push(entry)
  saveResearch(entries)
  return entry
}

/**
 * Update an existing research entry
 */
export function updateResearch(
  id: string,
  updates: Partial<Omit<ResearchEntry, "id" | "createdAt">>
): ResearchEntry | null {
  const entries = getStoredResearch()
  const index = entries.findIndex(e => e.id === id)

  if (index === -1) return null

  entries[index] = {
    ...entries[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  saveResearch(entries)
  return entries[index]
}

/**
 * Delete a research entry permanently
 */
export function deleteResearch(id: string): boolean {
  const entries = getStoredResearch()
  const filtered = entries.filter(e => e.id !== id)

  if (filtered.length === entries.length) return false

  saveResearch(filtered)
  return true
}

// ============ Research Operations ============

/**
 * Update research with findings
 */
export function updateResearchFindings(
  id: string,
  findings: PriorArtResearch
): ResearchEntry | null {
  return updateResearch(id, {
    status: "completed",
    findings,
    recommendation: findings.recommendation,
    competitorCount: findings.totalCompetitorsFound,
    marketSaturation: findings.marketSaturation,
    confidenceLevel: findings.confidenceLevel
  })
}

/**
 * Mark research as failed
 */
export function markResearchFailed(
  id: string,
  error?: string
): ResearchEntry | null {
  const entry = getResearch(id)
  if (!entry) return null

  return updateResearch(id, {
    status: "failed",
    notes: error ? `Research failed: ${error}` : entry.notes
  })
}

/**
 * Mark research as converted to a project
 */
export function markResearchConverted(
  id: string,
  projectId: string
): ResearchEntry | null {
  return updateResearch(id, {
    convertedToProjectId: projectId,
    convertedAt: new Date().toISOString()
  })
}

// ============ Statistics ============

/**
 * Get research statistics
 */
export function getResearchStats(): {
  total: number
  byStatus: Record<ResearchStatus, number>
  byRecommendation: Record<ResearchRecommendation, number>
  converted: number
} {
  const entries = getStoredResearch()

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
 * Search research entries
 */
export function searchResearch(query: string): ResearchEntry[] {
  const entries = getStoredResearch()
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
 */
export function createEmptyResearch(topic: string = "New Research"): ResearchEntry {
  return createResearch({
    topic,
    description: "",
    status: "pending",
    tags: []
  })
}

/**
 * Get research entries that recommend pursuing
 */
export function getWorthyIdeas(): ResearchEntry[] {
  return getAllResearch({
    status: "completed",
    recommendation: "pursue",
    includeConverted: false
  })
}

/**
 * Get research entries that haven't been started
 */
export function getPendingResearch(): ResearchEntry[] {
  return getAllResearch({ status: "pending" })
}
