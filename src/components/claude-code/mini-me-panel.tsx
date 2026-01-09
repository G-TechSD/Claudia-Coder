"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MiniMe, MiniMeAgent, MiniMeStatus, MiniMeSkeleton, useMiniMeSounds } from "./mini-me"
import {
  ChevronDown,
  ChevronUp,
  Users,
  CheckCircle2,
  Loader2,
  XCircle,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Bot,
  Zap
} from "lucide-react"

interface MiniMePanelProps {
  agents: MiniMeAgent[]
  className?: string
  defaultExpanded?: boolean
  isLoading?: boolean
  title?: string
}

interface StatsItem {
  status: MiniMeStatus
  count: number
  label: string
  icon: React.ElementType
  color: string
}

export function MiniMePanel({
  agents,
  className,
  defaultExpanded = true,
  isLoading = false,
  title = "Mini-Me Agents"
}: MiniMePanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const { soundEnabled, toggleSound } = useMiniMeSounds()

  // Calculate stats
  const stats = useMemo(() => {
    const counts: Record<MiniMeStatus, number> = {
      pending: 0,
      spawning: 0,
      running: 0,
      completed: 0,
      failed: 0
    }

    agents.forEach(agent => {
      counts[agent.status]++
    })

    return counts
  }, [agents])

  const activeCount = stats.running + stats.spawning
  const totalCount = agents.length

  // Stats items for the summary bar
  const statsItems: StatsItem[] = [
    { status: "running", count: stats.running, label: "Running", icon: Loader2, color: "text-blue-400" },
    { status: "spawning", count: stats.spawning, label: "Spawning", icon: Sparkles, color: "text-blue-300" },
    { status: "completed", count: stats.completed, label: "Completed", icon: CheckCircle2, color: "text-green-400" },
    { status: "failed", count: stats.failed, label: "Failed", icon: XCircle, color: "text-red-400" },
    { status: "pending", count: stats.pending, label: "Pending", icon: Clock, color: "text-gray-400" }
  ]

  // Generate header text
  const getHeaderText = () => {
    if (activeCount === 0 && totalCount === 0) {
      return "No Mini-Me Agents"
    }
    if (activeCount === 0) {
      return `${totalCount} Mini-Me Agent${totalCount !== 1 ? "s" : ""}`
    }
    return `${activeCount} Mini-Me${activeCount !== 1 ? "s" : ""} working...`
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-[#30363d] bg-[#161b22] overflow-hidden mini-me-panel",
        activeCount > 0 && "mini-me-panel-active",
        className
      )}
    >
      {/* Header - Collapsible Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-[#1c2128] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
              activeCount > 0
                ? "bg-blue-500/20 text-blue-400"
                : totalCount > 0
                ? "bg-green-500/10 text-green-400"
                : "bg-gray-500/10 text-gray-400"
            )}>
              <Zap className="h-4 w-4" />
            </div>
            {activeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-blue-400 animate-pulse ring-2 ring-[#161b22]" />
            )}
          </div>
          <div>
            <span className="text-sm font-medium text-gray-200">
              {getHeaderText()}
            </span>
            {totalCount > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <Bot className="h-3 w-3" />
                <span>Parallel task execution</span>
              </div>
            )}
          </div>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        </div>

        <div className="flex items-center gap-2">
          {/* Sound toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              toggleSound()
            }}
            className={cn(
              "h-7 w-7",
              soundEnabled ? "text-blue-400" : "text-gray-500"
            )}
            title={soundEnabled ? "Disable sounds" : "Enable sounds"}
          >
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
          </Button>

          {/* Quick stats badges */}
          {stats.running > 0 && (
            <Badge
              variant="outline"
              className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30 animate-pulse"
            >
              {stats.running} running
            </Badge>
          )}
          {stats.completed > 0 && (
            <Badge
              variant="outline"
              className="text-xs bg-green-500/10 text-green-400 border-green-500/30"
            >
              {stats.completed} done
            </Badge>
          )}
          {stats.failed > 0 && (
            <Badge
              variant="outline"
              className="text-xs bg-red-500/10 text-red-400 border-red-500/30"
            >
              {stats.failed} failed
            </Badge>
          )}

          {/* Expand/Collapse icon */}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="h-1 bg-[#0d1117]">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-blue-400 to-green-500 transition-all duration-700 ease-out"
            style={{
              width: `${((stats.completed + stats.failed) / totalCount) * 100}%`,
            }}
          />
        </div>
      )}

      {/* Expanded Content */}
      <div
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        {/* Stats Summary Bar */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-[#30363d] bg-[#0d1117]/50">
          {statsItems.map(({ status, count, label, icon: Icon, color }) => (
            count > 0 && (
              <div key={status} className="flex items-center gap-1.5">
                <Icon className={cn(
                  "h-3.5 w-3.5",
                  color,
                  status === "running" && "animate-spin"
                )} />
                <span className={cn("text-xs font-medium", color)}>
                  {count}
                </span>
                <span className="text-xs text-gray-500">{label}</span>
              </div>
            )
          ))}
          {totalCount === 0 && !isLoading && (
            <span className="text-xs text-gray-500">No sub-agents spawned yet</span>
          )}
        </div>

        {/* Grid of Mini-Me cards */}
        <div className="p-4 border-t border-[#30363d]">
          {isLoading && agents.length === 0 ? (
            // Loading skeletons
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <MiniMeSkeleton />
              <MiniMeSkeleton />
              <MiniMeSkeleton />
            </div>
          ) : agents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Sort agents: running/spawning first, then pending, completed, failed */}
              {[...agents]
                .sort((a, b) => {
                  const order: Record<MiniMeStatus, number> = {
                    spawning: 0,
                    running: 1,
                    pending: 2,
                    completed: 3,
                    failed: 4
                  }
                  return order[a.status] - order[b.status]
                })
                .map((agent, idx) => (
                  <MiniMe
                    key={agent.id}
                    agent={agent}
                    index={agent.index ?? idx}
                    soundEnabled={soundEnabled}
                  />
                ))}
            </div>
          ) : (
            // Empty state
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-gray-600" />
              </div>
              <h3 className="text-sm font-medium text-gray-400 mb-1">
                No Sub-Agents Yet
              </h3>
              <p className="text-xs text-gray-500 max-w-sm">
                When Claude Code spawns sub-agents to work on parallel tasks,
                they&apos;ll appear here as Mini-Me&apos;s
              </p>
            </div>
          )}
        </div>

        {/* Footer with actions */}
        {agents.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-[#30363d] bg-[#0d1117]/50">
            <span className="text-xs text-gray-500">
              Total: {totalCount} sub-agent{totalCount !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              {stats.completed > 0 && (
                <span className="text-xs text-green-400">
                  {Math.round((stats.completed / totalCount) * 100)}% complete
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Demo component for testing
export function MiniMePanelDemo() {
  const demoAgents: MiniMeAgent[] = [
    {
      id: "agent-abc12345",
      status: "running",
      task: "Implementing user authentication with OAuth2 and JWT tokens",
      startedAt: new Date(Date.now() - 120000) // 2 minutes ago
    },
    {
      id: "agent-def67890",
      status: "running",
      task: "Creating database migrations for user profiles",
      startedAt: new Date(Date.now() - 45000) // 45 seconds ago
    },
    {
      id: "agent-ghi11111",
      status: "completed",
      task: "Setting up project structure and dependencies",
      startedAt: new Date(Date.now() - 300000),
      completedAt: new Date(Date.now() - 180000)
    },
    {
      id: "agent-jkl22222",
      status: "spawning",
      task: "Preparing API endpoint handlers",
      startedAt: new Date()
    },
    {
      id: "agent-mno33333",
      status: "failed",
      task: "Connecting to external payment service",
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(Date.now() - 30000),
      error: "Connection timeout: Could not reach payment gateway"
    },
    {
      id: "agent-pqr44444",
      status: "pending",
      task: "Writing unit tests for authentication module"
    }
  ]

  return <MiniMePanel agents={demoAgents} />
}
