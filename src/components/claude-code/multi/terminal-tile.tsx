"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  X,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  FolderOpen,
  Clock,
  Loader2,
} from "lucide-react"
import { MultiTerminalSession, TerminalGroup, TILE_COLLAPSED_HEIGHT, GROUP_COLORS } from "@/lib/multi-terminal/types"
import { useMultiTerminal } from "./multi-terminal-provider"
import { EmbeddedTerminal } from "@/components/claude-code/embedded-terminal"

interface TerminalTileProps {
  terminal: MultiTerminalSession
  groups: TerminalGroup[]
  className?: string
}

const statusColors = {
  idle: "bg-gray-400",
  connecting: "bg-yellow-400 animate-pulse",
  connected: "bg-green-400",
  error: "bg-red-400",
  closed: "bg-gray-400",
}

const statusLabels = {
  idle: "Idle",
  connecting: "Connecting",
  connected: "Connected",
  error: "Error",
  closed: "Closed",
}

export function TerminalTile({ terminal, groups, className }: TerminalTileProps) {
  const {
    removeTerminal,
    updateStatus,
    updateProject,
    toggleCollapse,
    popOut,
    moveToGroup,
    dispatch
  } = useMultiTerminal()

  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [labelValue, setLabelValue] = useState(terminal.label)
  const labelInputRef = useRef<HTMLInputElement>(null)
  const terminalContainerRef = useRef<HTMLDivElement>(null)

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingLabel && labelInputRef.current) {
      labelInputRef.current.focus()
      labelInputRef.current.select()
    }
  }, [isEditingLabel])

  // Update label value when terminal label changes
  useEffect(() => {
    setLabelValue(terminal.label)
  }, [terminal.label])

  const handleLabelSubmit = useCallback(() => {
    const trimmedLabel = labelValue.trim()
    if (trimmedLabel && trimmedLabel !== terminal.label) {
      dispatch({ type: "UPDATE_LABEL", payload: { terminalId: terminal.id, label: trimmedLabel } })
    } else {
      setLabelValue(terminal.label)
    }
    setIsEditingLabel(false)
  }, [labelValue, terminal.label, terminal.id, dispatch])

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLabelSubmit()
    } else if (e.key === "Escape") {
      setLabelValue(terminal.label)
      setIsEditingLabel(false)
    }
  }, [handleLabelSubmit, terminal.label])

  const handleStatusChange = useCallback((status: "idle" | "connecting" | "connected" | "error" | "closed") => {
    updateStatus(terminal.id, status)
  }, [terminal.id, updateStatus])

  const handleRemove = useCallback(() => {
    removeTerminal(terminal.id)
  }, [terminal.id, removeTerminal])

  const handleToggleCollapse = useCallback(() => {
    toggleCollapse(terminal.id)
  }, [terminal.id, toggleCollapse])

  const handlePopOut = useCallback(() => {
    popOut(terminal.id)
  }, [terminal.id, popOut])

  const handleMoveToGroup = useCallback((groupId: string | null) => {
    moveToGroup(terminal.id, groupId)
  }, [terminal.id, moveToGroup])

  const handleProjectChange = useCallback((project: {
    projectId: string
    projectName: string
    workingDirectory: string
  }) => {
    updateProject(terminal.id, project.projectId, project.projectName, project.workingDirectory)
  }, [terminal.id, updateProject])

  const handleTmuxSessionCreated = useCallback((tmuxSessionName: string) => {
    dispatch({ type: 'UPDATE_TMUX_SESSION', payload: { terminalId: terminal.id, tmuxSessionName } })
  }, [terminal.id, dispatch])

  // Format time ago
  const timeAgo = useCallback((dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return "just now"
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }, [])

  // If popped out, show placeholder
  if (terminal.isPoppedOut) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-purple-500/50 bg-purple-500/5",
          className
        )}
        style={{ height: TILE_COLLAPSED_HEIGHT }}
      >
        <div className="flex items-center h-full px-4 gap-3">
          <div className="flex items-center gap-2 text-purple-400">
            <ExternalLink className="h-4 w-4" />
            <span className="font-medium text-sm">{terminal.label}</span>
          </div>
          <span className="text-xs text-purple-400/70">Popped out to separate window</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
            onClick={() => popOut(terminal.id)} // This will focus existing window
          >
            Focus Window
          </Button>
        </div>
      </div>
    )
  }

  // Collapsed view
  if (terminal.isCollapsed) {
    return (
      <div
        className={cn(
          "rounded-lg border bg-card transition-all",
          terminal.status === "error" && "border-red-500/50",
          className
        )}
        style={{ height: TILE_COLLAPSED_HEIGHT }}
      >
        <div className="flex items-center h-full px-3 gap-2">
          {/* Drag handle */}
          <div className="cursor-grab text-muted-foreground hover:text-foreground">
            <GripVertical className="h-4 w-4" />
          </div>

          {/* Label */}
          <div className="font-medium text-sm truncate min-w-0 flex-shrink">
            {terminal.label}
          </div>

          {/* Project name */}
          <div className="text-xs text-muted-foreground truncate hidden sm:block">
            {terminal.projectName}
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-1.5 ml-auto">
            <div className={cn("h-2 w-2 rounded-full", statusColors[terminal.status])} />
            <span className="text-xs text-muted-foreground hidden md:inline">
              {statusLabels[terminal.status]}
            </span>
          </div>

          {/* Time */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground hidden lg:flex">
            <Clock className="h-3 w-3" />
            {timeAgo(terminal.lastActiveAt)}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleToggleCollapse}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Expanded view
  return (
    <div
      className={cn(
        "rounded-lg border bg-card flex flex-col overflow-hidden transition-all",
        terminal.status === "error" && "border-red-500/50",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center px-3 py-2 border-b bg-muted/30 gap-2">
        {/* Drag handle */}
        <div className="cursor-grab text-muted-foreground hover:text-foreground flex-shrink-0">
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Label - editable */}
        {isEditingLabel ? (
          <Input
            ref={labelInputRef}
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            onBlur={handleLabelSubmit}
            onKeyDown={handleLabelKeyDown}
            className="h-7 w-40 text-sm"
          />
        ) : (
          <button
            onClick={() => setIsEditingLabel(true)}
            className="font-medium text-sm truncate hover:text-primary transition-colors flex items-center gap-1"
          >
            {terminal.label}
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50" />
          </button>
        )}

        {/* Project name */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <FolderOpen className="h-3 w-3" />
          <span className="truncate max-w-[120px]">{terminal.projectName}</span>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-1.5 ml-auto">
          {terminal.status === "connecting" && (
            <Loader2 className="h-3 w-3 animate-spin text-yellow-400" />
          )}
          <div className={cn("h-2 w-2 rounded-full", statusColors[terminal.status])} />
          <span className="text-xs text-muted-foreground">
            {statusLabels[terminal.status]}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleToggleCollapse}
            title="Collapse"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handlePopOut}
            title="Pop out to window"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditingLabel(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Move to Group
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleMoveToGroup(null)}>
                    No Group
                  </DropdownMenuItem>
                  {groups.length > 0 && <DropdownMenuSeparator />}
                  {groups.map((group) => (
                    <DropdownMenuItem
                      key={group.id}
                      onClick={() => handleMoveToGroup(group.id)}
                    >
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full mr-2",
                          `bg-${group.color}-500`
                        )}
                        style={{ backgroundColor: getGroupColor(group.color) }}
                      />
                      {group.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleRemove}
                className="text-destructive focus:text-destructive"
              >
                <X className="h-4 w-4 mr-2" />
                Close Terminal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Terminal content */}
      <div ref={terminalContainerRef} className="flex-1 min-h-[350px]">
        <EmbeddedTerminal
          projectId={terminal.projectId || undefined}
          projectName={terminal.projectName}
          workingDirectory={terminal.workingDirectory}
          label={terminal.label}
          className="h-full"
          onStatusChange={handleStatusChange}
          onProjectChange={handleProjectChange}
          onTmuxSessionCreated={handleTmuxSessionCreated}
        />
      </div>
    </div>
  )
}

// Helper to get actual color value from color name
function getGroupColor(colorName: string): string {
  const colors: Record<string, string> = {
    blue: "#3b82f6",
    green: "#22c55e",
    purple: "#a855f7",
    orange: "#f97316",
    pink: "#ec4899",
    cyan: "#06b6d4",
    yellow: "#eab308",
    red: "#ef4444",
  }
  return colors[colorName] || colors.blue
}
