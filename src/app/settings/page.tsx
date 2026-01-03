"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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
import { LLMStatus } from "@/components/llm/llm-status"
import {
  resetSetup,
  addLocalServer,
  getGlobalSettings,
  saveGlobalSettings,
  type LocalServerConfig
} from "@/lib/settings/global-settings"
import {
  Settings,
  Server,
  Key,
  Bell,
  Shield,
  Palette,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle,
  ExternalLink,
  Cpu,
  Cloud,
  GitBranch,
  Mic,
  DollarSign,
  Zap,
  Brain,
  ImageIcon,
  AlertCircle,
  Plus,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  RotateCcw
} from "lucide-react"

interface ServiceStatus {
  name: string
  url: string
  status: "connected" | "disconnected" | "error"
  latency?: number
}

interface SettingToggle {
  id: string
  label: string
  description: string
  enabled: boolean
}

const mockServices: ServiceStatus[] = [
  { name: "n8n Orchestrator", url: "http://orangepi:5678", status: "connected", latency: 45 },
  { name: "LM Studio BEAST", url: "http://192.168.245.155:1234", status: "connected", latency: 23 },
  { name: "LM Studio BEDROOM", url: "http://192.168.27.182:1234", status: "connected", latency: 31 },
  { name: "GitLab", url: "https://bill-dev-linux-1", status: "connected", latency: 12 },
  { name: "Linear", url: "api.linear.app", status: "connected", latency: 89 },
  { name: "Claude API", url: "api.anthropic.com", status: "connected", latency: 156 },
]

const statusConfig = {
  connected: { label: "Connected", color: "text-green-400", bg: "bg-green-400" },
  disconnected: { label: "Disconnected", color: "text-muted-foreground", bg: "bg-muted-foreground" },
  error: { label: "Error", color: "text-red-400", bg: "bg-red-400" }
}

function SettingsPageContent() {
  const searchParams = useSearchParams()
  const [services, setServices] = useState<ServiceStatus[]>(mockServices)
  const [activeTab, setActiveTab] = useState<string>("ai-services")
  const { settings, update } = useSettings()

  // Handle tab query parameter
  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab && ["ai-services", "connections", "api-keys", "notifications", "automation", "security", "appearance"].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Dialog states
  const [addServerDialog, setAddServerDialog] = useState(false)
  const [addApiDialog, setAddApiDialog] = useState(false)
  const [addGitDialog, setAddGitDialog] = useState(false)

  // Form states for Add Local Server
  const [newServerName, setNewServerName] = useState("")
  const [newServerUrl, setNewServerUrl] = useState("")
  const [newServerType, setNewServerType] = useState<"lmstudio" | "ollama" | "custom">("lmstudio")
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle")
  const [serverModels, setServerModels] = useState<string[]>([])
  const [selectedServerModel, setSelectedServerModel] = useState<string>("")

  // Form states for Add API Service
  const [newApiProvider, setNewApiProvider] = useState<"anthropic" | "openai" | "google">("anthropic")
  const [newApiKey, setNewApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [testingApiKey, setTestingApiKey] = useState(false)
  const [apiKeyStatus, setApiKeyStatus] = useState<"idle" | "success" | "error">("idle")
  const [apiKeyError, setApiKeyError] = useState("")
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)

  // Form states for Add Git Remote
  const [newGitUrl, setNewGitUrl] = useState("")
  const [newGitName, setNewGitName] = useState("")

  async function handleTestConnection() {
    if (!newServerUrl) return
    setTestingConnection(true)
    setConnectionStatus("idle")
    setServerModels([])
    setSelectedServerModel("")

    try {
      const response = await fetch(`${newServerUrl}/v1/models`, {
        signal: AbortSignal.timeout(5000)
      })

      if (response.ok) {
        setConnectionStatus("success")
        const data = await response.json()
        // Extract model IDs
        const models = (data.data || []).map((m: { id: string }) => m.id)
        setServerModels(models)
        // Don't auto-select - let user choose
      } else {
        setConnectionStatus("error")
      }
    } catch {
      setConnectionStatus("error")
    } finally {
      setTestingConnection(false)
    }
  }

  async function handleAddServer() {
    if (!newServerName || !newServerUrl) return
    if (serverModels.length > 0 && !selectedServerModel) {
      // Don't allow adding without selecting a model if models are available
      return
    }

    addLocalServer({
      name: newServerName,
      type: newServerType,
      baseUrl: newServerUrl,
      enabled: true,
      defaultModel: selectedServerModel || undefined
    })

    // Add to services list
    setServices(prev => [...prev, {
      name: newServerName,
      url: newServerUrl,
      status: connectionStatus === "success" ? "connected" : "disconnected"
    }])

    // Reset form
    setNewServerName("")
    setNewServerUrl("")
    setConnectionStatus("idle")
    setServerModels([])
    setSelectedServerModel("")
    setAddServerDialog(false)
  }

  async function handleTestApiKey() {
    if (!newApiKey) return
    setTestingApiKey(true)
    setApiKeyStatus("idle")
    setApiKeyError("")

    try {
      const response = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: newApiProvider, apiKey: newApiKey })
      })
      const data = await response.json()

      if (data.valid) {
        setApiKeyStatus("success")
      } else {
        setApiKeyStatus("error")
        setApiKeyError(data.error || "Invalid API key")
      }
    } catch {
      setApiKeyStatus("error")
      setApiKeyError("Connection failed")
    } finally {
      setTestingApiKey(false)
    }
  }

  async function handleAddApiService() {
    if (!newApiKey || apiKeyStatus !== "success") return

    // Save to global settings
    const globalSettings = getGlobalSettings()
    const existingIndex = globalSettings.cloudProviders.findIndex(p => p.provider === newApiProvider)

    if (existingIndex >= 0) {
      globalSettings.cloudProviders[existingIndex].apiKey = newApiKey
      globalSettings.cloudProviders[existingIndex].enabled = true
    } else {
      globalSettings.cloudProviders.push({
        provider: newApiProvider,
        enabled: true,
        apiKey: newApiKey,
        enabledModels: []
      })
    }
    saveGlobalSettings(globalSettings)

    // Add to services list
    const providerNames = {
      anthropic: "Claude API",
      openai: "OpenAI API",
      google: "Google AI"
    }
    setServices(prev => {
      const filtered = prev.filter(s => !s.name.includes(providerNames[newApiProvider]))
      return [...filtered, {
        name: providerNames[newApiProvider],
        url: `api.${newApiProvider}.com`,
        status: "connected"
      }]
    })

    // Reset form
    setNewApiKey("")
    setApiKeyStatus("idle")
    setShowApiKey(false)
    setAddApiDialog(false)
  }

  function handleAddGitRemote() {
    if (!newGitUrl || !newGitName) return

    setServices(prev => [...prev, {
      name: newGitName,
      url: newGitUrl,
      status: "connected"
    }])

    setNewGitUrl("")
    setNewGitName("")
    setAddGitDialog(false)
  }

  function handleResetSetup() {
    if (confirm("This will reset all settings and show the setup wizard again. Continue?")) {
      resetSetup()
    }
  }

  const [notifications, setNotifications] = useState<SettingToggle[]>([
    { id: "n1", label: "Approval Requests", description: "Get notified when human approval is needed", enabled: true },
    { id: "n2", label: "Error Alerts", description: "Immediate alerts for build failures and errors", enabled: true },
    { id: "n3", label: "Daily Summary", description: "Daily email summary of all activity", enabled: false },
    { id: "n4", label: "Cost Alerts", description: "Alert when approaching budget limits", enabled: true },
    { id: "n5", label: "Completion Notifications", description: "Notify when packets complete", enabled: false }
  ])

  const [automationSettings, setAutomationSettings] = useState<SettingToggle[]>([
    { id: "a1", label: "Auto-start Queued Packets", description: "Automatically start packets when agents are available", enabled: true },
    { id: "a2", label: "Auto-retry Failed Builds", description: "Retry failed builds up to 3 times", enabled: true },
    { id: "a3", label: "Auto-merge on Approval", description: "Merge PRs automatically after approval", enabled: false },
    { id: "a4", label: "Auto-deploy to Staging", description: "Deploy to staging after tests pass", enabled: true },
    { id: "a5", label: "Ralph Wiggum Loop", description: "Keep iterating until all tests pass", enabled: true }
  ])

  const tabs = [
    { id: "ai-services", label: "AI Services", icon: Brain },
    { id: "connections", label: "Connections", icon: Server },
    { id: "api-keys", label: "API Keys", icon: Key },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "automation", label: "Automation", icon: Zap },
    { id: "security", label: "Security", icon: Shield },
    { id: "appearance", label: "Appearance", icon: Palette }
  ]

  const toggleSetting = (list: SettingToggle[], setList: React.Dispatch<React.SetStateAction<SettingToggle[]>>, id: string) => {
    setList(list.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your development pipeline
          </p>
        </div>
        <Button className="gap-2">
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
      </div>

      {/* Main Layout */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <Card className="lg:col-span-1 h-fit">
          <CardContent className="p-2">
            <nav className="space-y-1">
              {tabs.map(tab => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left",
                      activeTab === tab.id
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </CardContent>
        </Card>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* AI Services Tab */}
          {activeTab === "ai-services" && (
            <>
              {/* LLM Status */}
              <LLMStatus />

              {/* Image Generation */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Image Generation
                  </CardTitle>
                  <CardDescription>
                    Configure AI image generation for logos, icons, and graphics
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-5 w-5 text-yellow-500" />
                      <div>
                        <p className="font-medium">Enable Paid Image Generation</p>
                        <p className="text-sm text-muted-foreground">
                          Use NanoBanana AI for logos and graphics
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.allowPaidImageGen}
                      onCheckedChange={(checked) => update({ allowPaidImageGen: checked })}
                    />
                  </div>

                  {settings.allowPaidImageGen && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="nanoBananaKey">NanoBanana API Key</Label>
                        <input
                          id="nanoBananaKey"
                          type="password"
                          placeholder="nb_api_..."
                          value={settings.nanoBananaApiKey || ""}
                          onChange={(e) => update({ nanoBananaApiKey: e.target.value })}
                          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Image generation will use AI to create logos, icons, and marketing graphics for your projects.
                      </p>
                    </div>
                  )}

                  {!settings.allowPaidImageGen && (
                    <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
                      Image generation requires a paid API key. Projects will use placeholder graphics.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Cost Warning */}
              <Card className="border-yellow-500/50 bg-yellow-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="font-medium text-yellow-600">About Paid Services</p>
                      <p className="text-sm text-muted-foreground">
                        This application prioritizes <strong>local LLMs</strong> (LM Studio, Ollama) for all AI operations.
                        Paid services (Claude API, NanoBanana) are only used when explicitly enabled and local options are unavailable.
                        All core functionality works without any paid subscriptions.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Connections Tab */}
          {activeTab === "connections" && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Service Connections</CardTitle>
                      <CardDescription>Manage connections to external services and agents</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Test All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {services.map(service => {
                    const config = statusConfig[service.status]
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
                        <div className="flex items-center gap-4">
                          {service.latency && (
                            <span className="text-xs text-muted-foreground">
                              {service.latency}ms
                            </span>
                          )}
                          <Badge variant={service.status === "connected" ? "success" : "destructive"}>
                            {config.label}
                          </Badge>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

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
          )}

          {/* API Keys Tab */}
          {activeTab === "api-keys" && (
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Manage API keys for external services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: "n8n API Key", service: "n8n", masked: "eyJhb...5NiJ9", lastUsed: "2 minutes ago" },
                  { name: "Linear API Key", service: "Linear", masked: "lin_api...zFB5", lastUsed: "15 minutes ago" },
                  { name: "Claude API Key", service: "Anthropic", masked: "sk-ant...xxxx", lastUsed: "Just now" },
                  { name: "GitLab SSH Key", service: "GitLab", masked: "SHA256:xxxx...xxxx", lastUsed: "1 hour ago" }
                ].map(key => (
                  <div key={key.name} className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">{key.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {key.service} • Last used: {key.lastUsed}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 rounded bg-muted text-xs font-mono">
                        {key.masked}
                      </code>
                      <Button variant="outline" size="sm">Rotate</Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full gap-2">
                  <Key className="h-4 w-4" />
                  Add API Key
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Control how and when you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {notifications.map(setting => (
                  <div
                    key={setting.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium">{setting.label}</p>
                      <p className="text-sm text-muted-foreground">{setting.description}</p>
                    </div>
                    <button
                      onClick={() => toggleSetting(notifications, setNotifications, setting.id)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        setting.enabled ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          setting.enabled ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Automation Tab */}
          {activeTab === "automation" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Automation Settings</CardTitle>
                  <CardDescription>Configure automatic behaviors for the pipeline</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {automationSettings.map(setting => (
                    <div
                      key={setting.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">{setting.label}</p>
                        <p className="text-sm text-muted-foreground">{setting.description}</p>
                      </div>
                      <button
                        onClick={() => toggleSetting(automationSettings, setAutomationSettings, setting.id)}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                          setting.enabled ? "bg-primary" : "bg-muted"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            setting.enabled ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Budget Limits</CardTitle>
                  <CardDescription>Set spending limits and alerts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Daily Budget</label>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <input
                          type="number"
                          defaultValue="35.00"
                          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Monthly Budget</label>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <input
                          type="number"
                          defaultValue="750.00"
                          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Alert Threshold</label>
                    <p className="text-xs text-muted-foreground">Alert when this percentage of budget is used</p>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      defaultValue="80"
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>50%</span>
                      <span>80%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Manage security and access controls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Require Approval for Deployments</p>
                      <p className="text-sm text-muted-foreground">All production deployments require human approval</p>
                    </div>
                    <Badge variant="success">Enabled</Badge>
                  </div>
                </div>
                <div className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Secret Scanning</p>
                      <p className="text-sm text-muted-foreground">Prevent commits containing secrets</p>
                    </div>
                    <Badge variant="success">Enabled</Badge>
                  </div>
                </div>
                <div className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Dependency Audit</p>
                      <p className="text-sm text-muted-foreground">Block packages with known vulnerabilities</p>
                    </div>
                    <Badge variant="warning">Warn Only</Badge>
                  </div>
                </div>
                <div className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">API Rate Limiting</p>
                      <p className="text-sm text-muted-foreground">Limit API calls to prevent abuse</p>
                    </div>
                    <Badge variant="success">Enabled</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Appearance Tab */}
          {activeTab === "appearance" && (
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize the look and feel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium">Theme</label>
                  <div className="grid grid-cols-3 gap-4">
                    {["Dark", "Light", "System"].map(theme => (
                      <button
                        key={theme}
                        className={cn(
                          "p-4 rounded-lg border text-center transition-colors",
                          theme === "Dark" ? "border-primary bg-accent" : "hover:bg-accent/50"
                        )}
                      >
                        <p className="font-medium">{theme}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium">Accent Color</label>
                  <div className="flex gap-3">
                    {["blue", "green", "purple", "orange", "pink"].map(color => (
                      <button
                        key={color}
                        className={cn(
                          "h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all",
                          color === "blue" && "bg-blue-500 ring-blue-500",
                          color === "green" && "bg-green-500 ring-transparent hover:ring-green-500",
                          color === "purple" && "bg-purple-500 ring-transparent hover:ring-purple-500",
                          color === "orange" && "bg-orange-500 ring-transparent hover:ring-orange-500",
                          color === "pink" && "bg-pink-500 ring-transparent hover:ring-pink-500"
                        )}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium">Sidebar</label>
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">Collapsed by default</p>
                      <p className="text-sm text-muted-foreground">Start with sidebar collapsed</p>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Local Server Dialog */}
      <Dialog open={addServerDialog} onOpenChange={setAddServerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              Add Local AI Server
            </DialogTitle>
            <DialogDescription>
              Connect to an LM Studio or Ollama server on your network
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="serverName">Server Name</Label>
              <Input
                id="serverName"
                placeholder="e.g., LM Studio Beast"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serverUrl">Server URL</Label>
              <div className="flex gap-2">
                <Input
                  id="serverUrl"
                  placeholder="http://192.168.1.100:1234"
                  value={newServerUrl}
                  onChange={(e) => setNewServerUrl(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={!newServerUrl || testingConnection}
                >
                  {testingConnection ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Test"
                  )}
                </Button>
              </div>
              {connectionStatus === "success" && (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Connection successful
                </p>
              )}
              {connectionStatus === "error" && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  Connection failed
                </p>
              )}
            </div>

            {/* Model Selection - only show after successful connection */}
            {connectionStatus === "success" && serverModels.length > 0 && (
              <div className="space-y-2">
                <Label>Select Default Model</Label>
                <p className="text-xs text-muted-foreground">
                  Choose which model to use by default on this server
                </p>
                <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                  {serverModels.map(model => (
                    <button
                      key={model}
                      onClick={() => setSelectedServerModel(model)}
                      className={cn(
                        "w-full text-left p-2 rounded text-sm transition-colors",
                        selectedServerModel === model
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      )}
                    >
                      {model}
                    </button>
                  ))}
                </div>
                {!selectedServerModel && (
                  <p className="text-xs text-amber-500">
                    Please select a model before adding
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddServerDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddServer}
              disabled={!newServerName || !newServerUrl || (serverModels.length > 0 && !selectedServerModel)}
            >
              Add Server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add API Service Dialog */}
      <Dialog open={addApiDialog} onOpenChange={(open) => {
        setAddApiDialog(open)
        if (!open) {
          // Reset state when closing
          setNewApiProvider("anthropic")
          setNewApiKey("")
          setApiKeyStatus("idle")
          setShowApiKey(false)
          setShowApiKeyInput(false)
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Add Cloud API Service
            </DialogTitle>
            <DialogDescription>
              Select a provider to connect
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label>Select Provider</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "anthropic" as const, name: "Anthropic", sub: "Claude", color: "text-orange-500" },
                  { id: "openai" as const, name: "OpenAI", sub: "ChatGPT", color: "text-emerald-500" },
                  { id: "google" as const, name: "Google", sub: "Gemini", color: "text-blue-500" }
                ].map(provider => (
                  <button
                    key={provider.id}
                    onClick={() => {
                      setNewApiProvider(provider.id)
                      setApiKeyStatus("idle")
                      setApiKeyError("")
                      setNewApiKey("")
                      setShowApiKeyInput(false)
                    }}
                    className={cn(
                      "p-3 rounded-lg border text-center transition-colors",
                      newApiProvider === provider.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent"
                    )}
                  >
                    <span className={cn("font-medium text-sm block", provider.color)}>
                      {provider.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{provider.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sign in with Google - shown after provider selection */}
            {newApiProvider && (
              <div className="space-y-3 pt-2 border-t">
                <Button
                  variant="outline"
                  className="w-full gap-2 h-11"
                  onClick={() => {
                    setAddApiDialog(false)
                    window.location.href = `/api/auth/oauth/${newApiProvider}`
                  }}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in to {newApiProvider === "anthropic" ? "Anthropic" : newApiProvider === "openai" ? "OpenAI" : "Google AI"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Uses your {newApiProvider === "anthropic" ? "Claude" : newApiProvider === "openai" ? "ChatGPT Plus" : "Google AI"} subscription
                </p>

                {/* Use API Key Instead link */}
                {!showApiKeyInput ? (
                  <button
                    onClick={() => setShowApiKeyInput(true)}
                    className="w-full text-xs text-muted-foreground hover:text-primary text-center py-2"
                  >
                    Use API key instead
                  </button>
                ) : (
                  <div className="space-y-3 pt-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="apiKey"
                          type={showApiKey ? "text" : "password"}
                          placeholder="Enter API key..."
                          value={newApiKey}
                          onChange={(e) => {
                            setNewApiKey(e.target.value)
                            setApiKeyStatus("idle")
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
                    {apiKeyStatus === "success" && (
                      <p className="text-xs text-green-500 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        API key valid
                      </p>
                    )}
                    {apiKeyStatus === "error" && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {apiKeyError}
                      </p>
                    )}
                    <Button
                      className="w-full"
                      onClick={handleAddApiService}
                      disabled={!newApiKey || apiKeyStatus !== "success"}
                    >
                      Connect with API Key
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddApiDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Git Remote Dialog */}
      <Dialog open={addGitDialog} onOpenChange={setAddGitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Add Git Remote
            </DialogTitle>
            <DialogDescription>
              Connect to a Git repository
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="gitName">Repository Name</Label>
              <Input
                id="gitName"
                placeholder="e.g., My Project"
                value={newGitName}
                onChange={(e) => setNewGitName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gitUrl">Repository URL</Label>
              <Input
                id="gitUrl"
                placeholder="https://gitlab.com/user/repo.git"
                value={newGitUrl}
                onChange={(e) => setNewGitUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddGitDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddGitRemote}
              disabled={!newGitName || !newGitUrl}
            >
              Add Remote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <SettingsPageContent />
    </Suspense>
  )
}
