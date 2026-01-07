/**
 * Data Reset Utility
 *
 * Clear all Claudia data from localStorage for a fresh start
 */

// All known localStorage keys used by Claudia
const CLAUDIA_STORAGE_KEYS = [
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
  "gitlab_token",  // GitLab auth token
]

// Prefix-based keys that need pattern matching
const CLAUDIA_KEY_PREFIXES = [
  "project-models-",
]

/**
 * Get all Claudia-related keys from localStorage
 */
export function getAllClaudiaKeys(): string[] {
  if (typeof window === "undefined") return []

  const keys: string[] = []

  // Add known keys that exist
  for (const key of CLAUDIA_STORAGE_KEYS) {
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
 * Get summary of stored data
 */
export function getDataSummary(): {
  projects: number
  packets: number
  buildPlans: number
  interviews: number
  resources: number
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

  return {
    projects: parseCount("claudia_projects"),
    packets: parseCount("claudia_packets"),
    buildPlans: parseCount("claudia_build_plans") + parseCount("claudia_build_plans_raw"),
    interviews: parseCount("claudia_interviews"),
    resources: parseCount("claudia_resources"),
    hasSettings: localStorage.getItem("claudia-settings") !== null ||
                 localStorage.getItem("claudia_global_settings") !== null,
    hasGitLabToken: localStorage.getItem("gitlab_token") !== null,
    totalKeys: getAllClaudiaKeys().length
  }
}

/**
 * Clear all Claudia data (keeps GitLab token by default)
 */
export function clearAllData(options: { keepToken?: boolean } = {}): {
  clearedKeys: string[]
  keptKeys: string[]
} {
  if (typeof window === "undefined") {
    return { clearedKeys: [], keptKeys: [] }
  }

  const clearedKeys: string[] = []
  const keptKeys: string[] = []
  const keysToSkip = options.keepToken ? ["gitlab_token"] : []

  // Clear known keys
  for (const key of CLAUDIA_STORAGE_KEYS) {
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

  // Clear prefix-based keys
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      for (const prefix of CLAUDIA_KEY_PREFIXES) {
        if (key.startsWith(prefix)) {
          keysToRemove.push(key)
        }
      }
    }
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key)
    clearedKeys.push(key)
  }

  return { clearedKeys, keptKeys }
}

/**
 * Clear only project data (packets, build plans, etc.) but keep settings
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
 * Export all data for backup
 */
export function exportAllData(): Record<string, unknown> {
  if (typeof window === "undefined") return {}

  const data: Record<string, unknown> = {}

  for (const key of getAllClaudiaKeys()) {
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
 */
export function importData(data: Record<string, unknown>): string[] {
  if (typeof window === "undefined") return []

  const imported: string[] = []

  for (const [key, value] of Object.entries(data)) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      imported.push(key)
    } catch (error) {
      console.error(`Failed to import ${key}:`, error)
    }
  }

  return imported
}
