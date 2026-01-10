/**
 * User GitLab Settings Data Layer
 * Manages per-user GitLab configuration including credentials and isolation settings
 *
 * Similar pattern to user-settings.ts for n8n isolation.
 * Supports both shared GitLab (with user namespaces/groups) and personal instances.
 */

import {
  encryptValue,
  decryptValue,
  getOrCreateUserSettings,
  saveUserSettings,
  type UserSettings,
} from "./user-settings"

// ============ Types ============

export type GitLabInstanceMode = "shared" | "personal"

export interface GitLabPersonalInstance {
  baseUrl: string
  personalAccessToken: string  // Encrypted when stored
}

export interface GitLabSharedNamespace {
  groupId?: number           // GitLab group ID for the user
  groupPath: string          // e.g., "claudia-users/user-abc123"
  prefix: string             // Project name prefix, e.g., "user-abc123"
}

export interface UserGitLabConfig {
  mode: GitLabInstanceMode

  // For personal GitLab instance
  personalInstance?: GitLabPersonalInstance

  // For shared instance - namespace/group for isolation
  sharedNamespace?: GitLabSharedNamespace

  // Preferences
  defaultVisibility: "private" | "internal" | "public"
  autoCreateProjects: boolean
  defaultBranch: string

  // Connection status
  lastConnectionTest?: string   // ISO timestamp
  connectionHealthy?: boolean
}

export interface GitLabUser {
  id: number
  username: string
  name: string
  email: string
  avatar_url?: string
  web_url?: string
}

// ============ Storage Keys ============

// Note: GitLab config is stored within UserSettings under the "gitlab" key
// Using user-settings.ts storage mechanism for consistency

// ============ Default Settings ============

export function createDefaultGitLabConfig(userId: string): UserGitLabConfig {
  return {
    mode: "shared",
    sharedNamespace: {
      groupPath: `claudia-users/${userId.slice(0, 8)}`,
      prefix: `user-${userId.slice(0, 8)}`,
    },
    defaultVisibility: "private",
    autoCreateProjects: true,
    defaultBranch: "main",
  }
}

// ============ CRUD Operations ============

/**
 * Get user's GitLab configuration
 */
export function getUserGitLabConfig(userId: string): UserGitLabConfig {
  const settings = getOrCreateUserSettings(userId)

  // Check if GitLab config exists in settings
  const gitlabConfig = (settings as UserSettings & { gitlab?: UserGitLabConfig }).gitlab

  if (gitlabConfig) {
    // Decrypt personal access token if present
    if (gitlabConfig.personalInstance?.personalAccessToken) {
      gitlabConfig.personalInstance.personalAccessToken = decryptValue(
        gitlabConfig.personalInstance.personalAccessToken,
        userId
      )
    }
    return gitlabConfig
  }

  // Return defaults if not configured
  return createDefaultGitLabConfig(userId)
}

/**
 * Update user's GitLab configuration
 */
export function updateUserGitLabConfig(
  userId: string,
  updates: Partial<UserGitLabConfig>
): UserGitLabConfig {
  const current = getUserGitLabConfig(userId)
  const settings = getOrCreateUserSettings(userId)

  // Merge updates
  const updated: UserGitLabConfig = {
    ...current,
    ...updates,
  }

  // Deep merge for nested objects
  if (updates.personalInstance) {
    updated.personalInstance = {
      ...current.personalInstance,
      ...updates.personalInstance,
    }
  }

  if (updates.sharedNamespace) {
    updated.sharedNamespace = {
      ...current.sharedNamespace,
      ...updates.sharedNamespace,
    }
  }

  // Encrypt personal access token before saving
  const toStore = { ...updated }
  if (toStore.personalInstance?.personalAccessToken) {
    toStore.personalInstance = {
      ...toStore.personalInstance,
      personalAccessToken: encryptValue(
        toStore.personalInstance.personalAccessToken,
        userId
      ),
    }
  }

  // Save to user settings
  const updatedSettings = {
    ...settings,
    gitlab: toStore,
  } as UserSettings & { gitlab: UserGitLabConfig }

  saveUserSettings(updatedSettings)

  return updated
}

/**
 * Clear user's GitLab configuration
 */
export function clearUserGitLabConfig(userId: string): void {
  const settings = getOrCreateUserSettings(userId)
  const updatedSettings = {
    ...settings,
    gitlab: undefined,
  } as UserSettings
  saveUserSettings(updatedSettings)
}

// ============ Helper Functions ============

/**
 * Check if user has personal GitLab instance configured
 */
export function hasPersonalGitLabInstance(userId: string): boolean {
  const config = getUserGitLabConfig(userId)
  return (
    config.mode === "personal" &&
    !!config.personalInstance?.baseUrl &&
    !!config.personalInstance?.personalAccessToken
  )
}

/**
 * Get the GitLab URL for a user (shared or personal)
 */
export function getUserGitLabUrl(userId: string): string {
  const config = getUserGitLabConfig(userId)

  if (config.mode === "personal" && config.personalInstance?.baseUrl) {
    return config.personalInstance.baseUrl
  }

  return process.env.NEXT_PUBLIC_GITLAB_URL || "https://bill-dev-linux-1"
}

/**
 * Get the GitLab token for a user (shared or personal)
 */
export function getUserGitLabToken(userId: string): string | null {
  const config = getUserGitLabConfig(userId)

  if (config.mode === "personal" && config.personalInstance?.personalAccessToken) {
    return config.personalInstance.personalAccessToken
  }

  // For shared mode, check if there's a user-specific token stored
  // Fall back to localStorage for backwards compatibility
  if (typeof window !== "undefined") {
    const legacyToken = localStorage.getItem("gitlab_token")
    if (legacyToken) {
      return legacyToken
    }
  }

  return null
}

/**
 * Get the project namespace/path prefix for a user
 */
export function getUserGitLabNamespace(userId: string): string {
  const config = getUserGitLabConfig(userId)

  if (config.mode === "personal") {
    // Personal instances don't need a user namespace prefix
    return ""
  }

  return config.sharedNamespace?.groupPath || `claudia-users/${userId.slice(0, 8)}`
}

/**
 * Get the project name prefix for a user
 */
export function getUserProjectPrefix(userId: string): string {
  const config = getUserGitLabConfig(userId)

  if (config.mode === "personal") {
    // Personal instances use "claudia" prefix
    return "claudia"
  }

  return config.sharedNamespace?.prefix || `user-${userId.slice(0, 8)}`
}

/**
 * Generate a project name with user prefix
 */
export function generateProjectName(userId: string, baseName: string): string {
  const prefix = getUserProjectPrefix(userId)

  // Normalize base name to lowercase with dashes
  const normalizedName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  // Check if already has prefix
  if (normalizedName.startsWith(prefix.toLowerCase())) {
    return normalizedName
  }

  return `${prefix}-${normalizedName}`
}

/**
 * Check if a project belongs to a user based on name/path
 */
export function isUserProject(userId: string, projectPath: string): boolean {
  const config = getUserGitLabConfig(userId)

  // Personal instances - all projects belong to the user
  if (config.mode === "personal") {
    return true
  }

  // Check namespace/group path
  const namespace = config.sharedNamespace?.groupPath
  if (namespace && projectPath.startsWith(namespace)) {
    return true
  }

  // Check project name prefix
  const prefix = config.sharedNamespace?.prefix
  if (prefix) {
    const projectName = projectPath.split("/").pop() || ""
    if (projectName.startsWith(prefix)) {
      return true
    }
  }

  return false
}

// ============ Validation Functions ============

/**
 * Parse and enhance error messages for GitLab connection failures
 */
function parseGitLabError(error: unknown, baseUrl: string): string {
  if (!(error instanceof Error)) {
    return "Connection failed"
  }

  const message = error.message.toLowerCase()

  // SSL/Certificate errors
  if (
    message.includes("certificate") ||
    message.includes("ssl") ||
    message.includes("cert") ||
    message.includes("self-signed") ||
    message.includes("unable to verify") ||
    message.includes("depth zero self-signed")
  ) {
    return `SSL certificate error: The GitLab server at ${baseUrl} uses a self-signed or invalid certificate. If this is a trusted internal server, you may need to add it to your trusted certificates.`
  }

  // Network/DNS errors
  if (
    message.includes("network") ||
    message.includes("enotfound") ||
    message.includes("dns") ||
    message.includes("getaddrinfo")
  ) {
    return `Network error: Cannot reach ${baseUrl}. Please check the URL and your network connection.`
  }

  // Connection refused
  if (message.includes("econnrefused") || message.includes("connection refused")) {
    return `Connection refused: GitLab server at ${baseUrl} is not responding. Check if the server is running and the port is correct.`
  }

  // Timeout
  if (message.includes("timeout") || message.includes("etimedout")) {
    return `Connection timeout: GitLab server at ${baseUrl} took too long to respond.`
  }

  // CORS errors (browser-specific)
  if (message.includes("cors") || message.includes("blocked by")) {
    return `CORS error: The GitLab server may not allow requests from this origin. This can happen with self-hosted instances.`
  }

  return error.message
}

/**
 * Validate a GitLab personal access token
 */
export async function validateGitLabToken(
  baseUrl: string,
  token: string
): Promise<{ valid: boolean; user?: GitLabUser; error?: string }> {
  // Validate inputs
  if (!baseUrl) {
    return { valid: false, error: "GitLab URL is required" }
  }

  if (!token) {
    return { valid: false, error: "Personal Access Token is required" }
  }

  // Ensure URL doesn't have trailing slash
  const cleanUrl = baseUrl.replace(/\/+$/, "")

  // Validate URL format
  try {
    new URL(cleanUrl)
  } catch {
    return { valid: false, error: "Invalid GitLab URL format" }
  }

  try {
    const response = await fetch(`${cleanUrl}/api/v4/user`, {
      headers: {
        "PRIVATE-TOKEN": token,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: "Invalid or expired token. Please generate a new Personal Access Token with 'api' scope." }
      }
      if (response.status === 403) {
        return { valid: false, error: "Access denied. Your token may lack required permissions. Ensure it has the 'api' scope." }
      }
      if (response.status === 404) {
        return { valid: false, error: `GitLab API not found at ${cleanUrl}. Please verify the URL is correct.` }
      }

      // Try to get error details from response
      try {
        const errorData = await response.json()
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`
        return { valid: false, error: `GitLab error: ${errorMessage}` }
      } catch {
        return { valid: false, error: `GitLab returned HTTP ${response.status}` }
      }
    }

    const user = await response.json() as GitLabUser
    return { valid: true, user }
  } catch (error) {
    return {
      valid: false,
      error: parseGitLabError(error, cleanUrl),
    }
  }
}

/**
 * Test connection to a GitLab instance
 */
export async function testGitLabConnection(
  baseUrl: string,
  token: string
): Promise<{
  healthy: boolean
  latency?: number
  user?: GitLabUser
  message: string
  details?: string
}> {
  const startTime = Date.now()

  try {
    const result = await validateGitLabToken(baseUrl, token)
    const latency = Date.now() - startTime

    if (result.valid && result.user) {
      return {
        healthy: true,
        latency,
        user: result.user,
        message: `Connected as ${result.user.username}`,
        details: `Latency: ${latency}ms`,
      }
    }

    return {
      healthy: false,
      latency,
      message: result.error || "Connection failed",
      details: `URL: ${baseUrl}`,
    }
  } catch (error) {
    return {
      healthy: false,
      message: parseGitLabError(error, baseUrl),
      details: `URL: ${baseUrl}`,
    }
  }
}

// ============ Event Subscription ============

/**
 * Subscribe to GitLab config changes
 */
export function subscribeToGitLabConfig(
  userId: string,
  callback: (config: UserGitLabConfig) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {}
  }

  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail.userId === userId && detail.settings?.gitlab) {
      callback(detail.settings.gitlab)
    }
  }

  window.addEventListener("user-settings-changed", handler)
  return () => window.removeEventListener("user-settings-changed", handler)
}
