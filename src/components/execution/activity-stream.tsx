"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Play,
  RefreshCw,
  FileCode,
  TestTube,
  Brain,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  GitCommit,
  Sparkles
} from "lucide-react"

export interface ActivityEvent {
  id: string
  type: "start" | "iteration" | "file_change" | "test_run" | "thinking" | "complete" | "error" | "commit"
  timestamp: Date
  message: string
  detail?: string
  iteration?: number
  progress?: number
  files?: string[]
  testResults?: {
    passed: number
    failed: number
    total: number
  }
}

interface ActivityStreamProps {
  events: ActivityEvent[]
  isRunning?: boolean
  className?: string
}

const eventIcons: Record<ActivityEvent["type"], React.ElementType> = {
  start: Play,
  iteration: RefreshCw,
  file_change: FileCode,
  test_run: TestTube,
  thinking: Brain,
  complete: CheckCircle,
  error: XCircle,
  commit: GitCommit
}

const eventColors: Record<ActivityEvent["type"], string> = {
  start: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  iteration: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  file_change: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  test_run: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  thinking: "text-pink-400 bg-pink-500/10 border-pink-500/30",
  complete: "text-green-400 bg-green-500/10 border-green-500/30",
  error: "text-red-400 bg-red-500/10 border-red-500/30",
  commit: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
}

/**
 * Activity Stream - A delightful window into Claudia's work
 *
 * Shows real-time progress without being overwhelming
 * Each event animates in smoothly
 */
export function ActivityStream({ events, isRunning, className }: ActivityStreamProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new events arrive
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events])

  if (events.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-muted-foreground", className)}>
        <Sparkles className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-sm">Activity will appear here when execution starts</p>
      </div>
    )
  }

  return (
    <ScrollArea
      ref={scrollRef}
      className={cn("h-full", className)}
    >
      <div className="space-y-3 p-4">
        {events.map((event, index) => (
          <ActivityEventCard
            key={event.id}
            event={event}
            isLatest={index === events.length - 1 && isRunning}
          />
        ))}

        {/* Thinking indicator when running */}
        {isRunning && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground animate-pulse">
            <div className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-2 w-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-2 w-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span>Claudia is working...</span>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

function ActivityEventCard({ event, isLatest }: { event: ActivityEvent; isLatest?: boolean }) {
  const Icon = eventIcons[event.type]
  const colorClass = eventColors[event.type]

  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border p-3 transition-all",
        colorClass,
        isLatest && "ring-2 ring-green-500/50",
        "animate-slide-in"
      )}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <Icon className={cn("h-4 w-4", event.type === "thinking" && "animate-pulse")} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{event.message}</span>
          {event.iteration && (
            <span className="text-xs opacity-70">
              Iteration {event.iteration}
            </span>
          )}
        </div>

        {event.detail && (
          <p className="text-xs opacity-70 mt-1 truncate">
            {event.detail}
          </p>
        )}

        {/* File list for file_change events */}
        {event.files && event.files.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {event.files.slice(0, 5).map((file) => (
              <span
                key={file}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-black/20 font-mono"
              >
                {file.split("/").pop()}
              </span>
            ))}
            {event.files.length > 5 && (
              <span className="text-xs opacity-70">
                +{event.files.length - 5} more
              </span>
            )}
          </div>
        )}

        {/* Test results */}
        {event.testResults && (
          <div className="mt-2 flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1 text-green-400">
              <CheckCircle className="h-3 w-3" />
              {event.testResults.passed} passed
            </span>
            {event.testResults.failed > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <XCircle className="h-3 w-3" />
                {event.testResults.failed} failed
              </span>
            )}
            <span className="opacity-70">
              {event.testResults.total} total
            </span>
          </div>
        )}

        {/* Timestamp */}
        <div className="flex items-center gap-1 mt-2 text-xs opacity-50">
          <Clock className="h-3 w-3" />
          {formatTime(event.timestamp)}
        </div>
      </div>

      {/* Progress indicator */}
      {event.progress !== undefined && (
        <div className="flex-shrink-0 flex items-center">
          <div className="w-12 h-12 relative">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="opacity-20"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray={`${event.progress * 1.26} 126`}
                className="text-green-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
              {event.progress}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  })
}

/**
 * Compact activity indicator for header/sidebar
 */
export function ActivityIndicator({
  isRunning,
  eventCount,
  latestMessage
}: {
  isRunning: boolean
  eventCount: number
  latestMessage?: string
}) {
  if (!isRunning && eventCount === 0) return null

  return (
    <div className="flex items-center gap-2 text-sm">
      {isRunning ? (
        <>
          <Zap className="h-4 w-4 text-green-500 animate-pulse" />
          <span className="text-green-500 font-medium">Building</span>
          {latestMessage && (
            <span className="text-muted-foreground truncate max-w-[200px]">
              {latestMessage}
            </span>
          )}
        </>
      ) : (
        <>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{eventCount} events</span>
        </>
      )}
    </div>
  )
}
