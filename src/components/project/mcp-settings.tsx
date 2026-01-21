"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Server,
  Sparkles,
  Info,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  suggestMCPServers,
  getMCPServerInfo,
  getAllMCPServers,
  getMCPServersByCategory,
  type MCPServerInfo
} from "@/lib/mcp/tech-stack-mapping"
import type { ProjectMCPSettings } from "@/lib/data/types"

interface MCPSettingsProps {
  projectId: string
  projectTags: string[]
  currentSettings?: ProjectMCPSettings
  onSettingsChange: (settings: ProjectMCPSettings) => void
}

export function MCPSettings({
  projectId,
  projectTags,
  currentSettings,
  onSettingsChange,
}: MCPSettingsProps) {
  const [settings, setSettings] = useState<ProjectMCPSettings>(
    currentSettings || {
      enabledServers: [],
      autoDetectFromTechStack: true,
    }
  )
  const [suggestedServers, setSuggestedServers] = useState<string[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  // Get suggested servers based on tech stack
  useEffect(() => {
    if (projectTags.length > 0) {
      const suggested = suggestMCPServers(projectTags)
      setSuggestedServers(suggested)

      // Auto-enable suggested servers if autoDetect is on and no servers are enabled yet
      if (settings.autoDetectFromTechStack && settings.enabledServers.length === 0) {
        setSettings((prev) => ({
          ...prev,
          enabledServers: suggested,
        }))
        setHasChanges(true)
      }
    }
  }, [projectTags])

  const handleToggleServer = (serverId: string) => {
    setSettings((prev) => {
      const newEnabled = prev.enabledServers.includes(serverId)
        ? prev.enabledServers.filter((id) => id !== serverId)
        : [...prev.enabledServers, serverId]
      return { ...prev, enabledServers: newEnabled }
    })
    setHasChanges(true)
  }

  const handleToggleAutoDetect = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, autoDetectFromTechStack: enabled }))
    setHasChanges(true)
  }

  const handleSave = () => {
    onSettingsChange(settings)
    setHasChanges(false)
  }

  const handleApplySuggestions = () => {
    setSettings((prev) => ({
      ...prev,
      enabledServers: [...new Set([...prev.enabledServers, ...suggestedServers])],
    }))
    setHasChanges(true)
  }

  const serversByCategory = getMCPServersByCategory()
  const allServers = getAllMCPServers()

  return (
    <div className="space-y-4">
      {/* Auto-detect Toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="auto-detect">Auto-detect from tech stack</Label>
          <p className="text-xs text-muted-foreground">
            Automatically suggest MCP servers based on project tags
          </p>
        </div>
        <Switch
          id="auto-detect"
          checked={settings.autoDetectFromTechStack}
          onCheckedChange={handleToggleAutoDetect}
        />
      </div>

      {/* Suggested Servers */}
      {suggestedServers.length > 0 && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Suggested for your tech stack</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedServers.map((serverId) => {
              const info = getMCPServerInfo([serverId])[0]
              const isEnabled = settings.enabledServers.includes(serverId)
              return (
                <Badge
                  key={serverId}
                  variant={isEnabled ? "default" : "secondary"}
                  className={cn(
                    "cursor-pointer transition-colors",
                    isEnabled && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => handleToggleServer(serverId)}
                >
                  {isEnabled && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {info?.name || serverId}
                </Badge>
              )
            })}
          </div>
          {suggestedServers.some((id) => !settings.enabledServers.includes(id)) && (
            <Button
              variant="link"
              size="sm"
              className="mt-2 h-auto p-0 text-primary"
              onClick={handleApplySuggestions}
            >
              Enable all suggestions
            </Button>
          )}
        </div>
      )}

      {/* All Available Servers */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Available MCP Servers</h4>
        {Object.entries(serversByCategory).map(([category, servers]) => (
          <div key={category}>
            <h5 className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              {category}
            </h5>
            <div className="space-y-2">
              {servers.map((server) => (
                <ServerToggle
                  key={server.id}
                  server={server}
                  isEnabled={settings.enabledServers.includes(server.id)}
                  isSuggested={suggestedServers.includes(server.id)}
                  onToggle={() => handleToggleServer(server.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave}>
            Save MCP Settings
          </Button>
        </div>
      )}

      {/* Info Note */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p>
            MCP (Model Context Protocol) servers extend Claude's capabilities with
            specialized tools. Enabled servers will be available during execution.
          </p>
        </div>
      </div>
    </div>
  )
}

function ServerToggle({
  server,
  isEnabled,
  isSuggested,
  onToggle,
}: {
  server: MCPServerInfo
  isEnabled: boolean
  isSuggested: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer",
        isEnabled
          ? "bg-primary/5 border-primary/30"
          : "bg-background border-border hover:border-border/80"
      )}
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        <Server className={cn("h-4 w-4", isEnabled ? "text-primary" : "text-muted-foreground")} />
        <div>
          <div className="flex items-center gap-2">
            <span className={cn("font-medium text-sm", isEnabled && "text-primary")}>
              {server.name}
            </span>
            {isSuggested && !isEnabled && (
              <Badge variant="outline" className="text-xs py-0">
                Suggested
              </Badge>
            )}
            {server.requiresConfig && (
              <Badge variant="outline" className="text-xs py-0 text-amber-500 border-amber-500/30">
                Requires Config
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{server.description}</p>
        </div>
      </div>
      <Switch checked={isEnabled} onCheckedChange={onToggle} onClick={(e) => e.stopPropagation()} />
    </div>
  )
}
