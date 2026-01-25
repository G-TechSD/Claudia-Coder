/**
 * Global App Settings
 * Manages app-wide configuration including default AI providers and models
 */

export interface LocalServerConfig {
  id: string
  name: string
  type: "lmstudio" | "ollama" | "custom"
  baseUrl: string
  apiKey?: string
  enabled: boolean
  defaultModel?: string  // Selected default model for this server
}

export interface CloudProviderConfig {
  provider: "anthropic" | "openai" | "google" | "claude-code"
  enabled: boolean
  apiKey?: string
  enabledModels: string[]
  isDefault?: boolean  // Is this the default cloud provider
  // OAuth-specific fields (for Anthropic with Google sign-in)
  authMethod?: "apiKey" | "oauth"
  oauthTokens?: {
    accessToken: string
    refreshToken?: string
    expiresAt?: number
    idToken?: string
  }
  oauthUser?: {
    email: string
    name?: string
    picture?: string
  }
}

/**
 * Claude Code Max Provider Configuration
 * Uses the Claude Code CLI with Max subscription - no API key needed
 */
export interface ClaudeCodeMaxConfig {
  enabled: boolean
  // No API key needed - uses Max subscription authentication via CLI
}

export interface DefaultModelConfig {
  provider: string
  serverId?: string  // For local providers
  modelId: string
  displayName: string
}

export interface GlobalSettings {
  // Setup state
  setupComplete: boolean
  setupCompletedAt?: string

  // Local servers
  localServers: LocalServerConfig[]

  // Cloud providers
  cloudProviders: CloudProviderConfig[]

  // Default model for new projects
  defaultModel?: DefaultModelConfig

  // App preferences
  preferLocalModels: boolean
  autoRouteByTaskType: boolean

  // Launch & Test settings
  defaultLaunchHost?: string  // Default hostname/IP for Launch Test (e.g., "192.168.1.100" or "myserver.local")
}

const SETTINGS_KEY = "claudia_global_settings"
const SETTINGS_SYNC_KEY = "claudia_global_settings_synced_at"

/**
 * Get global settings from localStorage (synchronous)
 * This returns the cached version. Use fetchGlobalSettingsFromServer() for server data.
 */
export function getGlobalSettings(): GlobalSettings {
  if (typeof window === "undefined") {
    return createDefaultSettings()
  }

  const stored = localStorage.getItem(SETTINGS_KEY)
  if (!stored) {
    return createDefaultSettings()
  }

  try {
    return JSON.parse(stored) as GlobalSettings
  } catch {
    return createDefaultSettings()
  }
}

/**
 * Save global settings to localStorage (synchronous)
 * Also triggers async sync to server in the background.
 */
export function saveGlobalSettings(settings: GlobalSettings): void {
  if (typeof window === "undefined") return
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))

  // Trigger async server sync (fire and forget)
  syncGlobalSettingsToServer(settings).catch(err => {
    console.warn("[GlobalSettings] Background sync failed:", err)
  })
}

/**
 * Fetch global settings from the server
 * Returns null if fetch fails or user is not authenticated
 */
export async function fetchGlobalSettingsFromServer(): Promise<GlobalSettings | null> {
  if (typeof window === "undefined") return null

  console.log("[GlobalSettings] Fetching settings from server...")

  try {
    const response = await fetch("/api/settings", {
      method: "GET",
      credentials: "include"
    })

    console.log("[GlobalSettings] Fetch response status:", response.status)

    if (!response.ok) {
      if (response.status === 401) {
        console.log("[GlobalSettings] Not authenticated, using localStorage")
        return null
      }
      throw new Error(`Server returned ${response.status}`)
    }

    const data = await response.json()
    console.log("[GlobalSettings] Fetch response:", { success: data.success, exists: data.exists, hasGlobalSettings: !!data.globalSettings })

    if (!data.success) {
      console.warn("[GlobalSettings] Server returned error:", data.error)
      return null
    }

    if (!data.exists || !data.globalSettings) {
      console.log("[GlobalSettings] No server settings found")
      return null
    }

    console.log("[GlobalSettings] Got settings from server, defaultLaunchHost:", data.globalSettings.defaultLaunchHost)

    // Cache to localStorage
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.globalSettings))
    localStorage.setItem(SETTINGS_SYNC_KEY, new Date().toISOString())

    return data.globalSettings as GlobalSettings
  } catch (error) {
    console.error("[GlobalSettings] Failed to fetch from server:", error)
    return null
  }
}

/**
 * Sync global settings to the server
 * Automatically creates/updates server record - no separate migration needed
 * Returns true if successful, false otherwise
 */
export async function syncGlobalSettingsToServer(settings: GlobalSettings): Promise<boolean> {
  if (typeof window === "undefined") return false

  console.log("[GlobalSettings] Syncing to server, defaultLaunchHost:", settings.defaultLaunchHost)

  try {
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ globalSettings: settings })
    })

    console.log("[GlobalSettings] Server response status:", response.status)

    if (!response.ok) {
      if (response.status === 401) {
        console.log("[GlobalSettings] Not authenticated, skipping server sync")
        return false
      }
      const errorText = await response.text()
      console.error("[GlobalSettings] Server sync failed:", response.status, errorText)
      return false
    }

    const data = await response.json()
    console.log("[GlobalSettings] Server response data:", data)

    if (data.success) {
      localStorage.setItem(SETTINGS_SYNC_KEY, new Date().toISOString())
      console.log("[GlobalSettings] Settings synced to server successfully")
      return true
    }

    console.warn("[GlobalSettings] Server sync returned error:", data.error)
    return false
  } catch (error) {
    console.error("[GlobalSettings] Failed to sync to server:", error)
    return false
  }
}

/**
 * Get the last time settings were synced to the server
 */
export function getLastSyncTime(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(SETTINGS_SYNC_KEY)
}

/**
 * Check if settings need to be synced (e.g., never synced or stale)
 */
export function needsSync(): boolean {
  const lastSync = getLastSyncTime()
  if (!lastSync) return true

  // Consider stale if older than 1 hour
  const lastSyncDate = new Date(lastSync)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  return lastSyncDate < oneHourAgo
}

/**
 * Migrate localStorage settings to the server
 * This should be called once when a user first accesses the settings with server sync
 */
export async function migrateSettingsToServer(): Promise<{
  success: boolean
  migrated: boolean
  error?: string
}> {
  if (typeof window === "undefined") {
    return { success: false, migrated: false, error: "Not in browser" }
  }

  try {
    // Get current localStorage settings
    const globalSettings = getGlobalSettings()

    // Get app settings if they exist
    const appSettingsStr = localStorage.getItem("claudia-settings")
    const appSettings = appSettingsStr ? JSON.parse(appSettingsStr) : {}

    // Get user-specific settings if they exist (look for any user settings key)
    const userSettingsKey = Object.keys(localStorage).find(k => k.startsWith("claudia-user-settings-"))
    const userSettings = userSettingsKey
      ? JSON.parse(localStorage.getItem(userSettingsKey) || "{}")
      : {}

    const response = await fetch("/api/settings/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        appSettings,
        globalSettings,
        userSettings: userSettings.apiKeys ? { apiKeys: userSettings.apiKeys } : undefined
      })
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, migrated: false, error: "Not authenticated" }
      }
      throw new Error(`Server returned ${response.status}`)
    }

    const data = await response.json()

    if (data.success) {
      // Update sync time
      localStorage.setItem(SETTINGS_SYNC_KEY, new Date().toISOString())
      return { success: true, migrated: data.migrated }
    }

    return { success: false, migrated: false, error: data.error }
  } catch (error) {
    return {
      success: false,
      migrated: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

/**
 * Initialize settings with server sync
 * Fetches from server if available, falls back to localStorage
 * Automatically syncs local settings to server if no server settings exist
 */
export async function initializeSettingsWithSync(): Promise<{
  settings: GlobalSettings
  source: "server" | "localStorage"
  synced: boolean
}> {
  // First try to fetch from server
  const serverSettings = await fetchGlobalSettingsFromServer()

  if (serverSettings) {
    return {
      settings: serverSettings,
      source: "server",
      synced: true
    }
  }

  // No server settings - sync local settings to server
  const localSettings = getGlobalSettings()
  const synced = await syncGlobalSettingsToServer(localSettings)

  return {
    settings: localSettings,
    source: "localStorage",
    synced
  }
}

export function createDefaultSettings(): GlobalSettings {
  // Check for pre-configured servers from environment
  const server1Url = process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_1
  const server2Url = process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_2

  const localServers: LocalServerConfig[] = []

  if (server1Url) {
    localServers.push({
      id: "local-llm-server",
      name: "Local LLM Server",
      type: "lmstudio",
      baseUrl: server1Url,
      enabled: true,
      defaultModel: "gpt-oss-20b"  // Default model for Local LLM Server
    })
  }

  if (server2Url) {
    localServers.push({
      id: "local-llm-server-2",
      name: "Local LLM Server 2",
      type: "lmstudio",
      baseUrl: server2Url,
      enabled: true
    })
  }

  // Set default model to local-llm-server with gpt-oss-20b if available
  const defaultModel: DefaultModelConfig | undefined = server1Url ? {
    provider: "lmstudio",
    serverId: "local-llm-server",
    modelId: "gpt-oss-20b",
    displayName: "GPT-OSS 20B (Local LLM Server)"
  } : undefined

  return {
    setupComplete: false,
    localServers,
    cloudProviders: [
      { provider: "anthropic", enabled: false, enabledModels: [] },
      { provider: "openai", enabled: false, enabledModels: [] },
      { provider: "google", enabled: false, enabledModels: [] },
      { provider: "claude-code", enabled: false, enabledModels: [] }
    ],
    defaultModel,
    preferLocalModels: true,
    autoRouteByTaskType: true
  }
}

export function isSetupComplete(): boolean {
  return getGlobalSettings().setupComplete
}

export function markSetupComplete(): void {
  const settings = getGlobalSettings()
  settings.setupComplete = true
  settings.setupCompletedAt = new Date().toISOString()
  saveGlobalSettings(settings)
}

export function resetSetup(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(SETTINGS_KEY)
  window.location.reload()
}

export function addLocalServer(server: Omit<LocalServerConfig, "id">): LocalServerConfig {
  const settings = getGlobalSettings()
  const id = `server-${Date.now()}`
  const newServer: LocalServerConfig = { ...server, id }
  settings.localServers.push(newServer)
  saveGlobalSettings(settings)
  return newServer
}

export function removeLocalServer(id: string): void {
  const settings = getGlobalSettings()
  settings.localServers = settings.localServers.filter(s => s.id !== id)
  saveGlobalSettings(settings)
}

export function updateLocalServer(id: string, updates: Partial<LocalServerConfig>): void {
  const settings = getGlobalSettings()
  const index = settings.localServers.findIndex(s => s.id === id)
  if (index >= 0) {
    settings.localServers[index] = { ...settings.localServers[index], ...updates }
    saveGlobalSettings(settings)
  }
}

export function setDefaultModel(config: DefaultModelConfig): void {
  const settings = getGlobalSettings()
  settings.defaultModel = config
  saveGlobalSettings(settings)
}

export function getDefaultModel(): DefaultModelConfig | undefined {
  return getGlobalSettings().defaultModel
}

export function updateCloudProvider(
  provider: CloudProviderConfig["provider"],
  updates: Partial<CloudProviderConfig>
): void {
  const settings = getGlobalSettings()
  const index = settings.cloudProviders.findIndex(p => p.provider === provider)
  if (index >= 0) {
    settings.cloudProviders[index] = { ...settings.cloudProviders[index], ...updates }
    saveGlobalSettings(settings)
  }
}

export function getEnabledProviders(): {
  local: LocalServerConfig[]
  cloud: CloudProviderConfig[]
} {
  const settings = getGlobalSettings()
  return {
    local: settings.localServers.filter(s => s.enabled),
    cloud: settings.cloudProviders.filter(p => p.enabled)
  }
}

export function getDefaultLaunchHost(): string | undefined {
  return getGlobalSettings().defaultLaunchHost
}

export function setDefaultLaunchHost(host: string | undefined): void {
  const settings = getGlobalSettings()
  settings.defaultLaunchHost = host
  saveGlobalSettings(settings)
}

/**
 * Get the effective default model configuration
 *
 * Priority:
 * 1. If explicit default is set, use it
 * 2. If local servers are configured, use the FIRST one as default
 * 3. If cloud providers are configured (with API key), use the first one
 * 4. Otherwise return null (no default)
 *
 * IMPORTANT: Prefers local servers over cloud providers
 */
export function getEffectiveDefaultModel(): DefaultModelConfig | null {
  const settings = getGlobalSettings()

  // If explicit default is set, use it
  if (settings.defaultModel?.modelId) {
    return settings.defaultModel
  }

  // Get all configured providers
  const configuredLocalServers = settings.localServers.filter(s => s.baseUrl && s.enabled)
  const configuredCloudProviders = settings.cloudProviders.filter(p => p.apiKey && p.enabled)

  // Prefer local servers - use FIRST configured local server as default
  if (configuredLocalServers.length > 0) {
    const server = configuredLocalServers[0]
    return {
      provider: server.type, // "lmstudio" | "ollama" | "custom"
      serverId: server.id,
      modelId: server.defaultModel || "auto",
      displayName: server.defaultModel
        ? `${server.defaultModel} (${server.name})`
        : `Auto (${server.name})`
    }
  }

  // Fall back to first cloud provider with API key
  if (configuredCloudProviders.length > 0) {
    const provider = configuredCloudProviders[0]
    const modelId = provider.enabledModels[0] || "auto"
    return {
      provider: provider.provider, // "anthropic" | "openai" | "google"
      modelId,
      displayName: `${modelId} (${provider.provider})`
    }
  }

  // No providers configured
  return null
}
