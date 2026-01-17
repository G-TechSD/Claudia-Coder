/**
 * Role Definitions and Permission System
 * Centralized role management for Claudia Admin
 */

import { db } from "./db"

// ============================================================================
// Role Definitions
// ============================================================================

export type Role = "admin" | "beta_tester" | "user"

export const ROLES = {
  ADMIN: "admin" as Role,
  BETA_TESTER: "beta_tester" as Role,
  USER: "user" as Role,
} as const

// Admin email that always gets admin role
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@localhost"

// Role hierarchy (higher number = more permissions)
export const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 100,
  beta_tester: 50,
  user: 10,
}

// ============================================================================
// Permission Definitions
// ============================================================================

export type Permission =
  | "invite_users"
  | "view_all_sessions"
  | "access_admin_panel"
  | "manage_users"
  | "revoke_access"
  | "view_security_logs"
  | "manage_invites"
  | "use_claude_code"
  | "access_full_features"
  | "manage_settings"
  | "view_referrals"
  | "manage_lockdown"

// Permissions granted to each role
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "invite_users",
    "view_all_sessions",
    "access_admin_panel",
    "manage_users",
    "revoke_access",
    "view_security_logs",
    "manage_invites",
    "use_claude_code",
    "access_full_features",
    "manage_settings",
    "view_referrals",
    "manage_lockdown",
  ],
  beta_tester: [
    "access_full_features",
    // Beta testers have limited features - cannot access admin, claude code, etc.
  ],
  user: [
    // Regular users have minimal permissions
  ],
}

// ============================================================================
// Permission Check Functions
// ============================================================================

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || []
  return permissions.includes(permission)
}

/**
 * Check if a user can invite other users
 */
export function canInviteUsers(role: Role): boolean {
  return roleHasPermission(role, "invite_users")
}

/**
 * Check if a user can view all sessions
 */
export function canViewAllSessions(role: Role): boolean {
  return roleHasPermission(role, "view_all_sessions")
}

/**
 * Check if a user can access the admin panel
 */
export function canAccessAdminPanel(role: Role): boolean {
  return roleHasPermission(role, "access_admin_panel")
}

/**
 * Check if a user can manage other users (edit roles, disable, etc.)
 */
export function canManageUsers(role: Role): boolean {
  return roleHasPermission(role, "manage_users")
}

/**
 * Check if a user can revoke access from other users
 */
export function canRevokeAccess(role: Role): boolean {
  return roleHasPermission(role, "revoke_access")
}

/**
 * Check if a user can view security logs
 */
export function canViewSecurityLogs(role: Role): boolean {
  return roleHasPermission(role, "view_security_logs")
}

/**
 * Check if a user can manage invite codes
 */
export function canManageInvites(role: Role): boolean {
  return roleHasPermission(role, "manage_invites")
}

/**
 * Check if a user can use Claude Code interface
 */
export function canUseClaudeCode(role: Role): boolean {
  return roleHasPermission(role, "use_claude_code")
}

/**
 * Check if a user can access full features (not restricted by beta limitations)
 */
export function canAccessFullFeatures(role: Role): boolean {
  return roleHasPermission(role, "access_full_features")
}

/**
 * Check if a user can manage settings
 */
export function canManageSettings(role: Role): boolean {
  return roleHasPermission(role, "manage_settings")
}

/**
 * Check if a user can view referrals
 */
export function canViewReferrals(role: Role): boolean {
  return roleHasPermission(role, "view_referrals")
}

/**
 * Check if a user can manage system lockdown
 */
export function canManageLockdown(role: Role): boolean {
  return roleHasPermission(role, "manage_lockdown")
}

// ============================================================================
// User Role Helper Functions
// ============================================================================

/**
 * Check if a user ID belongs to an admin
 */
export function isAdmin(userId: string): boolean {
  const result = db
    .prepare("SELECT role FROM user WHERE id = ?")
    .get(userId) as { role: string } | undefined
  return result?.role === ROLES.ADMIN
}

/**
 * Check if an email belongs to the admin account
 */
export function isAdminEmail(email: string): boolean {
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
}

/**
 * Get a user's role by ID
 */
export function getUserRole(userId: string): Role | null {
  const result = db
    .prepare("SELECT role FROM user WHERE id = ?")
    .get(userId) as { role: string } | undefined

  if (!result?.role) return null

  // Validate the role is a known role
  if (result.role === "admin" || result.role === "beta_tester" || result.role === "user") {
    return result.role as Role
  }

  // Default to user for unknown roles
  return "user"
}

/**
 * Get a user's role by email
 */
export function getUserRoleByEmail(email: string): Role | null {
  const result = db
    .prepare("SELECT role FROM user WHERE email = ?")
    .get(email.toLowerCase()) as { role: string } | undefined

  if (!result?.role) return null

  if (result.role === "admin" || result.role === "beta_tester" || result.role === "user") {
    return result.role as Role
  }

  return "user"
}

/**
 * Set a user's role by ID
 */
export function setUserRole(userId: string, role: Role): boolean {
  const validRoles: Role[] = ["admin", "beta_tester", "user"]
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role: ${role}`)
  }

  const now = new Date().toISOString()
  const result = db
    .prepare("UPDATE user SET role = ?, updatedAt = ? WHERE id = ?")
    .run(role, now, userId)

  return result.changes > 0
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}

/**
 * Check if one role outranks another
 */
export function roleOutranks(role1: Role, role2: Role): boolean {
  return ROLE_HIERARCHY[role1] > ROLE_HIERARCHY[role2]
}

/**
 * Check if a user has at least the specified role level
 */
export function hasRoleLevel(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

// ============================================================================
// Role Assignment Logic
// ============================================================================

/**
 * Determine the appropriate role for a new user
 * - bill@gtechsd.com always gets admin
 * - Users invited via code get beta_tester
 * - Other users get "user" role
 */
export function determineNewUserRole(
  email: string,
  wasInvited: boolean
): Role {
  // Admin email always gets admin role
  if (isAdminEmail(email)) {
    return ROLES.ADMIN
  }

  // Invited users get beta_tester role
  if (wasInvited) {
    return ROLES.BETA_TESTER
  }

  // Default to regular user
  return ROLES.USER
}

/**
 * Ensure the admin account exists and has the correct role
 * This should be called on database initialization
 */
export function ensureAdminRole(): void {
  // Check if admin user exists
  const adminUser = db
    .prepare("SELECT id, role FROM user WHERE email = ?")
    .get(ADMIN_EMAIL.toLowerCase()) as { id: string; role: string } | undefined

  if (adminUser && adminUser.role !== ROLES.ADMIN) {
    // Update role to admin if user exists but doesn't have admin role
    const now = new Date().toISOString()
    db.prepare("UPDATE user SET role = ?, updatedAt = ? WHERE email = ?")
      .run(ROLES.ADMIN, now, ADMIN_EMAIL.toLowerCase())
    console.log(`[Roles] Updated ${ADMIN_EMAIL} to admin role`)
  } else if (adminUser) {
    console.log(`[Roles] Admin account ${ADMIN_EMAIL} verified`)
  } else {
    console.log(`[Roles] Admin account ${ADMIN_EMAIL} not yet created`)
  }
}

// ============================================================================
// Initialize on import
// ============================================================================

// Ensure admin role is set on module load
try {
  ensureAdminRole()
} catch (error) {
  // Database may not be ready yet during initial setup
  console.log("[Roles] Deferred admin role check (database not ready)")
}
