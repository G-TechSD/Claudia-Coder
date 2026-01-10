/**
 * Users Data Layer
 * Manages user administration - roles, NDA status, enable/disable
 */

import { db } from "@/lib/auth/db"
import { type Role, ROLES, isAdminEmail } from "@/lib/auth/roles"

export interface AdminUser {
  id: string
  name: string
  email: string
  role: Role
  image: string | null
  emailVerified: number
  ndaSigned: number
  ndaSignedAt: string | null
  disabled: number
  accessRevoked: number
  revokedAt: string | null
  revokedReason: string | null
  createdAt: string
  updatedAt: string
}

// Re-export Role type for convenience
export type UserRole = Role

/**
 * Get all users for admin management
 */
export function getAllUsers(): AdminUser[] {
  const users = db.prepare(`
    SELECT
      id, name, email, role, image, emailVerified,
      COALESCE(ndaSigned, 0) as ndaSigned,
      ndaSignedAt,
      COALESCE(disabled, 0) as disabled,
      COALESCE(accessRevoked, 0) as accessRevoked,
      revokedAt,
      revokedReason,
      createdAt, updatedAt
    FROM user
    ORDER BY createdAt DESC
  `).all() as AdminUser[]

  return users
}

/**
 * Get a single user by ID
 */
export function getUserById(id: string): AdminUser | null {
  const user = db.prepare(`
    SELECT
      id, name, email, role, image, emailVerified,
      COALESCE(ndaSigned, 0) as ndaSigned,
      ndaSignedAt,
      COALESCE(disabled, 0) as disabled,
      COALESCE(accessRevoked, 0) as accessRevoked,
      revokedAt,
      revokedReason,
      createdAt, updatedAt
    FROM user
    WHERE id = ?
  `).get(id) as AdminUser | undefined

  return user || null
}

/**
 * Update user role
 * Note: bill@gtechsd.com cannot have their role changed from admin
 */
export function updateUserRole(id: string, role: UserRole): boolean {
  const validRoles: Role[] = [ROLES.ADMIN, ROLES.BETA_TESTER, ROLES.USER]
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role: ${role}`)
  }

  // Check if this is the admin user - they cannot have their role changed
  const user = db.prepare("SELECT email FROM user WHERE id = ?").get(id) as { email: string } | undefined
  if (user && isAdminEmail(user.email) && role !== ROLES.ADMIN) {
    throw new Error("Cannot change the role of the primary admin account")
  }

  const now = new Date().toISOString()

  const result = db.prepare(`
    UPDATE user
    SET role = ?, updatedAt = ?
    WHERE id = ?
  `).run(role, now, id)

  return result.changes > 0
}

/**
 * Enable or disable a user
 */
export function setUserDisabled(id: string, disabled: boolean): boolean {
  const now = new Date().toISOString()

  const result = db.prepare(`
    UPDATE user
    SET disabled = ?, updatedAt = ?
    WHERE id = ?
  `).run(disabled ? 1 : 0, now, id)

  return result.changes > 0
}

/**
 * Update user NDA status
 */
export function setUserNdaSigned(id: string, signed: boolean): boolean {
  const now = new Date().toISOString()

  const result = db.prepare(`
    UPDATE user
    SET ndaSigned = ?, ndaSignedAt = ?, updatedAt = ?
    WHERE id = ?
  `).run(signed ? 1 : 0, signed ? now : null, now, id)

  return result.changes > 0
}

/**
 * Immediately revoke a user's access
 * This is a critical security function for beta testers who violate NDA
 */
export function revokeUserAccess(id: string, reason: string): boolean {
  const now = new Date().toISOString()

  const result = db.prepare(`
    UPDATE user
    SET accessRevoked = 1, revokedAt = ?, revokedReason = ?, disabled = 1, updatedAt = ?
    WHERE id = ?
  `).run(now, reason, now, id)

  // Also invalidate all sessions for this user
  db.prepare(`DELETE FROM session WHERE userId = ?`).run(id)

  return result.changes > 0
}

/**
 * Restore a user's access (un-revoke)
 */
export function restoreUserAccess(id: string): boolean {
  const now = new Date().toISOString()

  const result = db.prepare(`
    UPDATE user
    SET accessRevoked = 0, revokedAt = NULL, revokedReason = NULL, disabled = 0, updatedAt = ?
    WHERE id = ?
  `).run(now, id)

  return result.changes > 0
}

/**
 * Check if a user's access is revoked
 */
export function isUserAccessRevoked(userId: string): { revoked: boolean; reason: string | null; revokedAt: string | null } {
  const user = db.prepare(`
    SELECT COALESCE(accessRevoked, 0) as accessRevoked, revokedReason, revokedAt
    FROM user WHERE id = ?
  `).get(userId) as { accessRevoked: number; revokedReason: string | null; revokedAt: string | null } | undefined

  if (!user) {
    return { revoked: false, reason: null, revokedAt: null }
  }

  return {
    revoked: !!user.accessRevoked,
    reason: user.revokedReason,
    revokedAt: user.revokedAt,
  }
}

/**
 * Get user statistics
 */
export function getUserStats(): {
  total: number
  admins: number
  betaTesters: number
  users: number
  ndaSigned: number
  disabled: number
  accessRevoked: number
} {
  const users = getAllUsers()

  const stats = {
    total: users.length,
    admins: 0,
    betaTesters: 0,
    users: 0,
    ndaSigned: 0,
    disabled: 0,
    accessRevoked: 0,
  }

  for (const user of users) {
    if (user.role === "admin") stats.admins++
    else if (user.role === "beta_tester") stats.betaTesters++
    else stats.users++

    if (user.ndaSigned) stats.ndaSigned++
    if (user.disabled) stats.disabled++
    if (user.accessRevoked) stats.accessRevoked++
  }

  return stats
}
