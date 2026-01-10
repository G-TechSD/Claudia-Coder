/**
 * NDA Signature Database Configuration
 * Manages NDA signatures and beta tester invite codes
 */

import { db } from "./db"
import { determineNewUserRole, ROLES, type Role } from "./roles"

/**
 * Initialize NDA-related database tables
 */
export function initializeNdaDatabase() {
  // NDA Signatures table
  db.exec(`
    CREATE TABLE IF NOT EXISTS nda_signature (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      fullName TEXT NOT NULL,
      email TEXT NOT NULL,
      signature TEXT NOT NULL,
      signatureType TEXT NOT NULL DEFAULT 'typed',
      ipAddress TEXT,
      userAgent TEXT,
      ndaVersion TEXT NOT NULL DEFAULT '1.0',
      agreedToTerms INTEGER NOT NULL DEFAULT 0,
      signedAt TEXT NOT NULL DEFAULT (datetime('now')),
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(userId, ndaVersion)
    )
  `)

  // Beta Tester Invites table
  db.exec(`
    CREATE TABLE IF NOT EXISTS beta_invite (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      email TEXT,
      invitedBy TEXT REFERENCES user(id) ON DELETE CASCADE,
      createdBy TEXT REFERENCES user(id) ON DELETE CASCADE,
      usedBy TEXT REFERENCES user(id) ON DELETE SET NULL,
      maxUses INTEGER NOT NULL DEFAULT 1,
      usedCount INTEGER NOT NULL DEFAULT 0,
      uses INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      expiresAt TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      usedAt TEXT
    )
  `)

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nda_signature_userId ON nda_signature(userId);
    CREATE INDEX IF NOT EXISTS idx_beta_invite_code ON beta_invite(code);
    CREATE INDEX IF NOT EXISTS idx_beta_invite_invitedBy ON beta_invite(invitedBy);
    CREATE INDEX IF NOT EXISTS idx_beta_invite_usedBy ON beta_invite(usedBy);
    CREATE INDEX IF NOT EXISTS idx_beta_invite_status ON beta_invite(status);
    CREATE INDEX IF NOT EXISTS idx_beta_invite_createdBy ON beta_invite(createdBy);
  `)

  console.log("[NDA] Database tables initialized")
}

// Initialize on import
initializeNdaDatabase()

/**
 * NDA Signature type
 */
export interface NdaSignature {
  id: string
  userId: string
  fullName: string
  email: string
  signature: string
  signatureType: "typed" | "drawn"
  ipAddress: string | null
  userAgent: string | null
  ndaVersion: string
  agreedToTerms: boolean
  signedAt: string
  createdAt: string
}

/**
 * Beta Invite type
 */
export interface BetaInvite {
  id: string
  code: string
  invitedBy: string
  invitedEmail: string | null
  usedBy: string | null
  maxUses: number
  uses: number
  expiresAt: string | null
  createdAt: string
  usedAt: string | null
}

/**
 * Check if a user has signed the NDA
 */
export function hasSignedNda(userId: string, ndaVersion = "1.0"): boolean {
  const result = db
    .prepare(
      "SELECT id FROM nda_signature WHERE userId = ? AND ndaVersion = ?"
    )
    .get(userId, ndaVersion) as { id: string } | undefined

  return !!result
}

/**
 * Get NDA signature for a user
 */
export function getNdaSignature(
  userId: string,
  ndaVersion = "1.0"
): NdaSignature | null {
  const result = db
    .prepare(
      "SELECT * FROM nda_signature WHERE userId = ? AND ndaVersion = ?"
    )
    .get(userId, ndaVersion) as NdaSignature | undefined

  if (!result) return null

  return {
    ...result,
    agreedToTerms: Boolean(result.agreedToTerms),
  }
}

/**
 * Create an NDA signature
 */
export function createNdaSignature(data: {
  userId: string
  fullName: string
  email: string
  signature: string
  signatureType: "typed" | "drawn"
  ipAddress?: string
  userAgent?: string
  ndaVersion?: string
}): NdaSignature {
  const id = crypto.randomUUID()
  const ndaVersion = data.ndaVersion || "1.0"

  db.prepare(
    `INSERT INTO nda_signature (id, userId, fullName, email, signature, signatureType, ipAddress, userAgent, ndaVersion, agreedToTerms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  ).run(
    id,
    data.userId,
    data.fullName,
    data.email,
    data.signature,
    data.signatureType,
    data.ipAddress || null,
    data.userAgent || null,
    ndaVersion
  )

  return getNdaSignature(data.userId, ndaVersion)!
}

/**
 * Get a beta invite by code
 */
export function getBetaInviteByCode(code: string): BetaInvite | null {
  const result = db
    .prepare("SELECT * FROM beta_invite WHERE code = ?")
    .get(code) as BetaInvite | undefined

  return result || null
}

/**
 * Check if an invite code is valid
 */
export function isInviteCodeValid(code: string): {
  valid: boolean
  reason?: string
  invite?: BetaInvite
} {
  const invite = getBetaInviteByCode(code)

  if (!invite) {
    return { valid: false, reason: "Invalid invite code" }
  }

  if (invite.uses >= invite.maxUses) {
    return { valid: false, reason: "Invite code has been fully used" }
  }

  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    return { valid: false, reason: "Invite code has expired" }
  }

  return { valid: true, invite }
}

/**
 * Use an invite code for a user
 * Also updates the user's role to beta_tester (unless they're the admin)
 */
export function useInviteCode(code: string, userId: string): boolean {
  const { valid, invite } = isInviteCodeValid(code)

  if (!valid || !invite) {
    return false
  }

  // Update invite usage
  db.prepare(
    `UPDATE beta_invite SET uses = uses + 1, usedBy = ?, usedAt = datetime('now') WHERE code = ?`
  ).run(userId, code)

  // Get user's email to determine appropriate role
  const user = db
    .prepare("SELECT email FROM user WHERE id = ?")
    .get(userId) as { email: string } | undefined

  if (user) {
    // Determine and set the appropriate role
    const newRole = determineNewUserRole(user.email, true)
    const now = new Date().toISOString()
    db.prepare("UPDATE user SET role = ?, updatedAt = ? WHERE id = ?")
      .run(newRole, now, userId)
  }

  return true
}

/**
 * Create a new invite code
 */
export function createInviteCode(data: {
  invitedBy: string
  invitedEmail?: string
  maxUses?: number
  expiresInDays?: number
}): BetaInvite {
  const id = crypto.randomUUID()
  const code = generateInviteCode()
  const expiresAt = data.expiresInDays
    ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  db.prepare(
    `INSERT INTO beta_invite (id, code, invitedBy, invitedEmail, maxUses, expiresAt)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    code,
    data.invitedBy,
    data.invitedEmail || null,
    data.maxUses || 1,
    expiresAt
  )

  return getBetaInviteByCode(code)!
}

/**
 * Generate a unique invite code
 */
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Get inviter details
 */
export function getInviterDetails(code: string): {
  name: string
  email: string
} | null {
  const result = db
    .prepare(
      `SELECT u.name, u.email FROM beta_invite bi
       JOIN user u ON bi.invitedBy = u.id
       WHERE bi.code = ?`
    )
    .get(code) as { name: string; email: string } | undefined

  return result || null
}

/**
 * Get all invites created by a user
 */
export function getInvitesByUser(userId: string): BetaInvite[] {
  return db
    .prepare("SELECT * FROM beta_invite WHERE invitedBy = ? ORDER BY createdAt DESC")
    .all(userId) as BetaInvite[]
}

/**
 * Check if user is a beta tester (invited via code)
 */
export function isBetaTester(userId: string): boolean {
  const result = db
    .prepare("SELECT id FROM beta_invite WHERE usedBy = ?")
    .get(userId) as { id: string } | undefined

  return !!result
}

/**
 * Get user role from the user table
 */
export function getUserRole(userId: string): string | null {
  const result = db
    .prepare("SELECT role FROM user WHERE id = ?")
    .get(userId) as { role: string } | undefined

  return result?.role || null
}
