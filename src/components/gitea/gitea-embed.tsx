"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  ExternalLink,
  Wifi,
  WifiOff,
  Loader2,
  AlertCircle,
  GitBranch,
} from "lucide-react"

// Gitea is bundled in the all-in-one container at this URL
const GITEA_DEFAULT_URL = "http://localhost:8929"

interface GiteaConnectionStatus {
  healthy: boolean
  url: string
  message: string
  version?: string
  lastChecked?: string
}

interface GiteaEmbedProps {
  className?: string
  onFullscreenChange?: (isFullscreen: boolean) => void
  baseUrl?: string
}

export function GiteaEmbed({
  className,
  onFullscreenChange,
  baseUrl = GITEA_DEFAULT_URL,
}: GiteaEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // State
  const [connectionStatus, setConnectionStatus] = useState<GiteaConnectionStatus | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [iframeError, setIframeError] = useState<string | null>(null)

  // Check connection health
  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch("/api/gitea/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: baseUrl }),
      })

      const data = await response.json()
      setConnectionStatus({
        healthy: data.healthy,
        url: baseUrl,
        message: data.message,
        version: data.version,
        lastChecked: new Date().toISOString(),
      })
    } catch (error) {
      setConnectionStatus({
        healthy: false,
        url: baseUrl,
        message: error instanceof Error ? error.message : "Connection check failed",
        lastChecked: new Date().toISOString(),
      })
    }
  }, [baseUrl])

  // Initial connection check
  useEffect(() => {
    checkConnection()
  }, [checkConnection])

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
    setIframeError("Failed to load Gitea")
  }, [])

  // Refresh iframe
  const refreshIframe = useCallback(() => {
    if (iframeRef.current) {
      setIframeLoaded(false)
      setIframeError(null)
      // Force reload by updating src
      iframeRef.current.src = baseUrl
    }
    checkConnection()
  }, [baseUrl, checkConnection])

  // Open in new tab
  const openInNewTab = useCallback(() => {
    window.open(baseUrl, "_blank")
  }, [baseUrl])

  // Handle escape key for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false)
        onFullscreenChange?.(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen, onFullscreenChange])

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
          {/* Gitea Icon */}
          <GitBranch className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Gitea</span>

          {/* Connection Status */}
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
        </div>
      </div>

      {/* Iframe Container */}
      <div className="relative flex-1 min-h-0">
        {/* Loading overlay */}
        {!iframeLoaded && !iframeError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading Gitea...</p>
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
                Make sure the Claudia container is running. Gitea should be available at {baseUrl}.
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
        <iframe
          ref={iframeRef}
          src={baseUrl}
          className={cn(
            "w-full h-full border-0",
            (!iframeLoaded || iframeError) && "invisible"
          )}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
          title="Gitea"
        />
      </div>

      {/* Status bar (shown in fullscreen) */}
      {isFullscreen && (
        <div className="flex items-center justify-between px-4 py-1 border-t bg-muted/30 text-xs text-muted-foreground">
          <span>Press Esc or click minimize to exit fullscreen</span>
          <span>{baseUrl}</span>
        </div>
      )}
    </div>
  )
}
