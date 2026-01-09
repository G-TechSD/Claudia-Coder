/**
 * Patent Attorney Referrals Data Store
 * Manages attorney directory, referrals, and commission tracking
 */

import * as fs from "fs"
import * as path from "path"

// ============ Types ============

export type ReferralStatus = "pending" | "contacted" | "consultation_scheduled" | "converted" | "declined" | "expired"
export type CommissionStatus = "pending" | "earned" | "paid"

export interface Attorney {
  id: string
  name: string
  firm: string
  specialty: string[]  // e.g., ["software", "biotechnology", "mechanical"]
  location: string
  rating: number  // 1-5 stars
  commissionRate: number  // percentage, e.g., 10 for 10%
  email?: string
  phone?: string
  website?: string
  bio?: string
  active: boolean
}

export interface Referral {
  id: string
  userId: string
  patentId: string
  attorneyId: string
  status: ReferralStatus
  commissionRate: number  // Rate at time of referral
  commissionAmount?: number  // Calculated when converted
  commissionStatus: CommissionStatus
  referredAt: string
  contactedAt?: string
  convertedAt?: string
  paidAt?: string
  notes?: string
  // Attorney info snapshot at time of referral
  attorneyName: string
  attorneyFirm: string
}

export interface ReferralStats {
  total: number
  byStatus: Record<ReferralStatus, number>
  pendingCommissions: number
  earnedCommissions: number
  paidCommissions: number
  totalCommissionValue: number
}

// ============ Storage Paths ============

const LOCAL_STORAGE_DIR = path.join(process.cwd(), ".local-storage")
const ATTORNEYS_FILE = path.join(LOCAL_STORAGE_DIR, "attorneys.json")
const REFERRALS_FILE = path.join(LOCAL_STORAGE_DIR, "referrals.json")

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

// ============ File Storage Helpers ============

function ensureStorageDir(): void {
  if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true })
  }
}

function readJsonFile<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8")
      return JSON.parse(data)
    }
  } catch (error) {
    console.error(`[Referrals] Error reading ${filePath}:`, error)
  }
  return defaultValue
}

function writeJsonFile<T>(filePath: string, data: T): void {
  ensureStorageDir()
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

// ============ Attorney Operations ============

/**
 * Get all attorneys
 */
export function getAllAttorneys(options?: { activeOnly?: boolean }): Attorney[] {
  const attorneys = readJsonFile<Attorney[]>(ATTORNEYS_FILE, [])
  if (options?.activeOnly) {
    return attorneys.filter(a => a.active)
  }
  return attorneys
}

/**
 * Get a single attorney by ID
 */
export function getAttorney(id: string): Attorney | null {
  const attorneys = getAllAttorneys()
  return attorneys.find(a => a.id === id) || null
}

/**
 * Search attorneys by specialty and/or location
 */
export function searchAttorneys(filters: {
  specialty?: string
  location?: string
  minRating?: number
}): Attorney[] {
  let attorneys = getAllAttorneys({ activeOnly: true })

  if (filters.specialty) {
    const specialty = filters.specialty.toLowerCase()
    attorneys = attorneys.filter(a =>
      a.specialty.some(s => s.toLowerCase().includes(specialty))
    )
  }

  if (filters.location) {
    const location = filters.location.toLowerCase()
    attorneys = attorneys.filter(a =>
      a.location.toLowerCase().includes(location)
    )
  }

  if (filters.minRating !== undefined) {
    attorneys = attorneys.filter(a => a.rating >= filters.minRating!)
  }

  // Sort by rating descending
  return attorneys.sort((a, b) => b.rating - a.rating)
}

/**
 * Create a new attorney
 */
export function createAttorney(
  data: Omit<Attorney, "id">
): Attorney {
  const attorneys = getAllAttorneys()

  const attorney: Attorney = {
    ...data,
    id: generateUUID()
  }

  attorneys.push(attorney)
  writeJsonFile(ATTORNEYS_FILE, attorneys)
  return attorney
}

/**
 * Update an attorney
 */
export function updateAttorney(
  id: string,
  updates: Partial<Omit<Attorney, "id">>
): Attorney | null {
  const attorneys = getAllAttorneys()
  const index = attorneys.findIndex(a => a.id === id)

  if (index === -1) return null

  attorneys[index] = {
    ...attorneys[index],
    ...updates
  }

  writeJsonFile(ATTORNEYS_FILE, attorneys)
  return attorneys[index]
}

/**
 * Delete an attorney (soft delete by setting active to false)
 */
export function deactivateAttorney(id: string): boolean {
  const result = updateAttorney(id, { active: false })
  return result !== null
}

// ============ Referral Operations ============

/**
 * Get all referrals
 */
export function getAllReferrals(): Referral[] {
  return readJsonFile<Referral[]>(REFERRALS_FILE, [])
}

/**
 * Get referrals for a specific user
 */
export function getUserReferrals(userId: string): Referral[] {
  const referrals = getAllReferrals()
  return referrals.filter(r => r.userId === userId)
}

/**
 * Get referrals for a specific patent
 */
export function getPatentReferrals(patentId: string): Referral[] {
  const referrals = getAllReferrals()
  return referrals.filter(r => r.patentId === patentId)
}

/**
 * Get a single referral by ID
 */
export function getReferral(id: string): Referral | null {
  const referrals = getAllReferrals()
  return referrals.find(r => r.id === id) || null
}

/**
 * Track a new referral
 */
export function trackReferral(
  userId: string,
  patentId: string,
  attorneyId: string,
  notes?: string
): Referral | null {
  const attorney = getAttorney(attorneyId)
  if (!attorney) {
    console.error(`[Referrals] Attorney not found: ${attorneyId}`)
    return null
  }

  const referrals = getAllReferrals()
  const now = new Date().toISOString()

  const referral: Referral = {
    id: generateUUID(),
    userId,
    patentId,
    attorneyId,
    status: "pending",
    commissionRate: attorney.commissionRate,
    commissionStatus: "pending",
    referredAt: now,
    notes,
    attorneyName: attorney.name,
    attorneyFirm: attorney.firm
  }

  referrals.push(referral)
  writeJsonFile(REFERRALS_FILE, referrals)
  return referral
}

/**
 * Update referral status
 */
export function updateReferralStatus(
  referralId: string,
  status: ReferralStatus,
  notes?: string
): Referral | null {
  const referrals = getAllReferrals()
  const index = referrals.findIndex(r => r.id === referralId)

  if (index === -1) return null

  const now = new Date().toISOString()
  const updates: Partial<Referral> = { status }

  // Update timestamps based on status
  if (status === "contacted" && !referrals[index].contactedAt) {
    updates.contactedAt = now
  }
  if (status === "converted" && !referrals[index].convertedAt) {
    updates.convertedAt = now
    updates.commissionStatus = "earned"
  }

  if (notes) {
    updates.notes = notes
  }

  referrals[index] = {
    ...referrals[index],
    ...updates
  }

  writeJsonFile(REFERRALS_FILE, referrals)
  return referrals[index]
}

/**
 * Calculate and set commission amount for a referral
 */
export function calculateCommission(
  referralId: string,
  serviceAmount: number
): Referral | null {
  const referrals = getAllReferrals()
  const index = referrals.findIndex(r => r.id === referralId)

  if (index === -1) return null

  const referral = referrals[index]
  const commissionAmount = (serviceAmount * referral.commissionRate) / 100

  referrals[index] = {
    ...referral,
    commissionAmount,
    commissionStatus: referral.status === "converted" ? "earned" : "pending"
  }

  writeJsonFile(REFERRALS_FILE, referrals)
  return referrals[index]
}

/**
 * Mark commission as paid
 */
export function markCommissionPaid(referralId: string): Referral | null {
  const referrals = getAllReferrals()
  const index = referrals.findIndex(r => r.id === referralId)

  if (index === -1) return null

  referrals[index] = {
    ...referrals[index],
    commissionStatus: "paid",
    paidAt: new Date().toISOString()
  }

  writeJsonFile(REFERRALS_FILE, referrals)
  return referrals[index]
}

/**
 * Get referral statistics
 */
export function getReferralStats(): ReferralStats {
  const referrals = getAllReferrals()

  const byStatus: Record<ReferralStatus, number> = {
    pending: 0,
    contacted: 0,
    consultation_scheduled: 0,
    converted: 0,
    declined: 0,
    expired: 0
  }

  let pendingCommissions = 0
  let earnedCommissions = 0
  let paidCommissions = 0
  let totalCommissionValue = 0

  for (const referral of referrals) {
    byStatus[referral.status]++

    if (referral.commissionAmount) {
      totalCommissionValue += referral.commissionAmount
      switch (referral.commissionStatus) {
        case "pending":
          pendingCommissions += referral.commissionAmount
          break
        case "earned":
          earnedCommissions += referral.commissionAmount
          break
        case "paid":
          paidCommissions += referral.commissionAmount
          break
      }
    }
  }

  return {
    total: referrals.length,
    byStatus,
    pendingCommissions,
    earnedCommissions,
    paidCommissions,
    totalCommissionValue
  }
}

/**
 * Get pending referrals that need follow-up
 * Returns referrals that have been pending for more than the specified days
 */
export function getPendingReferrals(olderThanDays?: number): Referral[] {
  const referrals = getAllReferrals()
  const pendingStatuses: ReferralStatus[] = ["pending", "contacted", "consultation_scheduled"]

  let pending = referrals.filter(r => pendingStatuses.includes(r.status))

  if (olderThanDays !== undefined) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - olderThanDays)

    pending = pending.filter(r => new Date(r.referredAt) < cutoff)
  }

  return pending.sort((a, b) =>
    new Date(a.referredAt).getTime() - new Date(b.referredAt).getTime()
  )
}

/**
 * Initialize default attorneys if none exist
 */
export function seedDefaultAttorneys(): void {
  const existing = getAllAttorneys()
  if (existing.length > 0) return

  const defaultAttorneys: Omit<Attorney, "id">[] = [
    {
      name: "Sarah Chen",
      firm: "Chen & Associates IP Law",
      specialty: ["software", "ai", "machine-learning"],
      location: "San Francisco, CA",
      rating: 4.9,
      commissionRate: 10,
      email: "sarah@chenip.com",
      website: "https://chenip.com",
      bio: "Specializing in software and AI patents with 15+ years of experience at major tech companies.",
      active: true
    },
    {
      name: "Michael Roberts",
      firm: "Roberts Patent Group",
      specialty: ["biotechnology", "pharmaceuticals", "medical-devices"],
      location: "Boston, MA",
      rating: 4.8,
      commissionRate: 12,
      email: "michael@robertspatent.com",
      website: "https://robertspatent.com",
      bio: "Former biotech researcher turned patent attorney. Expert in life sciences IP.",
      active: true
    },
    {
      name: "Jennifer Walsh",
      firm: "Walsh & Partners",
      specialty: ["mechanical", "manufacturing", "automotive"],
      location: "Detroit, MI",
      rating: 4.7,
      commissionRate: 10,
      email: "jwalsh@walshpartners.com",
      website: "https://walshpartners.com",
      bio: "Mechanical engineering background with extensive automotive industry patent experience.",
      active: true
    },
    {
      name: "David Kim",
      firm: "Kim IP Law",
      specialty: ["electronics", "semiconductors", "telecommunications"],
      location: "Austin, TX",
      rating: 4.8,
      commissionRate: 11,
      email: "david@kimiplaw.com",
      website: "https://kimiplaw.com",
      bio: "Electrical engineer and patent attorney specializing in semiconductor and telecom patents.",
      active: true
    },
    {
      name: "Amanda Foster",
      firm: "Foster & Green IP",
      specialty: ["software", "fintech", "blockchain"],
      location: "New York, NY",
      rating: 4.6,
      commissionRate: 10,
      email: "amanda@fostergreen.com",
      website: "https://fostergreen.com",
      bio: "Focused on fintech and blockchain technology patents. Former startup founder.",
      active: true
    }
  ]

  for (const attorney of defaultAttorneys) {
    createAttorney(attorney)
  }

  console.log(`[Referrals] Seeded ${defaultAttorneys.length} default attorneys`)
}
