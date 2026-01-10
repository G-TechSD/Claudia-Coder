/**
 * User-Scoped Storage Utilities
 *
 * All localStorage data must be prefixed with userId to ensure complete
 * data isolation between users. This module provides helpers for:
 * - Generating user-scoped storage keys
 * - Managing user-specific data in localStorage
 * - Migrating existing global storage to user-scoped storage
 *
 * IMPORTANT: Every piece of stored data must belong to a specific user.
 * Global/shared data should be stored in the database, not localStorage.
 */

// ============ Storage Key Helpers ============

/**
 * Generate a user-scoped localStorage key
 * @param userId - The user ID to scope the key to
 * @param baseKey - The base key name (e.g., 'projects', 'build_plans')
 * @returns A user-scoped key in format: claudia_user_{userId}_{baseKey}
 */
export function getUserStorageKey(userId: string, baseKey: string): string {
  if (!userId) {
    throw new Error("userId is required for user-scoped storage")
  }
  // Sanitize userId to prevent injection - only allow alphanumeric and dash
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-]/g, "")
  return `claudia_user_${sanitizedUserId}_${baseKey}`
}

/**
 * Check if a storage key belongs to a specific user
 * @param key - The storage key to check
 * @param userId - The user ID to check against
 * @returns True if the key belongs to the user
 */
export function isUserStorageKey(key: string, userId: string): boolean {
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-]/g, "")
  return key.startsWith(`claudia_user_${sanitizedUserId}_`)
}

/**
 * Extract the base key from a user-scoped storage key
 * @param key - The full storage key
 * @param userId - The user ID
 * @returns The base key without user prefix
 */
export function extractBaseKey(key: string, userId: string): string | null {
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-]/g, "")
  const prefix = `claudia_user_${sanitizedUserId}_`
  if (!key.startsWith(prefix)) return null
  return key.slice(prefix.length)
}

// ============ Storage CRUD Helpers ============

/**
 * Get user-scoped data from localStorage
 * @param userId - The user ID
 * @param baseKey - The base key name
 * @returns Parsed JSON data or null if not found
 */
export function getUserStorageItem<T>(userId: string, baseKey: string): T | null {
  if (typeof window === "undefined") return null

  try {
    const key = getUserStorageKey(userId, baseKey)
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : null
  } catch (error) {
    console.error(`Failed to get user storage item: ${baseKey}`, error)
    return null
  }
}

/**
 * Set user-scoped data in localStorage
 * @param userId - The user ID
 * @param baseKey - The base key name
 * @param data - The data to store (will be JSON stringified)
 */
export function setUserStorageItem<T>(userId: string, baseKey: string, data: T): void {
  if (typeof window === "undefined") return

  try {
    const key = getUserStorageKey(userId, baseKey)
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.error(`Failed to set user storage item: ${baseKey}`, error)
    throw error
  }
}

/**
 * Remove user-scoped data from localStorage
 * @param userId - The user ID
 * @param baseKey - The base key name
 */
export function removeUserStorageItem(userId: string, baseKey: string): void {
  if (typeof window === "undefined") return

  const key = getUserStorageKey(userId, baseKey)
  localStorage.removeItem(key)
}

/**
 * Get all storage keys for a specific user
 * @param userId - The user ID
 * @returns Array of storage keys belonging to the user
 */
export function getAllUserStorageKeys(userId: string): string[] {
  if (typeof window === "undefined") return []

  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-]/g, "")
  const prefix = `claudia_user_${sanitizedUserId}_`
  const keys: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(prefix)) {
      keys.push(key)
    }
  }

  return keys
}

/**
 * Clear all storage for a specific user
 * @param userId - The user ID
 * @returns Number of keys cleared
 */
export function clearAllUserStorage(userId: string): number {
  if (typeof window === "undefined") return 0

  const keys = getAllUserStorageKeys(userId)
  for (const key of keys) {
    localStorage.removeItem(key)
  }
  return keys.length
}

// ============ Storage Base Keys ============

/**
 * Standard base keys used for user-scoped storage
 * Use these constants to ensure consistency across the application
 */
export const USER_STORAGE_KEYS = {
  PROJECTS: "projects",
  BUILD_PLANS: "build_plans",
  PACKET_RUNS: "packet_runs",
  RESOURCES: "resources",
  BRAIN_DUMPS: "brain_dumps",
  INTERVIEWS: "interviews",
  RESEARCH: "research",
  BUSINESS_IDEAS: "business_ideas",
  PATENTS: "patents",
  BUSINESS_DEV: "business_dev",
  QUALITY_GATES: "quality_gates",
  EXECUTION_LOGS: "execution_logs",
  MCP_STORAGE: "mcp_storage",
} as const

export type UserStorageKey = (typeof USER_STORAGE_KEYS)[keyof typeof USER_STORAGE_KEYS]

// ============ Migration Helpers ============

/**
 * Legacy storage keys that need to be migrated to user-scoped storage
 */
const LEGACY_STORAGE_KEYS = [
  { legacy: "claudia_projects", baseKey: USER_STORAGE_KEYS.PROJECTS },
  { legacy: "claudia_build_plans", baseKey: USER_STORAGE_KEYS.BUILD_PLANS },
  { legacy: "claudia_packet_runs", baseKey: USER_STORAGE_KEYS.PACKET_RUNS },
  { legacy: "claudia_resources", baseKey: USER_STORAGE_KEYS.RESOURCES },
  { legacy: "claudia_brain_dumps", baseKey: USER_STORAGE_KEYS.BRAIN_DUMPS },
  { legacy: "claudia_interviews", baseKey: USER_STORAGE_KEYS.INTERVIEWS },
  { legacy: "claudia_research", baseKey: USER_STORAGE_KEYS.RESEARCH },
  { legacy: "claudia_business_ideas", baseKey: USER_STORAGE_KEYS.BUSINESS_IDEAS },
  { legacy: "claudia_patents", baseKey: USER_STORAGE_KEYS.PATENTS },
  { legacy: "claudia_business_dev", baseKey: USER_STORAGE_KEYS.BUSINESS_DEV },
] as const

/**
 * Migrate legacy global storage to user-scoped storage
 * This should be called once when a user logs in to ensure their data is migrated
 *
 * @param userId - The user ID to migrate data to
 * @returns Object with migration statistics
 */
export function migrateToUserStorage(userId: string): {
  migratedKeys: string[]
  skippedKeys: string[]
  errors: string[]
} {
  if (typeof window === "undefined") {
    return { migratedKeys: [], skippedKeys: [], errors: [] }
  }

  const result = {
    migratedKeys: [] as string[],
    skippedKeys: [] as string[],
    errors: [] as string[],
  }

  for (const { legacy, baseKey } of LEGACY_STORAGE_KEYS) {
    try {
      const legacyData = localStorage.getItem(legacy)
      if (!legacyData) {
        continue // No legacy data to migrate
      }

      const userKey = getUserStorageKey(userId, baseKey)
      const existingUserData = localStorage.getItem(userKey)

      if (existingUserData) {
        // User already has data - merge or skip
        // For now, we skip to avoid data loss
        result.skippedKeys.push(legacy)
        continue
      }

      // Parse legacy data and add userId to each item if it's an array
      const parsed = JSON.parse(legacyData)

      if (Array.isArray(parsed)) {
        // Add userId to each item for future queries
        const withUserId = parsed.map((item) => ({
          ...item,
          userId: item.userId || userId,
        }))
        localStorage.setItem(userKey, JSON.stringify(withUserId))
      } else {
        // Single object - just add userId
        const withUserId = { ...parsed, userId: parsed.userId || userId }
        localStorage.setItem(userKey, JSON.stringify(withUserId))
      }

      result.migratedKeys.push(legacy)

      // Optionally remove legacy key after successful migration
      // Uncomment the next line to enable cleanup:
      // localStorage.removeItem(legacy)
    } catch (error) {
      result.errors.push(`Failed to migrate ${legacy}: ${error}`)
    }
  }

  return result
}

/**
 * Check if legacy data exists that needs migration
 * @returns True if there is legacy data to migrate
 */
export function hasLegacyData(): boolean {
  if (typeof window === "undefined") return false

  for (const { legacy } of LEGACY_STORAGE_KEYS) {
    if (localStorage.getItem(legacy)) {
      return true
    }
  }
  return false
}

/**
 * Clean up legacy storage keys after migration
 * Only call this after confirming data has been successfully migrated
 */
export function cleanupLegacyStorage(): string[] {
  if (typeof window === "undefined") return []

  const cleaned: string[] = []

  for (const { legacy } of LEGACY_STORAGE_KEYS) {
    if (localStorage.getItem(legacy)) {
      localStorage.removeItem(legacy)
      cleaned.push(legacy)
    }
  }

  return cleaned
}

// ============ Storage Validation ============

/**
 * Validate that a user can access a specific data item
 * @param userId - The user ID requesting access
 * @param item - The data item to check
 * @param isAdmin - Whether the user is an admin (can access all data)
 * @returns True if the user can access the item
 */
export function canUserAccessItem(
  userId: string,
  item: { userId?: string; isPublic?: boolean; collaboratorIds?: string[] },
  isAdmin: boolean = false
): boolean {
  // Admins can access everything
  if (isAdmin) return true

  // Public items are accessible to all
  if (item.isPublic) return true

  // Item belongs to the user
  if (item.userId === userId) return true

  // User is a collaborator
  if (item.collaboratorIds?.includes(userId)) return true

  // Legacy items without userId - currently accessible to all for backwards compatibility
  // TODO: Remove this after migration is complete
  if (!item.userId) return true

  return false
}

/**
 * Filter an array of items to only include those accessible by a user
 * @param userId - The user ID requesting access
 * @param items - Array of items to filter
 * @param isAdmin - Whether the user is an admin
 * @returns Filtered array of accessible items
 */
export function filterUserAccessibleItems<
  T extends { userId?: string; isPublic?: boolean; collaboratorIds?: string[] }
>(userId: string, items: T[], isAdmin: boolean = false): T[] {
  return items.filter((item) => canUserAccessItem(userId, item, isAdmin))
}

// ============ Event Helpers ============

/**
 * Dispatch a storage change event for reactive updates
 * @param userId - The user ID
 * @param baseKey - The storage key that changed
 * @param data - The new data value
 */
export function dispatchStorageChange(userId: string, baseKey: string, data: unknown): void {
  if (typeof window === "undefined") return

  window.dispatchEvent(
    new CustomEvent("user-storage-changed", {
      detail: { userId, baseKey, data },
    })
  )
}

/**
 * Subscribe to storage changes for a specific user and key
 * @param userId - The user ID to watch
 * @param baseKey - The storage key to watch (or null for all keys)
 * @param callback - Callback function when data changes
 * @returns Cleanup function to unsubscribe
 */
export function subscribeToStorageChanges(
  userId: string,
  baseKey: string | null,
  callback: (data: unknown, changedKey: string) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {}
  }

  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail.userId !== userId) return
    if (baseKey && detail.baseKey !== baseKey) return
    callback(detail.data, detail.baseKey)
  }

  window.addEventListener("user-storage-changed", handler)
  return () => window.removeEventListener("user-storage-changed", handler)
}

// ============ IndexedDB User Scoping ============

/**
 * Get user-scoped IndexedDB database name
 * @param userId - The user ID
 * @param baseName - The base database name
 * @returns User-scoped database name
 */
export function getUserIndexedDBName(userId: string, baseName: string): string {
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-]/g, "")
  return `claudia-user-${sanitizedUserId}-${baseName}`
}

/**
 * Generate a user-scoped IndexedDB key for blob storage
 * @param userId - The user ID
 * @param resourceId - The resource ID
 * @returns User-scoped blob key
 */
export function getUserBlobKey(userId: string, resourceId: string): string {
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-]/g, "")
  return `user_${sanitizedUserId}_resource_${resourceId}`
}
