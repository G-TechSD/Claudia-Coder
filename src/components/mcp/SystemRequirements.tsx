"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Check,
  X,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info
} from "lucide-react"
import { cn } from "@/lib/utils"

// Types matching the API response
interface DependencyStatus {
  name: string
  installed: boolean
  version?: string
  path?: string
  description: string
  installUrl: string
  installInstructions: string
  category: "nodejs" | "python" | "other"
  required: boolean
  error?: string
}

interface DependencyCheckResult {
  dependencies: DependencyStatus[]
  allRequiredInstalled: boolean
  nodeAvailable: boolean
  pythonAvailable: boolean
  timestamp: string
  summary: string
  cached?: boolean
  installInstructions?: Record<string, string>
}

interface SystemRequirementsProps {
  className?: string
  compact?: boolean
  onStatusChange?: (status: DependencyCheckResult | null) => void
}

export function SystemRequirements({
  className,
  compact = false,
  onStatusChange
}: SystemRequirementsProps) {
  const [status, setStatus] = useState<DependencyCheckResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(!compact)

  const checkDependencies = async (refresh = false) => {
    setIsLoading(true)
    setError(null)

    try {
      const url = refresh
        ? "/api/mcp/check-dependencies?refresh=true"
        : "/api/mcp/check-dependencies"
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error("Failed to check dependencies")
      }

      const result = await response.json()
      setStatus(result)
      onStatusChange?.(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check dependencies")
      onStatusChange?.(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkDependencies()
  }, [])

  // Group dependencies by category
  const groupedDeps = status?.dependencies.reduce(
    (acc, dep) => {
      if (!acc[dep.category]) {
        acc[dep.category] = []
      }
      acc[dep.category].push(dep)
      return acc
    },
    {} as Record<string, DependencyStatus[]>
  )

  const categoryLabels: Record<string, string> = {
    nodejs: "Node.js",
    python: "Python",
    other: "Other Tools"
  }

  const installedCount = status?.dependencies.filter((d) => d.installed).length || 0
  const totalCount = status?.dependencies.length || 0
  const missingRequired = status?.dependencies.filter((d) => d.required && !d.installed) || []

  if (isLoading && !status) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 py-4">
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Checking system dependencies...
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={cn("border-red-500/20", className)}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => checkDependencies(true)}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Compact view - just a summary bar
  if (compact && !expanded) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {status?.allRequiredInstalled ? (
                <div className="flex items-center gap-2 text-green-500">
                  <Check className="h-4 w-4" />
                  <span className="text-sm font-medium">All required tools installed</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-yellow-500">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {missingRequired.length} required tool{missingRequired.length !== 1 ? "s" : ""}{" "}
                    missing
                  </span>
                </div>
              )}
              <Badge variant="secondary" className="text-xs">
                {installedCount}/{totalCount} installed
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => checkDependencies(true)}
                disabled={isLoading}
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setExpanded(true)}>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">System Requirements</CardTitle>
            <CardDescription>
              Tools required to run MCP servers
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkDependencies(true)}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-1", isLoading && "animate-spin")} />
              Refresh
            </Button>
            {compact && (
              <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
                <ChevronUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary */}
        <div
          className={cn(
            "p-3 rounded-lg border",
            status?.allRequiredInstalled
              ? "bg-green-500/5 border-green-500/20"
              : "bg-yellow-500/5 border-yellow-500/20"
          )}
        >
          <div className="flex items-start gap-2">
            {status?.allRequiredInstalled ? (
              <Check className="h-4 w-4 text-green-500 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
            )}
            <div className="flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  status?.allRequiredInstalled ? "text-green-500" : "text-yellow-500"
                )}
              >
                {status?.summary}
              </p>
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                <span>{installedCount} of {totalCount} tools installed</span>
                {status?.cached && <span>(cached)</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Dependency lists by category */}
        {groupedDeps &&
          Object.entries(groupedDeps).map(([category, deps]) => (
            <div key={category}>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {categoryLabels[category] || category}
              </h4>
              <div className="space-y-1">
                {deps.map((dep) => (
                  <DependencyRow key={dep.name} dependency={dep} />
                ))}
              </div>
            </div>
          ))}

        {/* Info note */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            Node.js is required for npx-based servers. Python and uv are needed for uvx-based
            servers. Install missing tools to use all MCP server types.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

interface DependencyRowProps {
  dependency: DependencyStatus
}

function DependencyRow({ dependency }: DependencyRowProps) {
  const [showInstructions, setShowInstructions] = useState(false)

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex items-center gap-3 p-2 rounded-lg",
          dependency.installed ? "bg-card" : "bg-red-500/5"
        )}
      >
        {/* Status icon */}
        {dependency.installed ? (
          <Check className="h-4 w-4 text-green-500 shrink-0" />
        ) : (
          <X className="h-4 w-4 text-red-500 shrink-0" />
        )}

        {/* Name and info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{dependency.name}</span>
            {dependency.required && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                Required
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{dependency.description}</p>
        </div>

        {/* Version or install action */}
        {dependency.installed ? (
          <div className="text-right shrink-0">
            <span className="text-xs font-mono text-muted-foreground">{dependency.version}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowInstructions(!showInstructions)}
            >
              {showInstructions ? "Hide" : "Install"}
              <ChevronDown
                className={cn("h-3 w-3 ml-1 transition-transform", showInstructions && "rotate-180")}
              />
            </Button>
            <a
              href={dependency.installUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-accent rounded"
            >
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          </div>
        )}
      </div>

      {/* Install instructions */}
      {showInstructions && !dependency.installed && (
        <div className="ml-7 p-3 rounded-lg bg-muted/50 border">
          <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">
            {dependency.installInstructions}
          </pre>
        </div>
      )}
    </div>
  )
}

// Hook for using dependency status in other components
export function useDependencyStatus() {
  const [status, setStatus] = useState<DependencyCheckResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkDependencies = async (refresh = false) => {
    setIsLoading(true)
    try {
      const url = refresh
        ? "/api/mcp/check-dependencies?refresh=true"
        : "/api/mcp/check-dependencies"
      const response = await fetch(url)
      if (response.ok) {
        const result = await response.json()
        setStatus(result)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkDependencies()
  }, [])

  return { status, isLoading, checkDependencies }
}

// Helper to check if a specific server command can run
export async function checkServerDependencies(
  command: string,
  args: string[] = []
): Promise<{
  canRun: boolean
  missing: string[]
  runtime: string
  message: string
  installInstructions: Record<string, string>
}> {
  try {
    const response = await fetch("/api/mcp/check-dependencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, args })
    })

    if (!response.ok) {
      throw new Error("Failed to check dependencies")
    }

    return await response.json()
  } catch {
    return {
      canRun: false,
      missing: [],
      runtime: "unknown",
      message: "Failed to check dependencies",
      installInstructions: {}
    }
  }
}
