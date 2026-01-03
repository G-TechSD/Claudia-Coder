"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useSettings } from "@/hooks/useSettings"
import {
  Server,
  Cloud,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Zap,
  DollarSign
} from "lucide-react"
import { cn } from "@/lib/utils"

interface LLMServer {
  name: string
  url: string
  type: "lmstudio" | "ollama"
  status: "unknown" | "online" | "offline" | "busy"
  currentModel?: string
}

interface LLMStatusData {
  servers: LLMServer[]
  hasLocalAvailable: boolean
  hasPaidConfigured: boolean
}

export function LLMStatus({ compact = false }: { compact?: boolean }) {
  const { settings, update } = useSettings()
  const [status, setStatus] = useState<LLMStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/llm/generate")
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      } else {
        setError("Failed to fetch LLM status")
      }
    } catch (e) {
      setError("Could not connect to LLM status API")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    // Refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : status?.hasLocalAvailable ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">Local LLM</span>
          </>
        ) : settings.allowPaidLLM && status?.hasPaidConfigured ? (
          <>
            <Cloud className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">Cloud API</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-muted-foreground">No LLM</span>
          </>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4" />
              LLM Status
            </CardTitle>
            <CardDescription>AI backend configuration</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchStatus} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Local Servers */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase">Local Servers (Free)</Label>
          {status?.servers && status.servers.length > 0 ? (
            <div className="space-y-2">
              {status.servers.map((server) => (
                <div
                  key={server.name}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        server.status === "online" && "bg-green-500",
                        server.status === "offline" && "bg-red-500",
                        server.status === "busy" && "bg-yellow-500",
                        server.status === "unknown" && "bg-gray-400"
                      )}
                    />
                    <span className="text-sm font-medium">{server.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {server.type}
                    </Badge>
                  </div>
                  {server.currentModel && (
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {server.currentModel}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-dashed text-sm text-muted-foreground">
              No local LLM servers configured. Add LM Studio or Ollama URLs to .env.local
            </div>
          )}
        </div>

        {/* Paid API Toggle */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-yellow-500" />
              <div>
                <Label htmlFor="paid-llm" className="text-sm font-medium">
                  Enable Paid APIs
                </Label>
                <p className="text-xs text-muted-foreground">
                  Use Claude/OpenAI when local unavailable
                </p>
              </div>
            </div>
            <Switch
              id="paid-llm"
              checked={settings.allowPaidLLM}
              onCheckedChange={(checked) => update({ allowPaidLLM: checked })}
            />
          </div>

          {settings.allowPaidLLM && (
            <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-600 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                Paid API usage will be billed to your configured accounts.
                Local LLMs are always tried first when available.
              </span>
            </div>
          )}

          {status?.hasPaidConfigured ? (
            <Badge variant="secondary" className="text-xs">
              <Cloud className="h-3 w-3 mr-1" />
              Anthropic API configured
            </Badge>
          ) : (
            <p className="text-xs text-muted-foreground">
              No paid API keys configured in environment
            </p>
          )}
        </div>

        {/* Quick Status */}
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2">
            {status?.hasLocalAvailable ? (
              <>
                <Zap className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  Ready with <strong>local LLM</strong>
                </span>
              </>
            ) : settings.allowPaidLLM && status?.hasPaidConfigured ? (
              <>
                <Cloud className="h-4 w-4 text-blue-500" />
                <span className="text-sm">
                  Ready with <strong>cloud API</strong> (paid)
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">
                  Start LM Studio or Ollama for AI features
                </span>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Inline status indicator for headers/toolbars
export function LLMStatusBadge() {
  const { settings } = useSettings()
  const [hasLocal, setHasLocal] = useState<boolean | null>(null)

  useEffect(() => {
    fetch("/api/llm/generate")
      .then(res => res.json())
      .then(data => setHasLocal(data.hasLocalAvailable))
      .catch(() => setHasLocal(false))
  }, [])

  if (hasLocal === null) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  }

  if (hasLocal) {
    return (
      <Badge variant="secondary" className="text-xs gap-1">
        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Local
      </Badge>
    )
  }

  if (settings.allowPaidLLM) {
    return (
      <Badge variant="secondary" className="text-xs gap-1">
        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
        Cloud
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="text-xs gap-1 text-yellow-600">
      <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
      No LLM
    </Badge>
  )
}
