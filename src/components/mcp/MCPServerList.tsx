"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Edit2,
  Trash2,
  Globe,
  FolderOpen,
  Terminal,
  MoreVertical,
  RefreshCw,
  AlertCircle
} from "lucide-react"
import { MCPManagedServer } from "@/lib/mcp/types"
import { cn } from "@/lib/utils"

interface MCPServerListProps {
  servers: MCPManagedServer[]
  onEdit: (server: MCPManagedServer) => void
  onDelete: (id: string) => void
  onToggle: (id: string) => void
  isLoading?: boolean
  projects?: { id: string; name: string }[]
}

function getStatusColor(status: MCPManagedServer["status"]) {
  switch (status) {
    case "running":
      return "bg-green-500"
    case "stopped":
      return "bg-zinc-500"
    case "error":
      return "bg-red-500"
    default:
      return "bg-yellow-500"
  }
}

function getStatusLabel(status: MCPManagedServer["status"]) {
  switch (status) {
    case "running":
      return "Running"
    case "stopped":
      return "Stopped"
    case "error":
      return "Error"
    default:
      return "Unknown"
  }
}

export function MCPServerList({
  servers,
  onEdit,
  onDelete,
  onToggle,
  isLoading = false,
  projects = []
}: MCPServerListProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const getProjectName = (projectId?: string) => {
    if (!projectId) return null
    const project = projects.find((p) => p.id === projectId)
    return project?.name || projectId
  }

  const handleDelete = (id: string) => {
    if (confirmDelete === id) {
      onDelete(id)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(id)
      // Reset confirm state after 3 seconds
      setTimeout(() => setConfirmDelete(null), 3000)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Terminal className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-lg mb-1">No MCP Servers</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Add an MCP server to extend Claude Code&apos;s capabilities
        </p>
      </div>
    )
  }

  // Group servers by scope
  const globalServers = servers.filter((s) => s.scope === "global")
  const projectServers = servers.filter((s) => s.scope === "project")

  return (
    <div className="space-y-6">
      {/* Global Servers */}
      {globalServers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Global Servers ({globalServers.length})
            </span>
          </div>
          <div className="space-y-2">
            {globalServers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                onEdit={() => onEdit(server)}
                onDelete={() => handleDelete(server.id)}
                onToggle={() => onToggle(server.id)}
                isConfirmingDelete={confirmDelete === server.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Project-specific Servers */}
      {projectServers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Project-specific Servers ({projectServers.length})
            </span>
          </div>
          <div className="space-y-2">
            {projectServers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                projectName={getProjectName(server.projectId)}
                onEdit={() => onEdit(server)}
                onDelete={() => handleDelete(server.id)}
                onToggle={() => onToggle(server.id)}
                isConfirmingDelete={confirmDelete === server.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface ServerCardProps {
  server: MCPManagedServer
  projectName?: string | null
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  isConfirmingDelete: boolean
}

function ServerCard({
  server,
  projectName,
  onEdit,
  onDelete,
  onToggle,
  isConfirmingDelete
}: ServerCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border transition-colors",
        server.enabled ? "bg-card" : "bg-muted/30 opacity-70"
      )}
    >
      {/* Status indicator */}
      <div
        className={cn(
          "h-2.5 w-2.5 rounded-full shrink-0",
          getStatusColor(server.status)
        )}
        title={getStatusLabel(server.status)}
      />

      {/* Server info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{server.name}</span>
          {projectName && (
            <Badge variant="outline" className="text-xs shrink-0">
              {projectName}
            </Badge>
          )}
          {server.scope === "global" && (
            <Badge variant="secondary" className="text-xs shrink-0">
              <Globe className="h-3 w-3 mr-1" />
              Global
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {server.command} {server.args.join(" ")}
          </code>
        </div>
        {server.lastError && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-red-500">
            <AlertCircle className="h-3 w-3" />
            <span className="truncate">{server.lastError}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Switch
          checked={server.enabled}
          onCheckedChange={onToggle}
          aria-label={`${server.enabled ? "Disable" : "Enable"} ${server.name}`}
        />
        <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8">
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button
          variant={isConfirmingDelete ? "destructive" : "ghost"}
          size="icon"
          onClick={onDelete}
          className="h-8 w-8"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
