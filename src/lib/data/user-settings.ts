/**
 * User Settings Data Layer
 * Manages per-user settings including n8n configuration and API keys
 *
 * Settings are stored per-user in localStorage with encryption for sensitive values.
 * Server-side settings are stored in the SQLite database.
 */

// ============ Types ============

export type N8NInstanceMode = "shared" | "personal"

export interface UserN8NConfig {
  mode: N8NInstanceMode

  // For personal n8n instance
  personalInstance?: {
    baseUrl: string
    apiKey: string  // Encrypted
  }

  // For shared instance - namespace/tag for isolation
  sharedNamespace?: {
    prefix: string      // e.g., "user-abc123"
    tag: string         // e.g., "claudia-user-abc123"
  }

  // Preferences
  autoCreateWorkflows: boolean
  defaultWorkflowTags: string[]
}

export interface UserApiKeys {
  anthropic?: string    // Encrypted
  openai?: string       // Encrypted
  google?: string       // Encrypted
  n8n?: string          // Encrypted (for personal instance)
}

export interface UserSettings {
  id: string           // Matches user ID from auth

  // n8n configuration
  n8n: UserN8NConfig

  // API keys (encrypted)
  apiKeys: UserApiKeys

  // Preferences
  defaultLocalServer?: string
  preferLocalLLM: boolean
  allowPaidLLM: boolean

  // Timestamps
  createdAt: string
  updatedAt: string
}

// ============ Encryption Utilities ============

/**
 * Simple encryption for client-side storage.
 * Uses base64 encoding with a user-specific salt.
 *
 * Note: This is NOT cryptographically secure for sensitive data.
 * For production, use proper encryption with a server-side key.
 * This provides basic obfuscation to prevent casual snooping.
 */
const ENCRYPTION_VERSION = "v1"

function getEncryptionKey(userId: string): string {
  // In a real app, this would be derived from a secure source
  // For now, we use a combination of userId and a fixed salt
  return `claudia-${userId}-settings-key`
}

export function encryptValue(value: string, userId: string): string {
  if (!value) return ""

  const key = getEncryptionKey(userId)
  // XOR each character with the key (simple obfuscation)
  let encrypted = ""
  for (let i = 0; i < value.length; i++) {
    const charCode = value.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    encrypted += String.fromCharCode(charCode)
  }

  // Base64 encode and add version prefix
  return `${ENCRYPTION_VERSION}:${btoa(encrypted)}`
}

export function decryptValue(encrypted: string, userId: string): string {
  if (!encrypted) return ""

  // Check version prefix
  if (!encrypted.startsWith(`${ENCRYPTION_VERSION}:`)) {
    // Try to decode as plain base64 for backwards compatibility
    try {
      return atob(encrypted)
    } catch {
      return encrypted // Return as-is if decryption fails
    }
  }

  const key = getEncryptionKey(userId)
  const encodedValue = encrypted.slice(ENCRYPTION_VERSION.length + 1)

  try {
    const decoded = atob(encodedValue)
    let decrypted = ""
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      decrypted += String.fromCharCode(charCode)
    }
    return decrypted
  } catch {
    return "" // Return empty string if decryption fails
  }
}

// ============ Storage Keys ============

const STORAGE_KEY_PREFIX = "claudia-user-settings"

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}-${userId}`
}

// ============ Default Settings ============

export function createDefaultUserSettings(userId: string): UserSettings {
  return {
    id: userId,
    n8n: {
      mode: "shared",
      sharedNamespace: {
        prefix: `user-${userId.slice(0, 8)}`,
        tag: `claudia-user-${userId.slice(0, 8)}`,
      },
      autoCreateWorkflows: true,
      defaultWorkflowTags: ["claudia-managed"],
    },
    apiKeys: {},
    preferLocalLLM: true,
    allowPaidLLM: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ============ CRUD Operations ============

/**
 * Get user settings from localStorage
 */
export function getUserSettings(userId: string): UserSettings | null {
  if (typeof window === "undefined") return null

  try {
    const stored = localStorage.getItem(getStorageKey(userId))
    if (!stored) return null

    const settings = JSON.parse(stored) as UserSettings

    // Decrypt sensitive values
    if (settings.apiKeys) {
      if (settings.apiKeys.anthropic) {
        settings.apiKeys.anthropic = decryptValue(settings.apiKeys.anthropic, userId)
      }
      if (settings.apiKeys.openai) {
        settings.apiKeys.openai = decryptValue(settings.apiKeys.openai, userId)
      }
      if (settings.apiKeys.google) {
        settings.apiKeys.google = decryptValue(settings.apiKeys.google, userId)
      }
      if (settings.apiKeys.n8n) {
        settings.apiKeys.n8n = decryptValue(settings.apiKeys.n8n, userId)
      }
    }

    if (settings.n8n?.personalInstance?.apiKey) {
      settings.n8n.personalInstance.apiKey = decryptValue(
        settings.n8n.personalInstance.apiKey,
        userId
      )
    }

    return settings
  } catch (error) {
    console.error("Failed to load user settings:", error)
    return null
  }
}

/**
 * Get user settings or create defaults if not found
 */
export function getOrCreateUserSettings(userId: string): UserSettings {
  const existing = getUserSettings(userId)
  if (existing) return existing

  const defaults = createDefaultUserSettings(userId)
  saveUserSettings(defaults)
  return defaults
}

/**
 * Save user settings to localStorage
 */
export function saveUserSettings(settings: UserSettings): void {
  if (typeof window === "undefined") return

  const userId = settings.id

  // Clone settings for storage
  const toStore: UserSettings = JSON.parse(JSON.stringify(settings))

  // Encrypt sensitive values before storing
  if (toStore.apiKeys) {
    if (toStore.apiKeys.anthropic) {
      toStore.apiKeys.anthropic = encryptValue(toStore.apiKeys.anthropic, userId)
    }
    if (toStore.apiKeys.openai) {
      toStore.apiKeys.openai = encryptValue(toStore.apiKeys.openai, userId)
    }
    if (toStore.apiKeys.google) {
      toStore.apiKeys.google = encryptValue(toStore.apiKeys.google, userId)
    }
    if (toStore.apiKeys.n8n) {
      toStore.apiKeys.n8n = encryptValue(toStore.apiKeys.n8n, userId)
    }
  }

  if (toStore.n8n?.personalInstance?.apiKey) {
    toStore.n8n.personalInstance.apiKey = encryptValue(
      toStore.n8n.personalInstance.apiKey,
      userId
    )
  }

  // Update timestamp
  toStore.updatedAt = new Date().toISOString()

  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(toStore))

    // Dispatch event for reactive updates
    window.dispatchEvent(new CustomEvent("user-settings-changed", {
      detail: { userId, settings }
    }))
  } catch (error) {
    console.error("Failed to save user settings:", error)
    throw error
  }
}

/**
 * Update specific fields in user settings
 */
export function updateUserSettings(
  userId: string,
  updates: Partial<Omit<UserSettings, "id" | "createdAt">>
): UserSettings {
  const current = getOrCreateUserSettings(userId)

  const updated: UserSettings = {
    ...current,
    ...updates,
    id: userId,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  }

  // Deep merge n8n config if provided
  if (updates.n8n) {
    updated.n8n = {
      ...current.n8n,
      ...updates.n8n,
    }
    if (updates.n8n.personalInstance) {
      updated.n8n.personalInstance = {
        ...current.n8n.personalInstance,
        ...updates.n8n.personalInstance,
      }
    }
    if (updates.n8n.sharedNamespace) {
      updated.n8n.sharedNamespace = {
        ...current.n8n.sharedNamespace,
        ...updates.n8n.sharedNamespace,
      }
    }
  }

  // Deep merge apiKeys if provided
  if (updates.apiKeys) {
    updated.apiKeys = {
      ...current.apiKeys,
      ...updates.apiKeys,
    }
  }

  saveUserSettings(updated)
  return updated
}

/**
 * Delete user settings
 */
export function deleteUserSettings(userId: string): void {
  if (typeof window === "undefined") return

  localStorage.removeItem(getStorageKey(userId))

  window.dispatchEvent(new CustomEvent("user-settings-changed", {
    detail: { userId, settings: null }
  }))
}

// ============ N8N-Specific Helpers ============

/**
 * Get the n8n configuration for a user
 */
export function getUserN8NConfig(userId: string): UserN8NConfig {
  const settings = getOrCreateUserSettings(userId)
  return settings.n8n
}

/**
 * Update user's n8n configuration
 */
export function updateUserN8NConfig(
  userId: string,
  config: Partial<UserN8NConfig>
): UserN8NConfig {
  const settings = getOrCreateUserSettings(userId)

  const updatedConfig: UserN8NConfig = {
    ...settings.n8n,
    ...config,
  }

  if (config.personalInstance) {
    updatedConfig.personalInstance = {
      ...settings.n8n.personalInstance,
      ...config.personalInstance,
    }
  }

  if (config.sharedNamespace) {
    updatedConfig.sharedNamespace = {
      ...settings.n8n.sharedNamespace,
      ...config.sharedNamespace,
    }
  }

  updateUserSettings(userId, { n8n: updatedConfig })
  return updatedConfig
}

/**
 * Check if user has personal n8n instance configured
 */
export function hasPersonalN8NInstance(userId: string): boolean {
  const config = getUserN8NConfig(userId)
  return (
    config.mode === "personal" &&
    !!config.personalInstance?.baseUrl &&
    !!config.personalInstance?.apiKey
  )
}

/**
 * Get the workflow tag for a user (for filtering workflows)
 */
export function getUserWorkflowTag(userId: string): string {
  const config = getUserN8NConfig(userId)
  if (config.mode === "personal") {
    // For personal instances, no tag filtering needed
    return ""
  }
  return config.sharedNamespace?.tag || `claudia-user-${userId.slice(0, 8)}`
}

/**
 * Get the workflow name prefix for a user
 */
export function getUserWorkflowPrefix(userId: string): string {
  const config = getUserN8NConfig(userId)
  if (config.mode === "personal") {
    // For personal instances, use just "Claudia" as prefix
    return "Claudia"
  }
  return config.sharedNamespace?.prefix || `user-${userId.slice(0, 8)}`
}

// ============ API Key Helpers ============

/**
 * Get a specific API key for a user
 */
export function getUserApiKey(userId: string, provider: keyof UserApiKeys): string | undefined {
  const settings = getOrCreateUserSettings(userId)
  return settings.apiKeys[provider]
}

/**
 * Set a specific API key for a user
 */
export function setUserApiKey(
  userId: string,
  provider: keyof UserApiKeys,
  apiKey: string | undefined
): void {
  const settings = getOrCreateUserSettings(userId)
  settings.apiKeys[provider] = apiKey
  saveUserSettings(settings)
}

/**
 * Check if user has a specific API key configured
 */
export function hasUserApiKey(userId: string, provider: keyof UserApiKeys): boolean {
  const key = getUserApiKey(userId, provider)
  return !!key && key.length > 0
}

// ============ Event Subscription ============

/**
 * Subscribe to user settings changes
 */
export function subscribeToUserSettings(
  userId: string,
  callback: (settings: UserSettings | null) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {}
  }

  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail.userId === userId) {
      callback(detail.settings)
    }
  }

  window.addEventListener("user-settings-changed", handler)
  return () => window.removeEventListener("user-settings-changed", handler)
}
