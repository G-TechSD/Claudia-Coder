"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  StopCircle,
  ThumbsUp,
  ThumbsDown,
  History,
  ChevronRight
} from "lucide-react"
import type { PacketRun, PacketRunStatus } from "@/lib/data/types"

interface PacketHistoryProps {
  runs: PacketRun[]
  onSelectRun: (run: PacketRun) => void
  selectedRunId?: string
  className?: string
}

const statusConfig: Record<PacketRunStatus, {
  icon: typeof Clock
  color: string
  bg: string
  label: string
  animate?: boolean
  badgeVariant: "secondary" | "default" | "warning" | "success" | "error" | "info"
}> = {
  running: {
    icon: Loader2,
    color: "text-blue-400",
    bg: "bg-blue-400",
    label: "Running",
    animate: true,
    badgeVariant: "info"
  },
  completed: {
    icon: CheckCircle2,
    color: "text-green-400",
    bg: "bg-green-400",
    label: "Completed",
    badgeVariant: "success"
  },
  failed: {
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-400",
    label: "Failed",
    badgeVariant: "error"
  },
  cancelled: {
    icon: StopCircle,
    color: "text-gray-400",
    bg: "bg-gray-400",
    label: "Cancelled",
    badgeVariant: "secondary"
  }
}

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

function formatDuration(startedAt: string, completedAt?: string): string {
  if (!completedAt) return "-"

  const start = new Date(startedAt).getTime()
  const end = new Date(completedAt).getTime()
  const diff = end - start

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

export function PacketHistory({
  runs,
  onSelectRun,
  selectedRunId,
  className
}: PacketHistoryProps) {
  // Sort runs by iteration number descending (newest first)
  const sortedRuns = useMemo(() => {
    return [...runs].sort((a, b) => b.iteration - a.iteration)
  }, [runs])

  // Find the currently running execution
  const runningRun = sortedRuns.find(run => run.status === "running")

  if (runs.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-muted-foreground", className)}>
        <History className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm font-medium">No runs yet</p>
        <p className="text-xs mt-1">Execution history will appear here</p>
      </div>
    )
  }

  return (
    <ScrollArea className={cn("", className)}>
      <div className="space-y-1 p-2">
        {sortedRuns.map((run) => {
          const config = statusConfig[run.status]
          const Icon = config.icon
          const isSelected = selectedRunId === run.id
          const isRunning = run.status === "running"

          return (
            <button
              key={run.id}
              onClick={() => onSelectRun(run)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                "hover:bg-accent/50",
                isSelected && "bg-accent border border-primary/50",
                isRunning && "ring-1 ring-blue-400/50 bg-blue-400/5"
              )}
            >
              {/* Timeline indicator */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all",
                    isRunning && "border-blue-400 bg-blue-400/20",
                    run.status === "completed" && "border-green-400 bg-green-400/20",
                    run.status === "failed" && "border-red-400 bg-red-400/20",
                    run.status === "cancelled" && "border-gray-400 bg-gray-400/20"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      config.color,
                      config.animate && "animate-spin"
                    )}
                  />
                </div>
              </div>

              {/* Run info */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    Run #{run.iteration}
                  </span>
                  <Badge variant={config.badgeVariant} className="text-xs">
                    {config.label}
                  </Badge>
                  {isRunning && (
                    <span className="text-xs text-blue-400 animate-pulse">
                      In Progress
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimestamp(run.startedAt)}
                  </span>
                  {run.completedAt && (
                    <span className="font-mono">
                      {formatDuration(run.startedAt, run.completedAt)}
                    </span>
                  )}
                </div>
              </div>

              {/* Rating indicator */}
              <div className="flex items-center gap-2">
                {run.rating === "thumbs_up" && (
                  <ThumbsUp className="h-4 w-4 text-green-400" />
                )}
                {run.rating === "thumbs_down" && (
                  <ThumbsDown className="h-4 w-4 text-red-400" />
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          )
        })}
      </div>
    </ScrollArea>
  )
}
