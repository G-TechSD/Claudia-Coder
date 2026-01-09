"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getGlobalSettings } from "@/lib/settings/global-settings"
import { Settings, Plus, Loader2 } from "lucide-react"
import Link from "next/link"

interface Agent {
  id: string
  name: string
  model: string
  status: "active" | "idle" | "error" | "checking" | "online" | "offline"
  type: "local" | "cloud"
}

interface LLMServer {
  name: string
  url: string
  type: "lmstudio" | "ollama"
  status: "unknown" | "online" | "offline" | "busy"
  currentModel?: string
}

interface LLMStatusResponse {
  servers: LLMServer[]
  hasLocalAvailable: boolean
  hasPaidConfigured: boolean
}

const statusConfig = {
  active: { label: "Active", color: "bg-green-400", ring: "ring-green-400/30" },
  online: { label: "Online", color: "bg-green-400", ring: "ring-green-400/30" },
  idle: { label: "Idle", color: "bg-muted-foreground", ring: "ring-muted-foreground/30" },
  offline: { label: "Offline", color: "bg-red-400", ring: "ring-red-400/30" },
  error: { label: "Error", color: "bg-red-400", ring: "ring-red-400/30" },
  checking: { label: "Checking", color: "bg-yellow-400", ring: "ring-yellow-400/30" },
}

export function AgentGrid() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLLMStatus = useCallback(async () => {
    try {
      // Fetch live status from API (same source as Settings page LLMStatus component)
      const response = await fetch("/api/llm/generate")
      if (response.ok) {
        const data: LLMStatusResponse = await response.json()
        const newAgents: Agent[] = []

        // Add local servers from live API response
        for (const server of data.servers) {
          newAgents.push({
            id: server.name.toLowerCase(),
            name: server.name,
            model: server.currentModel || server.type,
            status: server.status === "online" ? "online" : server.status === "offline" ? "offline" : "checking",
            type: "local"
          })
        }

        // Also add cloud providers from settings if enabled
        // Use actual configured models, not hardcoded ones
        const settings = getGlobalSettings()
        for (const provider of settings.cloudProviders.filter(p => p.enabled)) {
          const names: Record<string, string> = {
            anthropic: "Claude",
            openai: "GPT",
            google: "Gemini"
          }
          // Use the first enabled model for this provider, or a sensible default
          const defaultModels: Record<string, string> = {
            anthropic: "claude-opus-4-5-20251101",
            openai: "gpt-4o",
            google: "gemini-2.5-pro"
          }
          const configuredModel = provider.enabledModels?.[0] || defaultModels[provider.provider] || "default"
          // Extract a short display name from the model ID
          const modelDisplayName = configuredModel
            .replace("claude-", "")
            .replace("gpt-", "")
            .replace("gemini-", "")
            .split("-")[0]
            .charAt(0).toUpperCase() + configuredModel.split("-")[0].slice(1)

          newAgents.push({
            id: provider.provider,
            name: names[provider.provider],
            model: modelDisplayName,
            status: "idle",
            type: "cloud"
          })
        }

        // Check if any agent is currently active based on agent state
        try {
          const agentState = localStorage.getItem("claudia_agent_state")
          if (agentState) {
            const { state, activeServerId } = JSON.parse(agentState)
            if (state === "running" && activeServerId) {
              const activeIdx = newAgents.findIndex(a => a.id === activeServerId)
              if (activeIdx >= 0) {
                newAgents[activeIdx].status = "active"
              }
            }
          }
        } catch {
          // Ignore parse errors
        }

        setAgents(newAgents)
      }
    } catch (error) {
      console.error("Failed to fetch LLM status:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLLMStatus()

    // Refresh every 30 seconds (same as LLMStatus component)
    const interval = setInterval(fetchLLMStatus, 30000)

    return () => clearInterval(interval)
  }, [fetchLLMStatus])

  // Show loading state on initial load
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">AI Models</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Checking AI servers...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (agents.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">AI Models</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Settings className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-2">No AI models configured</p>
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link href="/settings?tab=ai-services">
                <Plus className="h-3 w-3" />
                Add Model
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">AI Models</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {agents.map((agent) => {
            const config = statusConfig[agent.status]
            return (
              <div
                key={agent.id}
                className="flex flex-col items-center gap-2 rounded-lg border bg-card p-3 text-center transition-colors hover:bg-accent/50"
              >
                <div className="relative">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium ring-2",
                      config.ring
                    )}
                  >
                    {agent.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
                      config.color,
                      agent.status === "active" && "animate-pulse"
                    )}
                  />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{agent.name}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-20" title={agent.model}>
                    {agent.model}
                  </p>
                  <p className={cn(
                    "text-xs",
                    agent.type === "local" ? "text-blue-400" : "text-purple-400"
                  )}>
                    {agent.type === "local" ? "Local" : "Cloud"}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
