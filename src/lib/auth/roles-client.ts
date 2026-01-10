/**
 * Client-side Role Utilities
 * Provides role and permission checking for React components
 *
 * Note: For security-critical operations, always verify on the server side.
 * These client-side checks are for UI/UX purposes only.
 */

// ============================================================================
// Role Definitions (mirrored from server-side roles.ts)
// ============================================================================

export type Role = "admin" | "beta_tester" | "user"

export const ROLES = {
  ADMIN: "admin" as Role,
  BETA_TESTER: "beta_tester" as Role,
  USER: "user" as Role,
} as const

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
  ],
  user: [],
}

// ============================================================================
// Permission Check Functions
// ============================================================================

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: Role | string | undefined, permission: Permission): boolean {
  if (!role) return false
  const validRole = role as Role
  const permissions = ROLE_PERMISSIONS[validRole] || []
  return permissions.includes(permission)
}

/**
 * Check if a role is admin
 */
export function isAdminRole(role: Role | string | undefined): boolean {
  return role === ROLES.ADMIN
}

/**
 * Check if a role is beta tester
 */
export function isBetaTesterRole(role: Role | string | undefined): boolean {
  return role === ROLES.BETA_TESTER
}

/**
 * Check if a user can invite other users
 */
export function canInviteUsers(role: Role | string | undefined): boolean {
  return roleHasPermission(role as Role, "invite_users")
}

/**
 * Check if a user can view all sessions
 */
export function canViewAllSessions(role: Role | string | undefined): boolean {
  return roleHasPermission(role as Role, "view_all_sessions")
}

/**
 * Check if a user can access the admin panel
 */
export function canAccessAdminPanel(role: Role | string | undefined): boolean {
  return roleHasPermission(role as Role, "access_admin_panel")
}

/**
 * Check if a user can manage other users
 */
export function canManageUsers(role: Role | string | undefined): boolean {
  return roleHasPermission(role as Role, "manage_users")
}

/**
 * Check if a user can revoke access
 */
export function canRevokeAccess(role: Role | string | undefined): boolean {
  return roleHasPermission(role as Role, "revoke_access")
}

/**
 * Check if a user can view security logs
 */
export function canViewSecurityLogs(role: Role | string | undefined): boolean {
  return roleHasPermission(role as Role, "view_security_logs")
}

/**
 * Check if a user can manage invite codes
 */
export function canManageInvites(role: Role | string | undefined): boolean {
  return roleHasPermission(role as Role, "manage_invites")
}

/**
 * Check if a user can use Claude Code interface
 */
export function canUseClaudeCode(role: Role | string | undefined): boolean {
  return roleHasPermission(role as Role, "use_claude_code")
}

/**
 * Check if a user can access full features
 */
export function canAccessFullFeatures(role: Role | string | undefined): boolean {
  return roleHasPermission(role as Role, "access_full_features")
}

/**
 * Check if a user can manage settings
 */
export function canManageSettings(role: Role | string | undefined): boolean {
  return roleHasPermission(role as Role, "manage_settings")
}

/**
 * Check if one role outranks another
 */
export function roleOutranks(role1: Role | string | undefined, role2: Role | string | undefined): boolean {
  if (!role1 || !role2) return false
  return ROLE_HIERARCHY[role1 as Role] > ROLE_HIERARCHY[role2 as Role]
}

/**
 * Check if a user has at least the specified role level
 */
export function hasRoleLevel(userRole: Role | string | undefined, requiredRole: Role): boolean {
  if (!userRole) return false
  return ROLE_HIERARCHY[userRole as Role] >= ROLE_HIERARCHY[requiredRole]
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role | string | undefined): Permission[] {
  if (!role) return []
  return ROLE_PERMISSIONS[role as Role] || []
}

/**
 * Get a human-readable label for a role
 */
export function getRoleLabel(role: Role | string | undefined): string {
  switch (role) {
    case ROLES.ADMIN:
      return "Administrator"
    case ROLES.BETA_TESTER:
      return "Beta Tester"
    case ROLES.USER:
      return "User"
    default:
      return "Unknown"
  }
}

/**
 * Get a badge color class for a role (Tailwind CSS)
 */
export function getRoleBadgeColor(role: Role | string | undefined): string {
  switch (role) {
    case ROLES.ADMIN:
      return "bg-red-500/10 text-red-600 border-red-500/20"
    case ROLES.BETA_TESTER:
      return "bg-amber-500/10 text-amber-600 border-amber-500/20"
    case ROLES.USER:
      return "bg-blue-500/10 text-blue-600 border-blue-500/20"
    default:
      return "bg-gray-500/10 text-gray-600 border-gray-500/20"
  }
}
