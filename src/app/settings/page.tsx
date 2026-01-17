"use client"

import { useState, useEffect, Suspense } from "react"
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
import { ConnectionsTab, type ServiceStatus } from "@/components/settings/connections-tab"
import {
  resetSetup,
  addLocalServer,
  getGlobalSettings,
  saveGlobalSettings,
  updateLocalServer,
  removeLocalServer
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
  Bell,
  Shield,
  Palette,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle,
  Cpu,
  Cloud,
  GitBranch,
  DollarSign,
  Zap,
  Brain,
  ImageIcon,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  HardDrive,
  Upload,
  Download as DownloadIcon,
  AlertOctagon,
  FileJson,
  Pencil
} from "lucide-react"

// Note: ServiceStatus type is imported from ConnectionsTab component

interface SettingToggle {
  id: string
  label: string
  description: string
  enabled: boolean
}

interface SecuritySetting {
  id: string
  label: string
  description: string
  type: "toggle" | "select"
  enabled?: boolean
  value?: string
  options?: { value: string; label: string; variant: "success" | "warning" | "destructive" }[]
}

// Default services - actual URLs should come from settings/environment
const mockServices: ServiceStatus[] = [
  { name: "n8n Orchestrator", url: "", status: "disconnected", latency: 0 },
  { name: "Local LLM Server", url: "", status: "disconnected", latency: 0 },
  { name: "GitLab", url: "", status: "disconnected", latency: 0 },
  { name: "Linear", url: "api.linear.app", status: "connected", latency: 89 },
  { name: "Claude API", url: "api.anthropic.com", status: "connected", latency: 156 },
]

// statusConfig has been moved to ConnectionsTab component

function SettingsPageContent() {
  const searchParams = useSearchParams()
  const [services, setServices] = useState<ServiceStatus[]>(mockServices)
  const [activeTab, setActiveTab] = useState<string>("ai-services")
  const [refreshingStatus, setRefreshingStatus] = useState(false)
  const { settings, update } = useSettings()

  // Function to refresh all LM Studio server statuses
  async function refreshLMStudioStatus() {
    try {
      // Add cache-busting to ensure fresh data
      const response = await fetch("/api/lmstudio-status", {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      if (response.ok) {
        const data = await response.json()
        // Update the services list with real status
        setServices(prev => {
          const updated = [...prev]
          for (const server of data.servers) {
            // Find existing service by URL or name
            const existingIndex = updated.findIndex(
              s => s.url === server.url ||
                   s.name.toUpperCase().includes(server.name.toUpperCase()) ||
                   server.name.toUpperCase().includes(s.name.replace("LM Studio ", "").toUpperCase())
            )
            if (existingIndex >= 0) {
              updated[existingIndex] = {
                ...updated[existingIndex],
                status: server.status,
                latency: server.latency
              }
            }
          }
          return updated
        })
      }
    } catch (error) {
      console.error("Failed to refresh LM Studio status:", error)
    }
  }

  // Also refresh N8N status
  async function refreshN8NStatus() {
    try {
      // Add cache-busting to ensure fresh data
      const response = await fetch("/api/n8n-status", {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      if (response.ok) {
        const data = await response.json()
        setServices(prev => prev.map(s => {
          if (s.name.toLowerCase().includes("n8n")) {
            // Determine appropriate status:
            // - Not configured: N8N URL is not set
            // - Connected: N8N is healthy
            // - Disconnected: N8N is configured but not reachable
            let status: "connected" | "disconnected" | "error" | "not_configured" = "disconnected"
            if (data.healthy) {
              status = "connected"
            } else if (data.configured === false) {
              status = "not_configured"
            }
            return {
              ...s,
              status,
              statusMessage: data.message,
              url: data.url || s.url,
              latency: data.healthy ? s.latency : undefined,
            }
          }
          return s
        }))
      }
    } catch (error) {
      console.error("Failed to refresh N8N status:", error)
    }
  }

  // Refresh all service statuses
  async function refreshAllStatuses() {
    setRefreshingStatus(true)
    await Promise.all([
      refreshLMStudioStatus(),
      refreshN8NStatus()
    ])
    setRefreshingStatus(false)
  }

  // Handle tab query parameter and OAuth callbacks
  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab && ["ai-services", "connections", "notifications", "automation", "security", "appearance", "data"].includes(tab)) {
      setActiveTab(tab)
    }

    // Handle Anthropic OAuth callback
    const oauthCode = searchParams.get("oauth_code")
    const provider = searchParams.get("provider")
    const oauthError = searchParams.get("oauth_error")

    if (provider === "anthropic") {
      if (oauthError) {
        setAnthropicOAuthStatus("error")
        setApiKeyError(oauthError === "access_denied" ? "Access denied" : oauthError)
        setAddApiDialog(true)
        // Clean up URL
        window.history.replaceState({}, "", window.location.pathname + "?tab=ai-services")
      } else if (oauthCode) {
        setAddApiDialog(true)
        handleAnthropicOAuthCallback(oauthCode)
        // Clean up URL
        window.history.replaceState({}, "", window.location.pathname + "?tab=ai-services")
      }
    }
   
  }, [searchParams])

  // Fetch real status on component mount
  useEffect(() => {
    refreshAllStatuses()
    // Refresh every 30 seconds
    const interval = setInterval(refreshAllStatuses, 30000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load cloud providers from global settings to populate OAuth info
  useEffect(() => {
    const globalSettings = getGlobalSettings()
    if (globalSettings.cloudProviders?.length) {
      setServices(prev => {
        const updated = [...prev]
        globalSettings.cloudProviders.forEach(cp => {
          if (cp.provider === "anthropic") {
            const existingIdx = updated.findIndex(s =>
              s.name.toLowerCase().includes("claude") || s.name.toLowerCase().includes("anthropic")
            )
            const serviceData: ServiceStatus = {
              name: cp.authMethod === "oauth" ? "Claude API (Max Plan)" : "Claude API",
              url: "api.anthropic.com",
              status: cp.enabled ? "connected" : "disconnected",
              apiKey: cp.apiKey,
              authMethod: cp.authMethod,
              oauthUser: cp.oauthUser
            }
            if (existingIdx >= 0) {
              updated[existingIdx] = { ...updated[existingIdx], ...serviceData }
            } else if (cp.enabled) {
              updated.push(serviceData)
            }
          } else if (cp.provider === "openai") {
            const existingIdx = updated.findIndex(s =>
              s.name.toLowerCase().includes("openai") || s.name.toLowerCase().includes("gpt")
            )
            const serviceData: ServiceStatus = {
              name: "OpenAI API",
              url: "api.openai.com",
              status: cp.enabled ? "connected" : "disconnected",
              apiKey: cp.apiKey
            }
            if (existingIdx >= 0) {
              updated[existingIdx] = { ...updated[existingIdx], ...serviceData }
            } else if (cp.enabled) {
              updated.push(serviceData)
            }
          } else if (cp.provider === "google") {
            const existingIdx = updated.findIndex(s =>
              s.name.toLowerCase().includes("google") || s.name.toLowerCase().includes("gemini")
            )
            const serviceData: ServiceStatus = {
              name: "Google AI",
              url: "generativelanguage.googleapis.com",
              status: cp.enabled ? "connected" : "disconnected",
              apiKey: cp.apiKey
            }
            if (existingIdx >= 0) {
              updated[existingIdx] = { ...updated[existingIdx], ...serviceData }
            } else if (cp.enabled) {
              updated.push(serviceData)
            }
          }
        })
        return updated
      })
    }
  }, [])

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
  // Anthropic OAuth states
  const [anthropicAuthMethod, setAnthropicAuthMethod] = useState<"oauth" | "apiKey">("oauth")
  const [anthropicOAuthStatus, setAnthropicOAuthStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle")
  const [anthropicOAuthUser, setAnthropicOAuthUser] = useState<{ email: string; name?: string; picture?: string } | null>(null)
  const [anthropicOAuthTokens, setAnthropicOAuthTokens] = useState<{ accessToken: string; refreshToken?: string; expiresAt?: number; idToken?: string } | null>(null)

  // Form states for Add Git Remote
  const [newGitUrl, setNewGitUrl] = useState("")
  const [newGitName, setNewGitName] = useState("")

  // Edit/Delete connection states
  const [editConnectionDialog, setEditConnectionDialog] = useState(false)
  const [deleteConnectionDialog, setDeleteConnectionDialog] = useState(false)
  const [selectedConnection, setSelectedConnection] = useState<ServiceStatus | null>(null)
  const [editName, setEditName] = useState("")
  const [editUrl, setEditUrl] = useState("")
  const [editApiKey, setEditApiKey] = useState("")
  const [testingEditConnection, setTestingEditConnection] = useState(false)
  const [editConnectionStatus, setEditConnectionStatus] = useState<"idle" | "success" | "error">("idle")

  async function handleTestConnection() {
    if (!newServerUrl) return
    setTestingConnection(true)
    setConnectionStatus("idle")
    setServerModels([])
    setSelectedServerModel("")

    try {
      // Use server-side proxy to avoid CORS issues
      const response = await fetch("/api/lmstudio-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newServerUrl, name: newServerName || "Test Server" })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.status === "connected") {
          setConnectionStatus("success")
          // Extract model IDs from the response
          const models = data.models || []
          setServerModels(models)
          // Don't auto-select - let user choose
        } else {
          setConnectionStatus("error")
        }
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

  // Start Anthropic OAuth flow
  async function startAnthropicOAuth() {
    setAnthropicOAuthStatus("connecting")
    setApiKeyError("")

    try {
      const response = await fetch("/api/auth/anthropic?action=start")
      const data = await response.json()

      if (data.success && data.authUrl) {
        // Store state for verification
        if (typeof window !== "undefined") {
          sessionStorage.setItem("anthropic_oauth_state", data.state)
        }
        // Redirect to Google OAuth
        window.location.href = data.authUrl
      } else {
        setAnthropicOAuthStatus("error")
        setApiKeyError(data.error || "Failed to start OAuth")
      }
    } catch {
      setAnthropicOAuthStatus("error")
      setApiKeyError("Failed to connect")
    }
  }

  // Handle Anthropic OAuth callback
  async function handleAnthropicOAuthCallback(code: string) {
    setAnthropicOAuthStatus("connecting")
    setNewApiProvider("anthropic")
    setAnthropicAuthMethod("oauth")

    try {
      const response = await fetch("/api/auth/anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      })

      const data = await response.json()

      if (data.success) {
        setAnthropicOAuthStatus("connected")
        setAnthropicOAuthUser(data.user)
        setAnthropicOAuthTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresIn ? Date.now() + data.expiresIn * 1000 : undefined,
          idToken: data.idToken
        })
      } else {
        setAnthropicOAuthStatus("error")
        setApiKeyError(data.error || "OAuth failed")
      }
    } catch {
      setAnthropicOAuthStatus("error")
      setApiKeyError("Failed to complete OAuth")
    }
  }

  // Save Anthropic OAuth connection
  function handleAddAnthropicOAuth() {
    if (anthropicOAuthStatus !== "connected" || !anthropicOAuthTokens) return

    const globalSettings = getGlobalSettings()
    const existingIndex = globalSettings.cloudProviders.findIndex(p => p.provider === "anthropic")

    const anthropicConfig = {
      provider: "anthropic" as const,
      enabled: true,
      apiKey: undefined,
      enabledModels: [],
      authMethod: "oauth" as const,
      oauthTokens: anthropicOAuthTokens,
      oauthUser: anthropicOAuthUser || undefined
    }

    if (existingIndex >= 0) {
      globalSettings.cloudProviders[existingIndex] = anthropicConfig
    } else {
      globalSettings.cloudProviders.push(anthropicConfig)
    }
    saveGlobalSettings(globalSettings)

    // Add to services list
    setServices(prev => {
      const filtered = prev.filter(s => !s.name.includes("Claude"))
      return [...filtered, {
        name: "Claude API (Max Plan)",
        url: "api.anthropic.com",
        status: "connected"
      }]
    })

    // Reset form
    setAnthropicOAuthStatus("idle")
    setAnthropicOAuthUser(null)
    setAnthropicOAuthTokens(null)
    setAnthropicAuthMethod("oauth")
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

  function handleOpenEditConnection(service: ServiceStatus) {
    setSelectedConnection(service)
    setEditName(service.name)
    setEditUrl(service.url)
    setEditApiKey(service.apiKey || "")
    setEditConnectionStatus("idle")
    setEditConnectionDialog(true)
  }

  function handleOpenDeleteConnection(service: ServiceStatus) {
    setSelectedConnection(service)
    setDeleteConnectionDialog(true)
  }

  async function handleTestEditConnection() {
    if (!editUrl) return
    setTestingEditConnection(true)
    setEditConnectionStatus("idle")

    try {
      // Use server-side proxy to avoid CORS issues
      const response = await fetch("/api/lmstudio-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: editUrl, name: editName || "Test Server" })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.status === "connected") {
          setEditConnectionStatus("success")
        } else {
          setEditConnectionStatus("error")
        }
      } else {
        setEditConnectionStatus("error")
      }
    } catch {
      setEditConnectionStatus("error")
    } finally {
      setTestingEditConnection(false)
    }
  }

  function handleSaveEditConnection() {
    if (!selectedConnection || !editName || !editUrl) return

    // Update local server in global settings
    if (selectedConnection.id) {
      updateLocalServer(selectedConnection.id, {
        name: editName,
        baseUrl: editUrl,
        apiKey: editApiKey || undefined
      })
    }

    // Update in services list
    setServices(prev => prev.map(s =>
      s.name === selectedConnection.name && s.url === selectedConnection.url
        ? { ...s, id: selectedConnection.id, name: editName, url: editUrl, apiKey: editApiKey || undefined }
        : s
    ))

    // Reset and close
    setSelectedConnection(null)
    setEditName("")
    setEditUrl("")
    setEditApiKey("")
    setEditConnectionStatus("idle")
    setEditConnectionDialog(false)
  }

  function handleDeleteConnection() {
    if (!selectedConnection) return

    // Remove from global settings if it's a local server
    if (selectedConnection.id) {
      removeLocalServer(selectedConnection.id)
    }

    // Remove from services list
    setServices(prev => prev.filter(s =>
      !(s.name === selectedConnection.name && s.url === selectedConnection.url)
    ))

    // Reset and close
    setSelectedConnection(null)
    setDeleteConnectionDialog(false)
  }

  // Email master toggle and sub-options
  const [emailUpdatesEnabled, setEmailUpdatesEnabled] = useState(true)
  const [emailSubOptions, setEmailSubOptions] = useState([
    { id: "email1", label: "Daily Email Summary", description: "Receive a daily digest of all activity", enabled: false },
    { id: "email2", label: "Project Generation Notifications", description: "Get notified when projects are generated", enabled: true },
    { id: "email3", label: "Attention Needed Alerts", description: "Notify when projects need attention while you are away", enabled: true }
  ])

  const [notifications, setNotifications] = useState<SettingToggle[]>([
    { id: "n1", label: "Approval Requests", description: "Get notified when human approval is needed", enabled: true },
    { id: "n2", label: "Error Alerts", description: "Immediate alerts for build failures and errors", enabled: true },
    { id: "n4", label: "Cost Alerts", description: "Alert when approaching budget limits", enabled: true },
    { id: "n5", label: "Completion Notifications", description: "Notify when packets complete", enabled: false }
  ])

  const toggleEmailSubOption = (id: string) => {
    setEmailSubOptions(prev => prev.map(opt =>
      opt.id === id ? { ...opt, enabled: !opt.enabled } : opt
    ))
  }

  const [automationSettings, setAutomationSettings] = useState<SettingToggle[]>([
    { id: "a1", label: "Auto-start Queued Packets", description: "Automatically start packets when agents are available", enabled: true },
    { id: "a2", label: "Auto-retry Failed Builds", description: "Retry failed builds up to 3 times", enabled: true },
    { id: "a3", label: "Auto-merge on Approval", description: "Merge PRs automatically after approval", enabled: false },
    { id: "a4", label: "Auto-deploy to Staging", description: "Deploy to staging after tests pass", enabled: true },
    { id: "a5", label: "Ralph Wiggum Loop", description: "Keep iterating until all tests pass", enabled: true }
  ])

  // Security settings state
  const [securitySettings, setSecuritySettings] = useState<SecuritySetting[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("claudia-security-settings")
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          // Fall back to defaults
        }
      }
    }
    return [
      { id: "s1", label: "Require Approval for Deployments", description: "All production deployments require human approval", type: "toggle" as const, enabled: true },
      { id: "s2", label: "Secret Scanning", description: "Prevent commits containing secrets", type: "toggle" as const, enabled: true },
      { id: "s3", label: "Dependency Audit", description: "Block packages with known vulnerabilities", type: "select" as const, value: "warn", options: [{ value: "block", label: "Block", variant: "success" as const }, { value: "warn", label: "Warn Only", variant: "warning" as const }, { value: "off", label: "Disabled", variant: "destructive" as const }] },
      { id: "s4", label: "API Rate Limiting", description: "Limit API calls to prevent abuse", type: "toggle" as const, enabled: true },
      { id: "s5", label: "Two-Factor Authentication", description: "Require 2FA for sensitive operations", type: "toggle" as const, enabled: false },
      { id: "s6", label: "Audit Logging", description: "Log all security-related events", type: "toggle" as const, enabled: true }
    ]
  })

  const [securitySaveStatus, setSecuritySaveStatus] = useState<"idle" | "saving" | "saved">("idle")

  const saveSecuritySettings = (newSettings: SecuritySetting[]) => {
    setSecuritySettings(newSettings)
    setSecuritySaveStatus("saving")
    if (typeof window !== "undefined") {
      localStorage.setItem("claudia-security-settings", JSON.stringify(newSettings))
    }
    setTimeout(() => {
      setSecuritySaveStatus("saved")
      setTimeout(() => setSecuritySaveStatus("idle"), 2000)
    }, 300)
  }

  const toggleSecuritySetting = (id: string) => {
    const newSettings = securitySettings.map(s => s.id === id && s.type === "toggle" ? { ...s, enabled: !s.enabled } : s)
    saveSecuritySettings(newSettings)
  }

  const updateSecuritySelect = (id: string, value: string) => {
    const newSettings = securitySettings.map(s => s.id === id && s.type === "select" ? { ...s, value } : s)
    saveSecuritySettings(newSettings)
  }

  // Data management state
  const [dataSummary, setDataSummary] = useState(() => getDataSummary())
  const [showDangerZone, setShowDangerZone] = useState(false)
  const [confirmClear, setConfirmClear] = useState("")
  const [clearingData, setClearingData] = useState(false)
  const [importingData, setImportingData] = useState(false)
  const [clearProjectsDialog, setClearProjectsDialog] = useState(false)
  const [clearingProjects, setClearingProjects] = useState(false)

  const refreshDataSummary = () => setDataSummary(getDataSummary())

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

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImportingData(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const imported = importData(data)
      alert(`Successfully imported ${imported.length} items`)
      refreshDataSummary()
    } catch (error) {
      alert("Failed to import data: " + (error instanceof Error ? error.message : "Invalid file"))
    } finally {
      setImportingData(false)
      event.target.value = ""
    }
  }

  const handleClearAllData = () => {
    if (confirmClear !== "DELETE ALL") return
    setClearingData(true)
    const result = clearAllData({ keepToken: true })
    setClearingData(false)
    setConfirmClear("")
    setShowDangerZone(false)
    alert(`Cleared ${result.clearedKeys.length} items. GitLab token preserved.`)
    refreshDataSummary()
  }

  const handleClearProjectData = () => {
    setClearingProjects(true)
    const cleared = clearProjectData()
    setClearingProjects(false)
    setClearProjectsDialog(false)
    alert(`Cleared ${cleared.length} project-related items`)
    refreshDataSummary()
  }

  const tabs = [
    { id: "ai-services", label: "AI Services", icon: Brain },
    { id: "connections", label: "Connections", icon: Server },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "automation", label: "Automation", icon: Zap },
    { id: "security", label: "Security", icon: Shield },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "data", label: "Data", icon: HardDrive }
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
            <ConnectionsTab
              services={services}
              setAddServerDialog={setAddServerDialog}
              setAddApiDialog={setAddApiDialog}
              setAddGitDialog={setAddGitDialog}
              handleResetSetup={handleResetSetup}
              handleOpenEditConnection={handleOpenEditConnection}
              handleOpenDeleteConnection={handleOpenDeleteConnection}
            />
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Control how and when you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Email Updates - Master Toggle */}
                <div className="space-y-3">
                  <div
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium">Email Updates</p>
                      <p className="text-sm text-muted-foreground">
                        Master toggle for all email notifications
                      </p>
                    </div>
                    <button
                      onClick={() => setEmailUpdatesEnabled(!emailUpdatesEnabled)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        emailUpdatesEnabled ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          emailUpdatesEnabled ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>

                  {/* Email Sub-options - only shown when Email Updates is ON */}
                  {emailUpdatesEnabled && (
                    <div className="ml-6 space-y-2 border-l-2 border-muted pl-4">
                      {emailSubOptions.map(option => (
                        <div
                          key={option.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                        >
                          <div>
                            <p className="font-medium text-sm">{option.label}</p>
                            <p className="text-xs text-muted-foreground">{option.description}</p>
                          </div>
                          <button
                            onClick={() => toggleEmailSubOption(option.id)}
                            className={cn(
                              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                              option.enabled ? "bg-primary" : "bg-muted"
                            )}
                          >
                            <span
                              className={cn(
                                "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                                option.enabled ? "translate-x-[18px]" : "translate-x-1"
                              )}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Other notification settings */}
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Security Settings</CardTitle>
                    <CardDescription>Manage security and access controls</CardDescription>
                  </div>
                  {securitySaveStatus === "saved" && (
                    <div className="flex items-center gap-2 text-green-500 text-sm">
                      <CheckCircle className="h-4 w-4" />
                      Saved
                    </div>
                  )}
                  {securitySaveStatus === "saving" && (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {securitySettings.map(setting => (
                  <div key={setting.id} className="p-4 rounded-lg border space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{setting.label}</p>
                        <p className="text-sm text-muted-foreground">{setting.description}</p>
                      </div>
                      {setting.type === "toggle" ? (
                        <button
                          onClick={() => toggleSecuritySetting(setting.id)}
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
                      ) : setting.type === "select" && setting.options ? (
                        <div className="flex gap-1">
                          {setting.options.map(option => (
                            <button
                              key={option.value}
                              onClick={() => updateSecuritySelect(setting.id, option.value)}
                              className={cn(
                                "px-3 py-1 text-xs rounded-full transition-colors",
                                setting.value === option.value
                                  ? option.variant === "success" ? "bg-green-500/20 text-green-500 ring-1 ring-green-500/50"
                                  : option.variant === "warning" ? "bg-yellow-500/20 text-yellow-500 ring-1 ring-yellow-500/50"
                                  : "bg-red-500/20 text-red-500 ring-1 ring-red-500/50"
                                  : "bg-muted text-muted-foreground hover:bg-accent"
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
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

          {/* Data Tab */}
          {activeTab === "data" && (
            <>
              {/* Data Summary */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileJson className="h-5 w-5" />
                        Stored Data
                      </CardTitle>
                      <CardDescription>Overview of data stored in your browser</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={refreshDataSummary} className="gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-2xl font-bold">{dataSummary.projects}</p>
                      <p className="text-sm text-muted-foreground">Projects</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-2xl font-bold">{dataSummary.packets}</p>
                      <p className="text-sm text-muted-foreground">Packets</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-2xl font-bold">{dataSummary.buildPlans}</p>
                      <p className="text-sm text-muted-foreground">Build Plans</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-2xl font-bold">{dataSummary.totalKeys}</p>
                      <p className="text-sm text-muted-foreground">Total Keys</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    {dataSummary.hasSettings && (
                      <Badge variant="outline">Settings Configured</Badge>
                    )}
                    {dataSummary.hasGitLabToken && (
                      <Badge variant="outline" className="text-green-500 border-green-500/50">GitLab Connected</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Import/Export */}
              <Card>
                <CardHeader>
                  <CardTitle>Import & Export</CardTitle>
                  <CardDescription>Backup or restore your Claudia data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">Export All Data</p>
                      <p className="text-sm text-muted-foreground">
                        Download a JSON backup of all projects, settings, and configurations
                      </p>
                    </div>
                    <Button onClick={handleExportData} className="gap-2">
                      <DownloadIcon className="h-4 w-4" />
                      Export
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">Import Data</p>
                      <p className="text-sm text-muted-foreground">
                        Restore from a previously exported backup file
                      </p>
                    </div>
                    <label>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportData}
                        className="hidden"
                        disabled={importingData}
                      />
                      <Button asChild disabled={importingData} className="gap-2 cursor-pointer">
                        <span>
                          {importingData ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          Import
                        </span>
                      </Button>
                    </label>
                  </div>
                </CardContent>
              </Card>

              {/* Danger Zone - Hidden by Default */}
              <Card className="border-destructive/30">
                <CardHeader>
                  <button
                    onClick={() => setShowDangerZone(!showDangerZone)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <AlertOctagon className="h-5 w-5 text-destructive" />
                      <div>
                        <CardTitle className="text-destructive">Danger Zone</CardTitle>
                        <CardDescription>Irreversible actions</CardDescription>
                      </div>
                    </div>
                    <span className={cn(
                      "text-xs text-muted-foreground transition-transform",
                      showDangerZone && "rotate-180"
                    )}>
                      ▼
                    </span>
                  </button>
                </CardHeader>
                {showDangerZone && (
                  <CardContent className="space-y-4 border-t pt-4">
                    {/* Clear Project Data */}
                    <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-destructive">Clear Project Data</p>
                          <p className="text-sm text-muted-foreground">
                            Remove all projects and packets, but keep settings and connections
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          onClick={() => setClearProjectsDialog(true)}
                          className="gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Clear Projects
                        </Button>
                      </div>
                    </div>

                    {/* Delete All Data */}
                    <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 space-y-4">
                      <div>
                        <p className="font-medium text-destructive">Delete All Data</p>
                        <p className="text-sm text-muted-foreground">
                          Permanently delete all Claudia data including projects, packets, build plans,
                          settings, and configurations. Your GitLab token will be preserved.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={handleExportData}
                          className="gap-2"
                        >
                          <DownloadIcon className="h-4 w-4" />
                          Export First
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmDelete" className="text-sm">
                          Type <code className="px-1 py-0.5 bg-muted rounded font-mono">DELETE ALL</code> to confirm:
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id="confirmDelete"
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
                            Delete Everything
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            </>
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
          setAnthropicAuthMethod("oauth")
          setAnthropicOAuthStatus("idle")
          setAnthropicOAuthUser(null)
          setAnthropicOAuthTokens(null)
          setApiKeyError("")
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Add Cloud AI Provider
            </DialogTitle>
            <DialogDescription>
              Connect to a cloud AI provider
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label>Select Provider</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "anthropic" as const, name: "Anthropic", sub: "Claude", color: "text-orange-500" },
                  { id: "openai" as const, name: "OpenAI", sub: "GPT-4/o1", color: "text-emerald-500" },
                  { id: "google" as const, name: "Google", sub: "Gemini", color: "text-blue-500" }
                ].map(provider => (
                  <button
                    key={provider.id}
                    onClick={() => {
                      setNewApiProvider(provider.id)
                      setApiKeyStatus("idle")
                      setApiKeyError("")
                      setNewApiKey("")
                      if (provider.id === "anthropic") {
                        setAnthropicAuthMethod("oauth")
                        setAnthropicOAuthStatus("idle")
                      }
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

            {/* Anthropic - OAuth primary, API key secondary */}
            {newApiProvider === "anthropic" && (
              <div className="space-y-4 pt-2 border-t">
                {/* OAuth Connected State */}
                {anthropicOAuthStatus === "connected" && anthropicOAuthUser && (
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center gap-3 mb-2">
                      {anthropicOAuthUser.picture && (
                        <img
                          src={anthropicOAuthUser.picture}
                          alt=""
                          className="h-10 w-10 rounded-full"
                        />
                      )}
                      <div>
                        <p className="font-medium">{anthropicOAuthUser.name || anthropicOAuthUser.email}</p>
                        <p className="text-xs text-muted-foreground">{anthropicOAuthUser.email}</p>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-500 ml-auto" />
                    </div>
                    <p className="text-xs text-green-600">
                      Ready to connect with your Anthropic Max subscription
                    </p>
                  </div>
                )}

                {/* OAuth Option - Primary */}
                {anthropicAuthMethod === "oauth" && anthropicOAuthStatus !== "connected" && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">Sign in with Google</span>
                        <Badge variant="secondary" className="text-xs">Max Plan</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Use your Anthropic Max subscription ($200/month) - not pay-per-use credits
                      </p>
                      <Button
                        className="w-full gap-2"
                        onClick={startAnthropicOAuth}
                        disabled={anthropicOAuthStatus === "connecting"}
                      >
                        {anthropicOAuthStatus === "connecting" ? (
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

                    {anthropicOAuthStatus === "error" && apiKeyError && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {apiKeyError}
                      </p>
                    )}

                    <button
                      onClick={() => setAnthropicAuthMethod("apiKey")}
                      className="w-full text-xs text-muted-foreground hover:text-primary text-center py-2"
                    >
                      or use API key (pay-per-use credits)
                    </button>
                  </div>
                )}

                {/* API Key Option - Secondary */}
                {anthropicAuthMethod === "apiKey" && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">API Key</span>
                        <Badge variant="outline" className="text-xs">Pay-per-use</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Uses separate API credits, billed by usage (not your Max subscription)
                      </p>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={showApiKey ? "text" : "password"}
                            placeholder="sk-ant-api03-..."
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
                        <p className="text-xs text-green-500 flex items-center gap-1 mt-2">
                          <CheckCircle className="h-3 w-3" />
                          API key is valid
                        </p>
                      )}
                      {apiKeyStatus === "error" && (
                        <p className="text-xs text-red-500 flex items-center gap-1 mt-2">
                          <XCircle className="h-3 w-3" />
                          {apiKeyError}
                        </p>
                      )}
                      <a
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-2"
                      >
                        Get API key from Anthropic Console
                      </a>
                    </div>

                    <button
                      onClick={() => setAnthropicAuthMethod("oauth")}
                      className="w-full text-xs text-muted-foreground hover:text-primary text-center py-2"
                    >
                      or sign in with Google (Max subscription)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* OpenAI / Google - API Key Only */}
            {newApiProvider !== "anthropic" && (
              <div className="space-y-3 pt-2 border-t">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <p className="text-xs text-muted-foreground">
                    {newApiProvider === "openai" ? "Get your key from platform.openai.com" :
                     "Get your key from aistudio.google.com"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="apiKey"
                      type={showApiKey ? "text" : "password"}
                      placeholder={newApiProvider === "openai" ? "sk-..." : "AIza..."}
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
                    API key is valid
                  </p>
                )}
                {apiKeyStatus === "error" && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    {apiKeyError}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddApiDialog(false)}>
              Cancel
            </Button>
            {newApiProvider === "anthropic" ? (
              anthropicOAuthStatus === "connected" ? (
                <Button onClick={handleAddAnthropicOAuth}>
                  Connect with Max Plan
                </Button>
              ) : anthropicAuthMethod === "apiKey" ? (
                <Button
                  onClick={handleAddApiService}
                  disabled={apiKeyStatus !== "success"}
                >
                  Connect with API Key
                </Button>
              ) : null
            ) : (
              <Button
                onClick={handleAddApiService}
                disabled={apiKeyStatus !== "success"}
              >
                Connect
              </Button>
            )}
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

      {/* Edit Connection Dialog */}
      <Dialog open={editConnectionDialog} onOpenChange={(open) => {
        setEditConnectionDialog(open)
        if (!open) {
          setSelectedConnection(null)
          setEditName("")
          setEditUrl("")
          setEditApiKey("")
          setEditConnectionStatus("idle")
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Connection
            </DialogTitle>
            <DialogDescription>
              Update the connection settings for {selectedConnection?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Connection Name</Label>
              <Input
                id="editName"
                placeholder="e.g., My Local LLM"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editUrl">URL / Endpoint</Label>
              <div className="flex gap-2">
                <Input
                  id="editUrl"
                  placeholder="http://localhost:1234"
                  value={editUrl}
                  onChange={(e) => {
                    setEditUrl(e.target.value)
                    setEditConnectionStatus("idle")
                  }}
                />
                <Button
                  variant="outline"
                  onClick={handleTestEditConnection}
                  disabled={!editUrl || testingEditConnection}
                >
                  {testingEditConnection ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Test"
                  )}
                </Button>
              </div>
              {editConnectionStatus === "success" && (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Connection successful
                </p>
              )}
              {editConnectionStatus === "error" && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  Connection failed
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="editApiKey">API Key (optional)</Label>
              <Input
                id="editApiKey"
                type="password"
                placeholder="Enter API key if required..."
                value={editApiKey}
                onChange={(e) => setEditApiKey(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditConnectionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditConnection}
              disabled={!editName || !editUrl}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Connection Confirmation Dialog */}
      <Dialog open={deleteConnectionDialog} onOpenChange={(open) => {
        setDeleteConnectionDialog(open)
        if (!open) {
          setSelectedConnection(null)
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Remove Connection
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this connection?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedConnection && (
              <div className="p-4 rounded-lg border bg-muted/50">
                <p className="font-medium">{selectedConnection.name}</p>
                <p className="text-sm text-muted-foreground font-mono">{selectedConnection.url}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-4">
              This action cannot be undone. The connection will be permanently removed from your settings.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConnectionDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConnection}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Remove Connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Projects Confirmation Dialog */}
      <Dialog open={clearProjectsDialog} onOpenChange={setClearProjectsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertOctagon className="h-5 w-5" />
              Clear All Projects
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <p className="text-sm">
                This will permanently delete:
              </p>
              <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>All projects ({dataSummary.projects} projects)</li>
                <li>All work packets ({dataSummary.packets} packets)</li>
                <li>All build plans ({dataSummary.buildPlans} build plans)</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              Your settings, connections, and API keys will be preserved.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearProjectsDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearProjectData}
              disabled={clearingProjects}
              className="gap-2"
            >
              {clearingProjects ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Clear All Projects
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
