/**
 * Data Reset Utility
 *
 * Clear all Claudia data from localStorage for a fresh start
 *
 * IMPORTANT: This module now supports user-scoped data clearing.
 * It can clear data for a specific user or all legacy global data.
 */

import {
  getAllUserStorageKeys,
  getUserStorageKey,
  USER_STORAGE_KEYS
} from "./user-storage"

// All known legacy localStorage keys used by Claudia (global, non-user-scoped)
const CLAUDIA_LEGACY_STORAGE_KEYS = [
  "claudia-settings",
  "claudia_global_settings",
  "claudia_packets",
  "claudia_build_plans_raw",
  "claudia_projects",
  "claudia_interviews",
  "claudia_build_plans",
  "claudia_resources",
  "claudia_brain_dumps",
  "claudia_projects_view",
  "claudia_execution_logs",
  "claudia_research",
  "claudia_business_ideas",
  "claudia_patents",
  "claudia_business_dev",
  "claudia_packet_runs",
  "gitlab_token",  // GitLab auth token
]

// Prefix-based keys that need pattern matching
const CLAUDIA_KEY_PREFIXES = [
  "project-models-",
  "claudia_user_",  // User-scoped storage prefix
]

/**
 * Get all Claudia-related keys from localStorage
 * @param userId - If provided, only returns keys for this user
 */
export function getAllClaudiaKeys(userId?: string): string[] {
  if (typeof window === "undefined") return []

  const keys: string[] = []

  if (userId) {
    // Return only user-scoped keys
    return getAllUserStorageKeys(userId)
  }

  // Add known legacy keys that exist
  for (const key of CLAUDIA_LEGACY_STORAGE_KEYS) {
    if (localStorage.getItem(key) !== null) {
      keys.push(key)
    }
  }

  // Find prefix-based keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      for (const prefix of CLAUDIA_KEY_PREFIXES) {
        if (key.startsWith(prefix)) {
          keys.push(key)
        }
      }
    }
  }

  return keys
}

/**
 * Get summary of stored data for a user
 * @param userId - If provided, returns summary for this user only
 */
export function getDataSummary(userId?: string): {
  projects: number
  packets: number
  buildPlans: number
  interviews: number
  resources: number
  research: number
  businessIdeas: number
  patents: number
  hasSettings: boolean
  hasGitLabToken: boolean
  totalKeys: number
} {
  if (typeof window === "undefined") {
    return {
      projects: 0,
      packets: 0,
      buildPlans: 0,
      interviews: 0,
      resources: 0,
      research: 0,
      businessIdeas: 0,
      patents: 0,
      hasSettings: false,
      hasGitLabToken: false,
      totalKeys: 0
    }
  }

  const parseCount = (key: string): number => {
    try {
      const data = localStorage.getItem(key)
      if (!data) return 0
      const parsed = JSON.parse(data)
      return Array.isArray(parsed) ? parsed.length : 1
    } catch {
      return 0
    }
  }

  if (userId) {
    // Return user-scoped data summary
    return {
      projects: parseCount(getUserStorageKey(userId, USER_STORAGE_KEYS.PROJECTS)),
      packets: parseCount(getUserStorageKey(userId, USER_STORAGE_KEYS.PACKET_RUNS)),
      buildPlans: parseCount(getUserStorageKey(userId, USER_STORAGE_KEYS.BUILD_PLANS)),
      interviews: parseCount(getUserStorageKey(userId, "interviews")),
      resources: parseCount(getUserStorageKey(userId, USER_STORAGE_KEYS.RESOURCES)),
      research: parseCount(getUserStorageKey(userId, USER_STORAGE_KEYS.RESEARCH)),
      businessIdeas: parseCount(getUserStorageKey(userId, USER_STORAGE_KEYS.BUSINESS_IDEAS)),
      patents: parseCount(getUserStorageKey(userId, USER_STORAGE_KEYS.PATENTS)),
      hasSettings: localStorage.getItem(getUserStorageKey(userId, "settings")) !== null,
      hasGitLabToken: localStorage.getItem(getUserStorageKey(userId, "gitlab_token")) !== null,
      totalKeys: getAllClaudiaKeys(userId).length
    }
  }

  // Return legacy global data summary
  return {
    projects: parseCount("claudia_projects"),
    packets: parseCount("claudia_packets"),
    buildPlans: parseCount("claudia_build_plans") + parseCount("claudia_build_plans_raw"),
    interviews: parseCount("claudia_interviews"),
    resources: parseCount("claudia_resources"),
    research: parseCount("claudia_research"),
    businessIdeas: parseCount("claudia_business_ideas"),
    patents: parseCount("claudia_patents"),
    hasSettings: localStorage.getItem("claudia-settings") !== null ||
                 localStorage.getItem("claudia_global_settings") !== null,
    hasGitLabToken: localStorage.getItem("gitlab_token") !== null,
    totalKeys: getAllClaudiaKeys().length
  }
}

/**
 * Clear all Claudia data for a specific user
 * @param userId - Required: The user ID to clear data for
 * @param options - Options for what to keep
 */
export function clearUserData(
  userId: string,
  options: { keepToken?: boolean; keepSettings?: boolean } = {}
): {
  clearedKeys: string[]
  keptKeys: string[]
} {
  if (typeof window === "undefined" || !userId) {
    return { clearedKeys: [], keptKeys: [] }
  }

  const clearedKeys: string[] = []
  const keptKeys: string[] = []

  // Get all user storage keys
  const userKeys = getAllUserStorageKeys(userId)

  for (const key of userKeys) {
    // Check if we should keep this key
    if (options.keepToken && key.includes("gitlab_token")) {
      keptKeys.push(key)
      continue
    }
    if (options.keepSettings && key.includes("settings")) {
      keptKeys.push(key)
      continue
    }

    localStorage.removeItem(key)
    clearedKeys.push(key)
  }

  return { clearedKeys, keptKeys }
}

/**
 * Clear all legacy (non-user-scoped) Claudia data
 * @param options - Options for what to keep
 */
export function clearAllLegacyData(options: { keepToken?: boolean } = {}): {
  clearedKeys: string[]
  keptKeys: string[]
} {
  if (typeof window === "undefined") {
    return { clearedKeys: [], keptKeys: [] }
  }

  const clearedKeys: string[] = []
  const keptKeys: string[] = []
  const keysToSkip = options.keepToken ? ["gitlab_token"] : []

  // Clear known legacy keys
  for (const key of CLAUDIA_LEGACY_STORAGE_KEYS) {
    if (keysToSkip.includes(key)) {
      if (localStorage.getItem(key) !== null) {
        keptKeys.push(key)
      }
      continue
    }
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key)
      clearedKeys.push(key)
    }
  }

  // Clear prefix-based keys (excluding user-scoped ones)
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith("project-models-")) {
      keysToRemove.push(key)
    }
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key)
    clearedKeys.push(key)
  }

  return { clearedKeys, keptKeys }
}

/**
 * Clear all Claudia data (legacy function - keeps GitLab token by default)
 * @deprecated Use clearUserData for user-specific clearing
 */
export function clearAllData(options: { keepToken?: boolean } = {}): {
  clearedKeys: string[]
  keptKeys: string[]
} {
  return clearAllLegacyData(options)
}

/**
 * Clear only project data for a user (packets, build plans, etc.) but keep settings
 * @param userId - Required: The user ID
 */
export function clearUserProjectData(userId: string): string[] {
  if (typeof window === "undefined" || !userId) return []

  const projectDataKeys = [
    USER_STORAGE_KEYS.PROJECTS,
    USER_STORAGE_KEYS.BUILD_PLANS,
    USER_STORAGE_KEYS.PACKET_RUNS,
    USER_STORAGE_KEYS.RESOURCES,
    USER_STORAGE_KEYS.BRAIN_DUMPS,
    USER_STORAGE_KEYS.RESEARCH,
    USER_STORAGE_KEYS.BUSINESS_IDEAS,
    USER_STORAGE_KEYS.PATENTS,
    USER_STORAGE_KEYS.BUSINESS_DEV,
    "interviews",
    "execution_logs",
  ]

  const cleared: string[] = []

  for (const baseKey of projectDataKeys) {
    const userKey = getUserStorageKey(userId, baseKey)
    if (localStorage.getItem(userKey) !== null) {
      localStorage.removeItem(userKey)
      cleared.push(userKey)
    }
  }

  return cleared
}

/**
 * Clear only legacy project data (packets, build plans, etc.) but keep settings
 * @deprecated Use clearUserProjectData for user-specific clearing
 */
export function clearProjectData(): string[] {
  if (typeof window === "undefined") return []

  const projectDataKeys = [
    "claudia_projects",
    "claudia_packets",
    "claudia_build_plans_raw",
    "claudia_build_plans",
    "claudia_interviews",
    "claudia_resources",
    "claudia_brain_dumps",
    "claudia_execution_logs",
    "claudia_research",
    "claudia_business_ideas",
    "claudia_patents",
    "claudia_business_dev",
    "claudia_packet_runs",
  ]

  const cleared: string[] = []

  for (const key of projectDataKeys) {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key)
      cleared.push(key)
    }
  }

  // Clear project-specific model configs
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith("project-models-")) {
      keysToRemove.push(key)
    }
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key)
    cleared.push(key)
  }

  return cleared
}

/**
 * Export all data for a user for backup
 * @param userId - If provided, exports only this user's data
 */
export function exportAllData(userId?: string): Record<string, unknown> {
  if (typeof window === "undefined") return {}

  const data: Record<string, unknown> = {}
  const keys = getAllClaudiaKeys(userId)

  for (const key of keys) {
    try {
      const value = localStorage.getItem(key)
      if (value) {
        data[key] = JSON.parse(value)
      }
    } catch {
      // Store as raw string if not JSON
      data[key] = localStorage.getItem(key)
    }
  }

  return data
}

/**
 * Import data from backup
 * @param data - The data to import
 * @param userId - If provided, imports as user-scoped data (renames keys)
 */
export function importData(
  data: Record<string, unknown>,
  userId?: string
): string[] {
  if (typeof window === "undefined") return []

  const imported: string[] = []

  for (const [key, value] of Object.entries(data)) {
    try {
      let targetKey = key

      // If userId is provided and key is a legacy key, convert to user-scoped
      if (userId && !key.startsWith("claudia_user_")) {
        // Map legacy keys to user-scoped keys
        const legacyToUserKeyMap: Record<string, string> = {
          "claudia_projects": USER_STORAGE_KEYS.PROJECTS,
          "claudia_build_plans": USER_STORAGE_KEYS.BUILD_PLANS,
          "claudia_packet_runs": USER_STORAGE_KEYS.PACKET_RUNS,
          "claudia_resources": USER_STORAGE_KEYS.RESOURCES,
          "claudia_brain_dumps": USER_STORAGE_KEYS.BRAIN_DUMPS,
          "claudia_interviews": "interviews",
          "claudia_research": USER_STORAGE_KEYS.RESEARCH,
          "claudia_business_ideas": USER_STORAGE_KEYS.BUSINESS_IDEAS,
          "claudia_patents": USER_STORAGE_KEYS.PATENTS,
          "claudia_business_dev": USER_STORAGE_KEYS.BUSINESS_DEV,
        }

        const baseKey = legacyToUserKeyMap[key]
        if (baseKey) {
          targetKey = getUserStorageKey(userId, baseKey)
        }
      }

      localStorage.setItem(targetKey, JSON.stringify(value))
      imported.push(targetKey)
    } catch (error) {
      console.error(`Failed to import ${key}:`, error)
    }
  }

  return imported
}
