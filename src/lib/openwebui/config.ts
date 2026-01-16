/**
 * Open Web UI Configuration Management
 *
 * Manages per-user Open Web UI settings including:
 * - Instance URL configuration
 * - Authentication token storage
 * - Connection preferences
 *
 * Settings are stored in localStorage with encryption for sensitive values.
 */

import { encryptValue, decryptValue } from "@/lib/data/user-settings"

// ============ Types ============

export interface OpenWebUIConfig {
  // Instance URL (user-configurable)
  baseUrl: string

  // Authentication
  authToken?: string  // Encrypted - for SSO/token passing

  // Preferences
  enabled: boolean
  autoConnect: boolean

  // Display preferences
  defaultFullscreen: boolean
  showStatusIndicator: boolean
}

export interface OpenWebUIConnectionStatus {
  healthy: boolean
  url: string
  message: string
  version?: string
  lastChecked?: string
}

// ============ Storage Keys ============

const STORAGE_KEY_PREFIX = "claudia-openwebui-config"

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}-${userId}`
}

// ============ Default Configuration ============

/**
 * Default OpenWebUI URL for all-in-one container
 * OpenWebUI runs on port 8080 in the bundled container
 */
export const DEFAULT_OPENWEBUI_URL = process.env.NEXT_PUBLIC_OPENWEBUI_URL || "http://localhost:8080"

export function createDefaultOpenWebUIConfig(): OpenWebUIConfig {
  return {
    baseUrl: DEFAULT_OPENWEBUI_URL,  // Pre-configured for all-in-one container
    enabled: true,
    autoConnect: true,
    defaultFullscreen: false,
    showStatusIndicator: true,
  }
}

// ============ CRUD Operations ============

/**
 * Get Open Web UI configuration for a user
 */
export function getOpenWebUIConfig(userId: string): OpenWebUIConfig {
  if (typeof window === "undefined") {
    return createDefaultOpenWebUIConfig()
  }

  try {
    const stored = localStorage.getItem(getStorageKey(userId))
    if (!stored) {
      return createDefaultOpenWebUIConfig()
    }

    const config = JSON.parse(stored) as OpenWebUIConfig

    // Decrypt sensitive values
    if (config.authToken) {
      config.authToken = decryptValue(config.authToken, userId)
    }

    return config
  } catch (error) {
    console.error("Failed to load Open Web UI config:", error)
    return createDefaultOpenWebUIConfig()
  }
}

/**
 * Save Open Web UI configuration for a user
 */
export function saveOpenWebUIConfig(userId: string, config: OpenWebUIConfig): void {
  if (typeof window === "undefined") return

  // Clone config for storage
  const toStore: OpenWebUIConfig = { ...config }

  // Encrypt sensitive values before storing
  if (toStore.authToken) {
    toStore.authToken = encryptValue(toStore.authToken, userId)
  }

  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(toStore))

    // Dispatch event for reactive updates
    window.dispatchEvent(new CustomEvent("openwebui-config-changed", {
      detail: { userId, config }
    }))
  } catch (error) {
    console.error("Failed to save Open Web UI config:", error)
    throw error
  }
}

/**
 * Update specific fields in Open Web UI configuration
 */
export function updateOpenWebUIConfig(
  userId: string,
  updates: Partial<OpenWebUIConfig>
): OpenWebUIConfig {
  const current = getOpenWebUIConfig(userId)

  const updated: OpenWebUIConfig = {
    ...current,
    ...updates,
  }

  saveOpenWebUIConfig(userId, updated)
  return updated
}

/**
 * Delete Open Web UI configuration for a user
 */
export function deleteOpenWebUIConfig(userId: string): void {
  if (typeof window === "undefined") return

  localStorage.removeItem(getStorageKey(userId))

  window.dispatchEvent(new CustomEvent("openwebui-config-changed", {
    detail: { userId, config: null }
  }))
}

// ============ Helpers ============

/**
 * Check if Open Web UI is configured for a user
 */
export function isOpenWebUIConfigured(userId: string): boolean {
  const config = getOpenWebUIConfig(userId)
  return config.enabled && !!config.baseUrl && config.baseUrl.length > 0
}

/**
 * Get the effective Open Web UI URL for a user
 */
export function getOpenWebUIUrl(userId: string): string | null {
  const config = getOpenWebUIConfig(userId)
  if (!config.enabled || !config.baseUrl) {
    return null
  }
  // Ensure URL doesn't have trailing slash
  return config.baseUrl.replace(/\/+$/, "")
}

/**
 * Subscribe to Open Web UI configuration changes
 */
export function subscribeToOpenWebUIConfig(
  userId: string,
  callback: (config: OpenWebUIConfig | null) => void
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

  window.addEventListener("openwebui-config-changed", handler)
  return () => window.removeEventListener("openwebui-config-changed", handler)
}

// ============ URL Validation ============

/**
 * Validate Open Web UI URL format
 */
export function validateOpenWebUIUrl(url: string): { valid: boolean; error?: string } {
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
 * Build iframe URL with optional auth token
 */
export function buildIframeUrl(userId: string): string | null {
  const config = getOpenWebUIConfig(userId)

  if (!config.enabled || !config.baseUrl) {
    return null
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, "")

  // If auth token is provided, we could append it as a query param
  // This depends on how Open Web UI handles SSO/token auth
  // For now, we return the base URL and handle auth separately
  return baseUrl
}
