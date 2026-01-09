/**
 * Business Ideas Data Store
 * Storage and management for business idea brainstorming
 */

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
}

// ============ Storage ============

const STORAGE_KEY = "claudia_business_ideas"

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

function getStoredIdeas(): BusinessIdea[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

function saveIdeas(ideas: BusinessIdea[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas))
}

// ============ CRUD Operations ============

/**
 * Get all business ideas
 */
export function getAllBusinessIdeas(options?: {
  includeArchived?: boolean
}): BusinessIdea[] {
  const ideas = getStoredIdeas()
  if (options?.includeArchived) {
    return ideas
  }
  return ideas.filter(i => i.status !== "archived")
}

/**
 * Get a single business idea by ID
 */
export function getBusinessIdea(id: string): BusinessIdea | null {
  const ideas = getStoredIdeas()
  return ideas.find(i => i.id === id) || null
}

/**
 * Create a new business idea
 */
export function createBusinessIdea(
  data: Omit<BusinessIdea, "id" | "createdAt" | "updatedAt">
): BusinessIdea {
  const ideas = getStoredIdeas()
  const now = new Date().toISOString()

  const idea: BusinessIdea = {
    ...data,
    id: generateUUID(),
    createdAt: now,
    updatedAt: now
  }

  ideas.push(idea)
  saveIdeas(ideas)
  return idea
}

/**
 * Update an existing business idea
 */
export function updateBusinessIdea(
  id: string,
  updates: Partial<Omit<BusinessIdea, "id" | "createdAt">>
): BusinessIdea | null {
  const ideas = getStoredIdeas()
  const index = ideas.findIndex(i => i.id === id)

  if (index === -1) return null

  ideas[index] = {
    ...ideas[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  saveIdeas(ideas)
  return ideas[index]
}

/**
 * Delete a business idea permanently
 */
export function deleteBusinessIdea(id: string): boolean {
  const ideas = getStoredIdeas()
  const filtered = ideas.filter(i => i.id !== id)

  if (filtered.length === ideas.length) return false

  saveIdeas(filtered)
  return true
}

/**
 * Archive a business idea
 */
export function archiveBusinessIdea(id: string): BusinessIdea | null {
  return updateBusinessIdea(id, { status: "archived" })
}

/**
 * Add a message to a business idea's chat history
 */
export function addMessageToIdea(
  id: string,
  message: Omit<BusinessIdeaMessage, "id" | "timestamp">
): BusinessIdea | null {
  const idea = getBusinessIdea(id)
  if (!idea) return null

  const newMessage: BusinessIdeaMessage = {
    ...message,
    id: generateUUID(),
    timestamp: new Date().toISOString()
  }

  return updateBusinessIdea(id, {
    messages: [...idea.messages, newMessage]
  })
}

/**
 * Mark an idea as converted to a project
 */
export function markIdeaAsConverted(
  id: string,
  projectId: string
): BusinessIdea | null {
  return updateBusinessIdea(id, {
    status: "converted",
    convertedProjectId: projectId
  })
}

/**
 * Get business idea statistics
 */
export function getBusinessIdeaStats(): {
  total: number
  byStatus: Record<BusinessIdeaStatus, number>
  byPotential: Record<BusinessIdeaPotential, number>
} {
  const ideas = getStoredIdeas()

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
 * Search business ideas
 */
export function searchBusinessIdeas(query: string): BusinessIdea[] {
  const ideas = getStoredIdeas()
  const lower = query.toLowerCase()

  return ideas.filter(i =>
    i.title.toLowerCase().includes(lower) ||
    i.summary.toLowerCase().includes(lower) ||
    i.tags.some(t => t.toLowerCase().includes(lower)) ||
    i.executiveSummary?.toLowerCase().includes(lower) ||
    i.problemStatement?.toLowerCase().includes(lower)
  )
}
