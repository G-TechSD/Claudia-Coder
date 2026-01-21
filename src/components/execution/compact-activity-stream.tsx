"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ActivityEvent } from "./activity-stream"
import {
  Play,
  RefreshCw,
  FileCode,
  TestTube,
  Brain,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Zap,
  GitCommit,
  Terminal,
  MessageSquare,
  Bot,
  Flag
} from "lucide-react"

const eventIcons: Record<ActivityEvent["type"], React.ElementType> = {
  start: Play,
  iteration: RefreshCw,
  file_change: FileCode,
  test_run: TestTube,
  thinking: Brain,
  complete: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  commit: GitCommit,
  tool_use: Terminal,
  progress: Zap,
  output: MessageSquare,
  milestone: Flag
}

const eventColors: Record<ActivityEvent["type"], string> = {
  start: "text-blue-400",
  iteration: "text-purple-400",
  file_change: "text-yellow-400",
  test_run: "text-cyan-400",
  thinking: "text-pink-400",
  complete: "text-green-400",
  error: "text-red-400",
  warning: "text-amber-400",
  commit: "text-emerald-400",
  tool_use: "text-orange-400",
  progress: "text-indigo-400",
  output: "text-gray-400",
  milestone: "text-fuchsia-400"
}

interface CompactActivityStreamProps {
  events: ActivityEvent[]
  maxEvents?: number
  isRunning?: boolean
  className?: string
  onViewAll?: () => void
}

/**
 * Compact Activity Stream for sidebar/widget use
 *
 * Shows the last N events in a condensed format
 */
export function CompactActivityStream({
  events,
  maxEvents = 5,
  isRunning,
  className,
  onViewAll
}: CompactActivityStreamProps) {
  const displayEvents = events.slice(-maxEvents).reverse()

  if (events.length === 0) {
    return (
      <div className={cn("text-center py-3 text-xs text-muted-foreground", className)}>
        No activity yet
      </div>
    )
  }

  return (
    <div className={cn("space-y-1", className)}>
      {/* Running indicator */}
      {isRunning && (
        <div className="flex items-center gap-2 text-xs text-green-400 animate-pulse px-2 py-1">
          <div className="flex gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: "100ms" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: "200ms" }} />
          </div>
          <span className="truncate">Working...</span>
        </div>
      )}

      {/* Events */}
      {displayEvents.map((event) => {
        const Icon = eventIcons[event.type] || Bot
        const colorClass = eventColors[event.type] || "text-gray-400"

        return (
          <div
            key={event.id}
            className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-gray-800/50 transition-colors"
          >
            <Icon className={cn("h-3.5 w-3.5 flex-shrink-0 mt-0.5", colorClass)} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white truncate">{event.message}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatTime(event.timestamp)}
              </p>
            </div>
          </div>
        )
      })}

      {/* View all link */}
      {events.length > maxEvents && onViewAll && (
        <button
          onClick={onViewAll}
          className="w-full text-xs text-center text-muted-foreground hover:text-white py-1.5 transition-colors"
        >
          View all {events.length} events
        </button>
      )}
    </div>
  )
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })
}

/**
 * Mini activity badge showing count and latest status
 */
export function ActivityBadge({
  events,
  isRunning
}: {
  events: ActivityEvent[]
  isRunning?: boolean
}) {
  if (events.length === 0 && !isRunning) return null

  const latestEvent = events[events.length - 1]
  const hasErrors = events.some(e => e.type === "error")
  const hasWarnings = events.some(e => e.type === "warning")

  return (
    <div className="flex items-center gap-1.5">
      {isRunning ? (
        <Zap className="h-3.5 w-3.5 text-green-500 animate-pulse" />
      ) : hasErrors ? (
        <XCircle className="h-3.5 w-3.5 text-red-400" />
      ) : hasWarnings ? (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
      ) : (
        <CheckCircle className="h-3.5 w-3.5 text-green-400" />
      )}
      <span className="text-xs text-muted-foreground">
        {isRunning ? "Running" : `${events.length} events`}
      </span>
    </div>
  )
}
