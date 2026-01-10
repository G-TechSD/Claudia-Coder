"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth/auth-provider"
import {
  getOpenWebUIConfig,
  buildIframeUrl,
  type OpenWebUIConfig,
  type OpenWebUIConnectionStatus,
} from "@/lib/openwebui/config"
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  ExternalLink,
  Wifi,
  WifiOff,
  Loader2,
  AlertCircle,
  Settings,
} from "lucide-react"
import Link from "next/link"

interface OpenWebUIEmbedProps {
  className?: string
  onFullscreenChange?: (isFullscreen: boolean) => void
}

export function OpenWebUIEmbed({ className, onFullscreenChange }: OpenWebUIEmbedProps) {
  const { user } = useAuth()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // State
  const [config, setConfig] = useState<OpenWebUIConfig | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<OpenWebUIConnectionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [iframeError, setIframeError] = useState<string | null>(null)

  // Load configuration
  useEffect(() => {
    if (!user?.id) return

    const userConfig = getOpenWebUIConfig(user.id)
    setConfig(userConfig)
    setIsFullscreen(userConfig.defaultFullscreen)

    const url = buildIframeUrl(user.id)
    setIframeUrl(url)
    setIsLoading(false)
  }, [user?.id])

  // Check connection health
  const checkConnection = useCallback(async () => {
    if (!config?.baseUrl) {
      setConnectionStatus({
        healthy: false,
        url: "",
        message: "Not configured",
      })
      return
    }

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
    }
  }, [config?.baseUrl])

  // Initial connection check
  useEffect(() => {
    if (config?.baseUrl && config.autoConnect) {
      checkConnection()
    }
  }, [config?.baseUrl, config?.autoConnect, checkConnection])

  // Handle fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    const newState = !isFullscreen
    setIsFullscreen(newState)
    onFullscreenChange?.(newState)
  }, [isFullscreen, onFullscreenChange])

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true)
    setIframeError(null)
  }, [])

  // Handle iframe error
  const handleIframeError = useCallback(() => {
    setIframeLoaded(false)
    setIframeError("Failed to load Open Web UI")
  }, [])

  // Refresh iframe
  const refreshIframe = useCallback(() => {
    if (iframeRef.current && iframeUrl) {
      setIframeLoaded(false)
      setIframeError(null)
      // Force reload by updating src
      iframeRef.current.src = iframeUrl
    }
    checkConnection()
  }, [iframeUrl, checkConnection])

  // Open in new tab
  const openInNewTab = useCallback(() => {
    if (iframeUrl) {
      window.open(iframeUrl, "_blank")
    }
  }, [iframeUrl])

  // Not configured state
  if (!isLoading && (!config?.baseUrl || !config?.enabled)) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">Open Web UI Not Configured</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          Configure your Open Web UI instance URL in settings to start using the embedded interface.
        </p>
        <Button asChild>
          <Link href="/settings/openwebui">
            <Settings className="h-4 w-4 mr-2" />
            Configure Open Web UI
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-background border rounded-lg overflow-hidden",
        isFullscreen && "fixed inset-0 z-50 rounded-none border-0",
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          {config?.showStatusIndicator && (
            <div className="flex items-center gap-2">
              {connectionStatus === null ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : connectionStatus.healthy ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                    Connected
                  </Badge>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20">
                    Disconnected
                  </Badge>
                </>
              )}
            </div>
          )}

          {/* Version */}
          {connectionStatus?.version && (
            <span className="text-xs text-muted-foreground">
              v{connectionStatus.version}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={refreshIframe}
            title="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", !iframeLoaded && "animate-spin")} />
          </Button>

          {/* Open in new tab */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={openInNewTab}
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>

          {/* Fullscreen toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>

          {/* Settings link */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            asChild
            title="Settings"
          >
            <Link href="/settings/openwebui">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Iframe Container */}
      <div className="relative flex-1 min-h-0">
        {/* Loading overlay */}
        {!iframeLoaded && !iframeError && iframeUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading Open Web UI...</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {iframeError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="flex flex-col items-center gap-3 text-center p-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="text-sm font-medium text-red-500">{iframeError}</p>
              <p className="text-xs text-muted-foreground max-w-md">
                Make sure Open Web UI is running and accessible at the configured URL.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={refreshIframe}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                <Button variant="outline" size="sm" onClick={openInNewTab}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Directly
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* The iframe */}
        {iframeUrl && (
          <iframe
            ref={iframeRef}
            src={iframeUrl}
            className={cn(
              "w-full h-full border-0",
              (!iframeLoaded || iframeError) && "invisible"
            )}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            allow="microphone; camera; clipboard-read; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
            title="Open Web UI"
          />
        )}
      </div>

      {/* Status bar (optional, shown in fullscreen) */}
      {isFullscreen && (
        <div className="flex items-center justify-between px-4 py-1 border-t bg-muted/30 text-xs text-muted-foreground">
          <span>Press Esc or click minimize to exit fullscreen</span>
          <span>{iframeUrl}</span>
        </div>
      )}
    </div>
  )
}

// Keyboard shortcut for fullscreen (Esc to exit)
if (typeof window !== "undefined") {
  // This will be handled by the component itself via React
}
