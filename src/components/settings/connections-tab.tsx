"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  getGlobalSettings,
  updateLocalServer,
} from "@/lib/settings/global-settings"
import {
  ExternalLink,
  Cpu,
  Cloud,
  GitBranch,
  Loader2,
  RotateCcw,
  Star,
  Workflow,
  Settings2,
  Pencil,
  Trash2,
  Key,
  CheckCircle
} from "lucide-react"

// Fallback models if dynamic fetch fails - these should be kept up to date
// The UI should prefer dynamically fetched models from /api/models endpoint
const FALLBACK_PROVIDER_MODELS: Record<string, { id: string; name: string }[]> = {
  anthropic: [
    { id: "claude-opus-4-5-20251101", name: "Claude Opus 4.5" },
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
    { id: "claude-opus-4-20250514", name: "Claude Opus 4" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
  ],
  openai: [
    { id: "gpt-4.5-preview", name: "GPT-4.5 Preview" },
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "o3", name: "o3" },
    { id: "o3-mini", name: "o3-mini" },
    { id: "o1", name: "o1" },
    { id: "o1-mini", name: "o1-mini" },
  ],
  google: [
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    { id: "gemini-2.0-flash-thinking", name: "Gemini 2.0 Flash Thinking" },
  ],
}

// LocalStorage keys for default provider preferences
const DEFAULT_AI_PROVIDER_KEY = "claudia_default_ai_provider"
const PROVIDER_DEFAULT_MODEL_KEY_PREFIX = "claudia_provider_default_model_"

export interface ServiceStatus {
  id?: string
  name: string
  url: string
  status: "connected" | "disconnected" | "error" | "not_configured"
  statusMessage?: string  // Additional status context (e.g., "N8N is not configured")
  latency?: number
  type?: "local" | "api" | "git"
  serverType?: "lmstudio" | "ollama" | "custom"
  apiKey?: string
  // OAuth-specific fields (for Anthropic)
  authMethod?: "apiKey" | "oauth"
  oauthUser?: {
    email: string
    name?: string
    picture?: string
  }
}

// Connection categories
type ConnectionCategory = "ai" | "git" | "automation" | "other"

interface CategorizedConnection {
  service: ServiceStatus
  category: ConnectionCategory
  providerId?: string
}

// Helper to categorize connections
function categorizeConnection(service: ServiceStatus): CategorizedConnection {
  const name = service.name.toLowerCase()
  const url = service.url.toLowerCase()

  // AI Service Providers
  if (name.includes("lm studio") || name.includes("primary-llm") || name.includes("secondary-llm") ||
      name.includes("ollama") || service.serverType) {
    const providerId = name.includes("primary-llm") ? "primary-llm" :
                       name.includes("secondary-llm") ? "secondary-llm" :
                       service.id || name.replace(/\s+/g, "-").toLowerCase()
    return { service, category: "ai", providerId }
  }
  if (name.includes("claude") || name.includes("anthropic") || url.includes("anthropic")) {
    return { service, category: "ai", providerId: "anthropic" }
  }
  if (name.includes("openai") || name.includes("gpt") || url.includes("openai")) {
    return { service, category: "ai", providerId: "openai" }
  }
  if (name.includes("google") || name.includes("gemini") || url.includes("google")) {
    return { service, category: "ai", providerId: "google" }
  }

  // Git Providers
  if (name.includes("gitlab") || name.includes("github") || name.includes("git") ||
      url.includes("gitlab") || url.includes("github")) {
    return { service, category: "git" }
  }

  // Automation
  if (name.includes("n8n") || url.includes("5678") || name.includes("automation") ||
      name.includes("webhook")) {
    return { service, category: "automation" }
  }

  // Other
  return { service, category: "other" }
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  connected: { label: "Connected", color: "text-green-400", bg: "bg-green-400" },
  disconnected: { label: "Disconnected", color: "text-muted-foreground", bg: "bg-muted-foreground" },
  error: { label: "Error", color: "text-red-400", bg: "bg-red-400" },
  not_configured: { label: "Not Configured", color: "text-amber-400", bg: "bg-amber-400" }
}

interface ConnectionsTabProps {
  services: ServiceStatus[]
  setAddServerDialog: (open: boolean) => void
  setAddApiDialog: (open: boolean) => void
  setAddGitDialog: (open: boolean) => void
  handleResetSetup: () => void
  handleOpenEditConnection?: (service: ServiceStatus) => void
  handleOpenDeleteConnection?: (service: ServiceStatus) => void
}

export function ConnectionsTab({
  services,
  setAddServerDialog,
  setAddApiDialog,
  setAddGitDialog,
  handleResetSetup,
  handleOpenEditConnection,
  handleOpenDeleteConnection
}: ConnectionsTabProps) {
  // Default AI provider state
  const [defaultAiProvider, setDefaultAiProvider] = useState<string>("")
  // Per-provider default models state
  const [providerDefaultModels, setProviderDefaultModels] = useState<Record<string, string>>({})
  // LM Studio models cache (fetched on demand)
  const [lmStudioModels, setLmStudioModels] = useState<Record<string, string[]>>({})
  const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({})

  // Load saved preferences from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return

    // Load default AI provider
    const savedDefaultProvider = localStorage.getItem(DEFAULT_AI_PROVIDER_KEY)
    if (savedDefaultProvider) {
      setDefaultAiProvider(savedDefaultProvider)
    }

    // Load per-provider default models
    const models: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(PROVIDER_DEFAULT_MODEL_KEY_PREFIX)) {
        const providerId = key.replace(PROVIDER_DEFAULT_MODEL_KEY_PREFIX, "")
        models[providerId] = localStorage.getItem(key) || ""
      }
    }
    setProviderDefaultModels(models)
  }, [])

  // Categorize services
  const categorizedServices = useMemo(() => {
    const categorized = services.map(categorizeConnection)
    return {
      ai: categorized.filter(c => c.category === "ai"),
      git: categorized.filter(c => c.category === "git"),
      automation: categorized.filter(c => c.category === "automation"),
      other: categorized.filter(c => c.category === "other")
    }
  }, [services])

  // Get all AI providers for the default dropdown
  const aiProviders = useMemo(() => {
    return categorizedServices.ai.map(c => ({
      id: c.providerId || c.service.name,
      name: c.service.name,
      status: c.service.status
    }))
  }, [categorizedServices.ai])

  // Auto-fetch models for connected local servers on mount
  useEffect(() => {
    // Find all connected local servers and fetch their models
    categorizedServices.ai.forEach(conn => {
      const { service, providerId } = conn
      const isLocalServer = service.serverType ||
                            service.name.toLowerCase().includes("lm studio") ||
                            service.name.toLowerCase().includes("ollama") ||
                            service.name.toLowerCase().includes("primary-llm") ||
                            service.name.toLowerCase().includes("secondary-llm")

      // Only fetch for connected local servers that haven't been fetched yet
      if (isLocalServer && service.status === "connected" && providerId && !lmStudioModels[providerId]?.length) {
        fetchLmStudioModels(providerId, service.url)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorizedServices.ai])

  // Handle default AI provider change
  function handleDefaultAiProviderChange(providerId: string) {
    setDefaultAiProvider(providerId)
    if (typeof window !== "undefined") {
      localStorage.setItem(DEFAULT_AI_PROVIDER_KEY, providerId)
    }
  }

  // Handle default model change for a provider
  function handleProviderDefaultModelChange(providerId: string, modelId: string) {
    setProviderDefaultModels(prev => ({ ...prev, [providerId]: modelId }))
    if (typeof window !== "undefined") {
      localStorage.setItem(PROVIDER_DEFAULT_MODEL_KEY_PREFIX + providerId, modelId)
    }

    // Also update global settings for local servers
    const globalSettings = getGlobalSettings()
    const server = globalSettings.localServers.find(s =>
      s.id === providerId || s.name.toLowerCase().includes(providerId.toLowerCase())
    )
    if (server) {
      updateLocalServer(server.id, { defaultModel: modelId })
    }
  }

  // Fetch models for LM Studio servers using server-side API to avoid CORS
  async function fetchLmStudioModels(providerId: string, url: string) {
    if (lmStudioModels[providerId]?.length > 0) return // Already fetched

    setLoadingModels(prev => ({ ...prev, [providerId]: true }))
    try {
      // Use server-side proxy to avoid CORS issues
      // Add cache-busting to ensure fresh data
      const response = await fetch("/api/lmstudio-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        },
        body: JSON.stringify({ url, name: providerId }),
        cache: 'no-store'
      })
      if (response.ok) {
        const data = await response.json()
        if (data.status === "connected" && data.models) {
          // Models are already filtered by the API route
          setLmStudioModels(prev => ({ ...prev, [providerId]: data.models }))
        }
      }
    } catch (error) {
      console.error("Failed to fetch models:", error)
    } finally {
      setLoadingModels(prev => ({ ...prev, [providerId]: false }))
    }
  }

  // Get external URL for a service
  function getExternalUrl(service: ServiceStatus): string | null {
    const name = service.name.toLowerCase()
    const url = service.url.toLowerCase()

    // LM Studio / Ollama - use the server URL directly
    if (name.includes("lm studio") || name.includes("ollama") ||
        name.includes("primary-llm") || name.includes("secondary-llm") || service.serverType) {
      return service.url
    }

    // Anthropic / Claude
    if (name.includes("claude") || name.includes("anthropic") || url.includes("anthropic")) {
      return "https://console.anthropic.com"
    }

    // OpenAI
    if (name.includes("openai") || name.includes("gpt") || url.includes("openai")) {
      return "https://platform.openai.com"
    }

    // Google AI
    if (name.includes("google") || name.includes("gemini") || url.includes("google")) {
      return "https://aistudio.google.com"
    }

    // GitLab
    if (name.includes("gitlab") || url.includes("gitlab")) {
      // Use the configured URL if it looks like a full URL, otherwise construct one
      if (service.url.startsWith("http")) {
        return service.url
      }
      return `https://${service.url}`
    }

    // GitHub
    if (name.includes("github") || url.includes("github")) {
      if (service.url.startsWith("http")) {
        return service.url
      }
      return `https://${service.url}`
    }

    // N8N
    if (name.includes("n8n") || url.includes("5678")) {
      return service.url.startsWith("http") ? service.url : `https://${service.url}`
    }

    // Linear
    if (name.includes("linear") || url.includes("linear")) {
      return "https://linear.app"
    }

    // Default - try to use the URL if it looks valid
    if (service.url.startsWith("http")) {
      return service.url
    }

    return null
  }

  // Handle external link click
  function handleOpenExternalLink(service: ServiceStatus) {
    const externalUrl = getExternalUrl(service)
    if (externalUrl) {
      window.open(externalUrl, "_blank", "noopener,noreferrer")
    }
  }

  // Render a connection card with model selection for AI providers
  function renderAIConnectionCard(conn: CategorizedConnection) {
    const { service, providerId } = conn
    const config = statusConfig[service.status]
    const isLocalServer = service.serverType || service.name.toLowerCase().includes("lm studio") ||
                          service.name.toLowerCase().includes("ollama")
    const isCloudProvider = ["anthropic", "openai", "google"].includes(providerId || "")
    const isDefault = defaultAiProvider === providerId

    // Get available models - prefer dynamically fetched, fall back to hardcoded
    const models = isCloudProvider
      ? FALLBACK_PROVIDER_MODELS[providerId || ""] || []
      : lmStudioModels[providerId || ""] || []

    const currentModel = providerDefaultModels[providerId || ""] || ""

    // Get API key status for cloud providers
    const hasApiKey = isCloudProvider && service.apiKey && service.apiKey.length > 0
    const maskedApiKey = hasApiKey ? `${service.apiKey?.substring(0, 7)}...${service.apiKey?.slice(-4)}` : null

    // Get external URL for this AI provider
    const externalUrl = getExternalUrl(service)

    return (
      <div
        key={service.name}
        className={cn(
          "p-4 rounded-lg border transition-colors",
          isDefault && "border-primary bg-primary/5"
        )}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("h-2 w-2 rounded-full mt-1.5", config.bg)} />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{service.name}</p>
                {isDefault && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Star className="h-3 w-3" />
                    Default
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono">{service.url}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {service.latency && (
              <span className="text-xs text-muted-foreground">
                {service.latency}ms
              </span>
            )}
            <Badge variant={
              service.status === "connected" ? "success" :
              service.status === "not_configured" ? "warning" :
              "destructive"
            }>
              {config.label}
            </Badge>
            {externalUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenExternalLink(service)}
                title={`Open ${service.name}`}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            {handleOpenEditConnection && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenEditConnection(service)}
                title="Edit connection"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {handleOpenDeleteConnection && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenDeleteConnection(service)}
                title="Delete connection"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Authentication Status for Cloud Providers */}
        {isCloudProvider && (
          <div className="mt-4 pt-4 border-t">
            {/* Anthropic with OAuth */}
            {providerId === "anthropic" && service.authMethod === "oauth" && service.oauthUser ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {service.oauthUser.picture && (
                    <img
                      src={service.oauthUser.picture}
                      alt=""
                      className="h-8 w-8 rounded-full"
                    />
                  )}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-medium">Signed in with Google</Label>
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Max Plan</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {service.oauthUser.name || service.oauthUser.email}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEditConnection?.(service)}
                  className="gap-2"
                >
                  Change Account
                </Button>
              </div>
            ) : (
              /* API Key authentication (default for OpenAI/Google, optional for Anthropic) */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-medium">API Key</Label>
                      {providerId === "anthropic" && (
                        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Pay-per-use</span>
                      )}
                    </div>
                    {hasApiKey ? (
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                          {maskedApiKey}
                        </code>
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      </div>
                    ) : (
                      <p className="text-xs text-amber-500">No API key configured</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEditConnection?.(service)}
                  className="gap-2"
                >
                  <Key className="h-3 w-3" />
                  {hasApiKey ? "Update Key" : "Add Key"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Model Selection */}
        {service.status === "connected" && (
          <div className={cn("mt-4 pt-4 border-t", isCloudProvider && "mt-3 pt-3")}>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Default Model</Label>
                <p className="text-xs text-muted-foreground">
                  Model to use when this provider is selected
                </p>
              </div>
              <div className="w-[240px]">
                {loadingModels[providerId || ""] ? (
                  <div className="flex items-center justify-center h-9 gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">Loading models...</span>
                  </div>
                ) : models.length > 0 ? (
                  <Select
                    value={currentModel}
                    onValueChange={(value) => handleProviderDefaultModelChange(providerId || "", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select default model..." />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map(model => (
                        <SelectItem
                          key={typeof model === "string" ? model : model.id}
                          value={typeof model === "string" ? model : model.id}
                        >
                          <div className="flex items-center gap-2">
                            {currentModel === (typeof model === "string" ? model : model.id) && (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            )}
                            {typeof model === "string" ? model : model.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : isLocalServer ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>No models available</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fetchLmStudioModels(providerId || "", service.url)}
                      className="h-6 px-2"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">No models configured</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render a simple connection card for non-AI services
  function renderSimpleConnectionCard(conn: CategorizedConnection) {
    const { service } = conn
    const config = statusConfig[service.status]
    const externalUrl = getExternalUrl(service)

    return (
      <div
        key={service.name}
        className="flex items-center justify-between p-3 rounded-lg border"
      >
        <div className="flex items-center gap-3">
          <div className={cn("h-2 w-2 rounded-full", config.bg)} />
          <div>
            <p className="font-medium">{service.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{service.url}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {service.latency && (
            <span className="text-xs text-muted-foreground mr-2">
              {service.latency}ms
            </span>
          )}
          <Badge variant={
            service.status === "connected" ? "success" :
            service.status === "not_configured" ? "warning" :
            "destructive"
          }>
            {config.label}
          </Badge>
          {externalUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenExternalLink(service)}
              title={`Open ${service.name}`}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          {handleOpenEditConnection && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenEditConnection(service)}
              title="Edit connection"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {handleOpenDeleteConnection && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenDeleteConnection(service)}
              title="Delete connection"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        {/* Show status message for not_configured or error states */}
        {service.statusMessage && service.status !== "connected" && (
          <p className="text-xs text-muted-foreground mt-2 ml-5">
            {service.statusMessage}
          </p>
        )}
      </div>
    )
  }

  return (
    <>
      {/* AI Service Providers Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                AI Service Providers
              </CardTitle>
              <CardDescription>Local LM Studio, Ollama, and cloud API providers</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setAddServerDialog(true)}
            >
              <Cpu className="h-4 w-4" />
              Add Local
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Default AI Provider Selector */}
          {aiProviders.length > 0 && (
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <Label className="font-medium">Default AI Provider</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Choose which provider to use by default for AI operations
                  </p>
                </div>
                <Select
                  value={defaultAiProvider}
                  onValueChange={handleDefaultAiProviderChange}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select provider..." />
                  </SelectTrigger>
                  <SelectContent>
                    {aiProviders.map(provider => (
                      <SelectItem
                        key={provider.id}
                        value={provider.id}
                        disabled={provider.status !== "connected"}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "h-2 w-2 rounded-full",
                            provider.status === "connected" ? "bg-green-500" : "bg-gray-400"
                          )} />
                          {provider.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* AI Provider Cards */}
          <div className="space-y-3">
            {categorizedServices.ai.map(renderAIConnectionCard)}
          </div>

          {categorizedServices.ai.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No AI providers configured. Add a local server or cloud API.
            </p>
          )}

          {/* Add Cloud API Button */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setAddApiDialog(true)}
          >
            <Cloud className="h-4 w-4" />
            Add Cloud API Provider
          </Button>
        </CardContent>
      </Card>

      {/* Git Providers Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Git Providers
              </CardTitle>
              <CardDescription>GitLab, GitHub, and other Git remotes</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setAddGitDialog(true)}
            >
              <GitBranch className="h-4 w-4" />
              Add Remote
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {categorizedServices.git.map(renderSimpleConnectionCard)}
          {categorizedServices.git.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No Git providers configured.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Automation Section */}
      {categorizedServices.automation.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5" />
              Automation
            </CardTitle>
            <CardDescription>n8n, webhooks, and automation services</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {categorizedServices.automation.map(renderSimpleConnectionCard)}
          </CardContent>
        </Card>
      )}

      {/* Other Integrations Section */}
      {categorizedServices.other.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Other Integrations
            </CardTitle>
            <CardDescription>Linear, Slack, and other services</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {categorizedServices.other.map(renderSimpleConnectionCard)}
          </CardContent>
        </Card>
      )}

      {/* Add New Connection */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Connection</CardTitle>
          <CardDescription>Connect a new service or agent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => setAddServerDialog(true)}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-dashed hover:border-primary hover:bg-accent/50 transition-colors"
            >
              <Cpu className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium text-sm">LM Studio</p>
                <p className="text-xs text-muted-foreground">Local AI model</p>
              </div>
            </button>
            <button
              onClick={() => setAddApiDialog(true)}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-dashed hover:border-primary hover:bg-accent/50 transition-colors"
            >
              <Cloud className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium text-sm">API Service</p>
                <p className="text-xs text-muted-foreground">External API</p>
              </div>
            </button>
            <button
              onClick={() => setAddGitDialog(true)}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-dashed hover:border-primary hover:bg-accent/50 transition-colors"
            >
              <GitBranch className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium text-sm">Git Remote</p>
                <p className="text-xs text-muted-foreground">Repository</p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Setup */}
      <Card className="border-destructive/30">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Reset Setup Wizard</p>
              <p className="text-sm text-muted-foreground">
                Clear all settings and run the setup wizard again
              </p>
            </div>
            <Button variant="outline" onClick={handleResetSetup} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset Setup
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
