"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  getOpenWebUIConfig,
  updateOpenWebUIConfig,
  validateOpenWebUIUrl,
  type OpenWebUIConfig,
  type OpenWebUIConnectionStatus,
} from "@/lib/openwebui/config"
import {
  MessageSquare,
  Server,
  Check,
  X,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Settings,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Info,
  Wifi,
  WifiOff,
} from "lucide-react"
import Link from "next/link"

export default function OpenWebUISettingsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [config, setConfig] = useState<OpenWebUIConfig | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<OpenWebUIConnectionStatus | null>(null)

  // Form state
  const [baseUrl, setBaseUrl] = useState("")
  const [authToken, setAuthToken] = useState("")
  const [showAuthToken, setShowAuthToken] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [autoConnect, setAutoConnect] = useState(true)
  const [defaultFullscreen, setDefaultFullscreen] = useState(false)
  const [showStatusIndicator, setShowStatusIndicator] = useState(true)

  // Validation state
  const [urlError, setUrlError] = useState<string | null>(null)

  // Status state
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  // Load config on mount
  useEffect(() => {
    if (user?.id) {
      const userConfig = getOpenWebUIConfig(user.id)
      setConfig(userConfig)
      setBaseUrl(userConfig.baseUrl || "")
      setAuthToken(userConfig.authToken || "")
      setEnabled(userConfig.enabled)
      setAutoConnect(userConfig.autoConnect)
      setDefaultFullscreen(userConfig.defaultFullscreen)
      setShowStatusIndicator(userConfig.showStatusIndicator)
    }
  }, [user?.id])

  // Validate URL on change
  const handleUrlChange = (value: string) => {
    setBaseUrl(value)
    if (value) {
      const validation = validateOpenWebUIUrl(value)
      setUrlError(validation.valid ? null : validation.error || null)
    } else {
      setUrlError(null)
    }
  }

  // Test connection
  const handleTestConnection = async () => {
    if (!baseUrl) return

    setIsTesting(true)
    setTestResult(null)

    try {
      const response = await fetch("/api/openwebui/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: baseUrl }),
      })

      const data = await response.json()

      setTestResult({
        success: data.healthy,
        message: data.message,
      })

      setConnectionStatus({
        healthy: data.healthy,
        url: baseUrl,
        message: data.message,
        version: data.version,
        lastChecked: new Date().toISOString(),
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Connection test failed",
      })
    } finally {
      setIsTesting(false)
    }
  }

  // Save settings
  const handleSave = async () => {
    if (!user?.id || urlError) return

    setIsSaving(true)
    setSaveStatus("saving")

    try {
      const updates: Partial<OpenWebUIConfig> = {
        baseUrl,
        authToken: authToken || undefined,
        enabled,
        autoConnect,
        defaultFullscreen,
        showStatusIndicator,
      }

      updateOpenWebUIConfig(user.id, updates)
      setConfig(getOpenWebUIConfig(user.id))

      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 2000)
    } catch (error) {
      console.error("Failed to save settings:", error)
      setSaveStatus("error")
    } finally {
      setIsSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Please sign in to access Open Web UI settings.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
            <MessageSquare className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Open Web UI Settings</h1>
            <p className="text-sm text-muted-foreground">
              Configure your Open Web UI instance connection
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-sm text-green-500">
              <CheckCircle className="h-4 w-4" />
              Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1 text-sm text-red-500">
              <X className="h-4 w-4" />
              Failed to save
            </span>
          )}
          <Button onClick={handleSave} disabled={isSaving || !!urlError} className="gap-2">
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Connection Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Instance Configuration
          </CardTitle>
          <CardDescription>
            Connect to your Open Web UI instance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* URL Configuration */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openwebui-url">Open Web UI URL</Label>
              <Input
                id="openwebui-url"
                placeholder="https://your-openwebui.example.com"
                value={baseUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                className={cn(urlError && "border-red-500")}
              />
              {urlError && (
                <p className="text-sm text-red-500">{urlError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                The base URL of your Open Web UI instance (e.g., http://localhost:3000 or https://openwebui.example.com)
              </p>
            </div>

            {/* Auth Token (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="auth-token">Authentication Token (Optional)</Label>
              <div className="relative">
                <Input
                  id="auth-token"
                  type={showAuthToken ? "text" : "password"}
                  placeholder="Optional: For SSO or API authentication"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowAuthToken(!showAuthToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showAuthToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                If your Open Web UI instance requires authentication, enter your API token here
              </p>
            </div>

            {/* Test Connection */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={!baseUrl || !!urlError || isTesting}
                className="gap-2"
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Test Connection
              </Button>

              {testResult && (
                <span className={cn(
                  "flex items-center gap-1 text-sm",
                  testResult.success ? "text-green-500" : "text-red-500"
                )}>
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  {testResult.message}
                </span>
              )}
            </div>
          </div>

          {/* Connection Status */}
          {connectionStatus && (
            <div className={cn(
              "p-4 rounded-lg border",
              connectionStatus.healthy
                ? "bg-green-500/5 border-green-500/20"
                : "bg-red-500/5 border-red-500/20"
            )}>
              <div className="flex items-center gap-3">
                {connectionStatus.healthy ? (
                  <Wifi className="h-5 w-5 text-green-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="font-medium text-sm">
                    {connectionStatus.healthy ? "Connected" : "Disconnected"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {connectionStatus.message}
                    {connectionStatus.version && ` - v${connectionStatus.version}`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Display Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Display Preferences
          </CardTitle>
          <CardDescription>
            Configure how Open Web UI is displayed in Claudia
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <p className="font-medium">Enable Open Web UI</p>
              <p className="text-sm text-muted-foreground">
                Show Open Web UI in the sidebar and allow embedding
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <p className="font-medium">Auto-connect on Load</p>
              <p className="text-sm text-muted-foreground">
                Automatically check connection status when opening the page
              </p>
            </div>
            <Switch
              checked={autoConnect}
              onCheckedChange={setAutoConnect}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <p className="font-medium">Default to Fullscreen</p>
              <p className="text-sm text-muted-foreground">
                Open the embedded interface in fullscreen mode by default
              </p>
            </div>
            <Switch
              checked={defaultFullscreen}
              onCheckedChange={setDefaultFullscreen}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <p className="font-medium">Show Connection Status</p>
              <p className="text-sm text-muted-foreground">
                Display connection status indicator in the embed toolbar
              </p>
            </div>
            <Switch
              checked={showStatusIndicator}
              onCheckedChange={setShowStatusIndicator}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base font-medium">Quick Links</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" asChild className="justify-start gap-2">
              <Link href="/openwebui">
                <MessageSquare className="h-4 w-4" />
                Open Web UI Page
              </Link>
            </Button>
            {baseUrl && (
              <Button variant="outline" asChild className="justify-start gap-2">
                <a href={baseUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open in New Tab
                </a>
              </Button>
            )}
          </div>

          <div className="mt-4 p-4 rounded-lg bg-background/50 border">
            <p className="text-sm font-medium mb-2">About Open Web UI</p>
            <p className="text-xs text-muted-foreground">
              Open Web UI is an extensible, feature-rich, and user-friendly self-hosted AI interface.
              It supports various LLM runners including Ollama and OpenAI-compatible APIs.
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <a
                href="https://github.com/open-webui/open-webui"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
                GitHub
              </a>
              <a
                href="https://docs.openwebui.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
                Documentation
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
