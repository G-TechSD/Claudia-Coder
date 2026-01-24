"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ToolStatusBadge } from "./tool-status-badge"
import { DevToolId, DevToolStatus, InstallStatus } from "@/lib/dev-tools/types"
import { Terminal, Code2, Sparkles, ChevronDown, ExternalLink, Settings } from "lucide-react"
import Link from "next/link"

const TOOL_ICONS: Record<DevToolId, React.ElementType> = {
  "claude-code": Terminal,
  ganesha: Sparkles,
  vscode: Code2,
}

const TOOL_COLORS: Record<DevToolId, string> = {
  "claude-code": "text-orange-500",
  ganesha: "text-purple-500",
  vscode: "text-blue-500",
}

interface ToolSelectorProps {
  projectId: string
  workingDirectory: string
  onSelect?: (toolId: DevToolId) => void
  className?: string
  triggerLabel?: string
  showManageLink?: boolean
}

export function ToolSelector({
  projectId,
  workingDirectory,
  onSelect,
  className,
  triggerLabel = "Open in...",
  showManageLink = true,
}: ToolSelectorProps) {
  const [tools, setTools] = useState<DevToolStatus[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch tool status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/dev-tools/status")
        if (response.ok) {
          const data = await response.json()
          setTools(data.tools)
        }
      } catch (error) {
        console.error("Failed to fetch tool status:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
  }, [])

  const handleSelect = (toolId: DevToolId) => {
    const tool = tools.find((t) => t.id === toolId)
    if (tool?.status !== "installed") {
      // Navigate to install page
      window.location.href = `/dev-tools?install=${toolId}`
      return
    }

    if (onSelect) {
      onSelect(toolId)
    } else {
      // Default navigation
      switch (toolId) {
        case "claude-code":
          window.location.href = `/claude-code?projectId=${projectId}&workingDirectory=${encodeURIComponent(workingDirectory)}`
          break
        case "ganesha":
          window.location.href = `/dev-tools/ganesha?projectId=${projectId}&workingDirectory=${encodeURIComponent(workingDirectory)}`
          break
        case "vscode":
          window.location.href = `/dev-tools/vscode?projectId=${projectId}&workingDirectory=${encodeURIComponent(workingDirectory)}`
          break
      }
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn("gap-2", className)}>
          <Code2 className="h-4 w-4" />
          {triggerLabel}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {loading ? (
          <DropdownMenuItem disabled>
            <span className="text-muted-foreground">Loading tools...</span>
          </DropdownMenuItem>
        ) : (
          <>
            {tools.map((tool) => {
              const Icon = TOOL_ICONS[tool.id]
              const colorClass = TOOL_COLORS[tool.id]
              const isInstalled = tool.status === "installed"

              return (
                <DropdownMenuItem
                  key={tool.id}
                  onClick={() => handleSelect(tool.id)}
                  className="flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", colorClass)} />
                    <span>{tool.name}</span>
                  </div>
                  <ToolStatusBadge
                    status={tool.status}
                    version={tool.version}
                    showLabel={isInstalled}
                  />
                </DropdownMenuItem>
              )
            })}
          </>
        )}

        {showManageLink && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href="/dev-tools"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Settings className="h-4 w-4" />
                <span>Manage Dev Tools</span>
                <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Simplified version for quick access
interface QuickToolButtonsProps {
  projectId: string
  workingDirectory: string
  onSelect?: (toolId: DevToolId) => void
  className?: string
}

export function QuickToolButtons({
  projectId,
  workingDirectory,
  onSelect,
  className,
}: QuickToolButtonsProps) {
  const [tools, setTools] = useState<DevToolStatus[]>([])

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/dev-tools/status")
        if (response.ok) {
          const data = await response.json()
          setTools(data.tools)
        }
      } catch (error) {
        console.error("Failed to fetch tool status:", error)
      }
    }

    fetchStatus()
  }, [])

  const handleClick = (toolId: DevToolId) => {
    if (onSelect) {
      onSelect(toolId)
    } else {
      switch (toolId) {
        case "claude-code":
          window.location.href = `/claude-code?projectId=${projectId}&workingDirectory=${encodeURIComponent(workingDirectory)}`
          break
        case "ganesha":
          window.location.href = `/dev-tools/ganesha?projectId=${projectId}&workingDirectory=${encodeURIComponent(workingDirectory)}`
          break
        case "vscode":
          window.location.href = `/dev-tools/vscode?projectId=${projectId}&workingDirectory=${encodeURIComponent(workingDirectory)}`
          break
      }
    }
  }

  return (
    <div className={cn("flex gap-2", className)}>
      {tools
        .filter((t) => t.status === "installed")
        .map((tool) => {
          const Icon = TOOL_ICONS[tool.id]
          const colorClass = TOOL_COLORS[tool.id]

          return (
            <Button
              key={tool.id}
              variant="outline"
              size="sm"
              onClick={() => handleClick(tool.id)}
              className="gap-2"
              title={`Open in ${tool.name}`}
            >
              <Icon className={cn("h-4 w-4", colorClass)} />
              {tool.name}
            </Button>
          )
        })}
    </div>
  )
}
