/**
 * Beta Invite Management
 * Functions for creating, validating, and managing beta invitations
 */

import { db } from "../auth/db"
import { randomBytes } from "crypto"
import type { BetaInvite } from "../data/types"

// Default invite expiration: 7 days
const DEFAULT_EXPIRATION_DAYS = 7

/**
 * Generate a unique invite code
 */
function generateInviteCode(): string {
  return randomBytes(16).toString("hex")
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return randomBytes(12).toString("hex")
}

/**
 * Convert database row to BetaInvite type
 */
function rowToInvite(row: Record<string, unknown>): BetaInvite {
  return {
    id: row.id as string,
    email: row.email as string,
    inviteCode: row.invite_code as string,
    invitedBy: row.invited_by as string,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    usedAt: row.used_at as string | undefined,
    maxUses: row.max_uses as number,
    currentUses: row.current_uses as number,
  }
}

/**
 * Create a new beta invite
 * @param email - Email address to invite
 * @param invitedBy - User ID of the person sending the invite
 * @param maxUses - Maximum number of times this invite can be used (default: 1)
 * @returns The created invite
 */
export function createInvite(
  email: string,
  invitedBy: string,
  maxUses: number = 1
): BetaInvite {
  const id = generateId()
  const inviteCode = generateInviteCode()
  const expiresAt = new Date(
    Date.now() + DEFAULT_EXPIRATION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()

  const stmt = db.prepare(`
    INSERT INTO beta_invites (id, email, invite_code, invited_by, expires_at, max_uses)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  stmt.run(id, email.toLowerCase(), inviteCode, invitedBy, expiresAt, maxUses)

  const invite = db
    .prepare("SELECT * FROM beta_invites WHERE id = ?")
    .get(id) as Record<string, unknown>

  return rowToInvite(invite)
}

/**
 * Validate an invite code
 * @param code - The invite code to validate
 * @returns The invite if valid, null if invalid or expired
 */
export function validateInviteCode(code: string): BetaInvite | null {
  const stmt = db.prepare(`
    SELECT * FROM beta_invites
    WHERE invite_code = ?
    AND expires_at > datetime('now')
    AND current_uses < max_uses
  `)

  const row = stmt.get(code) as Record<string, unknown> | undefined

  if (!row) {
    return null
  }

  return rowToInvite(row)
}

/**
 * Use an invite code (increment usage count)
 * @param code - The invite code to use
 * @param userId - The user ID who is using the invite
 * @returns True if successful, false if invite is invalid or exhausted
 */
export function useInvite(code: string, userId: string): boolean {
  const invite = validateInviteCode(code)

  if (!invite) {
    return false
  }

  const stmt = db.prepare(`
    UPDATE beta_invites
    SET current_uses = current_uses + 1,
        used_at = CASE
          WHEN current_uses + 1 >= max_uses THEN datetime('now')
          ELSE used_at
        END
    WHERE invite_code = ?
    AND current_uses < max_uses
  `)

  const result = stmt.run(code)

  return result.changes > 0
}

/**
 * Get all invites created by a user
 * @param userId - The user ID to get invites for
 * @returns Array of invites
 */
export function getInvitesByUser(userId: string): BetaInvite[] {
  const stmt = db.prepare(`
    SELECT * FROM beta_invites
    WHERE invited_by = ?
    ORDER BY created_at DESC
  `)

  const rows = stmt.all(userId) as Record<string, unknown>[]

  return rows.map(rowToInvite)
}

/**
 * Revoke an invite by ID
 * @param id - The invite ID to revoke
 * @returns True if successful, false if not found
 */
export function revokeInvite(id: string): boolean {
  const stmt = db.prepare(`
    DELETE FROM beta_invites WHERE id = ?
  `)

  const result = stmt.run(id)

  return result.changes > 0
}

/**
 * Get an invite by ID
 * @param id - The invite ID
 * @returns The invite or null if not found
 */
export function getInviteById(id: string): BetaInvite | null {
  const stmt = db.prepare("SELECT * FROM beta_invites WHERE id = ?")
  const row = stmt.get(id) as Record<string, unknown> | undefined

  if (!row) {
    return null
  }

  return rowToInvite(row)
}

/**
 * Get an invite by email
 * @param email - The email address
 * @returns The most recent valid invite for this email, or null
 */
export function getInviteByEmail(email: string): BetaInvite | null {
  const stmt = db.prepare(`
    SELECT * FROM beta_invites
    WHERE email = ?
    AND expires_at > datetime('now')
    AND current_uses < max_uses
    ORDER BY created_at DESC
    LIMIT 1
  `)

  const row = stmt.get(email.toLowerCase()) as Record<string, unknown> | undefined

  if (!row) {
    return null
  }

  return rowToInvite(row)
}
