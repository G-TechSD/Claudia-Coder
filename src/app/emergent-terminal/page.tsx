"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/components/auth/auth-provider"
import {
  Terminal,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  Settings,
  Loader2,
  Shield,
  Play,
  Square,
  Key,
  Globe,
} from "lucide-react"
import { getDefaultLaunchHost, setDefaultLaunchHost } from "@/lib/settings/global-settings"

const EMERGENT_PORT = 3100

interface TokenInfo {
  exists: boolean
  token?: string
  createdAt?: string
  setBy?: string
  message?: string
}

export default function EmergentTerminalPage() {
  const { user } = useAuth()
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking")
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [newToken, setNewToken] = useState("")
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  const [hostname, setHostname] = useState("localhost")
  const [editingHostname, setEditingHostname] = useState("")

  // Get the emergent URL based on configured hostname
  const emergentUrl = useMemo(() => {
    return `https://${hostname}:${EMERGENT_PORT}`
  }, [hostname])

  // Load hostname from settings
  useEffect(() => {
    const savedHost = getDefaultLaunchHost()
    if (savedHost) {
      setHostname(savedHost)
      setEditingHostname(savedHost)
    } else {
      setEditingHostname("localhost")
    }
  }, [])

  // Check if emergent server is running (via backend to avoid mixed content issues)
  const checkServerStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/emergent-terminal/start", {
        cache: "no-cache",
      })
      if (response.ok) {
        const data = await response.json()
        if (data.responding) {
          setServerStatus("online")
          return true
        }
      }
    } catch {
      // Server not reachable
    }
    setServerStatus("offline")
    return false
  }, [])

  // Fetch token info
  const fetchTokenInfo = useCallback(async () => {
    try {
      const response = await fetch("/api/emergent-terminal/token")
      if (response.ok) {
        const data = await response.json()
        setTokenInfo(data)
      }
    } catch (err) {
      console.error("Failed to fetch token info:", err)
    }
  }, [])

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([checkServerStatus(), fetchTokenInfo()])
      setLoading(false)
    }
    init()

    // Poll server status every 3 seconds
    const interval = setInterval(checkServerStatus, 3000)
    return () => clearInterval(interval)
  }, [checkServerStatus, fetchTokenInfo])

  // Copy token to clipboard
  const handleCopyToken = useCallback(() => {
    if (tokenInfo?.token) {
      navigator.clipboard.writeText(tokenInfo.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [tokenInfo?.token])

  // Start server
  const handleStartServer = useCallback(async () => {
    setStarting(true)
    try {
      // First ensure we have a token
      if (!tokenInfo?.exists) {
        await fetch("/api/emergent-terminal/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regenerate: true }),
        })
        await fetchTokenInfo()
      }

      const response = await fetch("/api/emergent-terminal/start", {
        method: "POST",
      })
      const data = await response.json()

      if (!response.ok) {
        console.error("Failed to start server:", data)
        alert(`Failed to start server: ${data.error || "Unknown error"}${data.log ? "\n\nLog:\n" + data.log : ""}`)
      } else {
        // Wait a moment then check status
        await new Promise((r) => setTimeout(r, 1000))
        await checkServerStatus()
        // Refresh token info in case it was just created
        await fetchTokenInfo()
      }
    } catch (err) {
      console.error("Failed to start server:", err)
      alert(`Failed to start server: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setStarting(false)
    }
  }, [tokenInfo?.exists, fetchTokenInfo, checkServerStatus])

  // Stop server
  const handleStopServer = useCallback(async () => {
    setStopping(true)
    try {
      await fetch("/api/emergent-terminal/start", {
        method: "DELETE",
      })
      await new Promise((r) => setTimeout(r, 1000))
      await checkServerStatus()
    } catch (err) {
      console.error("Failed to stop server:", err)
    } finally {
      setStopping(false)
    }
  }, [checkServerStatus])

  // Regenerate token
  const handleRegenerateToken = useCallback(async () => {
    setSaving(true)
    try {
      const response = await fetch("/api/emergent-terminal/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: true }),
      })
      if (response.ok) {
        await fetchTokenInfo()
      }
    } catch (err) {
      console.error("Failed to regenerate token:", err)
    } finally {
      setSaving(false)
    }
  }, [fetchTokenInfo])

  // Set custom token
  const handleSetCustomToken = useCallback(async () => {
    if (newToken.length < 16) {
      alert("Token must be at least 16 characters")
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/emergent-terminal/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: newToken }),
      })
      if (response.ok) {
        await fetchTokenInfo()
        setNewToken("")
        setShowSettings(false)
      }
    } catch (err) {
      console.error("Failed to set token:", err)
    } finally {
      setSaving(false)
    }
  }, [newToken, fetchTokenInfo])

  // Pop out terminal
  const handlePopout = useCallback(() => {
    if (tokenInfo?.token) {
      window.open(
        `${emergentUrl}?token=${tokenInfo.token}&popout=true`,
        "EmergentTerminal",
        "width=1100,height=750,menubar=no,toolbar=no,location=no,status=no"
      )
    }
  }, [tokenInfo?.token, emergentUrl])

  // Refresh iframe
  const handleRefresh = useCallback(() => {
    setIframeKey((k) => k + 1)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
            <Terminal className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Emergent Terminal</h1>
            <p className="text-sm text-muted-foreground">
              Development terminal for Claudia Coder and emergent modules
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={serverStatus === "online" ? "default" : "secondary"}>
            {serverStatus === "checking" ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : serverStatus === "online" ? (
              <span className="h-2 w-2 rounded-full bg-green-400 mr-1.5" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-zinc-400 mr-1.5" />
            )}
            {serverStatus === "online" ? "Online" : "Offline"}
          </Badge>

          {/* Start/Stop Server Button */}
          {serverStatus === "offline" ? (
            <Button onClick={handleStartServer} disabled={starting} size="sm">
              {starting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {starting ? "Starting..." : "Start Server"}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleStopServer} disabled={stopping}>
              {stopping ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              Stop
            </Button>
          )}

          {serverStatus === "online" && (
            <>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handlePopout}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Pop Out
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Token Display Bar - Always visible */}
      {tokenInfo?.token && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg border">
          <Key className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground shrink-0">Access Token:</span>
          <code className="flex-1 text-xs font-mono bg-background px-2 py-1 rounded border truncate">
            {tokenInfo.token}
          </code>
          <Button variant="ghost" size="sm" onClick={handleCopyToken} className="shrink-0">
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </>
            )}
          </Button>
          <span className="text-xs text-muted-foreground shrink-0">
            Direct access:{" "}
            <a
              href={emergentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {hostname}:{EMERGENT_PORT}
            </a>
          </span>
        </div>
      )}

      {/* Main content */}
      {serverStatus === "offline" ? (
        <Card className="flex-1 flex items-center justify-center">
          <CardContent className="text-center py-12">
            <Terminal className="h-16 w-16 mx-auto mb-6 text-muted-foreground/50" />
            <h2 className="text-xl font-semibold mb-2">Emergent Terminal Server</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              A standalone terminal that runs independently, so it keeps working even when Claudia
              Coder is restarting or being modified.
            </p>
            <Button size="lg" onClick={handleStartServer} disabled={starting}>
              {starting ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Play className="h-5 w-5 mr-2" />
              )}
              {starting ? "Starting Server..." : "Start Emergent Terminal"}
            </Button>
            {!tokenInfo?.exists && (
              <p className="text-xs text-muted-foreground mt-4">
                An access token will be generated automatically
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-0 h-full">
            {tokenInfo?.token ? (
              <iframe
                key={iframeKey}
                src={`${emergentUrl}?token=${tokenInfo.token}`}
                className="w-full h-full border-0"
                title="Emergent Terminal"
                allow="clipboard-read; clipboard-write"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No access token available</p>
                  <Button className="mt-4" onClick={handleRegenerateToken} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Key className="h-4 w-4 mr-2" />
                    )}
                    Generate Token
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emergent Terminal Settings</DialogTitle>
            <DialogDescription>
              Manage the access token for the Emergent Terminal server.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Hostname Setting */}
            <div>
              <Label htmlFor="hostname" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Host Address
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                The hostname or IP address for accessing the terminal (used for LAN access)
              </p>
              <div className="flex gap-2">
                <Input
                  id="hostname"
                  value={editingHostname}
                  onChange={(e) => setEditingHostname(e.target.value)}
                  placeholder="localhost or 192.168.1.100"
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const newHost = editingHostname.trim() || "localhost"
                    setHostname(newHost)
                    setDefaultLaunchHost(newHost === "localhost" ? undefined : newHost)
                  }}
                  disabled={editingHostname === hostname || (editingHostname === "" && hostname === "localhost")}
                >
                  Apply
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="text-sm font-medium">Access Token</Label>
            </div>

            {/* Current token */}
            {tokenInfo?.exists && (
              <div>
                <Label className="text-sm text-muted-foreground">Current Token</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value={tokenInfo.token || ""} readOnly className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={handleCopyToken}>
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {tokenInfo.createdAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Created: {new Date(tokenInfo.createdAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Regenerate */}
            <div>
              <Button
                variant="outline"
                onClick={handleRegenerateToken}
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Regenerate Random Token
              </Button>
            </div>

            {/* Custom token */}
            <div className="border-t pt-4">
              <Label htmlFor="customToken">Set Custom Token</Label>
              <p className="text-xs text-muted-foreground mb-2">Must be at least 16 characters</p>
              <div className="flex gap-2">
                <Input
                  id="customToken"
                  type="password"
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                  placeholder="Enter custom token..."
                  className="font-mono"
                />
                <Button onClick={handleSetCustomToken} disabled={saving || newToken.length < 16}>
                  Set
                </Button>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm">
              <p className="text-yellow-500 font-medium">Important</p>
              <p className="text-muted-foreground mt-1">
                After changing the token, restart the Emergent Terminal server for changes to take
                effect.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
