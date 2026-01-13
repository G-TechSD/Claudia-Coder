/**
 * Beta Invites Data Layer
 * Manages beta invite codes, usage tracking, and invite links
 */

import { db } from "@/lib/auth/db"

export interface BetaInvite {
  id: string
  code: string
  email: string | null // Optional: restrict to specific email
  maxUses: number
  usedCount: number
  expiresAt: string | null
  status: "pending" | "used" | "expired" | "revoked"
  createdBy: string
  createdByName: string | null
  customMessage: string | null
  emailSent: boolean
  emailSentAt: string | null
  createdAt: string
  updatedAt: string
}

export interface InviteUsage {
  id: string
  inviteId: string
  userId: string
  usedAt: string
}

export interface InviteWithUsages extends BetaInvite {
  usages: Array<{
    userId: string
    userName: string
    userEmail: string
    usedAt: string
  }>
  inviterName: string | null
}

/**
 * Initialize the invites database schema
 */
export function initializeInvitesDatabase() {
  // Drop old beta_invites table if it exists (migration from old schema)
  try {
    db.exec(`DROP TABLE IF EXISTS beta_invites`)
  } catch {
    // Table doesn't exist
  }

  // Beta invites table
  db.exec(`
    CREATE TABLE IF NOT EXISTS beta_invite (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      email TEXT,
      maxUses INTEGER NOT NULL DEFAULT 1,
      usedCount INTEGER NOT NULL DEFAULT 0,
      expiresAt TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      createdBy TEXT NOT NULL REFERENCES user(id),
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Invite usage tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invite_usage (
      id TEXT PRIMARY KEY,
      inviteId TEXT NOT NULL REFERENCES beta_invite(id),
      userId TEXT NOT NULL REFERENCES user(id),
      usedAt TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(inviteId, userId)
    )
  `)

  // Add custom message and email tracking columns
  try {
    db.exec(`ALTER TABLE beta_invite ADD COLUMN customMessage TEXT`)
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE beta_invite ADD COLUMN createdByName TEXT`)
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE beta_invite ADD COLUMN emailSent INTEGER DEFAULT 0`)
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE beta_invite ADD COLUMN emailSentAt TEXT`)
  } catch {
    // Column already exists
  }

  // Add NDA status to user table if not exists
  try {
    db.exec(`ALTER TABLE user ADD COLUMN ndaSigned INTEGER DEFAULT 0`)
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE user ADD COLUMN ndaSignedAt TEXT`)
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE user ADD COLUMN disabled INTEGER DEFAULT 0`)
  } catch {
    // Column already exists
  }

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_beta_invite_code ON beta_invite(code);
    CREATE INDEX IF NOT EXISTS idx_beta_invite_status ON beta_invite(status);
    CREATE INDEX IF NOT EXISTS idx_invite_usage_inviteId ON invite_usage(inviteId);
    CREATE INDEX IF NOT EXISTS idx_invite_usage_userId ON invite_usage(userId);
  `)

  console.log("[Invites] Database initialized")
}

/**
 * Generate a unique invite code
 */
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Exclude confusing chars
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create a new beta invite
 */
export function createInvite(params: {
  email?: string
  maxUses?: number
  expiresAt?: string
  createdBy: string
  createdByName?: string
  customMessage?: string
}): BetaInvite {
  const id = generateId()
  const code = generateInviteCode()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO beta_invite (id, code, email, maxUses, expiresAt, createdBy, createdByName, customMessage, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    code,
    params.email || null,
    params.maxUses || 1,
    params.expiresAt || null,
    params.createdBy,
    params.createdByName || null,
    params.customMessage || null,
    now,
    now
  )

  return {
    id,
    code,
    email: params.email || null,
    maxUses: params.maxUses || 1,
    usedCount: 0,
    expiresAt: params.expiresAt || null,
    status: "pending",
    createdBy: params.createdBy,
    createdByName: params.createdByName || null,
    customMessage: params.customMessage || null,
    emailSent: false,
    emailSentAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Mark an invite as having email sent
 */
export function markEmailSent(inviteId: string): boolean {
  const now = new Date().toISOString()
  const result = db.prepare(`
    UPDATE beta_invite
    SET emailSent = 1, emailSentAt = ?, updatedAt = ?
    WHERE id = ?
  `).run(now, now, inviteId)

  return result.changes > 0
}

/**
 * Get all invites with their usage information
 */
export function getAllInvites(): InviteWithUsages[] {
  const invites = db.prepare(`
    SELECT bi.*, u.name as inviterName
    FROM beta_invite bi
    LEFT JOIN user u ON bi.createdBy = u.id
    ORDER BY bi.createdAt DESC
  `).all() as (BetaInvite & { inviterName: string | null })[]

  return invites.map((invite) => {
    const usages = db.prepare(`
      SELECT
        iu.userId,
        u.name as userName,
        u.email as userEmail,
        iu.usedAt
      FROM invite_usage iu
      JOIN user u ON iu.userId = u.id
      WHERE iu.inviteId = ?
      ORDER BY iu.usedAt DESC
    `).all(invite.id) as Array<{
      userId: string
      userName: string
      userEmail: string
      usedAt: string
    }>

    // Update status based on current state
    let status = invite.status
    if (status === "pending") {
      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
        status = "expired"
      } else if (invite.usedCount >= invite.maxUses) {
        status = "used"
      }
    }

    // Convert emailSent from integer to boolean
    const emailSent = Boolean(invite.emailSent)

    return {
      ...invite,
      emailSent,
      status,
      usages,
      inviterName: invite.inviterName || invite.createdByName,
    }
  })
}

/**
 * Get a single invite by ID
 */
export function getInviteById(id: string): BetaInvite | null {
  const invite = db.prepare(`
    SELECT * FROM beta_invite WHERE id = ?
  `).get(id) as BetaInvite | undefined

  return invite || null
}

/**
 * Get a single invite by code
 */
export function getInviteByCode(code: string): BetaInvite | null {
  const invite = db.prepare(`
    SELECT * FROM beta_invite WHERE code = ?
  `).get(code.toUpperCase()) as BetaInvite | undefined

  return invite || null
}

/**
 * Validate and use an invite code
 * Returns the invite if valid, null if invalid or already used
 */
export function validateAndUseInvite(
  code: string,
  userId: string,
  userEmail: string
): { valid: boolean; error?: string; invite?: BetaInvite } {
  const invite = getInviteByCode(code)

  if (!invite) {
    return { valid: false, error: "Invalid invite code" }
  }

  if (invite.status === "revoked") {
    return { valid: false, error: "This invite has been revoked" }
  }

  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    return { valid: false, error: "This invite has expired" }
  }

  if (invite.usedCount >= invite.maxUses) {
    return { valid: false, error: "This invite has reached its maximum uses" }
  }

  if (invite.email && invite.email.toLowerCase() !== userEmail.toLowerCase()) {
    return { valid: false, error: "This invite is for a different email address" }
  }

  // Check if user already used this invite
  const existingUsage = db.prepare(`
    SELECT * FROM invite_usage WHERE inviteId = ? AND userId = ?
  `).get(invite.id, userId)

  if (existingUsage) {
    return { valid: false, error: "You have already used this invite" }
  }

  // Record the usage
  const usageId = generateId()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO invite_usage (id, inviteId, userId, usedAt)
    VALUES (?, ?, ?, ?)
  `).run(usageId, invite.id, userId, now)

  // Update the invite
  const newUsedCount = invite.usedCount + 1
  const newStatus = newUsedCount >= invite.maxUses ? "used" : "pending"

  db.prepare(`
    UPDATE beta_invite
    SET usedCount = ?, status = ?, updatedAt = ?
    WHERE id = ?
  `).run(newUsedCount, newStatus, now, invite.id)

  return {
    valid: true,
    invite: {
      ...invite,
      usedCount: newUsedCount,
      status: newStatus,
      updatedAt: now,
    },
  }
}

/**
 * Revoke an invite
 */
export function revokeInvite(id: string): boolean {
  const now = new Date().toISOString()

  const result = db.prepare(`
    UPDATE beta_invite
    SET status = 'revoked', updatedAt = ?
    WHERE id = ?
  `).run(now, id)

  return result.changes > 0
}

/**
 * Get invite statistics
 */
export function getInviteStats(): {
  total: number
  pending: number
  used: number
  expired: number
  revoked: number
  totalCapacity: number
  usedCapacity: number
  remainingCapacity: number
} {
  const invites = getAllInvites()

  const stats = {
    total: invites.length,
    pending: 0,
    used: 0,
    expired: 0,
    revoked: 0,
    totalCapacity: 0,
    usedCapacity: 0,
    remainingCapacity: 0,
  }

  for (const invite of invites) {
    stats[invite.status]++
    stats.totalCapacity += invite.maxUses
    stats.usedCapacity += invite.usedCount
  }

  stats.remainingCapacity = stats.totalCapacity - stats.usedCapacity

  return stats
}

// Initialize on import
initializeInvitesDatabase()
