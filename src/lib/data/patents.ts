/**
 * Patents Data Store
 * Storage and management for patent research projects
 */

import {
  PatentResearch,
  PatentResearchStatus,
  PatentPriorArt,
  PatentResearchClaim,
  PatentAttorney
} from "./types"

// Re-export types for consumers of this module
export type {
  PatentResearch,
  PatentResearchStatus,
  PatentPriorArt,
  PatentResearchClaim,
  PatentAttorney
}

// ============ Storage ============

const STORAGE_KEY = "claudia_patents"

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

function getStoredPatents(): PatentResearch[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

function savePatents(patents: PatentResearch[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patents))
}

// ============ CRUD Operations ============

/**
 * Get all patent research projects
 */
export function getAllPatents(options?: {
  status?: PatentResearchStatus
  projectId?: string
  businessIdeaId?: string
}): PatentResearch[] {
  let patents = getStoredPatents()

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
 */
export function getPatent(id: string): PatentResearch | null {
  const patents = getStoredPatents()
  return patents.find(p => p.id === id) || null
}

/**
 * Create a new patent research project
 */
export function createPatent(
  data: Omit<PatentResearch, "id" | "createdAt" | "updatedAt">
): PatentResearch {
  const patents = getStoredPatents()
  const now = new Date().toISOString()

  const patent: PatentResearch = {
    ...data,
    id: generateUUID(),
    createdAt: now,
    updatedAt: now
  }

  patents.push(patent)
  savePatents(patents)
  return patent
}

/**
 * Update an existing patent research project
 */
export function updatePatent(
  id: string,
  updates: Partial<Omit<PatentResearch, "id" | "createdAt">>
): PatentResearch | null {
  const patents = getStoredPatents()
  const index = patents.findIndex(p => p.id === id)

  if (index === -1) return null

  patents[index] = {
    ...patents[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  savePatents(patents)
  return patents[index]
}

/**
 * Delete a patent research project permanently
 */
export function deletePatent(id: string): boolean {
  const patents = getStoredPatents()
  const filtered = patents.filter(p => p.id !== id)

  if (filtered.length === patents.length) return false

  savePatents(filtered)
  return true
}

// ============ Status Management ============

/**
 * Update patent status
 */
export function updatePatentStatus(
  id: string,
  status: PatentResearchStatus
): PatentResearch | null {
  return updatePatent(id, { status })
}

// ============ Prior Art Management ============

/**
 * Add prior art to a patent
 */
export function addPriorArt(
  patentId: string,
  priorArt: Omit<PatentPriorArt, "id" | "addedAt">
): PatentResearch | null {
  const patent = getPatent(patentId)
  if (!patent) return null

  const newPriorArt: PatentPriorArt = {
    ...priorArt,
    id: generateUUID(),
    addedAt: new Date().toISOString()
  }

  return updatePatent(patentId, {
    priorArt: [...patent.priorArt, newPriorArt]
  })
}

/**
 * Update prior art entry
 */
export function updatePriorArt(
  patentId: string,
  priorArtId: string,
  updates: Partial<Omit<PatentPriorArt, "id" | "addedAt">>
): PatentResearch | null {
  const patent = getPatent(patentId)
  if (!patent) return null

  const priorArt = patent.priorArt.map(pa =>
    pa.id === priorArtId ? { ...pa, ...updates } : pa
  )

  return updatePatent(patentId, { priorArt })
}

/**
 * Remove prior art entry
 */
export function removePriorArt(
  patentId: string,
  priorArtId: string
): PatentResearch | null {
  const patent = getPatent(patentId)
  if (!patent) return null

  return updatePatent(patentId, {
    priorArt: patent.priorArt.filter(pa => pa.id !== priorArtId)
  })
}

// ============ Claims Management ============

/**
 * Add a claim to a patent
 */
export function addClaim(
  patentId: string,
  claim: Omit<PatentResearchClaim, "id" | "createdAt" | "updatedAt">
): PatentResearch | null {
  const patent = getPatent(patentId)
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
  })
}

/**
 * Update a claim
 */
export function updateClaim(
  patentId: string,
  claimId: string,
  updates: Partial<Omit<PatentResearchClaim, "id" | "createdAt">>
): PatentResearch | null {
  const patent = getPatent(patentId)
  if (!patent) return null

  const claims = patent.claims.map(c =>
    c.id === claimId
      ? { ...c, ...updates, updatedAt: new Date().toISOString() }
      : c
  )

  return updatePatent(patentId, { claims })
}

/**
 * Remove a claim
 */
export function removeClaim(
  patentId: string,
  claimId: string
): PatentResearch | null {
  const patent = getPatent(patentId)
  if (!patent) return null

  return updatePatent(patentId, {
    claims: patent.claims.filter(c => c.id !== claimId)
  })
}

/**
 * Reorder claims (renumber them)
 */
export function reorderClaims(
  patentId: string,
  claimIds: string[]
): PatentResearch | null {
  const patent = getPatent(patentId)
  if (!patent) return null

  const claimMap = new Map(patent.claims.map(c => [c.id, c]))
  const reorderedClaims = claimIds
    .map((id, index) => {
      const claim = claimMap.get(id)
      if (!claim) return null
      return { ...claim, number: index + 1 }
    })
    .filter((c): c is PatentResearchClaim => c !== null)

  return updatePatent(patentId, { claims: reorderedClaims })
}

// ============ Attorney Management ============

/**
 * Add an attorney referral
 */
export function addAttorney(
  patentId: string,
  attorney: Omit<PatentAttorney, "id">
): PatentResearch | null {
  const patent = getPatent(patentId)
  if (!patent) return null

  const newAttorney: PatentAttorney = {
    ...attorney,
    id: generateUUID()
  }

  return updatePatent(patentId, {
    attorneys: [...patent.attorneys, newAttorney]
  })
}

/**
 * Update an attorney
 */
export function updateAttorney(
  patentId: string,
  attorneyId: string,
  updates: Partial<Omit<PatentAttorney, "id">>
): PatentResearch | null {
  const patent = getPatent(patentId)
  if (!patent) return null

  const attorneys = patent.attorneys.map(a =>
    a.id === attorneyId ? { ...a, ...updates } : a
  )

  return updatePatent(patentId, { attorneys })
}

/**
 * Remove an attorney
 */
export function removeAttorney(
  patentId: string,
  attorneyId: string
): PatentResearch | null {
  const patent = getPatent(patentId)
  if (!patent) return null

  return updatePatent(patentId, {
    attorneys: patent.attorneys.filter(a => a.id !== attorneyId),
    selectedAttorneyId: patent.selectedAttorneyId === attorneyId
      ? undefined
      : patent.selectedAttorneyId
  })
}

/**
 * Select an attorney for the patent
 */
export function selectAttorney(
  patentId: string,
  attorneyId: string | undefined
): PatentResearch | null {
  return updatePatent(patentId, { selectedAttorneyId: attorneyId })
}

/**
 * Mark an attorney as contacted
 */
export function markAttorneyContacted(
  patentId: string,
  attorneyId: string
): PatentResearch | null {
  return updateAttorney(patentId, attorneyId, {
    contacted: true,
    contactedAt: new Date().toISOString()
  })
}

// ============ Statistics ============

/**
 * Get patent statistics
 */
export function getPatentStats(): {
  total: number
  byStatus: Record<PatentResearchStatus, number>
} {
  const patents = getStoredPatents()

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
 * Search patents
 */
export function searchPatents(query: string): PatentResearch[] {
  const patents = getStoredPatents()
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
 */
export function createEmptyPatent(title: string = "New Patent Research"): PatentResearch {
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
  })
}

/**
 * Link a patent to a project
 */
export function linkPatentToProject(
  patentId: string,
  projectId: string
): PatentResearch | null {
  return updatePatent(patentId, { projectId })
}

/**
 * Link a patent to a business idea
 */
export function linkPatentToBusinessIdea(
  patentId: string,
  businessIdeaId: string
): PatentResearch | null {
  return updatePatent(patentId, { businessIdeaId })
}

/**
 * Update invention description
 */
export function updateInventionDescription(
  patentId: string,
  description: Partial<PatentResearch["inventionDescription"]>
): PatentResearch | null {
  const patent = getPatent(patentId)
  if (!patent) return null

  return updatePatent(patentId, {
    inventionDescription: {
      ...patent.inventionDescription,
      ...description
    }
  })
}

/**
 * Update patentability analysis
 */
export function updatePatentabilityAnalysis(
  patentId: string,
  analysis: PatentResearch["patentabilityAnalysis"]
): PatentResearch | null {
  return updatePatent(patentId, { patentabilityAnalysis: analysis })
}

/**
 * Update filing information
 */
export function updateFiling(
  patentId: string,
  filing: PatentResearch["filing"]
): PatentResearch | null {
  return updatePatent(patentId, { filing })
}

/**
 * Complete prior art search
 */
export function completePriorArtSearch(
  patentId: string,
  notes?: string
): PatentResearch | null {
  return updatePatent(patentId, {
    priorArtSearchCompletedAt: new Date().toISOString(),
    priorArtSearchNotes: notes
  })
}
