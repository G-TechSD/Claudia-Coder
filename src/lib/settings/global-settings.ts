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
}

const SETTINGS_KEY = "claudia_global_settings"

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

export function saveGlobalSettings(settings: GlobalSettings): void {
  if (typeof window === "undefined") return
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
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

/**
 * Get the effective default model configuration
 *
 * Priority:
 * 1. If explicit default is set, use it
 * 2. If only one provider is configured, use it as default
 * 3. Otherwise return null (no default)
 *
 * IMPORTANT: Does NOT default to Claude API - only uses it if explicitly selected
 */
export function getEffectiveDefaultModel(): DefaultModelConfig | null {
  const settings = getGlobalSettings()

  // If explicit default is set, use it
  if (settings.defaultModel?.modelId) {
    return settings.defaultModel
  }

  // If only one provider is configured, use it as default
  const configuredLocalServers = settings.localServers.filter(s => s.baseUrl && s.enabled)
  const configuredCloudProviders = settings.cloudProviders.filter(p => p.apiKey && p.enabled)

  const totalConfigured = configuredLocalServers.length + configuredCloudProviders.length

  if (totalConfigured === 1) {
    // Only one provider configured - use it as default
    if (configuredLocalServers.length === 1) {
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

    if (configuredCloudProviders.length === 1) {
      const provider = configuredCloudProviders[0]
      // Use first enabled model, or "auto" if none specified
      const modelId = provider.enabledModels[0] || "auto"
      return {
        provider: provider.provider, // "anthropic" | "openai" | "google"
        modelId,
        displayName: `${modelId} (${provider.provider})`
      }
    }
  }

  // Multiple providers or no providers configured - no automatic default
  return null
}
