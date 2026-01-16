/**
 * Gitea Configuration Management
 *
 * Manages per-user Gitea settings including:
 * - Instance URL configuration
 * - Authentication token storage
 * - Connection preferences
 *
 * Gitea is bundled in the all-in-one container, so it's enabled by default
 * with the localhost URL pre-configured. No user configuration needed.
 *
 * Settings are stored in localStorage with encryption for sensitive values.
 */

import { encryptValue, decryptValue } from "@/lib/data/user-settings"

// ============ Types ============

export interface GiteaConfig {
  // Instance URL (pre-configured for all-in-one container)
  baseUrl: string

  // Authentication
  authToken?: string  // Encrypted - for API access

  // Preferences
  enabled: boolean
  autoConnect: boolean

  // Display preferences
  showStatusIndicator: boolean
}

export interface GiteaConnectionStatus {
  healthy: boolean
  url: string
  message: string
  version?: string
  lastChecked?: string
}

// ============ Storage Keys ============

const STORAGE_KEY_PREFIX = "claudia-gitea-config"

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}-${userId}`
}

// ============ Default Configuration ============

/**
 * Default Gitea URL for all-in-one container
 * Gitea runs on port 3000 internally in the bundled container
 * (mapped from internal Gitea port)
 */
export const DEFAULT_GITEA_URL = process.env.NEXT_PUBLIC_GITEA_URL || "http://localhost:3000"

export function createDefaultGiteaConfig(): GiteaConfig {
  return {
    baseUrl: DEFAULT_GITEA_URL,  // Pre-configured for all-in-one container
    enabled: true,               // Enabled by default (bundled service)
    autoConnect: true,
    showStatusIndicator: true,
  }
}

// ============ CRUD Operations ============

/**
 * Get Gitea configuration for a user
 */
export function getGiteaConfig(userId: string): GiteaConfig {
  if (typeof window === "undefined") {
    return createDefaultGiteaConfig()
  }

  try {
    const stored = localStorage.getItem(getStorageKey(userId))
    if (!stored) {
      return createDefaultGiteaConfig()
    }

    const config = JSON.parse(stored) as GiteaConfig

    // Decrypt sensitive values
    if (config.authToken) {
      config.authToken = decryptValue(config.authToken, userId)
    }

    return config
  } catch (error) {
    console.error("Failed to load Gitea config:", error)
    return createDefaultGiteaConfig()
  }
}

/**
 * Save Gitea configuration for a user
 */
export function saveGiteaConfig(userId: string, config: GiteaConfig): void {
  if (typeof window === "undefined") return

  // Clone config for storage
  const toStore: GiteaConfig = { ...config }

  // Encrypt sensitive values before storing
  if (toStore.authToken) {
    toStore.authToken = encryptValue(toStore.authToken, userId)
  }

  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(toStore))

    // Dispatch event for reactive updates
    window.dispatchEvent(new CustomEvent("gitea-config-changed", {
      detail: { userId, config }
    }))
  } catch (error) {
    console.error("Failed to save Gitea config:", error)
    throw error
  }
}

/**
 * Update specific fields in Gitea configuration
 */
export function updateGiteaConfig(
  userId: string,
  updates: Partial<GiteaConfig>
): GiteaConfig {
  const current = getGiteaConfig(userId)

  const updated: GiteaConfig = {
    ...current,
    ...updates,
  }

  saveGiteaConfig(userId, updated)
  return updated
}

/**
 * Delete Gitea configuration for a user
 */
export function deleteGiteaConfig(userId: string): void {
  if (typeof window === "undefined") return

  localStorage.removeItem(getStorageKey(userId))

  window.dispatchEvent(new CustomEvent("gitea-config-changed", {
    detail: { userId, config: null }
  }))
}

// ============ Helpers ============

/**
 * Check if Gitea is configured for a user
 * Note: Gitea is pre-configured by default in all-in-one container
 */
export function isGiteaConfigured(userId: string): boolean {
  const config = getGiteaConfig(userId)
  return config.enabled && !!config.baseUrl && config.baseUrl.length > 0
}

/**
 * Get the effective Gitea URL for a user
 */
export function getGiteaUrl(userId: string): string | null {
  const config = getGiteaConfig(userId)
  if (!config.enabled || !config.baseUrl) {
    return null
  }
  // Ensure URL doesn't have trailing slash
  return config.baseUrl.replace(/\/+$/, "")
}

/**
 * Subscribe to Gitea configuration changes
 */
export function subscribeToGiteaConfig(
  userId: string,
  callback: (config: GiteaConfig | null) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {}
  }

  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail.userId === userId) {
      callback(detail.config)
    }
  }

  window.addEventListener("gitea-config-changed", handler)
  return () => window.removeEventListener("gitea-config-changed", handler)
}

// ============ URL Validation ============

/**
 * Validate Gitea URL format
 */
export function validateGiteaUrl(url: string): { valid: boolean; error?: string } {
  if (!url) {
    return { valid: false, error: "URL is required" }
  }

  try {
    const parsed = new URL(url)

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: "URL must use HTTP or HTTPS" }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: "Invalid URL format" }
  }
}

/**
 * Build Gitea API URL
 */
export function buildGiteaApiUrl(userId: string, endpoint: string): string | null {
  const config = getGiteaConfig(userId)

  if (!config.enabled || !config.baseUrl) {
    return null
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, "")
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`

  return `${baseUrl}/api/v1${cleanEndpoint}`
}

/**
 * Build iframe URL for Gitea web interface
 */
export function buildIframeUrl(userId: string): string | null {
  const config = getGiteaConfig(userId)

  if (!config.enabled || !config.baseUrl) {
    return null
  }

  return config.baseUrl.replace(/\/+$/, "")
}
