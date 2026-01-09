/**
 * Users Data Layer
 * Manages user administration - roles, NDA status, enable/disable
 */

import { db } from "@/lib/auth/db"

export interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  image: string | null
  emailVerified: number
  ndaSigned: number
  ndaSignedAt: string | null
  disabled: number
  createdAt: string
  updatedAt: string
}

export type UserRole = "admin" | "beta_tester" | "user"

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
      createdAt, updatedAt
    FROM user
    WHERE id = ?
  `).get(id) as AdminUser | undefined

  return user || null
}

/**
 * Update user role
 */
export function updateUserRole(id: string, role: UserRole): boolean {
  const validRoles = ["admin", "beta_tester", "user"]
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role: ${role}`)
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
 * Get user statistics
 */
export function getUserStats(): {
  total: number
  admins: number
  betaTesters: number
  users: number
  ndaSigned: number
  disabled: number
} {
  const users = getAllUsers()

  const stats = {
    total: users.length,
    admins: 0,
    betaTesters: 0,
    users: 0,
    ndaSigned: 0,
    disabled: 0,
  }

  for (const user of users) {
    if (user.role === "admin") stats.admins++
    else if (user.role === "beta_tester") stats.betaTesters++
    else stats.users++

    if (user.ndaSigned) stats.ndaSigned++
    if (user.disabled) stats.disabled++
  }

  return stats
}
