/**
 * Patents Data Store
 * Storage and management for patent research projects
 *
 * IMPORTANT: All patent data is user-scoped. Patents belong to specific users
 * and are stored in user-specific localStorage keys.
 */

import {
  PatentResearch,
  PatentResearchStatus,
  PatentPriorArt,
  PatentResearchClaim,
  PatentAttorney
} from "./types"
import {
  getUserStorageItem,
  setUserStorageItem,
  USER_STORAGE_KEYS,
  dispatchStorageChange
} from "./user-storage"

// Re-export types for consumers of this module
export type {
  PatentResearch,
  PatentResearchStatus,
  PatentPriorArt,
  PatentResearchClaim,
  PatentAttorney
}

// ============ Storage ============

// Legacy storage key (kept for migration purposes)
const LEGACY_STORAGE_KEY = "claudia_patents"

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
 * Get patents for a specific user
 */
function getStoredPatentsForUser(userId: string): PatentResearch[] {
  if (typeof window === "undefined") return []

  const userPatents = getUserStorageItem<PatentResearch[]>(userId, USER_STORAGE_KEYS.PATENTS)
  if (userPatents) return userPatents

  // Fallback to legacy storage
  const stored = localStorage.getItem(LEGACY_STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

/**
 * Save patents for a specific user
 */
function savePatentsForUser(userId: string, patents: PatentResearch[]): void {
  if (typeof window === "undefined") return
  setUserStorageItem(userId, USER_STORAGE_KEYS.PATENTS, patents)
  dispatchStorageChange(userId, USER_STORAGE_KEYS.PATENTS, patents)
}

/**
 * @deprecated Use getStoredPatentsForUser instead
 */
function getStoredPatents(): PatentResearch[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(LEGACY_STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

/**
 * @deprecated Use savePatentsForUser instead
 */
function savePatents(patents: PatentResearch[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(patents))
}

// ============ CRUD Operations ============

/**
 * Get all patent research projects for a user
 * @param options - Filter options including userId (required)
 */
export function getAllPatents(options?: {
  status?: PatentResearchStatus
  projectId?: string
  businessIdeaId?: string
  userId?: string
}): PatentResearch[] {
  if (!options?.userId) {
    console.warn("getAllPatents called without userId - returning empty array for safety")
    return []
  }

  let patents = getStoredPatentsForUser(options.userId)

  if (options?.status) {
    patents = patents.filter(p => p.status === options.status)
  }

  if (options?.projectId) {
    patents = patents.filter(p => p.projectId === options.projectId)
  }

  if (options?.businessIdeaId) {
    patents = patents.filter(p => p.businessIdeaId === options.businessIdeaId)
  }

  return patents.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

/**
 * Get a single patent research project by ID
 * @param id - The patent ID
 * @param userId - The user ID (for access control)
 */
export function getPatent(id: string, userId?: string): PatentResearch | null {
  const patents = userId ? getStoredPatentsForUser(userId) : getStoredPatents()
  return patents.find(p => p.id === id) || null
}

/**
 * Create a new patent research project
 * @param data - Patent data
 * @param userId - The user ID (owner)
 */
export function createPatent(
  data: Omit<PatentResearch, "id" | "createdAt" | "updatedAt">,
  userId?: string
): PatentResearch {
  const patents = userId ? getStoredPatentsForUser(userId) : getStoredPatents()
  const now = new Date().toISOString()

  const patent: PatentResearch = {
    ...data,
    id: generateUUID(),
    createdAt: now,
    updatedAt: now
  }

  patents.push(patent)

  if (userId) {
    savePatentsForUser(userId, patents)
  } else {
    savePatents(patents)
  }

  return patent
}

/**
 * Update an existing patent research project
 * @param id - The patent ID
 * @param updates - Partial updates
 * @param userId - The user ID (for access control)
 */
export function updatePatent(
  id: string,
  updates: Partial<Omit<PatentResearch, "id" | "createdAt">>,
  userId?: string
): PatentResearch | null {
  const patents = userId ? getStoredPatentsForUser(userId) : getStoredPatents()
  const index = patents.findIndex(p => p.id === id)

  if (index === -1) return null

  patents[index] = {
    ...patents[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  if (userId) {
    savePatentsForUser(userId, patents)
  } else {
    savePatents(patents)
  }

  return patents[index]
}

/**
 * Delete a patent research project permanently
 * @param id - The patent ID
 * @param userId - The user ID (for access control)
 */
export function deletePatent(id: string, userId?: string): boolean {
  const patents = userId ? getStoredPatentsForUser(userId) : getStoredPatents()
  const filtered = patents.filter(p => p.id !== id)

  if (filtered.length === patents.length) return false

  if (userId) {
    savePatentsForUser(userId, filtered)
  } else {
    savePatents(filtered)
  }

  return true
}

// ============ Status Management ============

/**
 * Update patent status
 * @param id - The patent ID
 * @param status - New status
 * @param userId - The user ID (for access control)
 */
export function updatePatentStatus(
  id: string,
  status: PatentResearchStatus,
  userId?: string
): PatentResearch | null {
  return updatePatent(id, { status }, userId)
}

// ============ Prior Art Management ============

/**
 * Add prior art to a patent
 * @param patentId - The patent ID
 * @param priorArt - Prior art data
 * @param userId - The user ID (for access control)
 */
export function addPriorArt(
  patentId: string,
  priorArt: Omit<PatentPriorArt, "id" | "addedAt">,
  userId?: string
): PatentResearch | null {
  const patent = getPatent(patentId, userId)
  if (!patent) return null

  const newPriorArt: PatentPriorArt = {
    ...priorArt,
    id: generateUUID(),
    addedAt: new Date().toISOString()
  }

  return updatePatent(patentId, {
    priorArt: [...patent.priorArt, newPriorArt]
  }, userId)
}

/**
 * Update prior art entry
 * @param patentId - The patent ID
 * @param priorArtId - The prior art entry ID
 * @param updates - Partial updates
 * @param userId - The user ID (for access control)
 */
export function updatePriorArt(
  patentId: string,
  priorArtId: string,
  updates: Partial<Omit<PatentPriorArt, "id" | "addedAt">>,
  userId?: string
): PatentResearch | null {
  const patent = getPatent(patentId, userId)
  if (!patent) return null

  const priorArt = patent.priorArt.map(pa =>
    pa.id === priorArtId ? { ...pa, ...updates } : pa
  )

  return updatePatent(patentId, { priorArt }, userId)
}

/**
 * Remove prior art entry
 * @param patentId - The patent ID
 * @param priorArtId - The prior art entry ID
 * @param userId - The user ID (for access control)
 */
export function removePriorArt(
  patentId: string,
  priorArtId: string,
  userId?: string
): PatentResearch | null {
  const patent = getPatent(patentId, userId)
  if (!patent) return null

  return updatePatent(patentId, {
    priorArt: patent.priorArt.filter(pa => pa.id !== priorArtId)
  }, userId)
}

// ============ Claims Management ============

/**
 * Add a claim to a patent
 * @param patentId - The patent ID
 * @param claim - Claim data
 * @param userId - The user ID (for access control)
 */
export function addClaim(
  patentId: string,
  claim: Omit<PatentResearchClaim, "id" | "createdAt" | "updatedAt">,
  userId?: string
): PatentResearch | null {
  const patent = getPatent(patentId, userId)
  if (!patent) return null

  const now = new Date().toISOString()
  const newClaim: PatentResearchClaim = {
    ...claim,
    id: generateUUID(),
    createdAt: now,
    updatedAt: now
  }

  return updatePatent(patentId, {
    claims: [...patent.claims, newClaim]
  }, userId)
}

/**
 * Update a claim
 * @param patentId - The patent ID
 * @param claimId - The claim ID
 * @param updates - Partial updates
 * @param userId - The user ID (for access control)
 */
export function updateClaim(
  patentId: string,
  claimId: string,
  updates: Partial<Omit<PatentResearchClaim, "id" | "createdAt">>,
  userId?: string
): PatentResearch | null {
  const patent = getPatent(patentId, userId)
  if (!patent) return null

  const claims = patent.claims.map(c =>
    c.id === claimId
      ? { ...c, ...updates, updatedAt: new Date().toISOString() }
      : c
  )

  return updatePatent(patentId, { claims }, userId)
}

/**
 * Remove a claim
 * @param patentId - The patent ID
 * @param claimId - The claim ID
 * @param userId - The user ID (for access control)
 */
export function removeClaim(
  patentId: string,
  claimId: string,
  userId?: string
): PatentResearch | null {
  const patent = getPatent(patentId, userId)
  if (!patent) return null

  return updatePatent(patentId, {
    claims: patent.claims.filter(c => c.id !== claimId)
  }, userId)
}

/**
 * Reorder claims (renumber them)
 * @param patentId - The patent ID
 * @param claimIds - Array of claim IDs in new order
 * @param userId - The user ID (for access control)
 */
export function reorderClaims(
  patentId: string,
  claimIds: string[],
  userId?: string
): PatentResearch | null {
  const patent = getPatent(patentId, userId)
  if (!patent) return null

  const claimMap = new Map(patent.claims.map(c => [c.id, c]))
  const reorderedClaims = claimIds
    .map((id, index) => {
      const claim = claimMap.get(id)
      if (!claim) return null
      return { ...claim, number: index + 1 }
    })
    .filter((c): c is PatentResearchClaim => c !== null)

  return updatePatent(patentId, { claims: reorderedClaims }, userId)
}

// ============ Attorney Management ============

/**
 * Add an attorney referral
 * @param patentId - The patent ID
 * @param attorney - Attorney data
 * @param userId - The user ID (for access control)
 */
export function addAttorney(
  patentId: string,
  attorney: Omit<PatentAttorney, "id">,
  userId?: string
): PatentResearch | null {
  const patent = getPatent(patentId, userId)
  if (!patent) return null

  const newAttorney: PatentAttorney = {
    ...attorney,
    id: generateUUID()
  }

  return updatePatent(patentId, {
    attorneys: [...patent.attorneys, newAttorney]
  }, userId)
}

/**
 * Update an attorney
 * @param patentId - The patent ID
 * @param attorneyId - The attorney ID
 * @param updates - Partial updates
 * @param userId - The user ID (for access control)
 */
export function updateAttorney(
  patentId: string,
  attorneyId: string,
  updates: Partial<Omit<PatentAttorney, "id">>,
  userId?: string
): PatentResearch | null {
  const patent = getPatent(patentId, userId)
  if (!patent) return null

  const attorneys = patent.attorneys.map(a =>
    a.id === attorneyId ? { ...a, ...updates } : a
  )

  return updatePatent(patentId, { attorneys }, userId)
}

/**
 * Remove an attorney
 * @param patentId - The patent ID
 * @param attorneyId - The attorney ID
 * @param userId - The user ID (for access control)
 */
export function removeAttorney(
  patentId: string,
  attorneyId: string,
  userId?: string
): PatentResearch | null {
  const patent = getPatent(patentId, userId)
  if (!patent) return null

  return updatePatent(patentId, {
    attorneys: patent.attorneys.filter(a => a.id !== attorneyId),
    selectedAttorneyId: patent.selectedAttorneyId === attorneyId
      ? undefined
      : patent.selectedAttorneyId
  }, userId)
}

/**
 * Select an attorney for the patent
 * @param patentId - The patent ID
 * @param attorneyId - The attorney ID (or undefined to deselect)
 * @param userId - The user ID (for access control)
 */
export function selectAttorney(
  patentId: string,
  attorneyId: string | undefined,
  userId?: string
): PatentResearch | null {
  return updatePatent(patentId, { selectedAttorneyId: attorneyId }, userId)
}

/**
 * Mark an attorney as contacted
 * @param patentId - The patent ID
 * @param attorneyId - The attorney ID
 * @param userId - The user ID (for access control)
 */
export function markAttorneyContacted(
  patentId: string,
  attorneyId: string,
  userId?: string
): PatentResearch | null {
  return updateAttorney(patentId, attorneyId, {
    contacted: true,
    contactedAt: new Date().toISOString()
  }, userId)
}

// ============ Statistics ============

/**
 * Get patent statistics for a user
 * @param userId - Required: The user ID
 */
export function getPatentStats(userId: string): {
  total: number
  byStatus: Record<PatentResearchStatus, number>
} {
  if (!userId) {
    return {
      total: 0,
      byStatus: {
        research: 0,
        drafting: 0,
        review: 0,
        filed: 0,
        approved: 0,
        rejected: 0
      }
    }
  }

  const patents = getStoredPatentsForUser(userId)

  const byStatus: Record<PatentResearchStatus, number> = {
    research: 0,
    drafting: 0,
    review: 0,
    filed: 0,
    approved: 0,
    rejected: 0
  }

  for (const patent of patents) {
    byStatus[patent.status]++
  }

  return {
    total: patents.length,
    byStatus
  }
}

/**
 * Search patents for a user
 * @param query - Search query
 * @param userId - Required: The user ID
 */
export function searchPatents(query: string, userId: string): PatentResearch[] {
  if (!userId) return []

  const patents = getStoredPatentsForUser(userId)
  const lower = query.toLowerCase()

  return patents.filter(p =>
    p.title.toLowerCase().includes(lower) ||
    p.inventionDescription.summary.toLowerCase().includes(lower) ||
    p.tags.some(t => t.toLowerCase().includes(lower)) ||
    p.inventionDescription.technicalField?.toLowerCase().includes(lower) ||
    p.inventionDescription.problemSolved?.toLowerCase().includes(lower)
  )
}

// ============ Helper Functions ============

/**
 * Create a new empty patent research project with default values
 * @param title - The patent title
 * @param userId - The user ID (owner)
 */
export function createEmptyPatent(title: string = "New Patent Research", userId?: string): PatentResearch {
  return createPatent({
    title,
    status: "research",
    inventionDescription: {
      summary: ""
    },
    priorArt: [],
    claims: [],
    attorneys: [],
    tags: []
  }, userId)
}

/**
 * Link a patent to a project
 * @param patentId - The patent ID
 * @param projectId - The project ID to link
 * @param userId - The user ID (for access control)
 */
export function linkPatentToProject(
  patentId: string,
  projectId: string,
  userId?: string
): PatentResearch | null {
  return updatePatent(patentId, { projectId }, userId)
}

/**
 * Link a patent to a business idea
 * @param patentId - The patent ID
 * @param businessIdeaId - The business idea ID to link
 * @param userId - The user ID (for access control)
 */
export function linkPatentToBusinessIdea(
  patentId: string,
  businessIdeaId: string,
  userId?: string
): PatentResearch | null {
  return updatePatent(patentId, { businessIdeaId }, userId)
}

/**
 * Update invention description
 * @param patentId - The patent ID
 * @param description - Partial description updates
 * @param userId - The user ID (for access control)
 */
export function updateInventionDescription(
  patentId: string,
  description: Partial<PatentResearch["inventionDescription"]>,
  userId?: string
): PatentResearch | null {
  const patent = getPatent(patentId, userId)
  if (!patent) return null

  return updatePatent(patentId, {
    inventionDescription: {
      ...patent.inventionDescription,
      ...description
    }
  }, userId)
}

/**
 * Update patentability analysis
 * @param patentId - The patent ID
 * @param analysis - The patentability analysis data
 * @param userId - The user ID (for access control)
 */
export function updatePatentabilityAnalysis(
  patentId: string,
  analysis: PatentResearch["patentabilityAnalysis"],
  userId?: string
): PatentResearch | null {
  return updatePatent(patentId, { patentabilityAnalysis: analysis }, userId)
}

/**
 * Update filing information
 * @param patentId - The patent ID
 * @param filing - The filing data
 * @param userId - The user ID (for access control)
 */
export function updateFiling(
  patentId: string,
  filing: PatentResearch["filing"],
  userId?: string
): PatentResearch | null {
  return updatePatent(patentId, { filing }, userId)
}

/**
 * Complete prior art search
 * @param patentId - The patent ID
 * @param notes - Optional notes
 * @param userId - The user ID (for access control)
 */
export function completePriorArtSearch(
  patentId: string,
  notes?: string,
  userId?: string
): PatentResearch | null {
  return updatePatent(patentId, {
    priorArtSearchCompletedAt: new Date().toISOString(),
    priorArtSearchNotes: notes
  }, userId)
}
