"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth/auth-provider"
import { useUserN8NConfig } from "@/lib/api/hooks"
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  ExternalLink,
  Server,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Settings,
  Link as LinkIcon,
  Unlink,
} from "lucide-react"

interface N8NEmbedProps {
  className?: string
  defaultFullscreen?: boolean
  showHeader?: boolean
  onConnectionStatusChange?: (status: ConnectionStatus) => void
}

interface ConnectionStatus {
  connected: boolean
  checking: boolean
  url: string
  mode: "shared" | "personal"
  message: string
}

const DEFAULT_N8N_URL = process.env.NEXT_PUBLIC_N8N_URL || "https://192.168.245.211:5678"

export function N8NEmbed({
  className,
  defaultFullscreen = false,
  showHeader = true,
  onConnectionStatusChange,
}: N8NEmbedProps) {
  const { user, isAuthenticated } = useAuth()
  const { config, isPersonalInstance } = useUserN8NConfig(user?.id || null)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(defaultFullscreen)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    checking: true,
    url: DEFAULT_N8N_URL,
    mode: "shared",
    message: "Checking connection...",
  })
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [iframeError, setIframeError] = useState(false)

  // Determine the effective N8N URL based on user config
  const getEffectiveN8NUrl = useCallback(() => {
    if (isPersonalInstance && config?.personalInstance?.baseUrl) {
      return config.personalInstance.baseUrl
    }
    return DEFAULT_N8N_URL
  }, [isPersonalInstance, config])

  // Get auth headers/params if needed for the iframe
  const getIframeUrl = useCallback(() => {
    const baseUrl = getEffectiveN8NUrl()
    // N8N doesn't support embedding with API key auth via URL params
    // The user needs to be logged into their N8N instance separately
    // or we need to implement a session-based auth flow
    return baseUrl
  }, [getEffectiveN8NUrl])

  // Check connection to N8N
  const checkConnection = useCallback(async () => {
    const url = getEffectiveN8NUrl()
    const mode = isPersonalInstance ? "personal" : "shared"

    setConnectionStatus(prev => ({
      ...prev,
      checking: true,
      url,
      mode,
      message: "Checking connection...",
    }))

    try {
      // Use our proxy endpoint to check connection (handles self-signed certs)
      const response = await fetch("/api/n8n-status", {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        throw new Error("Status check returned " + response.status)
      }

      const data = await response.json()

      const newStatus: ConnectionStatus = {
        connected: data.healthy === true,
        checking: false,
        url,
        mode,
        message: data.healthy ? "Connected" : (data.message || "Connection failed"),
      }

      setConnectionStatus(newStatus)
      onConnectionStatusChange?.(newStatus)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed"
      const newStatus: ConnectionStatus = {
        connected: false,
        checking: false,
        url,
        mode,
        message,
      }
      setConnectionStatus(newStatus)
      onConnectionStatusChange?.(newStatus)
    }
  }, [getEffectiveN8NUrl, isPersonalInstance, onConnectionStatusChange])

  // Check connection on mount and when config changes
  useEffect(() => {
    checkConnection()
  }, [checkConnection])

  // Handle iframe load events
  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true)
    setIframeError(false)
  }, [])

  const handleIframeError = useCallback(() => {
    setIframeLoaded(false)
    setIframeError(true)
  }, [])

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev)
  }, [])

  // Refresh iframe
  const refreshIframe = useCallback(() => {
    if (iframeRef.current) {
      setIframeLoaded(false)
      iframeRef.current.src = getIframeUrl()
    }
    checkConnection()
  }, [getIframeUrl, checkConnection])

  // Open in new tab
  const openInNewTab = useCallback(() => {
    window.open(getEffectiveN8NUrl(), "_blank", "noopener,noreferrer")
  }, [getEffectiveN8NUrl])

  const containerClasses = cn(
    "transition-all duration-300",
    isFullscreen && "fixed inset-0 z-50 bg-background p-4",
    className
  )

  const iframeContainerClasses = cn(
    "relative bg-muted/30 rounded-lg overflow-hidden border",
    isFullscreen ? "h-full" : "h-[600px]"
  )

  return (
    <div className={containerClasses}>
      {showHeader && (
        <div className={cn(
          "flex items-center justify-between mb-4",
          isFullscreen && "pb-4 border-b"
        )}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20">
              <Server className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold">N8N Editor</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {connectionStatus.checking ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Checking...</span>
                  </>
                ) : connectionStatus.connected ? (
                  <>
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>Connected</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 text-red-500" />
                    <span>Disconnected</span>
                  </>
                )}
                <Badge variant="outline" className="text-xs ml-2">
                  {connectionStatus.mode === "personal" ? "Personal" : "Shared"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={checkConnection}
              disabled={connectionStatus.checking}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", connectionStatus.checking && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={openInNewTab}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Open</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Connection Status Bar */}
      <div className={cn(
        "flex items-center justify-between p-3 rounded-t-lg border-b",
        connectionStatus.connected
          ? "bg-green-500/10 border-green-500/20"
          : connectionStatus.checking
          ? "bg-muted/50 border-muted"
          : "bg-red-500/10 border-red-500/20"
      )}>
        <div className="flex items-center gap-2">
          {connectionStatus.connected ? (
            <LinkIcon className="h-4 w-4 text-green-500" />
          ) : connectionStatus.checking ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Unlink className="h-4 w-4 text-red-500" />
          )}
          <span className={cn(
            "text-sm font-medium",
            connectionStatus.connected
              ? "text-green-700 dark:text-green-400"
              : connectionStatus.checking
              ? "text-muted-foreground"
              : "text-red-700 dark:text-red-400"
          )}>
            {connectionStatus.message}
          </span>
        </div>
        <code className="text-xs text-muted-foreground font-mono truncate max-w-[200px] sm:max-w-none">
          {connectionStatus.url}
        </code>
      </div>

      {/* Iframe Container */}
      <div className={iframeContainerClasses}>
        {/* Loading State */}
        {!iframeLoaded && !iframeError && connectionStatus.connected && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading N8N Editor...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {(iframeError || !connectionStatus.connected) && !connectionStatus.checking && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="flex flex-col items-center gap-4 max-w-md text-center p-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <h4 className="font-semibold mb-2">Unable to Load N8N Editor</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  {iframeError
                    ? "The N8N editor could not be loaded in this frame. This may be due to security settings on the N8N server."
                    : connectionStatus.message || "Cannot connect to the N8N server."}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  N8N may need to be configured to allow embedding. Check the
                  N8N_EDITOR_BASE_URL and security settings.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={refreshIframe} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
                <Button onClick={openInNewTab} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Open in New Tab
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Iframe */}
        {connectionStatus.connected && (
          <iframe
            ref={iframeRef}
            src={getIframeUrl()}
            className="w-full h-full border-0"
            title="N8N Workflow Editor"
            allow="clipboard-read; clipboard-write"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        )}
      </div>

      {/* Footer Info */}
      {!isFullscreen && (
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Settings className="h-3 w-3" />
            <a
              href="/settings/n8n"
              className="hover:underline"
            >
              Configure N8N settings
            </a>
          </div>
          <span>
            {connectionStatus.mode === "personal"
              ? "Using your personal N8N instance"
              : "Using Claudia's shared N8N instance"}
          </span>
        </div>
      )}
    </div>
  )
}

// Compact connection status indicator component
export function N8NConnectionStatus({ className }: { className?: string }) {
  const [status, setStatus] = useState<{ connected: boolean; checking: boolean }>({
    connected: false,
    checking: true,
  })

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch("/api/n8n-status")
        if (response.ok) {
          const data = await response.json()
          setStatus({ connected: data.healthy === true, checking: false })
        } else {
          setStatus({ connected: false, checking: false })
        }
      } catch {
        setStatus({ connected: false, checking: false })
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {status.checking ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : status.connected ? (
        <>
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground">N8N Connected</span>
        </>
      ) : (
        <>
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-xs text-muted-foreground">N8N Offline</span>
        </>
      )}
    </div>
  )
}
