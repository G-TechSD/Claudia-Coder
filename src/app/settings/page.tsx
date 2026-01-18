"use client"

import { useState, useEffect, useCallback, Suspense, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useSettings } from "@/hooks/useSettings"
import {
  getGlobalSettings,
  saveGlobalSettings,
  addLocalServer,
  updateLocalServer,
  removeLocalServer,
  type LocalServerConfig,
  type CloudProviderConfig,
  type DefaultModelConfig,
} from "@/lib/settings/global-settings"
import {
  getDataSummary,
  clearAllData,
  clearProjectData,
  exportAllData,
  importData
} from "@/lib/data/reset"
import {
  Server,
  Cpu,
  Cloud,
  GitBranch,
  Palette,
  Settings2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  HardDrive,
  Upload,
  Download as DownloadIcon,
  AlertOctagon,
  Eye,
  EyeOff,
  Plus,
  Star,
  Zap,
  ExternalLink,
  Key,
  Workflow,
  Code2,
} from "lucide-react"

// Provider display names and colors
const PROVIDER_INFO: Record<string, { name: string; color: string; icon: typeof Cloud }> = {
  lmstudio: { name: "LM Studio", color: "text-purple-500", icon: Cpu },
  ollama: { name: "Ollama", color: "text-blue-500", icon: Cpu },
  anthropic: { name: "Anthropic", color: "text-orange-500", icon: Cloud },
  openai: { name: "OpenAI", color: "text-emerald-500", icon: Cloud },
  google: { name: "Google AI", color: "text-blue-500", icon: Cloud },
}

// Fallback models for cloud providers
const FALLBACK_MODELS: Record<string, { id: string; name: string }[]> = {
  anthropic: [
    { id: "claude-opus-4-5-20251101", name: "Claude Opus 4.5" },
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "o3-mini", name: "o3-mini" },
  ],
  google: [
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  ],
}

interface ServerStatus {
  id: string
  name: string
  url: string
  type: "lmstudio" | "ollama" | "custom"
  status: "connected" | "disconnected" | "checking"
  models: string[]
  defaultModel?: string
}

interface CloudProviderStatus {
  provider: "anthropic" | "openai" | "google"
  enabled: boolean
  hasApiKey: boolean
  authMethod?: "apiKey" | "oauth"
  oauthUser?: { email: string; name?: string }
}

function SettingsPageContent() {
  const searchParams = useSearchParams()
  const { settings, update } = useSettings()

  // Global settings state
  const [globalSettings, setGlobalSettings] = useState(() => getGlobalSettings())

  // Local server states
  const [localServers, setLocalServers] = useState<ServerStatus[]>([])
  const [checkingServers, setCheckingServers] = useState(false)

  // Cloud provider states
  const [cloudProviders, setCloudProviders] = useState<CloudProviderStatus[]>([])

  // UI state
  const [openSections, setOpenSections] = useState<string[]>(["ai-providers"])
  const [refreshing, setRefreshing] = useState(false)

  // Dialog states
  const [addServerDialog, setAddServerDialog] = useState(false)
  const [addCloudDialog, setAddCloudDialog] = useState(false)
  const [editServerDialog, setEditServerDialog] = useState<ServerStatus | null>(null)
  const [deleteServerDialog, setDeleteServerDialog] = useState<ServerStatus | null>(null)

  // Form states for Add Local Server
  const [newServerName, setNewServerName] = useState("")
  const [newServerUrl, setNewServerUrl] = useState("http://localhost:1234")
  const [newServerType, setNewServerType] = useState<"lmstudio" | "ollama" | "custom">("lmstudio")
  const [testingServer, setTestingServer] = useState(false)
  const [serverTestResult, setServerTestResult] = useState<{ status: "idle" | "success" | "error"; models: string[] }>({ status: "idle", models: [] })
  const [selectedNewModel, setSelectedNewModel] = useState("")

  // Form states for Add Cloud Provider
  const [selectedCloudProvider, setSelectedCloudProvider] = useState<"anthropic" | "openai" | "google">("anthropic")
  const [newApiKey, setNewApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [testingApiKey, setTestingApiKey] = useState(false)
  const [apiKeyTestResult, setApiKeyTestResult] = useState<{ status: "idle" | "success" | "error"; error?: string }>({ status: "idle" })

  // Data management state
  const [dataSummary, setDataSummary] = useState(() => getDataSummary())
  const [showDangerZone, setShowDangerZone] = useState(false)
  const [confirmClear, setConfirmClear] = useState("")
  const [clearingData, setClearingData] = useState(false)

  // Appearance state
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark")
  const [accentColor, setAccentColor] = useState("blue")

  // Initialize from URL params
  useEffect(() => {
    const section = searchParams.get("section")
    if (section) {
      setOpenSections([section])
    }
  }, [searchParams])

  // Load settings and check server statuses on mount
  useEffect(() => {
    loadSettings()
  }, [])

  // Load settings from localStorage
  const loadSettings = useCallback(() => {
    const gs = getGlobalSettings()
    setGlobalSettings(gs)

    // Initialize local servers from settings
    const servers: ServerStatus[] = gs.localServers.map(s => ({
      id: s.id,
      name: s.name,
      url: s.baseUrl,
      type: s.type,
      status: "disconnected" as const,
      models: [],
      defaultModel: s.defaultModel,
    }))
    setLocalServers(servers)

    // Initialize cloud providers
    const providers: CloudProviderStatus[] = gs.cloudProviders.map(p => ({
      provider: p.provider,
      enabled: p.enabled,
      hasApiKey: Boolean(p.apiKey) || p.authMethod === "oauth",
      authMethod: p.authMethod,
      oauthUser: p.oauthUser,
    }))
    setCloudProviders(providers)

    // Check server statuses
    if (servers.length > 0) {
      checkServerStatuses(servers)
    }
  }, [])

  // Check status of all local servers
  const checkServerStatuses = useCallback(async (servers: ServerStatus[]) => {
    setCheckingServers(true)

    const updatedServers = await Promise.all(
      servers.map(async (server) => {
        try {
          const response = await fetch("/api/lmstudio-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: server.url, name: server.name }),
          })

          if (response.ok) {
            const data = await response.json()
            return {
              ...server,
              status: data.status === "connected" ? "connected" as const : "disconnected" as const,
              models: data.models || [],
            }
          }
        } catch {
          // Server unreachable
        }
        return { ...server, status: "disconnected" as const, models: [] }
      })
    )

    setLocalServers(updatedServers)
    setCheckingServers(false)
  }, [])

  // Manual refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    loadSettings()
    await checkServerStatuses(localServers)
    setRefreshing(false)
  }, [loadSettings, checkServerStatuses, localServers])

  // Test new server connection
  const handleTestNewServer = async () => {
    if (!newServerUrl) return
    setTestingServer(true)
    setServerTestResult({ status: "idle", models: [] })

    try {
      const response = await fetch("/api/lmstudio-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newServerUrl, name: newServerName || "Test" }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.status === "connected") {
          setServerTestResult({ status: "success", models: data.models || [] })
        } else {
          setServerTestResult({ status: "error", models: [] })
        }
      } else {
        setServerTestResult({ status: "error", models: [] })
      }
    } catch {
      setServerTestResult({ status: "error", models: [] })
    } finally {
      setTestingServer(false)
    }
  }

  // Add new local server
  const handleAddServer = () => {
    if (!newServerName || !newServerUrl) return

    const newServer = addLocalServer({
      name: newServerName,
      type: newServerType,
      baseUrl: newServerUrl,
      enabled: true,
      defaultModel: selectedNewModel || undefined,
    })

    setLocalServers(prev => [...prev, {
      id: newServer.id,
      name: newServer.name,
      url: newServer.baseUrl,
      type: newServer.type,
      status: serverTestResult.status === "success" ? "connected" : "disconnected",
      models: serverTestResult.models,
      defaultModel: selectedNewModel || undefined,
    }])

    // Reset form
    setNewServerName("")
    setNewServerUrl("http://localhost:1234")
    setServerTestResult({ status: "idle", models: [] })
    setSelectedNewModel("")
    setAddServerDialog(false)
  }

  // Delete local server
  const handleDeleteServer = (server: ServerStatus) => {
    removeLocalServer(server.id)
    setLocalServers(prev => prev.filter(s => s.id !== server.id))
    setDeleteServerDialog(null)
  }

  // Update server default model
  const handleServerModelChange = (serverId: string, modelId: string) => {
    updateLocalServer(serverId, { defaultModel: modelId })
    setLocalServers(prev => prev.map(s =>
      s.id === serverId ? { ...s, defaultModel: modelId } : s
    ))
  }

  // Test API key
  const handleTestApiKey = async () => {
    if (!newApiKey) return
    setTestingApiKey(true)
    setApiKeyTestResult({ status: "idle" })

    try {
      const response = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedCloudProvider, apiKey: newApiKey }),
      })
      const data = await response.json()

      if (data.valid) {
        setApiKeyTestResult({ status: "success" })
      } else {
        setApiKeyTestResult({ status: "error", error: data.error || "Invalid API key" })
      }
    } catch {
      setApiKeyTestResult({ status: "error", error: "Connection failed" })
    } finally {
      setTestingApiKey(false)
    }
  }

  // Add cloud provider
  const handleAddCloudProvider = () => {
    if (!newApiKey || apiKeyTestResult.status !== "success") return

    const gs = getGlobalSettings()
    const existingIndex = gs.cloudProviders.findIndex(p => p.provider === selectedCloudProvider)

    if (existingIndex >= 0) {
      gs.cloudProviders[existingIndex].apiKey = newApiKey
      gs.cloudProviders[existingIndex].enabled = true
      gs.cloudProviders[existingIndex].authMethod = "apiKey"
    } else {
      gs.cloudProviders.push({
        provider: selectedCloudProvider,
        enabled: true,
        apiKey: newApiKey,
        enabledModels: [],
        authMethod: "apiKey",
      })
    }
    saveGlobalSettings(gs)

    setCloudProviders(prev => {
      const filtered = prev.filter(p => p.provider !== selectedCloudProvider)
      return [...filtered, {
        provider: selectedCloudProvider,
        enabled: true,
        hasApiKey: true,
        authMethod: "apiKey",
      }]
    })

    // Reset form
    setNewApiKey("")
    setApiKeyTestResult({ status: "idle" })
    setAddCloudDialog(false)
  }

  // Remove cloud provider
  const handleRemoveCloudProvider = (provider: "anthropic" | "openai" | "google") => {
    const gs = getGlobalSettings()
    const index = gs.cloudProviders.findIndex(p => p.provider === provider)
    if (index >= 0) {
      gs.cloudProviders[index].enabled = false
      gs.cloudProviders[index].apiKey = undefined
      gs.cloudProviders[index].authMethod = undefined
      gs.cloudProviders[index].oauthTokens = undefined
      gs.cloudProviders[index].oauthUser = undefined
      saveGlobalSettings(gs)
    }

    setCloudProviders(prev => prev.filter(p => p.provider !== provider))
  }

  // Set default model
  const handleSetDefaultModel = (provider: string, serverId: string | undefined, modelId: string, displayName: string) => {
    const gs = getGlobalSettings()
    gs.defaultModel = {
      provider,
      serverId,
      modelId,
      displayName,
    }
    saveGlobalSettings(gs)
    setGlobalSettings(gs)
  }

  // Get all available models for default selection
  const availableModels = useMemo(() => {
    const models: { provider: string; serverId?: string; modelId: string; displayName: string; isLocal: boolean }[] = []

    // Add local server models
    localServers.forEach(server => {
      if (server.status === "connected") {
        server.models.forEach(model => {
          models.push({
            provider: server.type,
            serverId: server.id,
            modelId: model,
            displayName: `${model} (${server.name})`,
            isLocal: true,
          })
        })
      }
    })

    // Add cloud provider models
    cloudProviders.forEach(cp => {
      if (cp.enabled && cp.hasApiKey) {
        const providerModels = FALLBACK_MODELS[cp.provider] || []
        providerModels.forEach(model => {
          models.push({
            provider: cp.provider,
            serverId: undefined,
            modelId: model.id,
            displayName: `${model.name} (${PROVIDER_INFO[cp.provider]?.name || cp.provider})`,
            isLocal: false,
          })
        })
      }
    })

    return models
  }, [localServers, cloudProviders])

  // Export data
  const handleExportData = () => {
    const data = exportAllData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `claudia-backup-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Import data
  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const imported = importData(data)
      alert(`Successfully imported ${imported.length} items`)
      setDataSummary(getDataSummary())
      loadSettings()
    } catch (error) {
      alert("Failed to import data: " + (error instanceof Error ? error.message : "Invalid file"))
    } finally {
      event.target.value = ""
    }
  }

  // Clear all data
  const handleClearAllData = () => {
    if (confirmClear !== "DELETE ALL") return
    setClearingData(true)
    const result = clearAllData({ keepToken: true })
    setClearingData(false)
    setConfirmClear("")
    setShowDangerZone(false)
    alert(`Cleared ${result.clearedKeys.length} items.`)
    setDataSummary(getDataSummary())
    loadSettings()
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure AI providers, preferences, and integrations
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Settings Accordion */}
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="space-y-4"
      >
        {/* AI Providers Section */}
        <AccordionItem value="ai-providers" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Cpu className="h-5 w-5 text-purple-500" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">AI Providers</h3>
                <p className="text-sm text-muted-foreground font-normal">
                  Local LLM servers and cloud APIs
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2">
            <div className="space-y-4">
              {/* Local Servers */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Local Servers</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddServerDialog(true)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Server
                  </Button>
                </div>

                {localServers.length === 0 ? (
                  <div className="p-4 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
                    No local servers configured. Add an LM Studio or Ollama server.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {localServers.map(server => (
                      <div
                        key={server.id}
                        className="p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-2.5 w-2.5 rounded-full",
                              server.status === "connected" ? "bg-green-500" :
                              server.status === "checking" ? "bg-yellow-500 animate-pulse" :
                              "bg-gray-400"
                            )} />
                            <div>
                              <p className="font-medium">{server.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{server.url}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={server.status === "connected" ? "success" : "secondary"}>
                              {server.status === "connected" ? "Connected" :
                               server.status === "checking" ? "Checking..." : "Offline"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteServerDialog(server)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {server.status === "connected" && server.models.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-muted-foreground">Default Model</Label>
                              <Select
                                value={server.defaultModel || ""}
                                onValueChange={(value) => handleServerModelChange(server.id, value)}
                              >
                                <SelectTrigger className="w-[200px] h-8 text-xs">
                                  <SelectValue placeholder="Select model..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {server.models.map(model => (
                                    <SelectItem key={model} value={model}>
                                      {model}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cloud Providers */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Cloud Providers</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddCloudDialog(true)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Provider
                  </Button>
                </div>

                {cloudProviders.filter(p => p.enabled).length === 0 ? (
                  <div className="p-4 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
                    No cloud providers configured. Add Anthropic, OpenAI, or Google AI.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cloudProviders.filter(p => p.enabled).map(provider => {
                      const info = PROVIDER_INFO[provider.provider]
                      return (
                        <div
                          key={provider.provider}
                          className="p-4 rounded-lg border bg-card"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                              <div>
                                <p className={cn("font-medium", info?.color)}>{info?.name || provider.provider}</p>
                                <p className="text-xs text-muted-foreground">
                                  {provider.authMethod === "oauth" ? (
                                    <span className="flex items-center gap-1">
                                      <CheckCircle className="h-3 w-3 text-green-500" />
                                      {provider.oauthUser?.email || "OAuth connected"}
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1">
                                      <Key className="h-3 w-3" />
                                      API key configured
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="success">Connected</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveCloudProvider(provider.provider)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Paid Services Toggle */}
              <div className="p-4 rounded-lg border bg-muted/30 mt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    <div>
                      <Label className="font-medium">Enable Paid Services</Label>
                      <p className="text-xs text-muted-foreground">
                        Allow fallback to cloud APIs when local servers unavailable
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.allowPaidLLM}
                    onCheckedChange={(checked) => update({ allowPaidLLM: checked })}
                  />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Default Model Section */}
        <AccordionItem value="default-model" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Star className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Default Model</h3>
                <p className="text-sm text-muted-foreground font-normal">
                  {globalSettings.defaultModel?.displayName || "Not configured"}
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select the default AI model for new projects and operations.
                Local models are prioritized over paid cloud services.
              </p>

              {availableModels.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
                  No models available. Configure AI providers first.
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Local Models */}
                  {availableModels.filter(m => m.isLocal).length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase">Local Models (Free)</Label>
                      {availableModels.filter(m => m.isLocal).map(model => (
                        <button
                          key={`${model.serverId}-${model.modelId}`}
                          onClick={() => handleSetDefaultModel(model.provider, model.serverId, model.modelId, model.displayName)}
                          className={cn(
                            "w-full p-3 rounded-lg border text-left transition-colors",
                            globalSettings.defaultModel?.modelId === model.modelId &&
                            globalSettings.defaultModel?.serverId === model.serverId
                              ? "border-primary bg-primary/5"
                              : "hover:bg-accent"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{model.displayName}</span>
                            {globalSettings.defaultModel?.modelId === model.modelId &&
                             globalSettings.defaultModel?.serverId === model.serverId && (
                              <Badge variant="secondary" className="gap-1">
                                <Star className="h-3 w-3" />
                                Default
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Cloud Models */}
                  {availableModels.filter(m => !m.isLocal).length > 0 && (
                    <div className="space-y-2 pt-4 border-t">
                      <Label className="text-xs text-muted-foreground uppercase">Cloud Models (Paid)</Label>
                      {availableModels.filter(m => !m.isLocal).map(model => (
                        <button
                          key={`${model.provider}-${model.modelId}`}
                          onClick={() => handleSetDefaultModel(model.provider, model.serverId, model.modelId, model.displayName)}
                          className={cn(
                            "w-full p-3 rounded-lg border text-left transition-colors",
                            globalSettings.defaultModel?.modelId === model.modelId &&
                            globalSettings.defaultModel?.provider === model.provider
                              ? "border-primary bg-primary/5"
                              : "hover:bg-accent"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{model.displayName}</span>
                            {globalSettings.defaultModel?.modelId === model.modelId &&
                             globalSettings.defaultModel?.provider === model.provider && (
                              <Badge variant="secondary" className="gap-1">
                                <Star className="h-3 w-3" />
                                Default
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* User Interface Section */}
        <AccordionItem value="user-interface" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10">
                <Palette className="h-5 w-5 text-pink-500" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">User Interface</h3>
                <p className="text-sm text-muted-foreground font-normal">
                  Theme and display preferences
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2">
            <div className="space-y-6">
              {/* Theme */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Theme</Label>
                <div className="grid grid-cols-3 gap-3">
                  {(["dark", "light", "system"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => {
                        setTheme(t)
                        update({ theme: t })
                      }}
                      className={cn(
                        "p-4 rounded-lg border text-center transition-colors capitalize",
                        theme === t ? "border-primary bg-primary/5" : "hover:bg-accent"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent Color */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Accent Color</Label>
                <div className="flex gap-3">
                  {["blue", "green", "purple", "orange", "pink"].map(color => (
                    <button
                      key={color}
                      onClick={() => setAccentColor(color)}
                      className={cn(
                        "h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all",
                        color === "blue" && "bg-blue-500",
                        color === "green" && "bg-green-500",
                        color === "purple" && "bg-purple-500",
                        color === "orange" && "bg-orange-500",
                        color === "pink" && "bg-pink-500",
                        accentColor === color ? "ring-current" : "ring-transparent hover:ring-current/50"
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Auto Speak */}
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div>
                  <Label className="font-medium">Auto-speak Responses</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically speak AI responses aloud
                  </p>
                </div>
                <Switch
                  checked={settings.autoSpeak}
                  onCheckedChange={(checked) => update({ autoSpeak: checked })}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Integrations Section */}
        <AccordionItem value="integrations" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <GitBranch className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Integrations</h3>
                <p className="text-sm text-muted-foreground font-normal">
                  Git, Linear, and other services
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2">
            <div className="space-y-4">
              {/* Git */}
              <div className="p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GitBranch className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="font-medium">Git</p>
                      <p className="text-sm text-muted-foreground">
                        Version control integration
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">Auto-detected</Badge>
                </div>
              </div>

              {/* Linear */}
              <div className="p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Workflow className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="font-medium">Linear</p>
                      <p className="text-sm text-muted-foreground">
                        Issue tracking
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Connect</Button>
                </div>
              </div>

              {/* n8n */}
              <div className="p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="font-medium">n8n</p>
                      <p className="text-sm text-muted-foreground">
                        Workflow automation
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Configure</Button>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Advanced Section */}
        <AccordionItem value="advanced" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-500/10">
                <Code2 className="h-5 w-5 text-gray-500" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Advanced</h3>
                <p className="text-sm text-muted-foreground font-normal">
                  Developer options and data management
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-2">
            <div className="space-y-6">
              {/* Data Summary */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Stored Data</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border text-center">
                    <p className="text-xl font-bold">{dataSummary.projects}</p>
                    <p className="text-xs text-muted-foreground">Projects</p>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <p className="text-xl font-bold">{dataSummary.packets}</p>
                    <p className="text-xs text-muted-foreground">Packets</p>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <p className="text-xl font-bold">{dataSummary.buildPlans}</p>
                    <p className="text-xs text-muted-foreground">Build Plans</p>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <p className="text-xl font-bold">{dataSummary.totalKeys}</p>
                    <p className="text-xs text-muted-foreground">Total Keys</p>
                  </div>
                </div>
              </div>

              {/* Import/Export */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Import & Export</Label>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleExportData} className="gap-2">
                    <DownloadIcon className="h-4 w-4" />
                    Export Data
                  </Button>
                  <label>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportData}
                      className="hidden"
                    />
                    <Button variant="outline" asChild className="gap-2 cursor-pointer">
                      <span>
                        <Upload className="h-4 w-4" />
                        Import Data
                      </span>
                    </Button>
                  </label>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="space-y-3 pt-4 border-t">
                <button
                  onClick={() => setShowDangerZone(!showDangerZone)}
                  className="flex items-center gap-2 text-destructive"
                >
                  <AlertOctagon className="h-4 w-4" />
                  <Label className="text-sm font-medium cursor-pointer">Danger Zone</Label>
                </button>

                {showDangerZone && (
                  <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 space-y-4">
                    <div>
                      <p className="font-medium text-destructive">Delete All Data</p>
                      <p className="text-sm text-muted-foreground">
                        Permanently delete all projects, packets, and settings.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">
                        Type <code className="px-1 py-0.5 bg-muted rounded font-mono">DELETE ALL</code> to confirm:
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={confirmClear}
                          onChange={(e) => setConfirmClear(e.target.value)}
                          placeholder="Type DELETE ALL"
                          className="max-w-xs"
                        />
                        <Button
                          variant="destructive"
                          onClick={handleClearAllData}
                          disabled={confirmClear !== "DELETE ALL" || clearingData}
                          className="gap-2"
                        >
                          {clearingData ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Add Local Server Dialog */}
      <Dialog open={addServerDialog} onOpenChange={setAddServerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              Add Local AI Server
            </DialogTitle>
            <DialogDescription>
              Connect to an LM Studio or Ollama server
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="serverName">Server Name</Label>
              <Input
                id="serverName"
                placeholder="e.g., My Local LLM"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serverUrl">Server URL</Label>
              <div className="flex gap-2">
                <Input
                  id="serverUrl"
                  placeholder="http://localhost:1234"
                  value={newServerUrl}
                  onChange={(e) => setNewServerUrl(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={handleTestNewServer}
                  disabled={!newServerUrl || testingServer}
                >
                  {testingServer ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Test"
                  )}
                </Button>
              </div>
              {serverTestResult.status === "success" && (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Connected - {serverTestResult.models.length} models available
                </p>
              )}
              {serverTestResult.status === "error" && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  Connection failed
                </p>
              )}
            </div>

            {serverTestResult.status === "success" && serverTestResult.models.length > 0 && (
              <div className="space-y-2">
                <Label>Select Default Model</Label>
                <Select value={selectedNewModel} onValueChange={setSelectedNewModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model..." />
                  </SelectTrigger>
                  <SelectContent>
                    {serverTestResult.models.map(model => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddServerDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddServer}
              disabled={!newServerName || !newServerUrl || serverTestResult.status !== "success"}
            >
              Add Server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Cloud Provider Dialog */}
      <Dialog open={addCloudDialog} onOpenChange={setAddCloudDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Add Cloud Provider
            </DialogTitle>
            <DialogDescription>
              Connect to a cloud AI provider
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Provider</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["anthropic", "openai", "google"] as const).map(provider => {
                  const info = PROVIDER_INFO[provider]
                  return (
                    <button
                      key={provider}
                      onClick={() => {
                        setSelectedCloudProvider(provider)
                        setApiKeyTestResult({ status: "idle" })
                        setNewApiKey("")
                      }}
                      className={cn(
                        "p-3 rounded-lg border text-center transition-colors",
                        selectedCloudProvider === provider
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent"
                      )}
                    >
                      <span className={cn("font-medium text-sm block", info?.color)}>
                        {info?.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="apiKey"
                    type={showApiKey ? "text" : "password"}
                    placeholder={selectedCloudProvider === "anthropic" ? "sk-ant-..." :
                                selectedCloudProvider === "openai" ? "sk-..." : "AI..."}
                    value={newApiKey}
                    onChange={(e) => {
                      setNewApiKey(e.target.value)
                      setApiKeyTestResult({ status: "idle" })
                    }}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  variant="outline"
                  onClick={handleTestApiKey}
                  disabled={!newApiKey || testingApiKey}
                >
                  {testingApiKey ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Test"
                  )}
                </Button>
              </div>
              {apiKeyTestResult.status === "success" && (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  API key valid
                </p>
              )}
              {apiKeyTestResult.status === "error" && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  {apiKeyTestResult.error}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCloudDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddCloudProvider}
              disabled={!newApiKey || apiKeyTestResult.status !== "success"}
            >
              Add Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Server Confirmation Dialog */}
      <Dialog open={!!deleteServerDialog} onOpenChange={() => setDeleteServerDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Server</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove "{deleteServerDialog?.name}"?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteServerDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteServerDialog && handleDeleteServer(deleteServerDialog)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  )
}
