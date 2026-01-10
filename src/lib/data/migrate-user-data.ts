/**
 * User Data Migration Module
 *
 * Migrates ALL legacy localStorage data to user-scoped storage.
 * This module handles the transition from global storage keys (e.g., "claudia_projects")
 * to user-scoped keys (e.g., "claudia_user_{userId}_projects").
 *
 * IMPORTANT:
 * - Legacy data is NOT deleted after migration (kept as backup)
 * - Migration only runs once per user (tracked via migration flag)
 * - The migration is non-destructive and can be re-run safely
 */

import {
  getUserStorageKey,
  getUserStorageItem,
  setUserStorageItem,
  USER_STORAGE_KEYS,
} from "./user-storage"

// ============ Legacy Storage Key Mapping ============

/**
 * Complete mapping of legacy storage keys to user-scoped base keys
 * These are all the data types that need to be migrated
 */
export const LEGACY_KEY_MAPPING = [
  { legacyKey: "claudia_projects", baseKey: USER_STORAGE_KEYS.PROJECTS },
  { legacyKey: "claudia_packets", baseKey: USER_STORAGE_KEYS.PACKET_RUNS },
  { legacyKey: "claudia_packet_runs", baseKey: USER_STORAGE_KEYS.PACKET_RUNS },
  { legacyKey: "claudia_build_plans", baseKey: USER_STORAGE_KEYS.BUILD_PLANS },
  { legacyKey: "claudia_resources", baseKey: USER_STORAGE_KEYS.RESOURCES },
  { legacyKey: "claudia_brain_dumps", baseKey: USER_STORAGE_KEYS.BRAIN_DUMPS },
  { legacyKey: "claudia_research", baseKey: USER_STORAGE_KEYS.RESEARCH },
  { legacyKey: "claudia_business_ideas", baseKey: USER_STORAGE_KEYS.BUSINESS_IDEAS },
  { legacyKey: "claudia_patents", baseKey: USER_STORAGE_KEYS.PATENTS },
  { legacyKey: "claudia_business_dev", baseKey: USER_STORAGE_KEYS.BUSINESS_DEV },
  { legacyKey: "claudia_interviews", baseKey: USER_STORAGE_KEYS.INTERVIEWS },
  { legacyKey: "claudia_quality_gates", baseKey: USER_STORAGE_KEYS.QUALITY_GATES },
  { legacyKey: "claudia_execution_logs", baseKey: USER_STORAGE_KEYS.EXECUTION_LOGS },
  { legacyKey: "claudia_mcp_storage", baseKey: USER_STORAGE_KEYS.MCP_STORAGE },
] as const

// ============ Migration Result Types ============

export interface MigrationResult {
  /** Keys that were successfully migrated */
  migratedKeys: string[]
  /** Keys that were skipped (already had user-scoped data) */
  skippedKeys: string[]
  /** Keys that had no legacy data to migrate */
  emptyKeys: string[]
  /** Errors encountered during migration */
  errors: Array<{ key: string; error: string }>
  /** Total items migrated across all keys */
  totalItemsMigrated: number
  /** Whether the migration was successful overall */
  success: boolean
  /** Timestamp of the migration */
  timestamp: string
}

export interface MigrationStatus {
  /** Whether migration has been completed for this user */
  migrated: boolean
  /** Timestamp of when migration was completed */
  migratedAt?: string
  /** Summary of what was migrated */
  summary?: MigrationResult
}

// ============ Migration Flag Helpers ============

/**
 * Get the migration flag key for a user
 */
function getMigrationFlagKey(userId: string): string {
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-]/g, "")
  return `claudia_user_${sanitizedUserId}_migrated`
}

/**
 * Check if migration has been completed for a user
 */
export function hasMigrationCompleted(userId: string): boolean {
  if (typeof window === "undefined") return false
  const flagKey = getMigrationFlagKey(userId)
  return localStorage.getItem(flagKey) === "true"
}

/**
 * Get the migration status for a user
 */
export function getMigrationStatus(userId: string): MigrationStatus {
  if (typeof window === "undefined") {
    return { migrated: false }
  }

  const flagKey = getMigrationFlagKey(userId)
  const migrated = localStorage.getItem(flagKey) === "true"

  if (!migrated) {
    return { migrated: false }
  }

  // Try to get the migration summary
  const summaryKey = `${flagKey}_summary`
  const summaryJson = localStorage.getItem(summaryKey)
  let summary: MigrationResult | undefined

  if (summaryJson) {
    try {
      summary = JSON.parse(summaryJson)
    } catch {
      // Ignore parse errors
    }
  }

  return {
    migrated: true,
    migratedAt: summary?.timestamp,
    summary,
  }
}

/**
 * Mark migration as completed for a user
 */
function setMigrationCompleted(userId: string, result: MigrationResult): void {
  if (typeof window === "undefined") return

  const flagKey = getMigrationFlagKey(userId)
  localStorage.setItem(flagKey, "true")

  // Also store the summary for reference
  const summaryKey = `${flagKey}_summary`
  localStorage.setItem(summaryKey, JSON.stringify(result))
}

/**
 * Reset migration flag for a user (allows re-running migration)
 */
export function resetMigrationFlag(userId: string): void {
  if (typeof window === "undefined") return

  const flagKey = getMigrationFlagKey(userId)
  localStorage.removeItem(flagKey)
  localStorage.removeItem(`${flagKey}_summary`)
}

// ============ Legacy Data Helpers ============

/**
 * Check if any legacy data exists that could be migrated
 */
export function hasLegacyDataToMigrate(): boolean {
  if (typeof window === "undefined") return false

  for (const { legacyKey } of LEGACY_KEY_MAPPING) {
    const data = localStorage.getItem(legacyKey)
    if (data && data !== "[]" && data !== "{}") {
      return true
    }
  }

  return false
}

/**
 * Get summary of what legacy data exists
 */
export function getLegacyDataSummary(): Array<{
  key: string
  baseKey: string
  itemCount: number
  hasData: boolean
}> {
  if (typeof window === "undefined") return []

  return LEGACY_KEY_MAPPING.map(({ legacyKey, baseKey }) => {
    const data = localStorage.getItem(legacyKey)
    let itemCount = 0
    let hasData = false

    if (data) {
      try {
        const parsed = JSON.parse(data)
        if (Array.isArray(parsed)) {
          itemCount = parsed.length
          hasData = parsed.length > 0
        } else if (typeof parsed === "object" && parsed !== null) {
          itemCount = Object.keys(parsed).length
          hasData = true
        }
      } catch {
        // Invalid JSON, count as 0
      }
    }

    return {
      key: legacyKey,
      baseKey,
      itemCount,
      hasData,
    }
  })
}

// ============ Core Migration Function ============

/**
 * Migrate a single legacy key to user-scoped storage
 */
function migrateSingleKey(
  userId: string,
  legacyKey: string,
  baseKey: string
): {
  status: "migrated" | "skipped" | "empty" | "error"
  itemCount: number
  error?: string
} {
  try {
    // Read legacy data
    const legacyData = localStorage.getItem(legacyKey)

    if (!legacyData || legacyData === "[]" || legacyData === "{}") {
      return { status: "empty", itemCount: 0 }
    }

    // Check if user already has data in the new location
    const existingData = getUserStorageItem(userId, baseKey)
    if (existingData) {
      // User already has data - check if it's non-empty
      if (Array.isArray(existingData) && existingData.length > 0) {
        return { status: "skipped", itemCount: 0 }
      }
      if (
        typeof existingData === "object" &&
        existingData !== null &&
        Object.keys(existingData).length > 0
      ) {
        return { status: "skipped", itemCount: 0 }
      }
    }

    // Parse and migrate the data
    const parsed = JSON.parse(legacyData)
    let itemCount = 0

    if (Array.isArray(parsed)) {
      // Add userId to each item for future queries
      const withUserId = parsed.map((item) => ({
        ...item,
        userId: item.userId || userId,
        migratedAt: new Date().toISOString(),
      }))
      setUserStorageItem(userId, baseKey, withUserId)
      itemCount = withUserId.length
    } else if (typeof parsed === "object" && parsed !== null) {
      // Single object - add userId
      const withUserId = {
        ...parsed,
        userId: parsed.userId || userId,
        migratedAt: new Date().toISOString(),
      }
      setUserStorageItem(userId, baseKey, withUserId)
      itemCount = 1
    }

    // NOTE: We do NOT delete the legacy data - it's kept as backup

    return { status: "migrated", itemCount }
  } catch (error) {
    return {
      status: "error",
      itemCount: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Migrate ALL legacy localStorage data to user-scoped storage
 *
 * This function:
 * - Reads from old keys (e.g., "claudia_projects")
 * - Writes to new user-scoped keys (e.g., "claudia_user_{userId}_projects")
 * - Does NOT delete old data (kept as backup)
 * - Returns a detailed summary of what was migrated
 *
 * @param userId - The user ID to scope the data to
 * @param force - If true, ignores the migration flag and runs anyway
 */
export function migrateAllUserData(
  userId: string,
  force: boolean = false
): MigrationResult {
  const result: MigrationResult = {
    migratedKeys: [],
    skippedKeys: [],
    emptyKeys: [],
    errors: [],
    totalItemsMigrated: 0,
    success: false,
    timestamp: new Date().toISOString(),
  }

  // Check if running in browser
  if (typeof window === "undefined") {
    result.errors.push({
      key: "_system",
      error: "Migration can only run in browser environment",
    })
    return result
  }

  // Validate userId
  if (!userId) {
    result.errors.push({
      key: "_system",
      error: "userId is required for migration",
    })
    return result
  }

  // Check if already migrated (unless forcing)
  if (!force && hasMigrationCompleted(userId)) {
    // Return the previous result if available
    const status = getMigrationStatus(userId)
    if (status.summary) {
      return status.summary
    }
    result.success = true
    return result
  }

  console.log(`[Migration] Starting migration for user: ${userId}`)

  // Migrate each legacy key
  for (const { legacyKey, baseKey } of LEGACY_KEY_MAPPING) {
    const { status, itemCount, error } = migrateSingleKey(userId, legacyKey, baseKey)

    switch (status) {
      case "migrated":
        result.migratedKeys.push(legacyKey)
        result.totalItemsMigrated += itemCount
        console.log(`[Migration] Migrated ${legacyKey}: ${itemCount} items`)
        break
      case "skipped":
        result.skippedKeys.push(legacyKey)
        console.log(`[Migration] Skipped ${legacyKey}: user already has data`)
        break
      case "empty":
        result.emptyKeys.push(legacyKey)
        break
      case "error":
        result.errors.push({ key: legacyKey, error: error || "Unknown error" })
        console.error(`[Migration] Error migrating ${legacyKey}:`, error)
        break
    }
  }

  // Mark migration as complete (even if some keys had errors)
  result.success = result.errors.length === 0
  setMigrationCompleted(userId, result)

  console.log(`[Migration] Complete. Migrated ${result.migratedKeys.length} keys, ` +
    `${result.totalItemsMigrated} total items`)

  return result
}

// ============ Auto-Migration Hook ============

/**
 * Run auto-migration when a user logs in
 * This should be called once when the user session is established
 *
 * @param userId - The user ID to migrate data for
 * @returns Migration result if migration ran, null if already migrated
 */
export function runAutoMigration(userId: string): MigrationResult | null {
  if (typeof window === "undefined") return null
  if (!userId) return null

  // Check if already migrated
  if (hasMigrationCompleted(userId)) {
    console.log(`[Migration] User ${userId} already migrated, skipping`)
    return null
  }

  // Check if there's any legacy data to migrate
  if (!hasLegacyDataToMigrate()) {
    console.log(`[Migration] No legacy data found for user ${userId}`)
    // Mark as migrated even if no data (to skip future checks)
    const emptyResult: MigrationResult = {
      migratedKeys: [],
      skippedKeys: [],
      emptyKeys: LEGACY_KEY_MAPPING.map((m) => m.legacyKey),
      errors: [],
      totalItemsMigrated: 0,
      success: true,
      timestamp: new Date().toISOString(),
    }
    setMigrationCompleted(userId, emptyResult)
    return emptyResult
  }

  // Run the migration
  console.log(`[Migration] Running auto-migration for user ${userId}`)
  return migrateAllUserData(userId)
}

// ============ Manual Migration Trigger ============

/**
 * Force re-run migration (for admin/debugging purposes)
 * This resets the migration flag and runs migration again
 *
 * @param userId - The user ID to migrate data for
 */
export function forceMigration(userId: string): MigrationResult {
  resetMigrationFlag(userId)
  return migrateAllUserData(userId, true)
}

// ============ Data Cleanup (Optional) ============

/**
 * Clean up legacy storage keys after confirming migration success
 * WARNING: This permanently deletes the backup data
 *
 * @param userId - The user ID (to verify migration was done)
 * @param confirm - Must be true to actually delete
 * @returns List of deleted keys
 */
export function cleanupLegacyData(userId: string, confirm: boolean = false): string[] {
  if (!confirm) {
    console.warn("[Migration] cleanupLegacyData called without confirm=true, skipping")
    return []
  }

  if (!hasMigrationCompleted(userId)) {
    console.error("[Migration] Cannot cleanup: migration not completed for this user")
    return []
  }

  const deleted: string[] = []

  for (const { legacyKey } of LEGACY_KEY_MAPPING) {
    if (localStorage.getItem(legacyKey)) {
      localStorage.removeItem(legacyKey)
      deleted.push(legacyKey)
    }
  }

  console.log(`[Migration] Cleaned up ${deleted.length} legacy keys`)
  return deleted
}
