/**
 * Business Ideas Data Store
 * Storage and management for business idea brainstorming
 *
 * IMPORTANT: All business idea data is user-scoped. Ideas belong to specific users
 * and are stored in user-specific localStorage keys.
 */

import {
  getUserStorageItem,
  setUserStorageItem,
  USER_STORAGE_KEYS,
  dispatchStorageChange
} from "./user-storage"

// ============ Types ============

export type BusinessIdeaStatus = "brainstorming" | "exploring" | "validating" | "ready" | "converted" | "archived"
export type BusinessIdeaPotential = "low" | "medium" | "high" | "very-high"

export interface BusinessIdeaMessage {
  id: string
  role: "assistant" | "user"
  content: string
  timestamp: string
}

export interface BusinessIdea {
  id: string
  title: string
  summary: string
  potential: BusinessIdeaPotential
  status: BusinessIdeaStatus
  createdAt: string
  updatedAt: string

  // Full details
  executiveSummary?: string
  problemStatement?: string
  targetAudience?: string
  valueProposition?: string
  revenueModel?: string
  competitiveAdvantage?: string
  keyRisks?: string[]
  nextSteps?: string[]

  // Chat history for brainstorming
  messages: BusinessIdeaMessage[]

  // Tags for organization
  tags: string[]

  // Link to converted project
  convertedProjectId?: string

  // AI-generated Executive Summary (structured data)
  executiveSummaryData?: {
    overview: string
    marketAnalysis: {
      marketSize: string
      targetMarket: string
      marketTrends: string[]
      competitorLandscape: string
    }
    revenueModel: {
      primaryModel: string
      pricingStrategy: string
      revenueStreams: string[]
      projectedMetrics: string
    }
    competitiveLandscape: {
      directCompetitors: string[]
      indirectCompetitors: string[]
      competitiveAdvantages: string[]
      barriers: string[]
    }
    risks: {
      marketRisks: string[]
      technicalRisks: string[]
      financialRisks: string[]
      mitigationStrategies: string[]
    }
    opportunities: {
      shortTerm: string[]
      longTerm: string[]
      partnerships: string[]
      expansion: string[]
    }
    nextSteps: string[]
    viabilityScore: number
    viabilityRationale: string
  }

  // Viability Interview Results
  viabilityInsights?: {
    problemValidation: { score: number; insights: string[]; gaps: string[] }
    customerUnderstanding: { score: number; insights: string[]; gaps: string[] }
    solutionFit: { score: number; insights: string[]; gaps: string[] }
    marketOpportunity: { score: number; insights: string[]; gaps: string[] }
    competitivePosition: { score: number; insights: string[]; gaps: string[] }
    revenueClarity: { score: number; insights: string[]; gaps: string[] }
    executionReadiness: { score: number; insights: string[]; gaps: string[] }
    overallViability: number
    recommendations: string[]
    criticalGaps: string[]
  }
  viabilityAnswers?: Array<{
    questionId: string
    answer: string
    timestamp: string
    skipped: boolean
  }>
}

// ============ Storage ============

// Legacy storage key (kept for migration purposes)
const LEGACY_STORAGE_KEY = "claudia_business_ideas"

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
 * Get business ideas for a specific user
 */
function getStoredIdeasForUser(userId: string): BusinessIdea[] {
  if (typeof window === "undefined") return []

  const userIdeas = getUserStorageItem<BusinessIdea[]>(userId, USER_STORAGE_KEYS.BUSINESS_IDEAS)
  if (userIdeas) return userIdeas

  // Fallback to legacy storage
  const stored = localStorage.getItem(LEGACY_STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

/**
 * Save business ideas for a specific user
 */
function saveIdeasForUser(userId: string, ideas: BusinessIdea[]): void {
  if (typeof window === "undefined") return
  setUserStorageItem(userId, USER_STORAGE_KEYS.BUSINESS_IDEAS, ideas)
  dispatchStorageChange(userId, USER_STORAGE_KEYS.BUSINESS_IDEAS, ideas)
}

/**
 * @deprecated Use getStoredIdeasForUser instead
 */
function getStoredIdeas(): BusinessIdea[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(LEGACY_STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

/**
 * @deprecated Use saveIdeasForUser instead
 */
function saveIdeas(ideas: BusinessIdea[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(ideas))
}

// ============ CRUD Operations ============

/**
 * Get all business ideas for a user
 * @param options - Filter options including userId (required)
 */
export function getAllBusinessIdeas(options?: {
  includeArchived?: boolean
  userId?: string
}): BusinessIdea[] {
  if (!options?.userId) {
    console.warn("getAllBusinessIdeas called without userId - returning empty array for safety")
    return []
  }

  const ideas = getStoredIdeasForUser(options.userId)
  if (options?.includeArchived) {
    return ideas
  }
  return ideas.filter(i => i.status !== "archived")
}

/**
 * Get a single business idea by ID
 * @param id - The idea ID
 * @param userId - The user ID (for access control)
 */
export function getBusinessIdea(id: string, userId?: string): BusinessIdea | null {
  const ideas = userId ? getStoredIdeasForUser(userId) : getStoredIdeas()
  return ideas.find(i => i.id === id) || null
}

/**
 * Create a new business idea
 * @param data - Business idea data
 * @param userId - The user ID (owner)
 */
export function createBusinessIdea(
  data: Omit<BusinessIdea, "id" | "createdAt" | "updatedAt">,
  userId?: string
): BusinessIdea {
  const ideas = userId ? getStoredIdeasForUser(userId) : getStoredIdeas()
  const now = new Date().toISOString()

  const idea: BusinessIdea = {
    ...data,
    id: generateUUID(),
    createdAt: now,
    updatedAt: now
  }

  ideas.push(idea)

  if (userId) {
    saveIdeasForUser(userId, ideas)
  } else {
    saveIdeas(ideas)
  }

  return idea
}

/**
 * Update an existing business idea
 * @param id - The idea ID
 * @param updates - Partial updates
 * @param userId - The user ID (for access control)
 */
export function updateBusinessIdea(
  id: string,
  updates: Partial<Omit<BusinessIdea, "id" | "createdAt">>,
  userId?: string
): BusinessIdea | null {
  const ideas = userId ? getStoredIdeasForUser(userId) : getStoredIdeas()
  const index = ideas.findIndex(i => i.id === id)

  if (index === -1) return null

  ideas[index] = {
    ...ideas[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  if (userId) {
    saveIdeasForUser(userId, ideas)
  } else {
    saveIdeas(ideas)
  }

  return ideas[index]
}

/**
 * Delete a business idea permanently
 * @param id - The idea ID
 * @param userId - The user ID (for access control)
 */
export function deleteBusinessIdea(id: string, userId?: string): boolean {
  const ideas = userId ? getStoredIdeasForUser(userId) : getStoredIdeas()
  const filtered = ideas.filter(i => i.id !== id)

  if (filtered.length === ideas.length) return false

  if (userId) {
    saveIdeasForUser(userId, filtered)
  } else {
    saveIdeas(filtered)
  }

  return true
}

/**
 * Archive a business idea
 * @param id - The idea ID
 * @param userId - The user ID (for access control)
 */
export function archiveBusinessIdea(id: string, userId?: string): BusinessIdea | null {
  return updateBusinessIdea(id, { status: "archived" }, userId)
}

/**
 * Add a message to a business idea's chat history
 * @param id - The idea ID
 * @param message - Message data
 * @param userId - The user ID (for access control)
 */
export function addMessageToIdea(
  id: string,
  message: Omit<BusinessIdeaMessage, "id" | "timestamp">,
  userId?: string
): BusinessIdea | null {
  const idea = getBusinessIdea(id, userId)
  if (!idea) return null

  const newMessage: BusinessIdeaMessage = {
    ...message,
    id: generateUUID(),
    timestamp: new Date().toISOString()
  }

  return updateBusinessIdea(id, {
    messages: [...idea.messages, newMessage]
  }, userId)
}

/**
 * Mark an idea as converted to a project
 * @param id - The idea ID
 * @param projectId - The created project ID
 * @param userId - The user ID (for access control)
 */
export function markIdeaAsConverted(
  id: string,
  projectId: string,
  userId?: string
): BusinessIdea | null {
  return updateBusinessIdea(id, {
    status: "converted",
    convertedProjectId: projectId
  }, userId)
}

/**
 * Get business idea statistics for a user
 * @param userId - Required: The user ID
 */
export function getBusinessIdeaStats(userId: string): {
  total: number
  byStatus: Record<BusinessIdeaStatus, number>
  byPotential: Record<BusinessIdeaPotential, number>
} {
  if (!userId) {
    return {
      total: 0,
      byStatus: { brainstorming: 0, exploring: 0, validating: 0, ready: 0, converted: 0, archived: 0 },
      byPotential: { low: 0, medium: 0, high: 0, "very-high": 0 }
    }
  }

  const ideas = getStoredIdeasForUser(userId)

  const byStatus: Record<BusinessIdeaStatus, number> = {
    brainstorming: 0,
    exploring: 0,
    validating: 0,
    ready: 0,
    converted: 0,
    archived: 0
  }

  const byPotential: Record<BusinessIdeaPotential, number> = {
    low: 0,
    medium: 0,
    high: 0,
    "very-high": 0
  }

  for (const idea of ideas) {
    byStatus[idea.status]++
    byPotential[idea.potential]++
  }

  return {
    total: ideas.filter(i => i.status !== "archived").length,
    byStatus,
    byPotential
  }
}

/**
 * Search business ideas for a user
 * @param query - Search query
 * @param userId - Required: The user ID
 */
export function searchBusinessIdeas(query: string, userId: string): BusinessIdea[] {
  if (!userId) return []

  const ideas = getStoredIdeasForUser(userId)
  const lower = query.toLowerCase()

  return ideas.filter(i =>
    i.title.toLowerCase().includes(lower) ||
    i.summary.toLowerCase().includes(lower) ||
    i.tags.some(t => t.toLowerCase().includes(lower)) ||
    i.executiveSummary?.toLowerCase().includes(lower) ||
    i.problemStatement?.toLowerCase().includes(lower)
  )
}
