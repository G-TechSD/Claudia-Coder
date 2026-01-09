"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  Server,
  Cloud,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Key,
  Zap,
  Eye,
  EyeOff,
  AlertCircle,
  RefreshCw,
  ExternalLink
} from "lucide-react"
import {
  type LocalServerConfig,
  type CloudProviderConfig,
  type DefaultModelConfig,
  getGlobalSettings,
  saveGlobalSettings,
  markSetupComplete
} from "@/lib/settings/global-settings"

interface SetupWizardProps {
  onComplete: () => void
}

type Step = "welcome" | "local" | "cloud" | "default" | "complete"

interface DetectedServer {
  name: string
  displayName: string
  type: "lmstudio" | "ollama"
  baseUrl: string
  status: "online" | "offline" | "checking"
  model?: string
  models?: string[]
}

interface LocalServerWithModel extends LocalServerConfig {
  selectedModel?: string
  availableModels?: string[]
}

interface CloudProviderState {
  id: string
  name: string
  description: string
  apiKey: string
  status: "unconfigured" | "testing" | "valid" | "invalid"
  errorMessage?: string
  apiKeyUrl?: string
  color: string
  // OAuth support (for Anthropic)
  supportsOAuth?: boolean
  authMethod?: "apiKey" | "oauth"
  oauthStatus?: "unconfigured" | "connecting" | "connected" | "error"
  oauthUser?: {
    email: string
    name?: string
    picture?: string
  }
  oauthTokens?: {
    accessToken: string
    refreshToken?: string
    expiresAt?: number
    idToken?: string
  }
}

// Provider metadata with API key URLs
const CLOUD_PROVIDER_DEFAULTS: CloudProviderState[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models - Best for coding",
    apiKey: "",
    status: "unconfigured",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    color: "text-orange-500",
    supportsOAuth: true,
    authMethod: "oauth", // Default to OAuth for Max subscription
    oauthStatus: "unconfigured"
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT & o-series models",
    apiKey: "",
    status: "unconfigured",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    color: "text-emerald-500",
    supportsOAuth: false,
    authMethod: "apiKey"
  },
  {
    id: "google",
    name: "Google AI",
    description: "Gemini models - Long context",
    apiKey: "",
    status: "unconfigured",
    apiKeyUrl: "https://aistudio.google.com/apikey",
    color: "text-blue-500",
    supportsOAuth: false,
    authMethod: "apiKey"
  }
]

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<Step>("welcome")
  const [detectedServers, setDetectedServers] = useState<DetectedServer[]>([])
  const [checkingServers, setCheckingServers] = useState(false)
  const [localServers, setLocalServers] = useState<LocalServerWithModel[]>([])

  // Cloud providers with API key state
  const [cloudProviders, setCloudProviders] = useState<CloudProviderState[]>(CLOUD_PROVIDER_DEFAULTS)
  const [defaultCloudProvider, setDefaultCloudProvider] = useState<string | null>(null)
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})

  // Global default
  const [globalDefault, setGlobalDefault] = useState<DefaultModelConfig | null>(null)

  // Custom server form
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [customName, setCustomName] = useState("")
  const [customUrl, setCustomUrl] = useState("")
  const [customApiKey, setCustomApiKey] = useState("")

  // Check for servers on mount
  useEffect(() => {
    if (step === "local") {
      detectServers()
    }
  }, [step])

  async function detectServers() {
    setCheckingServers(true)
    try {
      const response = await fetch("/api/providers")
      const data = await response.json()

      if (data.providers) {
        const servers: DetectedServer[] = data.providers
          .filter((p: { type: string }) => p.type === "local")
          .map((p: {
            name: string
            displayName: string
            status: string
            baseUrl?: string
            model?: string
            models?: string[]
          }) => ({
            name: p.name,
            displayName: p.displayName,
            type: p.name.includes("lmstudio") ? "lmstudio" : "ollama",
            baseUrl: p.baseUrl || "",
            status: p.status as "online" | "offline",
            model: p.model,
            models: p.models
          }))
        setDetectedServers(servers)

        // Auto-add online servers with their models
        const online = servers.filter(s => s.status === "online")
        if (online.length > 0 && localServers.length === 0) {
          setLocalServers(online.map(s => ({
            id: `detected-${s.name}`,
            name: s.displayName,
            type: s.type,
            baseUrl: s.baseUrl,
            enabled: true,
            availableModels: s.models || [],
            selectedModel: s.models?.[0] // Default to first model
          })))
        }
      }
    } catch (error) {
      console.error("Failed to detect servers:", error)
    } finally {
      setCheckingServers(false)
    }
  }

  function toggleServer(server: DetectedServer) {
    const existingIndex = localServers.findIndex(s => s.name === server.displayName)
    if (existingIndex >= 0) {
      setLocalServers(prev => prev.filter((_, i) => i !== existingIndex))
    } else {
      setLocalServers(prev => [...prev, {
        id: `detected-${server.name}`,
        name: server.displayName,
        type: server.type,
        baseUrl: server.baseUrl,
        enabled: true,
        availableModels: server.models || [],
        selectedModel: server.models?.[0]
      }])
    }
  }

  function updateServerModel(serverId: string, modelId: string) {
    setLocalServers(prev => prev.map(s =>
      s.id === serverId ? { ...s, selectedModel: modelId } : s
    ))
  }

  function addCustomServer() {
    if (!customName || !customUrl) return
    setLocalServers(prev => [...prev, {
      id: `custom-${Date.now()}`,
      name: customName,
      type: "custom",
      baseUrl: customUrl,
      apiKey: customApiKey || undefined,
      enabled: true,
      availableModels: [],
      selectedModel: "loaded" // Use currently loaded for custom
    }])
    setCustomName("")
    setCustomUrl("")
    setCustomApiKey("")
    setShowAddCustom(false)
  }

  function removeServer(id: string) {
    setLocalServers(prev => prev.filter(s => s.id !== id))
  }

  function updateApiKey(providerId: string, apiKey: string) {
    setCloudProviders(prev => prev.map(p =>
      p.id === providerId ? { ...p, apiKey, status: apiKey ? "unconfigured" : "unconfigured" } : p
    ))
  }

  async function testApiKey(providerId: string) {
    const provider = cloudProviders.find(p => p.id === providerId)
    if (!provider?.apiKey) return

    setCloudProviders(prev => prev.map(p =>
      p.id === providerId ? { ...p, status: "testing" } : p
    ))

    try {
      const response = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, apiKey: provider.apiKey })
      })

      const data = await response.json()

      setCloudProviders(prev => prev.map(p =>
        p.id === providerId
          ? { ...p, status: data.valid ? "valid" : "invalid", errorMessage: data.error }
          : p
      ))

      // Auto-select as default if it's the first valid provider
      if (data.valid && !defaultCloudProvider) {
        setDefaultCloudProvider(providerId)
      }
    } catch {
      setCloudProviders(prev => prev.map(p =>
        p.id === providerId ? { ...p, status: "invalid", errorMessage: "Connection failed" } : p
      ))
    }
  }

  // Toggle auth method for providers that support OAuth
  function toggleAuthMethod(providerId: string) {
    setCloudProviders(prev => prev.map(p =>
      p.id === providerId && p.supportsOAuth
        ? { ...p, authMethod: p.authMethod === "oauth" ? "apiKey" : "oauth" }
        : p
    ))
  }

  // Start OAuth flow for Anthropic (sign in with Google)
  async function startOAuthFlow(providerId: string) {
    if (providerId !== "anthropic") return

    setCloudProviders(prev => prev.map(p =>
      p.id === providerId ? { ...p, oauthStatus: "connecting" } : p
    ))

    try {
      const response = await fetch("/api/auth/anthropic?action=start")
      const data = await response.json()

      if (data.success && data.authUrl) {
        // Store state for verification on callback
        if (typeof window !== "undefined") {
          sessionStorage.setItem("anthropic_oauth_state", data.state)
        }
        // Redirect to Google OAuth
        window.location.href = data.authUrl
      } else {
        setCloudProviders(prev => prev.map(p =>
          p.id === providerId
            ? { ...p, oauthStatus: "error", errorMessage: data.error || "Failed to start OAuth" }
            : p
        ))
      }
    } catch {
      setCloudProviders(prev => prev.map(p =>
        p.id === providerId
          ? { ...p, oauthStatus: "error", errorMessage: "Failed to connect" }
          : p
      ))
    }
  }

  // Handle OAuth callback (check URL params on mount)
  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const oauthCode = params.get("oauth_code")
    const provider = params.get("provider")

    if (oauthCode && provider === "anthropic") {
      // Exchange code for tokens
      exchangeOAuthCode(oauthCode)
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function exchangeOAuthCode(code: string) {
    setCloudProviders(prev => prev.map(p =>
      p.id === "anthropic" ? { ...p, oauthStatus: "connecting" } : p
    ))

    try {
      const response = await fetch("/api/auth/anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      })

      const data = await response.json()

      if (data.success) {
        setCloudProviders(prev => prev.map(p =>
          p.id === "anthropic"
            ? {
                ...p,
                status: "valid",
                oauthStatus: "connected",
                authMethod: "oauth",
                oauthUser: data.user,
                oauthTokens: {
                  accessToken: data.accessToken,
                  refreshToken: data.refreshToken,
                  expiresAt: data.expiresIn ? Date.now() + data.expiresIn * 1000 : undefined,
                  idToken: data.idToken
                }
              }
            : p
        ))
        // Auto-select as default if it's the first valid provider
        if (!defaultCloudProvider) {
          setDefaultCloudProvider("anthropic")
        }
      } else {
        setCloudProviders(prev => prev.map(p =>
          p.id === "anthropic"
            ? { ...p, oauthStatus: "error", errorMessage: data.error || "OAuth failed" }
            : p
        ))
      }
    } catch {
      setCloudProviders(prev => prev.map(p =>
        p.id === "anthropic"
          ? { ...p, oauthStatus: "error", errorMessage: "Failed to complete OAuth" }
          : p
      ))
    }
  }

  function handleComplete() {
    const settings = getGlobalSettings()

    // Save local servers
    settings.localServers = localServers.map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      baseUrl: s.baseUrl,
      apiKey: s.apiKey,
      enabled: s.enabled,
      defaultModel: s.selectedModel
    }))

    // Save cloud providers (those with valid API keys OR OAuth connections)
    settings.cloudProviders = cloudProviders
      .filter(p => p.status === "valid" || p.oauthStatus === "connected")
      .map(p => ({
        provider: p.id as CloudProviderConfig["provider"],
        enabled: true,
        apiKey: p.authMethod === "apiKey" ? p.apiKey : undefined,
        enabledModels: [], // Will use latest automatically
        isDefault: p.id === defaultCloudProvider,
        authMethod: p.authMethod || "apiKey",
        oauthTokens: p.oauthStatus === "connected" ? p.oauthTokens : undefined,
        oauthUser: p.oauthStatus === "connected" ? p.oauthUser : undefined
      }))

    // Save global default
    if (globalDefault) {
      settings.defaultModel = globalDefault
    }

    saveGlobalSettings(settings)
    markSetupComplete()
    onComplete()
  }

  // Get valid cloud providers for default selection (API key valid OR OAuth connected)
  const validCloudProviders = cloudProviders.filter(p =>
    p.status === "valid" || p.oauthStatus === "connected"
  )

  // Build options for global default
  const defaultOptions: Array<{
    id: string
    type: "local" | "cloud"
    provider: string
    serverId?: string
    modelId: string
    displayName: string
    description?: string
  }> = []

  // Add local servers with their selected models
  localServers.forEach(server => {
    // Use selectedModel if available, otherwise default to "loaded" (currently loaded model)
    const modelId = server.selectedModel || "loaded"
    defaultOptions.push({
      id: `local-${server.id}-${modelId}`,
      type: "local",
      provider: server.type,
      serverId: server.id,
      modelId: modelId,
      displayName: server.name,
      description: modelId === "loaded" ? "Currently loaded model" : modelId
    })
  })

  // Add cloud providers (will auto-use latest model)
  validCloudProviders.forEach(provider => {
    defaultOptions.push({
      id: `cloud-${provider.id}`,
      type: "cloud",
      provider: provider.id,
      modelId: "latest",
      displayName: provider.name,
      description: "Uses latest/best model automatically"
    })
  })

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-2xl">
        {/* Welcome Step */}
        {step === "welcome" && (
          <>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Welcome to Claudia Coder</CardTitle>
              <CardDescription className="text-base">
                Let's set up your AI providers to get started
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <Server className="h-6 w-6 text-green-500 mb-2" />
                  <p className="font-medium">Local Models</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Free, private, runs on your hardware
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Cloud className="h-6 w-6 text-blue-500 mb-2" />
                  <p className="font-medium">Cloud Models</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Powerful APIs, pay per use
                  </p>
                </div>
              </div>
              <Button className="w-full" size="lg" onClick={() => setStep("local")}>
                Get Started
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </>
        )}

        {/* Local Servers Step */}
        {step === "local" && (
          <>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-green-500" />
                  <CardTitle>Local AI Servers</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={detectServers} disabled={checkingServers}>
                  <RefreshCw className={cn("h-4 w-4", checkingServers && "animate-spin")} />
                </Button>
              </div>
              <CardDescription>
                Configure your local LM Studio or Ollama servers and select default models
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {checkingServers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Detecting servers...</span>
                </div>
              ) : (
                <>
                  {/* Detected Servers */}
                  {detectedServers.length > 0 ? (
                    <div className="space-y-3">
                      <Label className="text-xs text-muted-foreground uppercase">Detected Servers</Label>
                      {detectedServers.map(server => {
                        const localServer = localServers.find(s => s.name === server.displayName)
                        const isSelected = !!localServer
                        const isOnline = server.status === "online"

                        return (
                          <div
                            key={server.name}
                            className={cn(
                              "p-4 rounded-lg border transition-all",
                              isSelected ? "border-primary bg-primary/5" : "",
                              !isOnline && "opacity-50"
                            )}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <button
                                onClick={() => isOnline && toggleServer(server)}
                                disabled={!isOnline}
                                className="flex items-center gap-3 text-left"
                              >
                                <div className={cn(
                                  "w-5 h-5 rounded border-2 flex items-center justify-center",
                                  isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                                )}>
                                  {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                                </div>
                                <div>
                                  <span className="font-medium">{server.displayName}</span>
                                  <p className="text-xs text-muted-foreground">{server.baseUrl}</p>
                                </div>
                              </button>
                              <Badge
                                variant={isOnline ? "default" : "secondary"}
                                className={cn("text-xs", isOnline && "bg-green-500/10 text-green-500")}
                              >
                                {isOnline ? "Online" : "Offline"}
                              </Badge>
                            </div>

                            {/* Model Selection for enabled servers */}
                            {isSelected && localServer && server.models && server.models.length > 0 && (
                              <div className="mt-3 pl-8">
                                <Label className="text-xs text-muted-foreground mb-2 block">
                                  Default Model for this server:
                                </Label>
                                <Select
                                  value={localServer.selectedModel || ""}
                                  onValueChange={(value) => updateServerModel(localServer.id, value)}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a model..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="loaded">
                                      <span className="flex items-center gap-2">
                                        <Zap className="h-3 w-3" />
                                        Currently Loaded Model
                                      </span>
                                    </SelectItem>
                                    {server.models.map(model => (
                                      <SelectItem key={model} value={model}>
                                        {model}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                      <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No local servers detected</p>
                      <p className="text-xs">Start LM Studio or Ollama, or add a custom connection</p>
                    </div>
                  )}

                  {/* Custom servers added */}
                  {localServers.filter(s => s.type === "custom").map(server => (
                    <div key={server.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <span className="font-medium text-sm">{server.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{server.baseUrl}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeServer(server.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {/* Add Custom */}
                  {showAddCustom ? (
                    <div className="p-4 border border-dashed rounded-lg space-y-3">
                      <Label className="text-sm font-medium">Add Custom Server</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Server name"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                        />
                        <Input
                          placeholder="http://192.168.1.100:1234"
                          value={customUrl}
                          onChange={(e) => setCustomUrl(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="API Key (optional)"
                          value={customApiKey}
                          onChange={(e) => setCustomApiKey(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" disabled={!customName || !customUrl} onClick={addCustomServer}>
                          Add Server
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowAddCustom(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" className="w-full" onClick={() => setShowAddCustom(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Custom Connection
                    </Button>
                  )}
                </>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep("welcome")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={() => setStep("cloud")}>
                  Next: Cloud Providers
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Cloud Providers Step */}
        {step === "cloud" && (
          <>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-blue-500" />
                <CardTitle>Cloud Providers</CardTitle>
              </div>
              <CardDescription>
                Connect cloud AI providers to access their models
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {cloudProviders.map(provider => {
                  const isConnected = provider.status === "valid" || provider.oauthStatus === "connected"
                  const isAnthropic = provider.id === "anthropic"

                  return (
                    <div
                      key={provider.id}
                      className={cn(
                        "border rounded-lg p-4 space-y-3 transition-colors",
                        isConnected && "border-green-500/30 bg-green-500/5"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={cn("font-medium", provider.color)}>{provider.name}</span>
                          <p className="text-xs text-muted-foreground">{provider.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isConnected && (
                            <Badge className="bg-green-500/10 text-green-500 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {provider.oauthStatus === "connected" ? "Signed In" : "Connected"}
                            </Badge>
                          )}
                          {provider.status === "invalid" && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Invalid
                            </Badge>
                          )}
                          {provider.oauthStatus === "error" && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Anthropic - OAuth as primary, API key as secondary */}
                      {isAnthropic && !isConnected && (
                        <div className="space-y-4">
                          {/* OAuth Option - Primary */}
                          {provider.authMethod === "oauth" && (
                            <div className="space-y-3">
                              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm font-medium">Sign in with Google</span>
                                  <Badge variant="secondary" className="text-xs">Max Plan</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mb-3">
                                  Use your Anthropic Max subscription ($200/month) - not pay-per-use credits
                                </p>
                                <Button
                                  className="w-full gap-2"
                                  onClick={() => startOAuthFlow("anthropic")}
                                  disabled={provider.oauthStatus === "connecting"}
                                >
                                  {provider.oauthStatus === "connecting" ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                    </svg>
                                  )}
                                  Sign in with Google to use Max plan
                                </Button>
                              </div>

                              <button
                                onClick={() => toggleAuthMethod("anthropic")}
                                className="w-full text-xs text-muted-foreground hover:text-primary text-center py-2"
                              >
                                or use API key (pay-per-use credits)
                              </button>
                            </div>
                          )}

                          {/* API Key Option - Secondary */}
                          {provider.authMethod === "apiKey" && (
                            <div className="space-y-3">
                              <div className="p-3 rounded-lg bg-muted/50 border">
                                <div className="flex items-center gap-2 mb-2">
                                  <Key className="h-4 w-4" />
                                  <span className="text-sm font-medium">API Key</span>
                                  <Badge variant="outline" className="text-xs">Pay-per-use</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mb-3">
                                  Uses separate API credits, billed by usage (not your Max subscription)
                                </p>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <Input
                                      type={showApiKeys[provider.id] ? "text" : "password"}
                                      placeholder="sk-ant-api03-..."
                                      value={provider.apiKey}
                                      onChange={(e) => updateApiKey(provider.id, e.target.value)}
                                      className="pr-10"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowApiKeys(prev => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                      {showApiKeys[provider.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                  </div>
                                  <Button
                                    variant="outline"
                                    onClick={() => testApiKey(provider.id)}
                                    disabled={!provider.apiKey || provider.status === "testing"}
                                  >
                                    {provider.status === "testing" ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      "Test"
                                    )}
                                  </Button>
                                </div>
                                <a
                                  href={provider.apiKeyUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-2"
                                >
                                  Get API key from Anthropic Console
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>

                              <button
                                onClick={() => toggleAuthMethod("anthropic")}
                                className="w-full text-xs text-muted-foreground hover:text-primary text-center py-2"
                              >
                                or sign in with Google (Max subscription)
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Anthropic - Connected State */}
                      {isAnthropic && isConnected && (
                        <div className="space-y-2">
                          {provider.oauthStatus === "connected" && provider.oauthUser && (
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                              {provider.oauthUser.picture && (
                                <img
                                  src={provider.oauthUser.picture}
                                  alt=""
                                  className="h-8 w-8 rounded-full"
                                />
                              )}
                              <div>
                                <p className="text-sm font-medium">{provider.oauthUser.name || provider.oauthUser.email}</p>
                                <p className="text-xs text-muted-foreground">
                                  Using Anthropic Max subscription
                                </p>
                              </div>
                            </div>
                          )}
                          {provider.authMethod === "apiKey" && provider.status === "valid" && (
                            <p className="text-xs text-muted-foreground">
                              Connected via API key (pay-per-use credits)
                            </p>
                          )}
                        </div>
                      )}

                      {/* OpenAI / Google - API Key Only */}
                      {!isAnthropic && !isConnected && (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                type={showApiKeys[provider.id] ? "text" : "password"}
                                placeholder={`Enter ${provider.name} API key...`}
                                value={provider.apiKey}
                                onChange={(e) => updateApiKey(provider.id, e.target.value)}
                                className="pr-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowApiKeys(prev => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                {showApiKeys[provider.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => testApiKey(provider.id)}
                              disabled={!provider.apiKey || provider.status === "testing"}
                            >
                              {provider.status === "testing" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Test"
                              )}
                            </Button>
                          </div>
                          {provider.apiKeyUrl && (
                            <a
                              href={provider.apiKeyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                            >
                              Get API key from {provider.name}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Error messages */}
                      {provider.status === "invalid" && provider.errorMessage && (
                        <p className="text-xs text-destructive">{provider.errorMessage}</p>
                      )}
                      {provider.oauthStatus === "error" && provider.errorMessage && (
                        <p className="text-xs text-destructive">{provider.errorMessage}</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Default Cloud Provider Selection */}
              {validCloudProviders.length > 0 && (
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium mb-3 block">
                    Default Cloud Provider
                  </Label>
                  <RadioGroup
                    value={defaultCloudProvider || ""}
                    onValueChange={setDefaultCloudProvider}
                  >
                    {validCloudProviders.map(provider => (
                      <div key={provider.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent">
                        <RadioGroupItem value={provider.id} id={`default-${provider.id}`} />
                        <Label htmlFor={`default-${provider.id}`} className="flex-1 cursor-pointer">
                          <span className="font-medium">{provider.name}</span>
                          <p className="text-xs text-muted-foreground">
                            {provider.oauthStatus === "connected"
                              ? "Using Max subscription"
                              : "Will use latest/best model automatically"
                            }
                          </p>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center py-2">
                Credentials are stored locally and never sent to our servers
              </p>

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep("local")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={() => setStep("default")}>
                  Next: Global Default
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Global Default Model Step */}
        {step === "default" && (
          <>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <CardTitle>Global Default Model</CardTitle>
              </div>
              <CardDescription>
                Choose the default AI source for new projects
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {defaultOptions.length > 0 ? (
                <RadioGroup
                  value={globalDefault?.displayName || ""}
                  onValueChange={(value: string) => {
                    const option = defaultOptions.find(o => o.displayName === value)
                    if (option) {
                      setGlobalDefault({
                        provider: option.provider,
                        serverId: option.serverId,
                        modelId: option.modelId,
                        displayName: option.displayName
                      })
                    }
                  }}
                >
                  {/* Local Models */}
                  {defaultOptions.filter(o => o.type === "local").length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                        <Server className="h-3 w-3" />
                        Local Servers (Free)
                      </Label>
                      {defaultOptions.filter(o => o.type === "local").map(option => (
                        <div
                          key={option.id}
                          className={cn(
                            "flex items-center space-x-3 p-4 rounded-lg border transition-colors",
                            globalDefault?.displayName === option.displayName
                              ? "border-primary bg-primary/5"
                              : "hover:bg-accent"
                          )}
                        >
                          <RadioGroupItem value={option.displayName} id={option.id} />
                          <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                            <span className="font-medium">{option.displayName}</span>
                            <p className="text-xs text-muted-foreground">{option.description}</p>
                          </Label>
                          <Badge variant="secondary" className="bg-green-500/10 text-green-500 text-xs">
                            Free
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cloud Providers */}
                  {defaultOptions.filter(o => o.type === "cloud").length > 0 && (
                    <div className="space-y-2 pt-4">
                      <Label className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                        <Cloud className="h-3 w-3" />
                        Cloud Providers (Paid)
                      </Label>
                      {defaultOptions.filter(o => o.type === "cloud").map(option => (
                        <div
                          key={option.id}
                          className={cn(
                            "flex items-center space-x-3 p-4 rounded-lg border transition-colors",
                            globalDefault?.displayName === option.displayName
                              ? "border-primary bg-primary/5"
                              : "hover:bg-accent"
                          )}
                        >
                          <RadioGroupItem value={option.displayName} id={option.id} />
                          <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                            <span className="font-medium">{option.displayName}</span>
                            <p className="text-xs text-muted-foreground">{option.description}</p>
                          </Label>
                          <Badge variant="secondary" className="text-xs">
                            Paid
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </RadioGroup>
              ) : (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No AI sources configured</p>
                  <p className="text-xs">Go back and add local servers or configure cloud providers</p>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep("cloud")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleComplete}
                  disabled={defaultOptions.length > 0 && !globalDefault}
                >
                  Complete Setup
                  <CheckCircle2 className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
