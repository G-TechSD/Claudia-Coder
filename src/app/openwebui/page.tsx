"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth/auth-provider"
import { OpenWebUIEmbed } from "@/components/openwebui/openwebui-embed"
import {
  getOpenWebUIConfig,
  updateOpenWebUIConfig,
  validateOpenWebUIUrl,
  type OpenWebUIConfig,
  type OpenWebUIConnectionStatus,
} from "@/lib/openwebui/config"
import {
  MessageSquare,
  Settings,
  ExternalLink,
  RefreshCw,
  Check,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Server,
  Plug,
  Wifi,
  WifiOff,
  Maximize2,
} from "lucide-react"
import Link from "next/link"

export default function OpenWebUIPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()

  // Config state
  const [config, setConfig] = useState<OpenWebUIConfig | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<OpenWebUIConnectionStatus | null>(null)
  const [isCheckingConnection, setIsCheckingConnection] = useState(false)

  // Settings form state (for quick config in this page)
  const [tempUrl, setTempUrl] = useState("")
  const [urlError, setUrlError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  // Fullscreen state
  const [isEmbedFullscreen, setIsEmbedFullscreen] = useState(false)

  // MCP tool status (placeholder for future integration)
  const [mcpStatus, setMcpStatus] = useState<{
    available: boolean
    tools: string[]
  }>({ available: false, tools: [] })

  // Load configuration
  useEffect(() => {
    if (user?.id) {
      const userConfig = getOpenWebUIConfig(user.id)
      setConfig(userConfig)
      setTempUrl(userConfig.baseUrl || "")
    }
  }, [user?.id])

  // Check connection status
  const checkConnection = useCallback(async () => {
    if (!config?.baseUrl) {
      setConnectionStatus({
        healthy: false,
        url: "",
        message: "Not configured",
      })
      return
    }

    setIsCheckingConnection(true)
    try {
      const response = await fetch("/api/openwebui/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: config.baseUrl }),
      })

      const data = await response.json()
      setConnectionStatus({
        healthy: data.healthy,
        url: config.baseUrl,
        message: data.message,
        version: data.version,
        lastChecked: new Date().toISOString(),
      })
    } catch (error) {
      setConnectionStatus({
        healthy: false,
        url: config.baseUrl,
        message: error instanceof Error ? error.message : "Connection check failed",
        lastChecked: new Date().toISOString(),
      })
    } finally {
      setIsCheckingConnection(false)
    }
  }, [config?.baseUrl])

  // Initial connection check
  useEffect(() => {
    if (config?.baseUrl) {
      checkConnection()
    }
  }, [config?.baseUrl, checkConnection])

  // Handle URL change
  const handleUrlChange = (value: string) => {
    setTempUrl(value)
    if (value) {
      const validation = validateOpenWebUIUrl(value)
      setUrlError(validation.valid ? null : validation.error || null)
    } else {
      setUrlError(null)
    }
  }

  // Save URL
  const handleSaveUrl = async () => {
    if (!user?.id || urlError) return

    setIsSaving(true)
    setSaveStatus("saving")

    try {
      const updated = updateOpenWebUIConfig(user.id, {
        baseUrl: tempUrl,
        enabled: true,
      })
      setConfig(updated)
      setSaveStatus("saved")

      // Check connection after saving
      setTimeout(() => {
        setSaveStatus("idle")
        checkConnection()
      }, 1000)
    } catch (error) {
      console.error("Failed to save URL:", error)
      setSaveStatus("error")
    } finally {
      setIsSaving(false)
    }
  }

  // Loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Please sign in to access Open Web UI.</p>
      </div>
    )
  }

  // Show fullscreen embed if active
  if (isEmbedFullscreen) {
    return (
      <OpenWebUIEmbed
        className="h-screen"
        onFullscreenChange={(fs) => setIsEmbedFullscreen(fs)}
      />
    )
  }

  const isConfigured = config?.baseUrl && config?.enabled

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
            <MessageSquare className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Open Web UI</h1>
            <p className="text-sm text-muted-foreground">
              Embedded AI chat interface
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={checkConnection}
            disabled={isCheckingConnection || !config?.baseUrl}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isCheckingConnection && "animate-spin")} />
            Check Connection
          </Button>
          {isConfigured && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsEmbedFullscreen(true)}
              className="gap-2"
            >
              <Maximize2 className="h-4 w-4" />
              Open Fullscreen
            </Button>
          )}
        </div>
      </div>

      {/* Connection Status Card */}
      <Card className={cn(
        "border-2 transition-colors",
        connectionStatus?.healthy === true && "border-green-500/50 bg-green-500/5",
        connectionStatus?.healthy === false && "border-red-500/50 bg-red-500/5",
        connectionStatus === null && "border-muted"
      )}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-lg",
                connectionStatus?.healthy === true && "bg-green-500/20",
                connectionStatus?.healthy === false && "bg-red-500/20",
                connectionStatus === null && "bg-muted"
              )}>
                {isCheckingConnection ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : connectionStatus?.healthy ? (
                  <Wifi className="h-6 w-6 text-green-400" />
                ) : (
                  <WifiOff className="h-6 w-6 text-red-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">Open Web UI Server</p>
                  <Badge variant={connectionStatus?.healthy ? "success" : connectionStatus?.healthy === false ? "destructive" : "secondary"}>
                    {isCheckingConnection ? "Checking..." : connectionStatus?.healthy ? "Connected" : connectionStatus?.healthy === false ? "Disconnected" : "Unknown"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground font-mono">
                  {config?.baseUrl || "Not configured"}
                </p>
                {connectionStatus?.message && !connectionStatus.healthy && (
                  <p className="text-xs text-red-400 mt-1">{connectionStatus.message}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {connectionStatus?.version && (
                <div className="text-right">
                  <p className="text-2xl font-bold">{connectionStatus.version}</p>
                  <p className="text-xs text-muted-foreground">Version</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick URL Configuration (if not configured) */}
      {!isConfigured && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Quick Setup
            </CardTitle>
            <CardDescription>
              Enter your Open Web UI instance URL to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openwebui-url">Open Web UI URL</Label>
              <div className="flex gap-2">
                <Input
                  id="openwebui-url"
                  placeholder="https://your-openwebui.example.com"
                  value={tempUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className={cn(urlError && "border-red-500")}
                />
                <Button
                  onClick={handleSaveUrl}
                  disabled={!tempUrl || !!urlError || isSaving}
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : saveStatus === "saved" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {saveStatus === "saved" ? "Saved" : "Save"}
                </Button>
              </div>
              {urlError && (
                <p className="text-sm text-red-500">{urlError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                The base URL of your Open Web UI instance (e.g., http://localhost:3000 or https://openwebui.example.com)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Embed or Instructions */}
      {isConfigured ? (
        <Card className="flex-1 min-h-[600px] flex flex-col">
          <CardHeader className="pb-2 flex-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                <CardTitle className="text-base">Chat Interface</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {config?.baseUrl && (
                  <Button variant="ghost" size="sm" asChild className="gap-2">
                    <a href={config.baseUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Open in New Tab
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild className="gap-2">
                  <Link href="/settings/openwebui">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <OpenWebUIEmbed
              className="h-full min-h-[500px]"
              onFullscreenChange={(fs) => setIsEmbedFullscreen(fs)}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="flex-1">
          <CardContent className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Get Started with Open Web UI</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Open Web UI is a user-friendly AI interface that supports various LLM backends.
              Configure your instance URL above to embed it here.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                <span>Self-hosted or cloud</span>
              </div>
              <div className="flex items-center gap-2">
                <Plug className="h-4 w-4" />
                <span>Multiple LLM support</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MCP Tools Status (Bottom) */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base font-medium">MCP Tool Integration</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              Coming Soon
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            MCP (Model Context Protocol) tools will be available here when configured.
            These tools allow Open Web UI to interact with Claudia&apos;s automation features.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="p-3 rounded-lg border bg-background/50">
              <p className="text-xs font-medium">Project Tools</p>
              <p className="text-xs text-muted-foreground mt-1">Access project files and context</p>
            </div>
            <div className="p-3 rounded-lg border bg-background/50">
              <p className="text-xs font-medium">Code Tools</p>
              <p className="text-xs text-muted-foreground mt-1">Run code analysis and generation</p>
            </div>
            <div className="p-3 rounded-lg border bg-background/50">
              <p className="text-xs font-medium">Workflow Tools</p>
              <p className="text-xs text-muted-foreground mt-1">Trigger n8n workflows</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
