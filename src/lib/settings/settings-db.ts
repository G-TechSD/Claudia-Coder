/**
 * Settings Database Operations
 * SQLite-based storage for user settings with server-side encryption
 *
 * This module provides persistent storage for user settings in the auth.db database.
 * Sensitive data (API keys, tokens) is encrypted using AES-256-GCM before storage.
 */

import { db } from "@/lib/auth/db"
import {
  encryptSettings,
  decryptSettings,
  extractSensitiveData,
  mergeSensitiveData,
  type SensitiveSettings
} from "./encryption"
import type { GlobalSettings, CloudProviderConfig, LocalServerConfig } from "./global-settings"

// Types for database storage
export interface UserSettingsRow {
  id: string
  user_id: string
  app_settings: string        // JSON string
  global_settings: string     // JSON string (non-sensitive parts)
  encrypted_settings: string | null  // Encrypted sensitive data
  encryption_version: string
  created_at: string
  updated_at: string
}

export interface StoredGlobalSettings extends Omit<GlobalSettings, "cloudProviders"> {
  cloudProviders: Array<Omit<CloudProviderConfig, "apiKey" | "oauthTokens"> & {
    // API keys and OAuth tokens are stored encrypted, not in this field
    apiKey?: undefined
    oauthTokens?: undefined
  }>
}

// Track if table has been ensured this session
let tableEnsured = false

/**
 * Ensure the user_settings table exists
 * Creates it if missing (handles databases created before this feature)
 */
function ensureTableExists(): void {
  if (tableEnsured) return

  try {
    console.log("[Settings] Ensuring table exists in database...")

    // Check if table exists
    const checkStmt = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings'`)
    const exists = checkStmt.get()

    if (!exists) {
      console.log("[Settings] Creating user_settings table...")
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_settings (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          app_settings TEXT DEFAULT '{}',
          global_settings TEXT DEFAULT '{}',
          encrypted_settings TEXT DEFAULT NULL,
          encryption_version TEXT DEFAULT 'v1',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id)`)
      console.log("[Settings] Table created successfully")
    }

    tableEnsured = true
  } catch (error) {
    console.error("[Settings] Failed to ensure table exists:", error)
    throw error
  }
}

/**
 * Initialize the user_settings table
 * @deprecated Use ensureTableExists() internally - this is kept for backwards compatibility
 */
export function initializeSettingsTable(): void {
  ensureTableExists()
}

/**
 * Generate a unique settings ID
 */
function generateSettingsId(): string {
  return `settings-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Get user settings from the database
 *
 * @param userId - The user ID to fetch settings for
 * @returns Object with appSettings, globalSettings, and sensitive data merged
 */
export function getUserSettingsFromDb(userId: string): {
  appSettings: Record<string, unknown>
  globalSettings: GlobalSettings | null
  exists: boolean
} | null {
  try {
    ensureTableExists()

    const stmt = db.prepare(`
      SELECT * FROM user_settings WHERE user_id = ?
    `)
    const row = stmt.get(userId) as UserSettingsRow | undefined

    if (!row) {
      return { appSettings: {}, globalSettings: null, exists: false }
    }

    // Parse non-sensitive settings
    const appSettings = JSON.parse(row.app_settings || "{}")
    const globalSettingsBase = JSON.parse(row.global_settings || "{}") as StoredGlobalSettings

    // Decrypt sensitive settings
    let sensitive: SensitiveSettings = {}
    if (row.encrypted_settings) {
      sensitive = decryptSettings(row.encrypted_settings) as SensitiveSettings
    }

    // Merge sensitive data back into global settings
    const globalSettings = mergeSensitiveData(globalSettingsBase, sensitive) as GlobalSettings

    return {
      appSettings,
      globalSettings,
      exists: true
    }
  } catch (error) {
    console.error("[Settings] Failed to get user settings:", error)
    return null
  }
}

/**
 * Save user settings to the database
 *
 * @param userId - The user ID to save settings for
 * @param appSettings - Application settings (non-sensitive)
 * @param globalSettings - Global settings including cloud providers
 */
export function saveUserSettingsToDb(
  userId: string,
  appSettings: Record<string, unknown>,
  globalSettings: GlobalSettings
): boolean {
  console.log("[Settings DB] saveUserSettingsToDb called for user:", userId)
  console.log("[Settings DB] globalSettings.defaultLaunchHost:", globalSettings.defaultLaunchHost)

  try {
    ensureTableExists()
    console.log("[Settings DB] Table exists check passed")

    // Extract sensitive data for encryption
    const sensitive = extractSensitiveData(globalSettings)

    // Create a copy of global settings without sensitive data
    const globalSettingsClean: StoredGlobalSettings = {
      ...globalSettings,
      cloudProviders: globalSettings.cloudProviders.map(p => ({
        ...p,
        apiKey: undefined,
        oauthTokens: undefined
      }))
    }

    // Encrypt sensitive data
    const encryptedSettings = Object.keys(sensitive).length > 0
      ? encryptSettings(sensitive)
      : null

    // Check if settings already exist
    const existingStmt = db.prepare(`SELECT id FROM user_settings WHERE user_id = ?`)
    const existing = existingStmt.get(userId) as { id: string } | undefined

    if (existing) {
      // Update existing settings
      const updateStmt = db.prepare(`
        UPDATE user_settings
        SET app_settings = ?,
            global_settings = ?,
            encrypted_settings = ?,
            updated_at = datetime('now')
        WHERE user_id = ?
      `)

      updateStmt.run(
        JSON.stringify(appSettings),
        JSON.stringify(globalSettingsClean),
        encryptedSettings,
        userId
      )
    } else {
      // Insert new settings
      const insertStmt = db.prepare(`
        INSERT INTO user_settings (id, user_id, app_settings, global_settings, encrypted_settings)
        VALUES (?, ?, ?, ?, ?)
      `)

      insertStmt.run(
        generateSettingsId(),
        userId,
        JSON.stringify(appSettings),
        JSON.stringify(globalSettingsClean),
        encryptedSettings
      )
    }

    console.log(`[Settings] Saved settings for user ${userId.slice(0, 8)}...`)
    return true
  } catch (error) {
    console.error("[Settings] Failed to save user settings:", error)
    return false
  }
}

/**
 * Migrate settings from localStorage format to database
 * Used for one-time migration when users first access the server API
 *
 * @param userId - The user ID to migrate settings for
 * @param localAppSettings - App settings from localStorage
 * @param localGlobalSettings - Global settings from localStorage (including sensitive data)
 * @param localUserSettings - User-specific settings from localStorage
 */
export function migrateFromLocalStorage(
  userId: string,
  localAppSettings?: Record<string, unknown>,
  localGlobalSettings?: GlobalSettings,
  localUserSettings?: {
    apiKeys?: {
      anthropic?: string
      openai?: string
      google?: string
      n8n?: string
    }
    n8n?: {
      personalInstance?: {
        apiKey?: string
        baseUrl?: string
      }
    }
  }
): { success: boolean; migrated: boolean; error?: string } {
  try {
    // Check if settings already exist
    const existing = getUserSettingsFromDb(userId)
    if (existing?.exists) {
      console.log(`[Settings] Settings already exist for user ${userId.slice(0, 8)}..., skipping migration`)
      return { success: true, migrated: false }
    }

    // Merge local settings
    const appSettings = localAppSettings || {}

    // Start with local global settings or defaults
    let globalSettings: GlobalSettings = localGlobalSettings || {
      setupComplete: false,
      localServers: [],
      cloudProviders: [
        { provider: "anthropic", enabled: false, enabledModels: [] },
        { provider: "openai", enabled: false, enabledModels: [] },
        { provider: "google", enabled: false, enabledModels: [] },
        { provider: "claude-code", enabled: false, enabledModels: [] }
      ],
      preferLocalModels: true,
      autoRouteByTaskType: true
    }

    // Merge user-specific API keys if provided
    if (localUserSettings?.apiKeys) {
      const keys = localUserSettings.apiKeys

      // Find or create cloud provider entries
      if (keys.anthropic) {
        const idx = globalSettings.cloudProviders.findIndex(p => p.provider === "anthropic")
        if (idx >= 0) {
          globalSettings.cloudProviders[idx].apiKey = keys.anthropic
          globalSettings.cloudProviders[idx].enabled = true
        }
      }
      if (keys.openai) {
        const idx = globalSettings.cloudProviders.findIndex(p => p.provider === "openai")
        if (idx >= 0) {
          globalSettings.cloudProviders[idx].apiKey = keys.openai
          globalSettings.cloudProviders[idx].enabled = true
        }
      }
      if (keys.google) {
        const idx = globalSettings.cloudProviders.findIndex(p => p.provider === "google")
        if (idx >= 0) {
          globalSettings.cloudProviders[idx].apiKey = keys.google
          globalSettings.cloudProviders[idx].enabled = true
        }
      }
    }

    // Save merged settings
    const saved = saveUserSettingsToDb(userId, appSettings, globalSettings)

    if (saved) {
      console.log(`[Settings] Migrated settings for user ${userId.slice(0, 8)}...`)
      return { success: true, migrated: true }
    } else {
      return { success: false, migrated: false, error: "Failed to save settings" }
    }
  } catch (error) {
    console.error("[Settings] Migration failed:", error)
    return {
      success: false,
      migrated: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

/**
 * Delete user settings from the database
 *
 * @param userId - The user ID to delete settings for
 */
export function deleteUserSettingsFromDb(userId: string): boolean {
  try {
    const stmt = db.prepare(`DELETE FROM user_settings WHERE user_id = ?`)
    stmt.run(userId)
    console.log(`[Settings] Deleted settings for user ${userId.slice(0, 8)}...`)
    return true
  } catch (error) {
    console.error("[Settings] Failed to delete user settings:", error)
    return false
  }
}

/**
 * Get API keys for a user (for use in API routes)
 * Returns decrypted API keys from the database
 *
 * @param userId - The user ID to get API keys for
 */
export function getUserApiKeysFromDb(userId: string): {
  anthropic?: string
  openai?: string
  google?: string
  n8n?: string
} | null {
  try {
    const settings = getUserSettingsFromDb(userId)
    if (!settings?.globalSettings) {
      return null
    }

    const keys: {
      anthropic?: string
      openai?: string
      google?: string
      n8n?: string
    } = {}

    // Extract API keys from cloud providers
    for (const provider of settings.globalSettings.cloudProviders) {
      if (provider.apiKey) {
        switch (provider.provider) {
          case "anthropic":
            keys.anthropic = provider.apiKey
            break
          case "openai":
            keys.openai = provider.apiKey
            break
          case "google":
            keys.google = provider.apiKey
            break
        }
      }
    }

    // Also check top-level apiKeys field (legacy/alternative storage format)
    const globalSettingsAny = settings.globalSettings as GlobalSettings & {
      apiKeys?: { anthropic?: string; openai?: string; google?: string; n8n?: string }
    }
    if (globalSettingsAny.apiKeys) {
      if (globalSettingsAny.apiKeys.anthropic && !keys.anthropic) {
        keys.anthropic = globalSettingsAny.apiKeys.anthropic
      }
      if (globalSettingsAny.apiKeys.openai && !keys.openai) {
        keys.openai = globalSettingsAny.apiKeys.openai
      }
      if (globalSettingsAny.apiKeys.google && !keys.google) {
        keys.google = globalSettingsAny.apiKeys.google
      }
      if (globalSettingsAny.apiKeys.n8n && !keys.n8n) {
        keys.n8n = globalSettingsAny.apiKeys.n8n
      }
    }

    return keys
  } catch (error) {
    console.error("[Settings] Failed to get API keys:", error)
    return null
  }
}

/**
 * Check if a user has settings stored in the database
 *
 * @param userId - The user ID to check
 */
export function hasUserSettingsInDb(userId: string): boolean {
  try {
    ensureTableExists()
    const stmt = db.prepare(`SELECT 1 FROM user_settings WHERE user_id = ?`)
    const result = stmt.get(userId)
    return !!result
  } catch (error) {
    console.error("[Settings] Failed to check user settings:", error)
    return false
  }
}

/**
 * Get the last update time for user settings
 *
 * @param userId - The user ID to check
 */
export function getSettingsLastUpdated(userId: string): string | null {
  try {
    const stmt = db.prepare(`SELECT updated_at FROM user_settings WHERE user_id = ?`)
    const result = stmt.get(userId) as { updated_at: string } | undefined
    return result?.updated_at || null
  } catch (error) {
    console.error("[Settings] Failed to get last updated time:", error)
    return null
  }
}
