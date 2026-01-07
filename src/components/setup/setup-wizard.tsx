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
    color: "text-orange-500"
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT & o-series models",
    apiKey: "",
    status: "unconfigured",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    color: "text-emerald-500"
  },
  {
    id: "google",
    name: "Google AI",
    description: "Gemini models - Long context",
    apiKey: "",
    status: "unconfigured",
    apiKeyUrl: "https://aistudio.google.com/apikey",
    color: "text-blue-500"
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

    // Save cloud providers (only those with valid API keys)
    settings.cloudProviders = cloudProviders
      .filter(p => p.status === "valid")
      .map(p => ({
        provider: p.id as CloudProviderConfig["provider"],
        enabled: true,
        apiKey: p.apiKey,
        enabledModels: [], // Will use latest automatically
        isDefault: p.id === defaultCloudProvider
      }))

    // Save global default
    if (globalDefault) {
      settings.defaultModel = globalDefault
    }

    saveGlobalSettings(settings)
    markSetupComplete()
    onComplete()
  }

  // Get valid cloud providers for default selection
  const validCloudProviders = cloudProviders.filter(p => p.status === "valid")

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
              <CardTitle className="text-2xl">Welcome to Claudia</CardTitle>
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
                Sign in with your account or enter an API key. The default provider will use its latest model.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {cloudProviders.map(provider => (
                  <div
                    key={provider.id}
                    className={cn(
                      "border rounded-lg p-4 space-y-3 transition-colors",
                      provider.status === "valid" && "border-green-500/30 bg-green-500/5"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={cn("font-medium", provider.color)}>{provider.name}</span>
                        <p className="text-xs text-muted-foreground">{provider.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {provider.status === "valid" && (
                          <Badge className="bg-green-500/10 text-green-500 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        )}
                        {provider.status === "invalid" && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Invalid
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Sign in with OAuth button - uses your subscription */}
                    {provider.status !== "valid" && (
                      <Button
                        variant="outline"
                        className="w-full gap-2 h-10"
                        onClick={() => window.location.href = `/api/auth/oauth/${provider.id}`}
                      >
                        {provider.id === "google" ? (
                          <svg className="h-4 w-4" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                        ) : provider.id === "anthropic" ? (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0h3.767L16.906 20.48h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm2.327 5.142L5.017 16.96h3.879l-1.001-8.3z"/>
                          </svg>
                        ) : provider.id === "openai" ? (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
                          </svg>
                        ) : (
                          <Key className="h-4 w-4" />
                        )}
                        Sign in with {provider.name}
                      </Button>
                    )}

                    {/* Divider */}
                    {provider.status !== "valid" && (
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">or use API key</span>
                        </div>
                      </div>
                    )}

                    {/* API Key input */}
                    {provider.status !== "valid" && (
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
                            Get API Key from {provider.name}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}

                    {provider.status === "invalid" && provider.errorMessage && (
                      <p className="text-xs text-destructive">{provider.errorMessage}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Note about authentication methods */}
              <p className="text-xs text-muted-foreground text-center pt-2">
                Sign in connects to your subscription account. API keys use pay-per-use billing.
              </p>

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
                            Will use latest/best model automatically
                          </p>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center py-2">
                API keys are stored locally and never sent to our servers
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
