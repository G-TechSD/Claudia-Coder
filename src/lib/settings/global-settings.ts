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
  provider: "anthropic" | "openai" | "google"
  enabled: boolean
  apiKey?: string
  enabledModels: string[]
  isDefault?: boolean  // Is this the default cloud provider
  authMethod?: "api_key" | "oauth"  // How the user authenticated
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
  const beastUrl = process.env.NEXT_PUBLIC_LMSTUDIO_BEAST
  const bedroomUrl = process.env.NEXT_PUBLIC_LMSTUDIO_BEDROOM

  const localServers: LocalServerConfig[] = []

  if (beastUrl) {
    localServers.push({
      id: "beast",
      name: "BEAST",
      type: "lmstudio",
      baseUrl: beastUrl,
      enabled: true,
      defaultModel: "gpt-oss-20b"  // Default model for BEAST
    })
  }

  if (bedroomUrl) {
    localServers.push({
      id: "bedroom",
      name: "Bedroom",
      type: "lmstudio",
      baseUrl: bedroomUrl,
      enabled: true
    })
  }

  // Set default model to BEAST with gpt-oss-20b if available
  const defaultModel: DefaultModelConfig | undefined = beastUrl ? {
    provider: "lmstudio",
    serverId: "beast",
    modelId: "gpt-oss-20b",
    displayName: "GPT-OSS 20B (BEAST)"
  } : undefined

  return {
    setupComplete: false,
    localServers,
    cloudProviders: [
      { provider: "anthropic", enabled: false, enabledModels: [] },
      { provider: "openai", enabled: false, enabledModels: [] },
      { provider: "google", enabled: false, enabledModels: [] }
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
