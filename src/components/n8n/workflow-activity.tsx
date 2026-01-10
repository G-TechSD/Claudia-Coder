"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth/auth-provider"
import { useUserExecutions, useUserWorkflows } from "@/lib/api/hooks"
import type { UserExecution, UserWorkflow } from "@/lib/n8n/user-workflows"
import Link from "next/link"
import {
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Play,
  Pause,
  AlertCircle,
  ExternalLink,
  Workflow,
  Timer,
  ChevronRight,
  ArrowRight,
  MoreHorizontal,
} from "lucide-react"

interface WorkflowActivityProps {
  className?: string
  maxItems?: number
  workflowId?: string
  showHeader?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
  onExecutionClick?: (execution: UserExecution) => void
}

// Execution status configuration
const statusConfig = {
  running: {
    label: "Running",
    icon: Loader2,
    color: "text-blue-500",
    bg: "bg-blue-500",
    badgeVariant: "secondary" as const,
    animate: true,
  },
  success: {
    label: "Success",
    icon: CheckCircle,
    color: "text-green-500",
    bg: "bg-green-500",
    badgeVariant: "success" as const,
    animate: false,
  },
  error: {
    label: "Failed",
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-500",
    badgeVariant: "destructive" as const,
    animate: false,
  },
  waiting: {
    label: "Waiting",
    icon: Clock,
    color: "text-yellow-500",
    bg: "bg-yellow-500",
    badgeVariant: "secondary" as const,
    animate: false,
  },
}

// Format timestamp to relative time
function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return `${seconds}s ago`
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}

// Format duration in ms to human readable
function formatDuration(startedAt: string, stoppedAt?: string): string {
  const start = new Date(startedAt).getTime()
  const end = stoppedAt ? new Date(stoppedAt).getTime() : Date.now()
  const durationMs = end - start

  if (durationMs < 1000) return `${durationMs}ms`
  if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`
  if (durationMs < 3600000) return `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
  return `${Math.floor(durationMs / 3600000)}h ${Math.floor((durationMs % 3600000) / 60000)}m`
}

export function WorkflowActivity({
  className,
  maxItems = 10,
  workflowId,
  showHeader = true,
  autoRefresh = true,
  refreshInterval = 10000, // 10 seconds
  onExecutionClick,
}: WorkflowActivityProps) {
  const { user, isAuthenticated } = useAuth()
  const userId = user?.id || null

  const { executions, isLoading, error, refresh } = useUserExecutions(
    userId,
    workflowId,
    true // autoFetch
  )

  const { workflows } = useUserWorkflows(userId, true)

  // Create a map for quick workflow name lookup
  const workflowMap = useMemo(() => {
    const map = new Map<string, UserWorkflow>()
    workflows.forEach(w => map.set(w.id, w))
    return map
  }, [workflows])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      refresh()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, refresh])

  // Filter and limit executions
  const displayedExecutions = useMemo(() => {
    return executions.slice(0, maxItems)
  }, [executions, maxItems])

  // Count executions by status
  const statusCounts = useMemo(() => {
    const counts = { running: 0, success: 0, error: 0, waiting: 0 }
    executions.forEach(e => {
      if (e.status in counts) {
        counts[e.status as keyof typeof counts]++
      }
    })
    return counts
  }, [executions])

  const handleRefresh = useCallback(() => {
    refresh()
  }, [refresh])

  if (!isAuthenticated) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center h-32 text-muted-foreground">
          <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">Sign in to view workflow activity</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-medium">
                Workflow Activity
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {/* Status Summary Badges */}
              {statusCounts.running > 0 && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {statusCounts.running} running
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                className="gap-1.5"
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent className={cn(!showHeader && "pt-6")}>
        {/* Error State */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-500 mb-4">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{error.message}</p>
            <Button variant="ghost" size="sm" onClick={handleRefresh} className="ml-auto">
              Retry
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && displayedExecutions.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && displayedExecutions.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Activity className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No recent executions</p>
            <p className="text-xs">Workflow runs will appear here</p>
          </div>
        )}

        {/* Executions List */}
        {displayedExecutions.length > 0 && (
          <div className="space-y-2">
            {displayedExecutions.map((execution) => {
              const config = statusConfig[execution.status] || statusConfig.waiting
              const Icon = config.icon
              const workflow = workflowMap.get(execution.workflowId)
              const workflowName = workflow?.name || execution.workflowName || "Unknown Workflow"

              return (
                <div
                  key={execution.id}
                  onClick={() => onExecutionClick?.(execution)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors",
                    onExecutionClick && "cursor-pointer"
                  )}
                >
                  {/* Status Indicator */}
                  <div className="relative flex-shrink-0">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      execution.status === "success" && "bg-green-500/10",
                      execution.status === "error" && "bg-red-500/10",
                      execution.status === "running" && "bg-blue-500/10",
                      execution.status === "waiting" && "bg-yellow-500/10"
                    )}>
                      <Icon className={cn(
                        "h-4 w-4",
                        config.color,
                        config.animate && "animate-spin"
                      )} />
                    </div>
                    {/* Pulse indicator for running */}
                    {execution.status === "running" && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                      </span>
                    )}
                  </div>

                  {/* Execution Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{workflowName}</p>
                      <Badge variant={config.badgeVariant} className="text-xs flex-shrink-0">
                        {config.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(execution.startedAt)}
                      </span>
                      {(execution.status === "success" || execution.status === "error") && (
                        <span className="flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          {formatDuration(execution.startedAt, execution.stoppedAt)}
                        </span>
                      )}
                      {execution.status === "running" && (
                        <span className="flex items-center gap-1 text-blue-500">
                          <Timer className="h-3 w-3" />
                          {formatDuration(execution.startedAt)}
                        </span>
                      )}
                      <span className="text-muted-foreground/70">
                        #{execution.id.slice(0, 8)}
                      </span>
                    </div>
                  </div>

                  {/* Action */}
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              )
            })}
          </div>
        )}

        {/* View All Link */}
        {executions.length > maxItems && (
          <div className="mt-4 pt-4 border-t">
            <Button variant="ghost" className="w-full gap-2" asChild>
              <Link href="/n8n?tab=executions">
                View all {executions.length} executions
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Compact activity indicator for dashboards
export function WorkflowActivityBadge({ className }: { className?: string }) {
  const { user } = useAuth()
  const { executions, isLoading } = useUserExecutions(user?.id || null)

  const runningCount = useMemo(() => {
    return executions.filter(e => e.status === "running").length
  }, [executions])

  if (isLoading) {
    return (
      <Badge variant="outline" className={cn("gap-1", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading...
      </Badge>
    )
  }

  if (runningCount > 0) {
    return (
      <Badge variant="secondary" className={cn("gap-1", className)}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
        {runningCount} running
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className={cn("gap-1 text-muted-foreground", className)}>
      <Activity className="h-3 w-3" />
      Idle
    </Badge>
  )
}

// Running workflows panel
export function RunningWorkflows({ className }: { className?: string }) {
  const { user } = useAuth()
  const { executions, refresh } = useUserExecutions(user?.id || null)
  const { workflows } = useUserWorkflows(user?.id || null)

  const runningExecutions = useMemo(() => {
    return executions.filter(e => e.status === "running")
  }, [executions])

  const workflowMap = useMemo(() => {
    const map = new Map<string, UserWorkflow>()
    workflows.forEach(w => map.set(w.id, w))
    return map
  }, [workflows])

  // Auto-refresh for running workflows
  useEffect(() => {
    if (runningExecutions.length === 0) return

    const interval = setInterval(refresh, 3000) // More frequent refresh when workflows are running
    return () => clearInterval(interval)
  }, [runningExecutions.length, refresh])

  if (runningExecutions.length === 0) {
    return null
  }

  return (
    <Card className={cn("border-blue-500/20 bg-blue-500/5", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
          </span>
          <CardTitle className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {runningExecutions.length} Workflow{runningExecutions.length > 1 ? "s" : ""} Running
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {runningExecutions.map((execution) => {
            const workflow = workflowMap.get(execution.workflowId)
            return (
              <div
                key={execution.id}
                className="flex items-center justify-between p-2 rounded bg-blue-500/10"
              >
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="text-sm font-medium">
                    {workflow?.name || "Unknown Workflow"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDuration(execution.startedAt)}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
