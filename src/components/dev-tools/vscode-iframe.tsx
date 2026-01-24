"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, ExternalLink, Square, Code2, AlertCircle, AlertTriangle } from "lucide-react"

interface VSCodeIframeProps {
  projectId: string
  workingDirectory: string
  className?: string
  onClose?: () => void
  userId?: string
  userRole?: string
}

export function VSCodeIframe({
  projectId,
  workingDirectory,
  className,
  onClose,
  userId,
  userRole,
}: VSCodeIframeProps) {
  const [status, setStatus] = useState<"idle" | "starting" | "ready" | "error" | "iframe-error">("idle")
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [iframeKey, setIframeKey] = useState(0)

  // Check if we're on HTTPS (which needs proxied URLs)
  const isHttps = useMemo(() => {
    if (typeof window === "undefined") return false
    return window.location.protocol === "https:"
  }, [])

  // Check if accessing through nginx proxy (port 8443)
  const isOnNginxProxy = useMemo(() => {
    if (typeof window === "undefined") return false
    return window.location.port === "8443"
  }, [])

  // Get the correct URL using current hostname (for remote access)
  // When on HTTPS via nginx (port 8443), use the nginx proxy path: /vscode/{port}/
  const getCorrectUrl = useCallback((originalUrl: string) => {
    if (typeof window === "undefined") return originalUrl

    const currentHost = window.location.hostname

    // Parse the original URL to extract port and path
    try {
      const parsed = new URL(originalUrl)
      const codeServerPort = parsed.port || "8100"
      const pathAndQuery = parsed.pathname + parsed.search

      if (isHttps && isOnNginxProxy) {
        // Use nginx proxy: https://hostname:8443/vscode/{port}/{path}
        // Only works when accessing through nginx on port 8443
        return `https://${currentHost}:8443/vscode/${codeServerPort}${pathAndQuery}`
      } else if (isHttps) {
        // On HTTPS but not through nginx - can't embed directly
        // Return the direct URL (will fail, but fallback UI will help)
        return `https://${currentHost}:8443/vscode/${codeServerPort}${pathAndQuery}`
      } else {
        // Direct HTTP access - just replace localhost with current host
        return originalUrl.replace(/localhost|127\.0\.0\.1/, currentHost)
      }
    } catch {
      // Fallback: simple replacement
      return originalUrl.replace(/localhost|127\.0\.0\.1/, currentHost)
    }
  }, [isHttps, isOnNginxProxy])

  // Get direct HTTP URL for "Open in New Tab" option
  const getDirectUrl = useCallback((originalUrl: string) => {
    if (typeof window === "undefined") return originalUrl
    const currentHost = window.location.hostname
    return originalUrl.replace(/localhost|127\.0\.0\.1/, currentHost)
  }, [])

  // Start VS Code instance
  const startInstance = useCallback(async () => {
    setStatus("starting")
    setError(null)

    try {
      const response = await fetch("/api/dev-tools/vscode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, workingDirectory, userId, userRole }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to start VS Code")
      }

      setInstanceId(data.instanceId)
      setUrl(data.url)
      // Always set to ready - nginx proxy handles HTTPS
      setStatus("ready")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start VS Code")
      setStatus("error")
    }
  }, [projectId, workingDirectory])

  // Stop VS Code instance
  const stopInstance = useCallback(async () => {
    if (!instanceId) return

    try {
      await fetch(`/api/dev-tools/vscode?instanceId=${instanceId}`, {
        method: "DELETE",
      })
    } catch (err) {
      console.error("Failed to stop VS Code:", err)
    }

    setInstanceId(null)
    setUrl(null)
    setStatus("idle")
    onClose?.()
  }, [instanceId, onClose])

  // Refresh iframe
  const refreshIframe = useCallback(() => {
    setIframeKey((prev) => prev + 1)
  }, [])

  // Open in new tab - use proxied URL for same HTTPS experience
  const openInNewTab = useCallback(() => {
    if (url) {
      window.open(getCorrectUrl(url), "_blank")
    }
  }, [url, getCorrectUrl])

  // Open direct HTTP URL (fallback if proxy doesn't work)
  const openDirectUrl = useCallback(() => {
    if (url) {
      window.open(getDirectUrl(url), "_blank")
    }
  }, [url, getDirectUrl])

  // Handle iframe load error
  const handleIframeError = useCallback(() => {
    setStatus("iframe-error")
  }, [])

  // Health check
  useEffect(() => {
    if (status !== "ready" || !instanceId) return

    const checkHealth = async () => {
      try {
        const response = await fetch(`/api/dev-tools/vscode?instanceId=${instanceId}&health=true`)
        const data = await response.json()

        if (!data.healthy) {
          console.warn("[vscode] Health check failed, instance may have stopped")
        }
      } catch {
        // Ignore health check errors
      }
    }

    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [status, instanceId])

  // Auto-start on mount
  useEffect(() => {
    startInstance()

    return () => {
      // Don't auto-stop on unmount - let instance run in background
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn("relative flex flex-col rounded-lg overflow-hidden bg-[#1e1e1e] border border-gray-800", className)}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-gray-800">
        <div className="flex items-center gap-3">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={stopInstance}
              className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 transition-colors"
              title="Close VS Code"
            />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
          </div>
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-gray-300 font-medium">VS Code</span>
          </div>
          {/* Status */}
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded text-xs",
            status === "starting" && "text-yellow-400",
            status === "ready" && "text-green-400",
            (status === "error" || status === "iframe-error") && "text-red-400",
            status === "idle" && "text-gray-400"
          )}>
            {status === "starting" && <Loader2 className="h-3 w-3 animate-spin" />}
            {status === "ready" && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
            {(status === "error" || status === "iframe-error") && <AlertCircle className="h-3 w-3" />}
            <span className="capitalize">
              {status === "iframe-error" ? "Error" : status}
            </span>
          </div>
          {/* HTTPS proxy status indicator */}
          {isHttps && status === "ready" && (
            <div className="text-xs text-gray-500">
              {isOnNginxProxy ? "via nginx" : "proxy mode"}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(status === "ready" || status === "iframe-error") && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshIframe}
                className="text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 h-7"
                title="Refresh"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={openInNewTab}
                className="gap-1 h-7"
                title="Open in new tab"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={stopInstance}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7"
              >
                <Square className="h-3 w-3 mr-1" />
                Stop
              </Button>
            </>
          )}
          {(status === "error" || status === "idle") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={startInstance}
              className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-7"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              {status === "error" ? "Retry" : "Start"}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative" style={{ minHeight: "500px" }}>
        {status === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1e1e1e] gap-4">
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
            <div className="text-center">
              <p className="text-gray-300 font-medium">Starting VS Code...</p>
              <p className="text-xs text-gray-500 mt-1">This may take a few seconds</p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1e1e1e] gap-4">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <div className="text-center">
              <p className="text-red-400 font-medium">Failed to start VS Code</p>
              <p className="text-xs text-gray-500 mt-1">{error}</p>
            </div>
            <Button
              variant="outline"
              onClick={startInstance}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        )}

        {status === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1e1e1e] gap-4">
            <Code2 className="h-8 w-8 text-blue-400" />
            <div className="text-center">
              <p className="text-gray-300 font-medium">VS Code</p>
              <p className="text-xs text-gray-500 mt-1">Click Start to launch VS Code</p>
            </div>
            <Button
              onClick={startInstance}
              className="gap-2"
            >
              <Code2 className="h-4 w-4" />
              Start VS Code
            </Button>
          </div>
        )}

        {status === "iframe-error" && url && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1e1e1e] gap-4 p-8">
            <AlertTriangle className="h-12 w-12 text-yellow-500" />
            <div className="text-center max-w-md">
              <p className="text-yellow-400 font-medium text-lg">Embedded view failed to load</p>
              <p className="text-sm text-gray-400 mt-2">
                Try opening VS Code in a new tab, or use direct HTTP access.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Working directory: <span className="font-mono">{workingDirectory}</span>
              </p>
            </div>
            <div className="flex gap-3 mt-4">
              <Button
                onClick={openInNewTab}
                size="lg"
                className="gap-2"
              >
                <ExternalLink className="h-5 w-5" />
                Open in New Tab (HTTPS)
              </Button>
              <Button
                onClick={openDirectUrl}
                size="lg"
                variant="outline"
                className="gap-2"
              >
                <ExternalLink className="h-5 w-5" />
                Direct HTTP
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2 font-mono">
              {getCorrectUrl(url)}
            </p>
          </div>
        )}

        {status === "ready" && url && (
          <iframe
            key={iframeKey}
            src={getCorrectUrl(url)}
            className="w-full h-full border-0"
            title="VS Code"
            allow="clipboard-read; clipboard-write"
            onError={handleIframeError}
            // Note: We can't detect cross-origin iframe loading failures
            // because contentDocument is always null for cross-origin frames.
            // If the iframe appears blank, users can use the fallback buttons.
          />
        )}
      </div>
    </div>
  )
}
