"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  Plus,
  Trash2,
  Server,
  Cloud,
  Zap,
  Brain,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Key,
  Star
} from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  TASK_TYPES,
  type ProviderName
} from "@/lib/ai/providers"
import { useAvailableModels, type AvailableModel } from "@/hooks/useAvailableModels"
import {
  type ProjectModelConfig,
  type AssignedModel,
  createDefaultModelConfig,
  addModelToProject,
  removeModelFromProject,
  toggleModel,
  setTaskOverride,
  removeTaskOverride,
  getProjectModelConfig,
  saveProjectModelConfig
} from "@/lib/ai/project-models"
import {
  getGlobalSettings,
  type LocalServerConfig
} from "@/lib/settings/global-settings"

// Known server from API
interface DetectedServer {
  name: string
  displayName: string
  type: "local" | "cloud" | "cli"
  status: "online" | "offline" | "checking" | "not-configured"
  baseUrl?: string
  model?: string
  models?: string[]
}

// Enabled instance for local, cloud, or CLI
interface EnabledInstance {
  id: string
  type: "local" | "cloud" | "cli"
  provider: string
  displayName: string
  serverId?: string
  serverName?: string
  baseUrl?: string
  modelId: string
  modelName: string
  maxConcurrent: number
  costPer1kTokens?: number
  isCustom?: boolean
  apiKey?: string
}

interface ModelAssignmentProps {
  projectId: string
  onConfigChange?: (config: ProjectModelConfig) => void
}

// Local provider types (servers configured in Settings)
const LOCAL_PROVIDERS = [
  { id: "lmstudio", name: "LM Studio", color: "text-green-500" },
  { id: "ollama", name: "Ollama", color: "text-purple-500" },
  { id: "custom", name: "Custom Server", color: "text-gray-500" }
]

// Cloud and CLI provider metadata (remote providers)
const CLOUD_PROVIDERS = [
  { id: "anthropic", name: "Anthropic", color: "text-orange-500" },
  { id: "openai", name: "OpenAI", color: "text-emerald-500" },
  { id: "google", name: "Google AI", color: "text-blue-500" },
  { id: "claude-code", name: "Claude Code", color: "text-purple-500", isCli: true }
]

// Storage key for enabled instances
const ENABLED_INSTANCES_KEY = "claudia_enabled_instances"
const DEFAULT_INSTANCE_KEY = "claudia_default_instance"

// Helper to filter out embedding models - they cannot be used for chat/generation
function isLLMModel(modelId: string): boolean {
  const id = modelId.toLowerCase()
  return !id.includes('embed') && !id.includes('embedding')
}

// Helper to get enabled instances for a project
function getStoredEnabledInstances(projectId: string): EnabledInstance[] {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(`${ENABLED_INSTANCES_KEY}_${projectId}`)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Validate the data structure
      if (Array.isArray(parsed)) {
        return parsed.filter(i => i && i.id && i.modelId && i.displayName)
      }
    }
  } catch (e) {
    console.warn("Failed to load enabled instances:", e)
  }
  return []
}

// Helper to save enabled instances for a project
function saveEnabledInstances(projectId: string, instances: EnabledInstance[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(`${ENABLED_INSTANCES_KEY}_${projectId}`, JSON.stringify(instances))
  } catch (e) {
    console.warn("Failed to save enabled instances:", e)
  }
}

// Helper to get default instance for a project
function getStoredDefaultInstance(projectId: string): EnabledInstance | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(`${DEFAULT_INSTANCE_KEY}_${projectId}`)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Validate the data structure
      if (parsed && parsed.id && parsed.modelId && parsed.displayName) {
        return parsed
      }
    }
  } catch (e) {
    console.warn("Failed to load default instance:", e)
  }
  return null
}

// Helper to save default instance for a project
function saveDefaultInstance(projectId: string, instance: EnabledInstance | null): void {
  if (typeof window === "undefined") return
  try {
    if (instance) {
      localStorage.setItem(`${DEFAULT_INSTANCE_KEY}_${projectId}`, JSON.stringify(instance))
    } else {
      localStorage.removeItem(`${DEFAULT_INSTANCE_KEY}_${projectId}`)
    }
  } catch (e) {
    console.warn("Failed to save default instance:", e)
  }
}

export function ModelAssignment({ projectId, onConfigChange }: ModelAssignmentProps) {
  const [config, setConfig] = useState<ProjectModelConfig>(() =>
    getProjectModelConfig(projectId) || createDefaultModelConfig(projectId)
  )
  const [expandedOverrides, setExpandedOverrides] = useState(false)

  // Servers/models for the SELECTED provider only (fetched on-demand)
  const [providerServers, setProviderServers] = useState<DetectedServer[]>([])
  const [providerModels, setProviderModels] = useState<string[]>([])
  const [loadingProviderData, setLoadingProviderData] = useState(false)

  // Load enabled instances from localStorage on mount
  const [enabledInstances, setEnabledInstances] = useState<EnabledInstance[]>(() =>
    getStoredEnabledInstances(projectId)
  )

  // Use dynamic model fetching for cloud providers
  const { models: dynamicModels, loading: loadingModels, refresh: refreshModels } = useAvailableModels()

  // Default model state - load from localStorage on mount
  const [defaultInstance, setDefaultInstance] = useState<EnabledInstance | null>(() =>
    getStoredDefaultInstance(projectId)
  )

  // Add new provider state
  const [showAddProvider, setShowAddProvider] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [selectedServer, setSelectedServer] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)

  // Custom server state
  const [showCustomServer, setShowCustomServer] = useState(false)
  const [customName, setCustomName] = useState("")
  const [customUrl, setCustomUrl] = useState("")
  const [customApiKey, setCustomApiKey] = useState("")

  // Fetch provider data only when a provider is selected
  useEffect(() => {
    if (!selectedProvider) {
      setProviderServers([])
      setProviderModels([])
      return
    }

    async function fetchProviderData() {
      setLoadingProviderData(true)
      try {
        const response = await fetch("/api/providers")
        const data = await response.json()

        if (data.providers && selectedProvider) {
          // For local providers, get matching servers
          if (LOCAL_PROVIDERS.some(p => p.id === selectedProvider)) {
            const servers: DetectedServer[] = data.providers
              .filter((p: { name: string; type: string; status: string }) =>
                p.type === "local" &&
                p.status === "online" &&
                p.name.toLowerCase().includes(selectedProvider.toLowerCase())
              )
              .map((p: {
                name: string
                displayName: string
                type: "local" | "cloud" | "cli"
                status: string
                baseUrl?: string
                model?: string
                models?: string[]
              }) => ({
                name: p.name,
                displayName: p.displayName,
                type: p.type,
                status: p.status,
                baseUrl: p.baseUrl,
                model: p.model,
                models: p.models
              }))
            setProviderServers(servers)
          }

          // For cloud/CLI providers, models come from dynamicModels (useAvailableModels)
          // which is already being fetched
        }
      } catch (error) {
        console.error("Failed to fetch provider data:", error)
      } finally {
        setLoadingProviderData(false)
      }
    }

    fetchProviderData()
  }, [selectedProvider])

  // NOTE: Auto-selection of default models has been removed.
  // Users must explicitly add models they want to use.
  // This prevents unexpected models (like Haiku) from appearing automatically.

  // Persist enabled instances to localStorage whenever they change
  useEffect(() => {
    saveEnabledInstances(projectId, enabledInstances)
  }, [projectId, enabledInstances])

  // Persist default instance to localStorage whenever it changes
  useEffect(() => {
    saveDefaultInstance(projectId, defaultInstance)
  }, [projectId, defaultInstance])

  // Persist changes
  useEffect(() => {
    saveProjectModelConfig(config)
    onConfigChange?.(config)
  }, [config, onConfigChange])

  // providerServers already contains filtered local servers for the selected provider
  const cloudModels = dynamicModels.filter(m => m.type === "cloud" || m.type === "cli")

  // Provider icons for compact grid
  const providerIcons: Record<string, { icon: typeof Server; color: string }> = {
    lmstudio: { icon: Server, color: "text-green-500" },
    ollama: { icon: Server, color: "text-purple-500" },
    anthropic: { icon: Cloud, color: "text-orange-500" },
    openai: { icon: Cloud, color: "text-emerald-500" },
    google: { icon: Cloud, color: "text-blue-500" },
    "claude-code": { icon: Zap, color: "text-purple-500" }
  }

  const addInstance = () => {
    if (!selectedProvider || !selectedModel) return

    const isLocal = ["lmstudio", "ollama", "custom"].includes(selectedProvider) || selectedServer?.startsWith("lmstudio-") || selectedServer === "ollama"
    const isCli = selectedProvider === "claude-code"
    const server = providerServers.find(s => s.name === selectedServer)
    const cloudProviderInfo = CLOUD_PROVIDERS.find(p => p.id === selectedProvider)
    const cloudModel = cloudModels.find(m => m.id === selectedModel && m.provider === selectedProvider)

    // For "loaded" selection, use the actual loaded model name
    const actualModelId = selectedModel === "loaded" ? (server?.model || "loaded") : selectedModel
    const modelDisplayName = selectedModel === "loaded"
      ? (server?.model ? `${server.model} (loaded)` : "Currently Loaded")
      : selectedModel

    // Build display name safely - ensure it's never undefined
    const serverDisplayName = server?.displayName || selectedServer || selectedProvider || "Unknown Server"
    const cloudProviderName = cloudProviderInfo?.name || selectedProvider || "Unknown Provider"
    const finalModelName = cloudModel?.name || selectedModel || "Unknown Model"
    const displayName = isLocal
      ? `${serverDisplayName} - ${modelDisplayName}`
      : `${cloudProviderName} - ${finalModelName}`

    const instance: EnabledInstance = {
      id: `instance-${Date.now()}`,
      type: isLocal ? "local" : isCli ? "cli" : "cloud",
      provider: selectedProvider,
      displayName,
      serverId: selectedServer || undefined,
      serverName: server?.displayName || serverDisplayName,
      baseUrl: server?.baseUrl,
      modelId: actualModelId,
      modelName: modelDisplayName,
      maxConcurrent: 1
    }

    setEnabledInstances(prev => [...prev, instance])

    // Set as default if first one
    if (enabledInstances.length === 0) {
      setDefaultInstance(instance)
    }

    // Reset selection
    setSelectedProvider(null)
    setSelectedServer(null)
    setSelectedModel(null)
    setShowAddProvider(false)
  }

  const addCustomServer = () => {
    if (!customName || !customUrl) return

    const instance: EnabledInstance = {
      id: `custom-${Date.now()}`,
      type: "local",
      provider: "custom",
      displayName: `${customName} - Loaded Model`,
      baseUrl: customUrl,
      apiKey: customApiKey || undefined,
      modelId: "loaded",
      modelName: "Currently Loaded",
      maxConcurrent: 1,
      isCustom: true
    }

    setEnabledInstances(prev => [...prev, instance])

    if (enabledInstances.length === 0) {
      setDefaultInstance(instance)
    }

    setCustomName("")
    setCustomUrl("")
    setCustomApiKey("")
    setShowCustomServer(false)
  }

  const removeInstance = (id: string) => {
    setEnabledInstances(prev => {
      const filtered = prev.filter(i => i.id !== id)
      // If removing default, set new default
      if (defaultInstance?.id === id && filtered.length > 0) {
        setDefaultInstance(filtered[0])
      } else if (filtered.length === 0) {
        setDefaultInstance(null)
      }
      return filtered
    })
  }

  const updateConcurrency = (id: string, maxConcurrent: number) => {
    setEnabledInstances(prev => prev.map(i =>
      i.id === id ? { ...i, maxConcurrent } : i
    ))
  }

  const setAsDefault = (instance: EnabledInstance) => {
    setDefaultInstance(instance)
  }

  // Check for overload warning
  const hasOverloadRisk = enabledInstances
    .filter(i => i.type === "local")
    .some(i => i.maxConcurrent > 1) ||
    enabledInstances.filter(i => i.type === "local" && i.serverId === enabledInstances[0]?.serverId).length > 1

  return (
    <div className="space-y-4">
      {/* Default Model - Always Visible */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Default Model</Label>
                {defaultInstance && defaultInstance.displayName ? (
                  <p className="font-medium">{defaultInstance.displayName}</p>
                ) : defaultInstance ? (
                  <p className="font-medium">{defaultInstance.modelName || defaultInstance.modelId || "Unknown Model"}</p>
                ) : (
                  <p className="text-muted-foreground text-sm">No model selected</p>
                )}
              </div>
            </div>
            {enabledInstances.length > 1 && (
              <Select
                value={defaultInstance?.id || ""}
                onValueChange={(id) => {
                  const instance = enabledInstances.find(i => i.id === id)
                  if (instance) setDefaultInstance(instance)
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select default..." />
                </SelectTrigger>
                <SelectContent>
                  {enabledInstances.map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      <span className="flex items-center gap-2">
                        {i.type === "local" ? <Server className="h-3 w-3" /> : <Cloud className="h-3 w-3" />}
                        {i.displayName || i.modelName || i.modelId || "Unknown Model"}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Enabled Models */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Enabled Models
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddProvider(!showAddProvider)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <>
            {/* Add Provider Panel */}
            {showAddProvider && (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                {/* Provider Grid - Static list of provider types */}
                <div>
                  <Label className="text-xs text-muted-foreground uppercase mb-2 block">Select Provider Type</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {/* Local Provider Types */}
                    {LOCAL_PROVIDERS.map(provider => {
                      const icon = providerIcons[provider.id] || { icon: Server, color: "text-green-500" }
                      const Icon = icon.icon
                      return (
                        <button
                          key={provider.id}
                          onClick={() => {
                            setSelectedProvider(provider.id)
                            setSelectedServer(null)
                            setSelectedModel(null)
                          }}
                          className={cn(
                            "flex flex-col items-center gap-1 p-3 rounded-lg border text-center transition-all",
                            selectedProvider === provider.id
                              ? "border-primary bg-primary/5"
                              : "hover:bg-accent"
                          )}
                        >
                          <Icon className={cn("h-5 w-5", provider.color)} />
                          <span className="text-xs font-medium">{provider.name}</span>
                          <Badge variant="outline" className="text-[10px] bg-muted">
                            Local
                          </Badge>
                        </button>
                      )
                    })}

                    {/* Cloud Providers */}
                    {CLOUD_PROVIDERS.map(provider => {
                      const providerModelCount = cloudModels.filter(m => m.provider === provider.id).length
                      return (
                        <button
                          key={provider.id}
                          onClick={() => {
                            setSelectedProvider(provider.id)
                            setSelectedServer(null)
                            setSelectedModel(null)
                          }}
                          className={cn(
                            "flex flex-col items-center gap-1 p-3 rounded-lg border text-center transition-all",
                            selectedProvider === provider.id
                              ? "border-primary bg-primary/5"
                              : "hover:bg-accent"
                          )}
                        >
                          <Cloud className={cn("h-5 w-5", provider.color)} />
                          <span className="text-xs font-medium">{provider.name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {providerModelCount > 0 ? `${providerModelCount} models` : "Paid"}
                          </Badge>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Server Selection for Local Providers */}
                {selectedProvider && LOCAL_PROVIDERS.some(p => p.id === selectedProvider) && (
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase mb-2 block">
                      {loadingProviderData ? "Loading servers..." : "Select Server"}
                    </Label>
                    {loadingProviderData ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Checking for {selectedProvider} servers...</span>
                      </div>
                    ) : providerServers.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-2">
                        No {selectedProvider} servers found online. Configure servers in Settings.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {providerServers.map(server => {
                          const modelCount = server.models?.length || 0
                          const loadedModel = server.model
                          return (
                            <button
                              key={server.name}
                              onClick={() => {
                                setSelectedServer(server.name)
                                setSelectedModel(null)
                              }}
                              className={cn(
                                "flex flex-col items-center gap-1 p-3 rounded-lg border text-center transition-all min-w-[120px]",
                                selectedServer === server.name
                                  ? "border-primary bg-primary/5"
                                  : "hover:bg-accent"
                              )}
                            >
                              <span className="text-xs font-medium">{server.displayName}</span>
                              <Badge variant="outline" className={cn(
                                "text-[10px]",
                                loadedModel ? "bg-green-500/10 text-green-600" : "bg-muted"
                              )}>
                                {loadedModel ? "Ready" : modelCount > 0 ? `${modelCount} models` : "Available"}
                              </Badge>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Model Selection */}
                {(selectedServer || (selectedProvider && CLOUD_PROVIDERS.some((p: { id: string }) => p.id === selectedProvider))) && (
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase mb-2 block">Select Model</Label>
                      <div className="flex flex-wrap gap-2">
                        {/* Local server models */}
                        {selectedServer && (() => {
                          const server = providerServers.find(s => s.name === selectedServer)
                          // Filter out embedding models from loaded model
                          const loadedModel = server?.model && isLLMModel(server.model) ? server.model : undefined
                          // Filter out embedding models from available models list
                          const availableModels = (server?.models || []).filter(isLLMModel)

                          return (
                            <>
                              {/* Show loaded model button only if a model is actually loaded and is an LLM */}
                              {loadedModel && (
                                <Button
                                  variant={selectedModel === "loaded" ? "default" : "outline"}
                                  size="sm"
                                  className="h-8 border-green-500/50"
                                  onClick={() => setSelectedModel("loaded")}
                                >
                                  <Zap className="h-3 w-3 mr-1 text-green-500" />
                                  {loadedModel}
                                  <Badge variant="outline" className="ml-1 text-[9px] bg-green-500/10 text-green-600">loaded</Badge>
                                </Button>
                              )}
                              {/* Show all available LLM models (embedding models are filtered out) */}
                              {availableModels.length > 0 ? (
                                availableModels
                                  .filter(model => model !== loadedModel) // Don't duplicate the loaded model
                                  .map(model => (
                                    <Button
                                      key={model}
                                      variant={selectedModel === model ? "default" : "outline"}
                                      size="sm"
                                      className="h-8"
                                      onClick={() => setSelectedModel(model)}
                                    >
                                      {model}
                                    </Button>
                                  ))
                              ) : !loadedModel && (
                                <div className="text-sm text-muted-foreground py-2">
                                  No models available on this server
                                </div>
                              )}
                            </>
                          )
                        })()}

                        {/* Cloud provider models */}
                        {!selectedServer && selectedProvider && (
                          cloudModels
                            .filter(m => m.provider === selectedProvider)
                            .map(model => {
                              const alreadyAdded = enabledInstances.some(
                                i => i.provider === selectedProvider && i.modelId === model.id
                              )
                              return (
                                <Button
                                  key={model.id}
                                  variant={selectedModel === model.id ? "default" : "outline"}
                                  size="sm"
                                  className="h-8"
                                  disabled={alreadyAdded}
                                  onClick={() => setSelectedModel(model.id)}
                                >
                                  {model.name}
                                  {alreadyAdded && <CheckCircle2 className="h-3 w-3 ml-1 text-green-500" />}
                                </Button>
                              )
                            })
                        )}
                      </div>
                    </div>
                  )}

                  {/* Custom Server Form */}
                  {showCustomServer && (
                    <div className="p-3 border rounded-lg space-y-2 bg-background">
                      <Label className="text-sm">Custom Server</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Name (e.g., Gaming PC)"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                        />
                        <Input
                          placeholder="URL (e.g., http://localhost:1234)"
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
                          Add Custom Server
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowCustomServer(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Add Button */}
                  {!showCustomServer && (
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowAddProvider(false)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={!selectedModel}
                        onClick={addInstance}
                      >
                        Add Model
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Enabled Instances List */}
              {enabledInstances.length > 0 ? (
                <div className="space-y-2">
                  {enabledInstances.map(instance => (
                    <div
                      key={instance.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        instance.id === defaultInstance?.id && "border-primary/30 bg-primary/5"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {instance.type === "local" ? (
                          <Server className="h-4 w-4 text-green-500" />
                        ) : (
                          <Cloud className="h-4 w-4 text-blue-500" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {instance.displayName || instance.modelName || instance.modelId || "Unknown Model"}
                            </span>
                            {instance.id === defaultInstance?.id && (
                              <Badge variant="outline" className="text-xs bg-primary/10 text-primary">
                                Default
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {instance.type === "local" ? "Free" : (
                              instance.costPer1kTokens && `$${instance.costPer1kTokens}/1k tokens`
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={instance.maxConcurrent.toString()}
                          onValueChange={(v) => updateConcurrency(instance.id, parseInt(v))}
                        >
                          <SelectTrigger className="w-[70px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 8, 10, 15, 20].map(n => (
                              <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {instance.id !== defaultInstance?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Set as default"
                            onClick={() => setAsDefault(instance)}
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeInstance(instance.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !showAddProvider && (
                (() => {
                  const globalSettings = getGlobalSettings()
                  const globalDefault = globalSettings.defaultModel

                  if (globalDefault) {
                    return (
                      <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg bg-primary/5">
                        <Brain className="h-8 w-8 mx-auto mb-2 text-primary/60" />
                        <p className="text-sm font-medium text-foreground">
                          Using Claudia Coder&apos;s default model: <span className="text-primary">{globalDefault.displayName}</span>
                        </p>
                        <p className="text-xs mt-1">
                          on {globalDefault.provider === "lmstudio" ? "LM Studio" :
                              globalDefault.provider === "ollama" ? "Ollama" :
                              globalDefault.provider === "anthropic" ? "Anthropic" :
                              globalDefault.provider === "openai" ? "OpenAI" :
                              globalDefault.provider === "google" ? "Google AI" :
                              globalDefault.provider}
                          {globalDefault.serverId && ` (${globalDefault.serverId})`}
                        </p>
                        <p className="text-xs mt-2 text-muted-foreground">
                          Click &quot;+Add&quot; to assign other AI models to this project
                        </p>
                      </div>
                    )
                  }

                  return (
                    <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                      <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No models enabled</p>
                      <p className="text-xs">Click &quot;Add&quot; to configure AI models</p>
                    </div>
                  )
                })()
              )}

              {/* Overload Warning */}
              {hasOverloadRisk && (
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-600">Potential Overload</p>
                    <p className="text-yellow-600/80 text-xs">
                      Multiple concurrent sessions on local servers may slow responses.
                    </p>
                  </div>
                </div>
              )}
          </>
        </CardContent>
      </Card>

      {/* Routing Settings */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="h-4 w-4 text-primary" />
              <div>
                <Label>Auto-route by task type</Label>
                <p className="text-xs text-muted-foreground">Best model per task</p>
              </div>
            </div>
            <Switch
              checked={config.autoRoute}
              onCheckedChange={(checked) => setConfig({ ...config, autoRoute: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Task Overrides - Collapsed */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer"
          onClick={() => setExpandedOverrides(!expandedOverrides)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Task Overrides</CardTitle>
            {expandedOverrides ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CardHeader>
        {expandedOverrides && (
          <CardContent className="space-y-2 pt-0">
            {TASK_TYPES.map(taskType => {
              const override = config.taskOverrides.find(o => o.taskType === taskType.id)
              return (
                <div key={taskType.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm">{taskType.name}</span>
                  <Select
                    value={override?.modelId || "auto"}
                    onValueChange={(value) => {
                      if (value === "auto") {
                        setConfig(removeTaskOverride(config, taskType.id))
                      } else {
                        setConfig(setTaskOverride(config, taskType.id, value))
                      }
                    }}
                  >
                    <SelectTrigger className="w-[160px] h-8">
                      <span className="truncate">
                        {override?.modelId
                          ? enabledInstances.find(i => i.modelId === override.modelId)?.displayName ||
                            enabledInstances.find(i => i.modelId === override.modelId)?.modelName ||
                            override.modelId
                          : defaultInstance
                            ? `Auto (${defaultInstance.displayName || defaultInstance.modelName})`
                            : "Auto"
                        }
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">
                        {defaultInstance
                          ? `Auto (${defaultInstance.displayName || defaultInstance.modelName})`
                          : "Auto"
                        }
                      </SelectItem>
                      {enabledInstances.map(i => (
                        <SelectItem key={i.id} value={i.modelId}>
                          {i.displayName || i.modelName || i.modelId || "Unknown Model"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
          </CardContent>
        )}
      </Card>
    </div>
  )
}

/**
 * Get the default model instance for a project
 * This can be used by other components (like BuildPlanEditor) to use the user's selected model
 */
export function getProjectDefaultModel(projectId: string): EnabledInstance | null {
  return getStoredDefaultInstance(projectId)
}

/**
 * Get all enabled model instances for a project
 */
export function getProjectEnabledModels(projectId: string): EnabledInstance[] {
  return getStoredEnabledInstances(projectId)
}

// Re-export EnabledInstance type for external use
export type { EnabledInstance }
