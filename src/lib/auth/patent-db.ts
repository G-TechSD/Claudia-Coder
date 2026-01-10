/**
 * Patent Research Database Configuration
 * Manages patent research projects, claims, prior art, attorneys, and searches
 */

import { db } from "./db"

/**
 * Initialize patent-related database tables
 */
export function initializePatentDatabase() {
  // Patent Research table - main patent research projects
  db.exec(`
    CREATE TABLE IF NOT EXISTS patent_research (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      inventionDescription TEXT,
      technicalField TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      tags TEXT,
      priority TEXT DEFAULT 'medium',
      filingDeadline TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Patent Claims table - individual patent claims
  db.exec(`
    CREATE TABLE IF NOT EXISTS patent_claims (
      id TEXT PRIMARY KEY,
      patentId TEXT NOT NULL REFERENCES patent_research(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'independent',
      claimNumber INTEGER,
      text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      dependencies TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Patent Prior Art table - prior art references
  db.exec(`
    CREATE TABLE IF NOT EXISTS patent_prior_art (
      id TEXT PRIMARY KEY,
      patentId TEXT NOT NULL REFERENCES patent_research(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      patentNumber TEXT,
      inventor TEXT,
      abstract TEXT,
      relevanceScore REAL DEFAULT 0,
      url TEXT,
      publicationDate TEXT,
      source TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Patent Attorneys table - attorney contacts
  db.exec(`
    CREATE TABLE IF NOT EXISTS patent_attorneys (
      id TEXT PRIMARY KEY,
      userId TEXT REFERENCES user(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      firm TEXT,
      email TEXT,
      phone TEXT,
      specializations TEXT,
      rating REAL DEFAULT 0,
      notes TEXT,
      isPreferred INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Patent Searches table - search history
  db.exec(`
    CREATE TABLE IF NOT EXISTS patent_searches (
      id TEXT PRIMARY KEY,
      patentId TEXT NOT NULL REFERENCES patent_research(id) ON DELETE CASCADE,
      query TEXT NOT NULL,
      results TEXT,
      patentabilityScore REAL DEFAULT 0,
      searchType TEXT DEFAULT 'general',
      resultCount INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_patent_research_userId ON patent_research(userId);
    CREATE INDEX IF NOT EXISTS idx_patent_research_status ON patent_research(status);
    CREATE INDEX IF NOT EXISTS idx_patent_research_technicalField ON patent_research(technicalField);
    CREATE INDEX IF NOT EXISTS idx_patent_claims_patentId ON patent_claims(patentId);
    CREATE INDEX IF NOT EXISTS idx_patent_claims_type ON patent_claims(type);
    CREATE INDEX IF NOT EXISTS idx_patent_claims_status ON patent_claims(status);
    CREATE INDEX IF NOT EXISTS idx_patent_prior_art_patentId ON patent_prior_art(patentId);
    CREATE INDEX IF NOT EXISTS idx_patent_prior_art_patentNumber ON patent_prior_art(patentNumber);
    CREATE INDEX IF NOT EXISTS idx_patent_attorneys_userId ON patent_attorneys(userId);
    CREATE INDEX IF NOT EXISTS idx_patent_attorneys_firm ON patent_attorneys(firm);
    CREATE INDEX IF NOT EXISTS idx_patent_searches_patentId ON patent_searches(patentId);
  `)

  console.log("[Patent] Database tables initialized")
}

// Initialize on import
initializePatentDatabase()

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Patent Research type
 */
export interface PatentResearch {
  id: string
  userId: string
  title: string
  description: string | null
  inventionDescription: string | null
  technicalField: string | null
  status: "draft" | "in_progress" | "filed" | "granted" | "rejected" | "abandoned"
  tags: string[] | null
  priority: "low" | "medium" | "high" | "critical"
  filingDeadline: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Patent Claim type
 */
export interface PatentClaim {
  id: string
  patentId: string
  type: "independent" | "dependent"
  claimNumber: number | null
  text: string
  status: "draft" | "review" | "approved" | "rejected"
  dependencies: string[] | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Patent Prior Art type
 */
export interface PatentPriorArt {
  id: string
  patentId: string
  title: string
  patentNumber: string | null
  inventor: string | null
  abstract: string | null
  relevanceScore: number
  url: string | null
  publicationDate: string | null
  source: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Patent Attorney type
 */
export interface PatentAttorney {
  id: string
  userId: string | null
  name: string
  firm: string | null
  email: string | null
  phone: string | null
  specializations: string[] | null
  rating: number
  notes: string | null
  isPreferred: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Patent Search type
 */
export interface PatentSearch {
  id: string
  patentId: string
  query: string
  results: string | null
  patentabilityScore: number
  searchType: string
  resultCount: number
  createdAt: string
}

// ============================================================================
// Patent Research CRUD Functions
// ============================================================================

/**
 * Create a new patent research project
 */
export function createPatentResearch(data: {
  userId: string
  title: string
  description?: string
  inventionDescription?: string
  technicalField?: string
  status?: PatentResearch["status"]
  tags?: string[]
  priority?: PatentResearch["priority"]
  filingDeadline?: string
}): PatentResearch {
  const id = crypto.randomUUID()
  const tagsJson = data.tags ? JSON.stringify(data.tags) : null

  db.prepare(
    `INSERT INTO patent_research (id, userId, title, description, inventionDescription, technicalField, status, tags, priority, filingDeadline)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.userId,
    data.title,
    data.description || null,
    data.inventionDescription || null,
    data.technicalField || null,
    data.status || "draft",
    tagsJson,
    data.priority || "medium",
    data.filingDeadline || null
  )

  return getPatentResearchById(id)!
}

/**
 * Get a patent research project by ID
 */
export function getPatentResearchById(id: string): PatentResearch | null {
  const result = db
    .prepare("SELECT * FROM patent_research WHERE id = ?")
    .get(id) as (Omit<PatentResearch, "tags"> & { tags: string | null }) | undefined

  if (!result) return null

  return {
    ...result,
    tags: result.tags ? JSON.parse(result.tags) : null,
  }
}

/**
 * Get all patent research projects for a user
 */
export function getPatentResearchByUserId(userId: string): PatentResearch[] {
  const results = db
    .prepare("SELECT * FROM patent_research WHERE userId = ? ORDER BY updatedAt DESC")
    .all(userId) as (Omit<PatentResearch, "tags"> & { tags: string | null })[]

  return results.map((result) => ({
    ...result,
    tags: result.tags ? JSON.parse(result.tags) : null,
  }))
}

/**
 * Update a patent research project
 */
export function updatePatentResearch(
  id: string,
  data: Partial<Omit<PatentResearch, "id" | "userId" | "createdAt" | "updatedAt">>
): PatentResearch | null {
  const existing = getPatentResearchById(id)
  if (!existing) return null

  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (data.title !== undefined) {
    updates.push("title = ?")
    values.push(data.title)
  }
  if (data.description !== undefined) {
    updates.push("description = ?")
    values.push(data.description)
  }
  if (data.inventionDescription !== undefined) {
    updates.push("inventionDescription = ?")
    values.push(data.inventionDescription)
  }
  if (data.technicalField !== undefined) {
    updates.push("technicalField = ?")
    values.push(data.technicalField)
  }
  if (data.status !== undefined) {
    updates.push("status = ?")
    values.push(data.status)
  }
  if (data.tags !== undefined) {
    updates.push("tags = ?")
    values.push(data.tags ? JSON.stringify(data.tags) : null)
  }
  if (data.priority !== undefined) {
    updates.push("priority = ?")
    values.push(data.priority)
  }
  if (data.filingDeadline !== undefined) {
    updates.push("filingDeadline = ?")
    values.push(data.filingDeadline)
  }

  if (updates.length === 0) return existing

  updates.push("updatedAt = datetime('now')")
  values.push(id)

  db.prepare(
    `UPDATE patent_research SET ${updates.join(", ")} WHERE id = ?`
  ).run(...values)

  return getPatentResearchById(id)
}

/**
 * Delete a patent research project
 */
export function deletePatentResearch(id: string): boolean {
  const result = db.prepare("DELETE FROM patent_research WHERE id = ?").run(id)
  return result.changes > 0
}

// ============================================================================
// Patent Claims CRUD Functions
// ============================================================================

/**
 * Create a new patent claim
 */
export function createPatentClaim(data: {
  patentId: string
  type?: PatentClaim["type"]
  claimNumber?: number
  text: string
  status?: PatentClaim["status"]
  dependencies?: string[]
  notes?: string
}): PatentClaim {
  const id = crypto.randomUUID()
  const dependenciesJson = data.dependencies ? JSON.stringify(data.dependencies) : null

  db.prepare(
    `INSERT INTO patent_claims (id, patentId, type, claimNumber, text, status, dependencies, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.patentId,
    data.type || "independent",
    data.claimNumber || null,
    data.text,
    data.status || "draft",
    dependenciesJson,
    data.notes || null
  )

  return getPatentClaimById(id)!
}

/**
 * Get a patent claim by ID
 */
export function getPatentClaimById(id: string): PatentClaim | null {
  const result = db
    .prepare("SELECT * FROM patent_claims WHERE id = ?")
    .get(id) as (Omit<PatentClaim, "dependencies"> & { dependencies: string | null }) | undefined

  if (!result) return null

  return {
    ...result,
    dependencies: result.dependencies ? JSON.parse(result.dependencies) : null,
  }
}

/**
 * Get all claims for a patent
 */
export function getPatentClaimsByPatentId(patentId: string): PatentClaim[] {
  const results = db
    .prepare("SELECT * FROM patent_claims WHERE patentId = ? ORDER BY claimNumber ASC, createdAt ASC")
    .all(patentId) as (Omit<PatentClaim, "dependencies"> & { dependencies: string | null })[]

  return results.map((result) => ({
    ...result,
    dependencies: result.dependencies ? JSON.parse(result.dependencies) : null,
  }))
}

/**
 * Update a patent claim
 */
export function updatePatentClaim(
  id: string,
  data: Partial<Omit<PatentClaim, "id" | "patentId" | "createdAt" | "updatedAt">>
): PatentClaim | null {
  const existing = getPatentClaimById(id)
  if (!existing) return null

  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (data.type !== undefined) {
    updates.push("type = ?")
    values.push(data.type)
  }
  if (data.claimNumber !== undefined) {
    updates.push("claimNumber = ?")
    values.push(data.claimNumber)
  }
  if (data.text !== undefined) {
    updates.push("text = ?")
    values.push(data.text)
  }
  if (data.status !== undefined) {
    updates.push("status = ?")
    values.push(data.status)
  }
  if (data.dependencies !== undefined) {
    updates.push("dependencies = ?")
    values.push(data.dependencies ? JSON.stringify(data.dependencies) : null)
  }
  if (data.notes !== undefined) {
    updates.push("notes = ?")
    values.push(data.notes)
  }

  if (updates.length === 0) return existing

  updates.push("updatedAt = datetime('now')")
  values.push(id)

  db.prepare(
    `UPDATE patent_claims SET ${updates.join(", ")} WHERE id = ?`
  ).run(...values)

  return getPatentClaimById(id)
}

/**
 * Delete a patent claim
 */
export function deletePatentClaim(id: string): boolean {
  const result = db.prepare("DELETE FROM patent_claims WHERE id = ?").run(id)
  return result.changes > 0
}

// ============================================================================
// Patent Prior Art CRUD Functions
// ============================================================================

/**
 * Create a new prior art reference
 */
export function createPatentPriorArt(data: {
  patentId: string
  title: string
  patentNumber?: string
  inventor?: string
  abstract?: string
  relevanceScore?: number
  url?: string
  publicationDate?: string
  source?: string
  notes?: string
}): PatentPriorArt {
  const id = crypto.randomUUID()

  db.prepare(
    `INSERT INTO patent_prior_art (id, patentId, title, patentNumber, inventor, abstract, relevanceScore, url, publicationDate, source, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.patentId,
    data.title,
    data.patentNumber || null,
    data.inventor || null,
    data.abstract || null,
    data.relevanceScore || 0,
    data.url || null,
    data.publicationDate || null,
    data.source || null,
    data.notes || null
  )

  return getPatentPriorArtById(id)!
}

/**
 * Get a prior art reference by ID
 */
export function getPatentPriorArtById(id: string): PatentPriorArt | null {
  const result = db
    .prepare("SELECT * FROM patent_prior_art WHERE id = ?")
    .get(id) as PatentPriorArt | undefined

  return result || null
}

/**
 * Get all prior art references for a patent
 */
export function getPatentPriorArtByPatentId(patentId: string): PatentPriorArt[] {
  return db
    .prepare("SELECT * FROM patent_prior_art WHERE patentId = ? ORDER BY relevanceScore DESC, createdAt DESC")
    .all(patentId) as PatentPriorArt[]
}

/**
 * Update a prior art reference
 */
export function updatePatentPriorArt(
  id: string,
  data: Partial<Omit<PatentPriorArt, "id" | "patentId" | "createdAt" | "updatedAt">>
): PatentPriorArt | null {
  const existing = getPatentPriorArtById(id)
  if (!existing) return null

  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (data.title !== undefined) {
    updates.push("title = ?")
    values.push(data.title)
  }
  if (data.patentNumber !== undefined) {
    updates.push("patentNumber = ?")
    values.push(data.patentNumber)
  }
  if (data.inventor !== undefined) {
    updates.push("inventor = ?")
    values.push(data.inventor)
  }
  if (data.abstract !== undefined) {
    updates.push("abstract = ?")
    values.push(data.abstract)
  }
  if (data.relevanceScore !== undefined) {
    updates.push("relevanceScore = ?")
    values.push(data.relevanceScore)
  }
  if (data.url !== undefined) {
    updates.push("url = ?")
    values.push(data.url)
  }
  if (data.publicationDate !== undefined) {
    updates.push("publicationDate = ?")
    values.push(data.publicationDate)
  }
  if (data.source !== undefined) {
    updates.push("source = ?")
    values.push(data.source)
  }
  if (data.notes !== undefined) {
    updates.push("notes = ?")
    values.push(data.notes)
  }

  if (updates.length === 0) return existing

  updates.push("updatedAt = datetime('now')")
  values.push(id)

  db.prepare(
    `UPDATE patent_prior_art SET ${updates.join(", ")} WHERE id = ?`
  ).run(...values)

  return getPatentPriorArtById(id)
}

/**
 * Delete a prior art reference
 */
export function deletePatentPriorArt(id: string): boolean {
  const result = db.prepare("DELETE FROM patent_prior_art WHERE id = ?").run(id)
  return result.changes > 0
}

// ============================================================================
// Patent Attorneys CRUD Functions
// ============================================================================

/**
 * Create a new attorney contact
 */
export function createPatentAttorney(data: {
  userId?: string
  name: string
  firm?: string
  email?: string
  phone?: string
  specializations?: string[]
  rating?: number
  notes?: string
  isPreferred?: boolean
}): PatentAttorney {
  const id = crypto.randomUUID()
  const specializationsJson = data.specializations ? JSON.stringify(data.specializations) : null

  db.prepare(
    `INSERT INTO patent_attorneys (id, userId, name, firm, email, phone, specializations, rating, notes, isPreferred)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.userId || null,
    data.name,
    data.firm || null,
    data.email || null,
    data.phone || null,
    specializationsJson,
    data.rating || 0,
    data.notes || null,
    data.isPreferred ? 1 : 0
  )

  return getPatentAttorneyById(id)!
}

/**
 * Get an attorney by ID
 */
export function getPatentAttorneyById(id: string): PatentAttorney | null {
  const result = db
    .prepare("SELECT * FROM patent_attorneys WHERE id = ?")
    .get(id) as (Omit<PatentAttorney, "specializations" | "isPreferred"> & { specializations: string | null; isPreferred: number }) | undefined

  if (!result) return null

  return {
    ...result,
    specializations: result.specializations ? JSON.parse(result.specializations) : null,
    isPreferred: Boolean(result.isPreferred),
  }
}

/**
 * Get all attorneys (optionally filtered by user)
 */
export function getPatentAttorneys(userId?: string): PatentAttorney[] {
  const query = userId
    ? "SELECT * FROM patent_attorneys WHERE userId = ? OR userId IS NULL ORDER BY isPreferred DESC, rating DESC, name ASC"
    : "SELECT * FROM patent_attorneys ORDER BY isPreferred DESC, rating DESC, name ASC"

  const results = userId
    ? db.prepare(query).all(userId) as (Omit<PatentAttorney, "specializations" | "isPreferred"> & { specializations: string | null; isPreferred: number })[]
    : db.prepare(query).all() as (Omit<PatentAttorney, "specializations" | "isPreferred"> & { specializations: string | null; isPreferred: number })[]

  return results.map((result) => ({
    ...result,
    specializations: result.specializations ? JSON.parse(result.specializations) : null,
    isPreferred: Boolean(result.isPreferred),
  }))
}

/**
 * Update an attorney
 */
export function updatePatentAttorney(
  id: string,
  data: Partial<Omit<PatentAttorney, "id" | "createdAt" | "updatedAt">>
): PatentAttorney | null {
  const existing = getPatentAttorneyById(id)
  if (!existing) return null

  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (data.userId !== undefined) {
    updates.push("userId = ?")
    values.push(data.userId)
  }
  if (data.name !== undefined) {
    updates.push("name = ?")
    values.push(data.name)
  }
  if (data.firm !== undefined) {
    updates.push("firm = ?")
    values.push(data.firm)
  }
  if (data.email !== undefined) {
    updates.push("email = ?")
    values.push(data.email)
  }
  if (data.phone !== undefined) {
    updates.push("phone = ?")
    values.push(data.phone)
  }
  if (data.specializations !== undefined) {
    updates.push("specializations = ?")
    values.push(data.specializations ? JSON.stringify(data.specializations) : null)
  }
  if (data.rating !== undefined) {
    updates.push("rating = ?")
    values.push(data.rating)
  }
  if (data.notes !== undefined) {
    updates.push("notes = ?")
    values.push(data.notes)
  }
  if (data.isPreferred !== undefined) {
    updates.push("isPreferred = ?")
    values.push(data.isPreferred ? 1 : 0)
  }

  if (updates.length === 0) return existing

  updates.push("updatedAt = datetime('now')")
  values.push(id)

  db.prepare(
    `UPDATE patent_attorneys SET ${updates.join(", ")} WHERE id = ?`
  ).run(...values)

  return getPatentAttorneyById(id)
}

/**
 * Delete an attorney
 */
export function deletePatentAttorney(id: string): boolean {
  const result = db.prepare("DELETE FROM patent_attorneys WHERE id = ?").run(id)
  return result.changes > 0
}

// ============================================================================
// Patent Searches CRUD Functions
// ============================================================================

/**
 * Create a new patent search record
 */
export function createPatentSearch(data: {
  patentId: string
  query: string
  results?: string
  patentabilityScore?: number
  searchType?: string
  resultCount?: number
}): PatentSearch {
  const id = crypto.randomUUID()

  db.prepare(
    `INSERT INTO patent_searches (id, patentId, query, results, patentabilityScore, searchType, resultCount)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.patentId,
    data.query,
    data.results || null,
    data.patentabilityScore || 0,
    data.searchType || "general",
    data.resultCount || 0
  )

  return getPatentSearchById(id)!
}

/**
 * Get a search record by ID
 */
export function getPatentSearchById(id: string): PatentSearch | null {
  const result = db
    .prepare("SELECT * FROM patent_searches WHERE id = ?")
    .get(id) as PatentSearch | undefined

  return result || null
}

/**
 * Get all searches for a patent
 */
export function getPatentSearchesByPatentId(patentId: string): PatentSearch[] {
  return db
    .prepare("SELECT * FROM patent_searches WHERE patentId = ? ORDER BY createdAt DESC")
    .all(patentId) as PatentSearch[]
}

/**
 * Update a search record (mainly for updating results and scores)
 */
export function updatePatentSearch(
  id: string,
  data: Partial<Omit<PatentSearch, "id" | "patentId" | "createdAt">>
): PatentSearch | null {
  const existing = getPatentSearchById(id)
  if (!existing) return null

  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (data.query !== undefined) {
    updates.push("query = ?")
    values.push(data.query)
  }
  if (data.results !== undefined) {
    updates.push("results = ?")
    values.push(data.results)
  }
  if (data.patentabilityScore !== undefined) {
    updates.push("patentabilityScore = ?")
    values.push(data.patentabilityScore)
  }
  if (data.searchType !== undefined) {
    updates.push("searchType = ?")
    values.push(data.searchType)
  }
  if (data.resultCount !== undefined) {
    updates.push("resultCount = ?")
    values.push(data.resultCount)
  }

  if (updates.length === 0) return existing

  values.push(id)

  db.prepare(
    `UPDATE patent_searches SET ${updates.join(", ")} WHERE id = ?`
  ).run(...values)

  return getPatentSearchById(id)
}

/**
 * Delete a search record
 */
export function deletePatentSearch(id: string): boolean {
  const result = db.prepare("DELETE FROM patent_searches WHERE id = ?").run(id)
  return result.changes > 0
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a patent research project with all related data
 */
export function getPatentResearchWithDetails(id: string): {
  patent: PatentResearch
  claims: PatentClaim[]
  priorArt: PatentPriorArt[]
  searches: PatentSearch[]
} | null {
  const patent = getPatentResearchById(id)
  if (!patent) return null

  return {
    patent,
    claims: getPatentClaimsByPatentId(id),
    priorArt: getPatentPriorArtByPatentId(id),
    searches: getPatentSearchesByPatentId(id),
  }
}

/**
 * Search patent research projects by title or description
 */
export function searchPatentResearch(userId: string, searchTerm: string): PatentResearch[] {
  const results = db
    .prepare(
      `SELECT * FROM patent_research
       WHERE userId = ? AND (title LIKE ? OR description LIKE ? OR technicalField LIKE ?)
       ORDER BY updatedAt DESC`
    )
    .all(userId, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`) as (Omit<PatentResearch, "tags"> & { tags: string | null })[]

  return results.map((result) => ({
    ...result,
    tags: result.tags ? JSON.parse(result.tags) : null,
  }))
}

/**
 * Get patent research projects by status
 */
export function getPatentResearchByStatus(
  userId: string,
  status: PatentResearch["status"]
): PatentResearch[] {
  const results = db
    .prepare("SELECT * FROM patent_research WHERE userId = ? AND status = ? ORDER BY updatedAt DESC")
    .all(userId, status) as (Omit<PatentResearch, "tags"> & { tags: string | null })[]

  return results.map((result) => ({
    ...result,
    tags: result.tags ? JSON.parse(result.tags) : null,
  }))
}
