/**
 * Patents Database Configuration
 * SQLite database setup for patent research storage
 */

import Database from "better-sqlite3"
import path from "path"
import fs from "fs"
import type {
  PatentResearch,
  PatentResearchStatus,
  PatentPriorArt,
  PatentResearchClaim,
  PatentAttorney
} from "./types"

// Database path - stored in project's .local-storage directory
const DB_DIR = path.join(process.cwd(), ".local-storage")
const DB_PATH = path.join(DB_DIR, "patents.db")

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

// Initialize SQLite database
export const patentsDb = new Database(DB_PATH)

// Enable WAL mode for better performance
patentsDb.pragma("journal_mode = WAL")

/**
 * Initialize the database schema for patents
 */
export function initializePatentsDatabase() {
  // Patents main table
  patentsDb.exec(`
    CREATE TABLE IF NOT EXISTS patents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'research',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      project_id TEXT,
      business_idea_id TEXT,
      invention_description TEXT NOT NULL DEFAULT '{}',
      patentability_analysis TEXT,
      filing TEXT,
      prior_art_search_notes TEXT,
      prior_art_search_completed_at TEXT,
      claims_draft_notes TEXT,
      selected_attorney_id TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      estimated_cost TEXT,
      target_filing_date TEXT
    )
  `)

  // Prior art table
  patentsDb.exec(`
    CREATE TABLE IF NOT EXISTS patent_prior_art (
      id TEXT PRIMARY KEY,
      patent_id TEXT NOT NULL REFERENCES patents(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      patent_number TEXT,
      application_number TEXT,
      inventor TEXT,
      assignee TEXT,
      filing_date TEXT,
      publication_date TEXT,
      abstract TEXT,
      url TEXT,
      relevance TEXT NOT NULL DEFAULT 'medium',
      notes TEXT NOT NULL DEFAULT '',
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Claims table
  patentsDb.exec(`
    CREATE TABLE IF NOT EXISTS patent_claims (
      id TEXT PRIMARY KEY,
      patent_id TEXT NOT NULL REFERENCES patents(id) ON DELETE CASCADE,
      number INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'independent',
      depends_on INTEGER,
      text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Attorneys table
  patentsDb.exec(`
    CREATE TABLE IF NOT EXISTS patent_attorneys (
      id TEXT PRIMARY KEY,
      patent_id TEXT NOT NULL REFERENCES patents(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      firm TEXT,
      email TEXT,
      phone TEXT,
      specializations TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      rating INTEGER,
      contacted INTEGER NOT NULL DEFAULT 0,
      contacted_at TEXT
    )
  `)

  // Create indexes
  patentsDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_patents_status ON patents(status);
    CREATE INDEX IF NOT EXISTS idx_patents_project_id ON patents(project_id);
    CREATE INDEX IF NOT EXISTS idx_patents_business_idea_id ON patents(business_idea_id);
    CREATE INDEX IF NOT EXISTS idx_patent_prior_art_patent_id ON patent_prior_art(patent_id);
    CREATE INDEX IF NOT EXISTS idx_patent_claims_patent_id ON patent_claims(patent_id);
    CREATE INDEX IF NOT EXISTS idx_patent_attorneys_patent_id ON patent_attorneys(patent_id);
  `)

  console.log("[Patents DB] Database initialized at:", DB_PATH)
}

// Initialize on import
initializePatentsDatabase()

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

// ============ Helper Functions ============

function rowToPatent(row: Record<string, unknown>): PatentResearch {
  return {
    id: row.id as string,
    title: row.title as string,
    status: row.status as PatentResearchStatus,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    projectId: row.project_id as string | undefined,
    businessIdeaId: row.business_idea_id as string | undefined,
    inventionDescription: JSON.parse(row.invention_description as string || "{}"),
    patentabilityAnalysis: row.patentability_analysis ? JSON.parse(row.patentability_analysis as string) : undefined,
    filing: row.filing ? JSON.parse(row.filing as string) : undefined,
    priorArtSearchNotes: row.prior_art_search_notes as string | undefined,
    priorArtSearchCompletedAt: row.prior_art_search_completed_at as string | undefined,
    claimsDraftNotes: row.claims_draft_notes as string | undefined,
    selectedAttorneyId: row.selected_attorney_id as string | undefined,
    tags: JSON.parse(row.tags as string || "[]"),
    notes: row.notes as string | undefined,
    estimatedCost: row.estimated_cost as string | undefined,
    targetFilingDate: row.target_filing_date as string | undefined,
    priorArt: [],
    claims: [],
    attorneys: []
  }
}

function rowToPriorArt(row: Record<string, unknown>): PatentPriorArt {
  return {
    id: row.id as string,
    title: row.title as string,
    patentNumber: row.patent_number as string | undefined,
    applicationNumber: row.application_number as string | undefined,
    inventor: row.inventor as string | undefined,
    assignee: row.assignee as string | undefined,
    filingDate: row.filing_date as string | undefined,
    publicationDate: row.publication_date as string | undefined,
    abstract: row.abstract as string | undefined,
    url: row.url as string | undefined,
    relevance: row.relevance as "low" | "medium" | "high",
    notes: row.notes as string,
    addedAt: row.added_at as string
  }
}

function rowToClaim(row: Record<string, unknown>): PatentResearchClaim {
  return {
    id: row.id as string,
    number: row.number as number,
    type: row.type as "independent" | "dependent",
    dependsOn: row.depends_on as number | undefined,
    text: row.text as string,
    status: row.status as "draft" | "reviewed" | "approved",
    notes: row.notes as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}

function rowToAttorney(row: Record<string, unknown>): PatentAttorney {
  return {
    id: row.id as string,
    name: row.name as string,
    firm: row.firm as string | undefined,
    email: row.email as string | undefined,
    phone: row.phone as string | undefined,
    specializations: JSON.parse(row.specializations as string || "[]"),
    notes: row.notes as string | undefined,
    rating: row.rating as number | undefined,
    contacted: Boolean(row.contacted),
    contactedAt: row.contacted_at as string | undefined
  }
}

// ============ CRUD Operations ============

/**
 * Get all patents with optional filtering
 */
export function dbGetAllPatents(options?: {
  status?: PatentResearchStatus
  projectId?: string
  businessIdeaId?: string
}): PatentResearch[] {
  let query = "SELECT * FROM patents WHERE 1=1"
  const params: (string | undefined)[] = []

  if (options?.status) {
    query += " AND status = ?"
    params.push(options.status)
  }

  if (options?.projectId) {
    query += " AND project_id = ?"
    params.push(options.projectId)
  }

  if (options?.businessIdeaId) {
    query += " AND business_idea_id = ?"
    params.push(options.businessIdeaId)
  }

  query += " ORDER BY updated_at DESC"

  const rows = patentsDb.prepare(query).all(...params) as Record<string, unknown>[]
  const patents = rows.map(rowToPatent)

  // Load related data for each patent
  for (const patent of patents) {
    patent.priorArt = dbGetPriorArt(patent.id)
    patent.claims = dbGetClaims(patent.id)
    patent.attorneys = dbGetAttorneys(patent.id)
  }

  return patents
}

/**
 * Get a single patent by ID
 */
export function dbGetPatent(id: string): PatentResearch | null {
  const row = patentsDb.prepare("SELECT * FROM patents WHERE id = ?").get(id) as Record<string, unknown> | undefined

  if (!row) return null

  const patent = rowToPatent(row)
  patent.priorArt = dbGetPriorArt(id)
  patent.claims = dbGetClaims(id)
  patent.attorneys = dbGetAttorneys(id)

  return patent
}

/**
 * Create a new patent
 */
export function dbCreatePatent(
  data: Omit<PatentResearch, "id" | "createdAt" | "updatedAt" | "priorArt" | "claims" | "attorneys">
): PatentResearch {
  const id = generateUUID()
  const now = new Date().toISOString()

  patentsDb.prepare(`
    INSERT INTO patents (
      id, title, status, created_at, updated_at,
      project_id, business_idea_id, invention_description,
      patentability_analysis, filing, prior_art_search_notes,
      prior_art_search_completed_at, claims_draft_notes,
      selected_attorney_id, tags, notes, estimated_cost, target_filing_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.title,
    data.status,
    now,
    now,
    data.projectId || null,
    data.businessIdeaId || null,
    JSON.stringify(data.inventionDescription),
    data.patentabilityAnalysis ? JSON.stringify(data.patentabilityAnalysis) : null,
    data.filing ? JSON.stringify(data.filing) : null,
    data.priorArtSearchNotes || null,
    data.priorArtSearchCompletedAt || null,
    data.claimsDraftNotes || null,
    data.selectedAttorneyId || null,
    JSON.stringify(data.tags || []),
    data.notes || null,
    data.estimatedCost || null,
    data.targetFilingDate || null
  )

  return dbGetPatent(id)!
}

/**
 * Update a patent
 */
export function dbUpdatePatent(
  id: string,
  updates: Partial<Omit<PatentResearch, "id" | "createdAt" | "priorArt" | "claims" | "attorneys">>
): PatentResearch | null {
  const existing = dbGetPatent(id)
  if (!existing) return null

  const now = new Date().toISOString()

  const fields: string[] = ["updated_at = ?"]
  const values: (string | null)[] = [now]

  if (updates.title !== undefined) {
    fields.push("title = ?")
    values.push(updates.title)
  }
  if (updates.status !== undefined) {
    fields.push("status = ?")
    values.push(updates.status)
  }
  if (updates.projectId !== undefined) {
    fields.push("project_id = ?")
    values.push(updates.projectId || null)
  }
  if (updates.businessIdeaId !== undefined) {
    fields.push("business_idea_id = ?")
    values.push(updates.businessIdeaId || null)
  }
  if (updates.inventionDescription !== undefined) {
    fields.push("invention_description = ?")
    values.push(JSON.stringify(updates.inventionDescription))
  }
  if (updates.patentabilityAnalysis !== undefined) {
    fields.push("patentability_analysis = ?")
    values.push(updates.patentabilityAnalysis ? JSON.stringify(updates.patentabilityAnalysis) : null)
  }
  if (updates.filing !== undefined) {
    fields.push("filing = ?")
    values.push(updates.filing ? JSON.stringify(updates.filing) : null)
  }
  if (updates.priorArtSearchNotes !== undefined) {
    fields.push("prior_art_search_notes = ?")
    values.push(updates.priorArtSearchNotes || null)
  }
  if (updates.priorArtSearchCompletedAt !== undefined) {
    fields.push("prior_art_search_completed_at = ?")
    values.push(updates.priorArtSearchCompletedAt || null)
  }
  if (updates.claimsDraftNotes !== undefined) {
    fields.push("claims_draft_notes = ?")
    values.push(updates.claimsDraftNotes || null)
  }
  if (updates.selectedAttorneyId !== undefined) {
    fields.push("selected_attorney_id = ?")
    values.push(updates.selectedAttorneyId || null)
  }
  if (updates.tags !== undefined) {
    fields.push("tags = ?")
    values.push(JSON.stringify(updates.tags))
  }
  if (updates.notes !== undefined) {
    fields.push("notes = ?")
    values.push(updates.notes || null)
  }
  if (updates.estimatedCost !== undefined) {
    fields.push("estimated_cost = ?")
    values.push(updates.estimatedCost || null)
  }
  if (updates.targetFilingDate !== undefined) {
    fields.push("target_filing_date = ?")
    values.push(updates.targetFilingDate || null)
  }

  values.push(id)

  patentsDb.prepare(`UPDATE patents SET ${fields.join(", ")} WHERE id = ?`).run(...values)

  return dbGetPatent(id)
}

/**
 * Delete a patent
 */
export function dbDeletePatent(id: string): boolean {
  const result = patentsDb.prepare("DELETE FROM patents WHERE id = ?").run(id)
  return result.changes > 0
}

// ============ Prior Art Operations ============

function dbGetPriorArt(patentId: string): PatentPriorArt[] {
  const rows = patentsDb.prepare("SELECT * FROM patent_prior_art WHERE patent_id = ? ORDER BY added_at DESC")
    .all(patentId) as Record<string, unknown>[]
  return rows.map(rowToPriorArt)
}

export function dbAddPriorArt(
  patentId: string,
  priorArt: Omit<PatentPriorArt, "id" | "addedAt">
): PatentResearch | null {
  const id = generateUUID()
  const now = new Date().toISOString()

  patentsDb.prepare(`
    INSERT INTO patent_prior_art (
      id, patent_id, title, patent_number, application_number,
      inventor, assignee, filing_date, publication_date,
      abstract, url, relevance, notes, added_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    patentId,
    priorArt.title,
    priorArt.patentNumber || null,
    priorArt.applicationNumber || null,
    priorArt.inventor || null,
    priorArt.assignee || null,
    priorArt.filingDate || null,
    priorArt.publicationDate || null,
    priorArt.abstract || null,
    priorArt.url || null,
    priorArt.relevance,
    priorArt.notes,
    now
  )

  // Update patent's updated_at
  patentsDb.prepare("UPDATE patents SET updated_at = ? WHERE id = ?").run(now, patentId)

  return dbGetPatent(patentId)
}

export function dbRemovePriorArt(patentId: string, priorArtId: string): PatentResearch | null {
  patentsDb.prepare("DELETE FROM patent_prior_art WHERE id = ? AND patent_id = ?").run(priorArtId, patentId)
  patentsDb.prepare("UPDATE patents SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), patentId)
  return dbGetPatent(patentId)
}

// ============ Claims Operations ============

function dbGetClaims(patentId: string): PatentResearchClaim[] {
  const rows = patentsDb.prepare("SELECT * FROM patent_claims WHERE patent_id = ? ORDER BY number ASC")
    .all(patentId) as Record<string, unknown>[]
  return rows.map(rowToClaim)
}

export function dbAddClaim(
  patentId: string,
  claim: Omit<PatentResearchClaim, "id" | "createdAt" | "updatedAt">
): PatentResearch | null {
  const id = generateUUID()
  const now = new Date().toISOString()

  patentsDb.prepare(`
    INSERT INTO patent_claims (
      id, patent_id, number, type, depends_on, text, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    patentId,
    claim.number,
    claim.type,
    claim.dependsOn || null,
    claim.text,
    claim.status,
    claim.notes || null,
    now,
    now
  )

  patentsDb.prepare("UPDATE patents SET updated_at = ? WHERE id = ?").run(now, patentId)

  return dbGetPatent(patentId)
}

export function dbUpdateClaim(
  patentId: string,
  claimId: string,
  updates: Partial<Omit<PatentResearchClaim, "id" | "createdAt">>
): PatentResearch | null {
  const now = new Date().toISOString()
  const fields: string[] = ["updated_at = ?"]
  const values: (string | number | null)[] = [now]

  if (updates.number !== undefined) {
    fields.push("number = ?")
    values.push(updates.number)
  }
  if (updates.type !== undefined) {
    fields.push("type = ?")
    values.push(updates.type)
  }
  if (updates.dependsOn !== undefined) {
    fields.push("depends_on = ?")
    values.push(updates.dependsOn || null)
  }
  if (updates.text !== undefined) {
    fields.push("text = ?")
    values.push(updates.text)
  }
  if (updates.status !== undefined) {
    fields.push("status = ?")
    values.push(updates.status)
  }
  if (updates.notes !== undefined) {
    fields.push("notes = ?")
    values.push(updates.notes || null)
  }

  values.push(claimId, patentId)

  patentsDb.prepare(`UPDATE patent_claims SET ${fields.join(", ")} WHERE id = ? AND patent_id = ?`).run(...values)
  patentsDb.prepare("UPDATE patents SET updated_at = ? WHERE id = ?").run(now, patentId)

  return dbGetPatent(patentId)
}

export function dbRemoveClaim(patentId: string, claimId: string): PatentResearch | null {
  patentsDb.prepare("DELETE FROM patent_claims WHERE id = ? AND patent_id = ?").run(claimId, patentId)
  patentsDb.prepare("UPDATE patents SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), patentId)
  return dbGetPatent(patentId)
}

// ============ Attorney Operations ============

function dbGetAttorneys(patentId: string): PatentAttorney[] {
  const rows = patentsDb.prepare("SELECT * FROM patent_attorneys WHERE patent_id = ?")
    .all(patentId) as Record<string, unknown>[]
  return rows.map(rowToAttorney)
}

export function dbAddAttorney(
  patentId: string,
  attorney: Omit<PatentAttorney, "id">
): PatentResearch | null {
  const id = generateUUID()

  patentsDb.prepare(`
    INSERT INTO patent_attorneys (
      id, patent_id, name, firm, email, phone, specializations, notes, rating, contacted, contacted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    patentId,
    attorney.name,
    attorney.firm || null,
    attorney.email || null,
    attorney.phone || null,
    JSON.stringify(attorney.specializations || []),
    attorney.notes || null,
    attorney.rating || null,
    attorney.contacted ? 1 : 0,
    attorney.contactedAt || null
  )

  patentsDb.prepare("UPDATE patents SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), patentId)

  return dbGetPatent(patentId)
}

export function dbUpdateAttorney(
  patentId: string,
  attorneyId: string,
  updates: Partial<Omit<PatentAttorney, "id">>
): PatentResearch | null {
  const fields: string[] = []
  const values: (string | number | null)[] = []

  if (updates.name !== undefined) {
    fields.push("name = ?")
    values.push(updates.name)
  }
  if (updates.firm !== undefined) {
    fields.push("firm = ?")
    values.push(updates.firm || null)
  }
  if (updates.email !== undefined) {
    fields.push("email = ?")
    values.push(updates.email || null)
  }
  if (updates.phone !== undefined) {
    fields.push("phone = ?")
    values.push(updates.phone || null)
  }
  if (updates.specializations !== undefined) {
    fields.push("specializations = ?")
    values.push(JSON.stringify(updates.specializations))
  }
  if (updates.notes !== undefined) {
    fields.push("notes = ?")
    values.push(updates.notes || null)
  }
  if (updates.rating !== undefined) {
    fields.push("rating = ?")
    values.push(updates.rating || null)
  }
  if (updates.contacted !== undefined) {
    fields.push("contacted = ?")
    values.push(updates.contacted ? 1 : 0)
  }
  if (updates.contactedAt !== undefined) {
    fields.push("contacted_at = ?")
    values.push(updates.contactedAt || null)
  }

  if (fields.length === 0) return dbGetPatent(patentId)

  values.push(attorneyId, patentId)

  patentsDb.prepare(`UPDATE patent_attorneys SET ${fields.join(", ")} WHERE id = ? AND patent_id = ?`).run(...values)
  patentsDb.prepare("UPDATE patents SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), patentId)

  return dbGetPatent(patentId)
}

export function dbRemoveAttorney(patentId: string, attorneyId: string): PatentResearch | null {
  patentsDb.prepare("DELETE FROM patent_attorneys WHERE id = ? AND patent_id = ?").run(attorneyId, patentId)

  // If this was the selected attorney, clear the selection
  patentsDb.prepare(`
    UPDATE patents SET selected_attorney_id = NULL, updated_at = ?
    WHERE id = ? AND selected_attorney_id = ?
  `).run(new Date().toISOString(), patentId, attorneyId)

  patentsDb.prepare("UPDATE patents SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), patentId)

  return dbGetPatent(patentId)
}

// ============ Statistics ============

export function dbGetPatentStats(): {
  total: number
  byStatus: Record<PatentResearchStatus, number>
} {
  const totalResult = patentsDb.prepare("SELECT COUNT(*) as count FROM patents").get() as { count: number }

  const byStatus: Record<PatentResearchStatus, number> = {
    research: 0,
    drafting: 0,
    review: 0,
    filed: 0,
    approved: 0,
    rejected: 0
  }

  const statusRows = patentsDb.prepare("SELECT status, COUNT(*) as count FROM patents GROUP BY status")
    .all() as Array<{ status: PatentResearchStatus; count: number }>

  for (const row of statusRows) {
    byStatus[row.status] = row.count
  }

  return {
    total: totalResult.count,
    byStatus
  }
}

export { DB_PATH as PATENTS_DB_PATH }
