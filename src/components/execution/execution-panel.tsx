"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GoButton, HeroGoButton } from "./go-button"
import { ActivityStream, ActivityEvent, ActivityIndicator } from "./activity-stream"
import { AlertCircle, Settings2, Sparkles, RefreshCw, Cpu, Zap, Wifi, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"

type ExecutionMode = "local" | "turbo" | "auto"

interface WorkPacket {
  id: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  tasks: Array<{ id: string; description: string; completed: boolean }>
  acceptanceCriteria: string[]
}

interface Project {
  id: string
  name: string
  description: string
  repos: Array<{
    provider: string
    id: number
    name: string
    path: string
    url: string
  }>
}

interface ExecutionPanelProps {
  project: Project
  packets: WorkPacket[]
  className?: string
}

type ExecutionStatus = "idle" | "ready" | "running" | "complete" | "error"

/**
 * Execution Panel - The command center for project execution
 *
 * Features:
 * - Hero GO button for one-click execution
 * - Real-time activity stream
 * - Progress tracking
 * - Error handling with recovery options
 */
export function ExecutionPanel({ project, packets, className }: ExecutionPanelProps) {
  const [status, setStatus] = React.useState<ExecutionStatus>("ready")
  const [progress, setProgress] = React.useState(0)
  const [events, setEvents] = React.useState<ActivityEvent[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [refinementCount, setRefinementCount] = React.useState(0)
  const [isRefining, setIsRefining] = React.useState(false)
  const [executionMode, setExecutionMode] = React.useState<ExecutionMode>("auto")
  const [lastUsedMode, setLastUsedMode] = React.useState<string | null>(null)

  // Filter to executable packets - include "queued" for Linear-imported issues
  const readyPackets = packets.filter(p =>
    p.status === "ready" || p.status === "pending" || p.status === "queued"
  )

  const addEvent = (
    type: ActivityEvent["type"],
    message: string,
    detail?: string,
    extra?: Partial<ActivityEvent>
  ) => {
    setEvents(prev => [...prev, {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      timestamp: new Date(),
      message,
      detail,
      ...extra
    }])
  }

  const handleGo = async () => {
    if (readyPackets.length === 0) return

    setStatus("running")
    setProgress(0)
    setError(null)
    setEvents([])

    addEvent("start", "Execution started", `Processing ${readyPackets.length} packets`)

    try {
      // Process packets sequentially
      for (let i = 0; i < readyPackets.length; i++) {
        const packet = readyPackets[i]
        const packetProgress = Math.round((i / readyPackets.length) * 100)

        addEvent("iteration", `Starting: ${packet.title}`, packet.description, {
          iteration: i + 1,
          progress: packetProgress
        })

        setProgress(packetProgress)

        // Call the Claudia execution API
        const response = await fetch("/api/claude-execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            projectName: project.name,
            repoPath: project.repos[0]?.localPath || project.repos[0]?.path || `/tmp/projects/${project.id}`,
            packet: {
              id: packet.id,
              title: packet.title,
              description: packet.description,
              type: packet.type,
              priority: packet.priority,
              tasks: packet.tasks,
              acceptanceCriteria: packet.acceptanceCriteria
            },
            options: {
              maxIterations: 5,
              runTests: true,
              createCommit: true,
              mode: executionMode // "local" = LM Studio (free), "turbo" = Claude Code (paid)
            }
          })
        })

        const result = await response.json()

        // Track which mode was actually used
        if (result.mode) {
          setLastUsedMode(result.mode)
        }

        if (!result.success) {
          addEvent("error", `Failed: ${packet.title}`, result.error)
          continue
        }

        // Add events from the execution
        if (result.events) {
          result.events.forEach((evt: { type: ActivityEvent["type"]; message: string; detail?: string }) => {
            addEvent(evt.type, evt.message, evt.detail)
          })
        }

        if (result.filesChanged?.length > 0) {
          addEvent("file_change", `Modified ${result.filesChanged.length} files`, undefined, {
            files: result.filesChanged
          })
        }

        addEvent("complete", `Completed: ${packet.title}`, `Duration: ${Math.round(result.duration / 1000)}s`)
      }

      setProgress(100)
      setStatus("complete")
      addEvent("complete", "All packets completed!", `${readyPackets.length} packets executed successfully`, {
        progress: 100
      })

    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
      setStatus("error")
      addEvent("error", "Execution failed", message)
    }
  }

  const handleRetry = () => {
    setStatus("ready")
    setError(null)
  }

  // Refine & Iterate - NICU for newborn apps
  const handleRefine = async () => {
    if (!project.repos?.length) return

    setIsRefining(true)
    const iteration = refinementCount + 1
    setRefinementCount(iteration)

    addEvent("iteration", `Refinement Pass #${iteration}`, "Analyzing and improving code quality...")

    try {
      const response = await fetch("/api/claude-execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          projectName: project.name,
          repoPath: project.repos[0]?.localPath || project.repos[0]?.path || `/tmp/projects/${project.id}`,
          packet: {
            id: `refine-${iteration}`,
            title: `Refinement Pass #${iteration}`,
            description: `Review the entire codebase and improve quality. This is refinement iteration ${iteration}.`,
            type: "refactor",
            priority: "high",
            tasks: [
              { id: "r1", description: "Run tests and fix any failures", completed: false },
              { id: "r2", description: "Improve error handling and edge cases", completed: false },
              { id: "r3", description: "Enhance accessibility (ARIA, keyboard nav)", completed: false },
              { id: "r4", description: "Optimize performance bottlenecks", completed: false },
              { id: "r5", description: "Polish UI/UX details", completed: false },
              { id: "r6", description: "Update documentation if needed", completed: false }
            ],
            acceptanceCriteria: [
              "All tests pass",
              "No console errors or warnings",
              "Code is cleaner than before",
              "User experience is smoother"
            ]
          },
          options: {
            maxIterations: 20,
            runTests: true,
            createCommit: true,
            mode: executionMode // Use the selected execution mode for refinement too
          }
        })
      })

      const result = await response.json()

      // Track which mode was used
      if (result.mode) {
        setLastUsedMode(result.mode)
      }

      if (result.success) {
        const modeLabel = result.mode === "local" ? "Local" : "Turbo"
        addEvent("complete", `Refinement #${iteration} complete`,
          `${result.filesChanged?.length || 0} files improved (${modeLabel} mode)`)
      } else {
        addEvent("error", `Refinement #${iteration} had issues`, result.error)
      }
    } catch (err) {
      addEvent("error", "Refinement failed", err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsRefining(false)
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Hero Section with GO Button */}
      <Card className="border-green-500/20 bg-gradient-to-br from-gray-900 to-gray-900/50">
        <CardContent className="pt-6">
          <HeroGoButton
            projectName={project.name}
            packetCount={readyPackets.length}
            onGo={handleGo}
            disabled={readyPackets.length === 0 || !project.repos?.length}
            loading={status === "running"}
            status={status === "error" ? "idle" : status}
            progress={progress}
          />

          {/* Execution Mode Selector */}
          <div className="mt-4 p-4 rounded-xl bg-gray-800/50 border border-gray-700/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-300">Execution Mode</span>
              {lastUsedMode && (
                <span className="text-xs text-gray-500">
                  Last: {lastUsedMode === "local" ? "Local" : "Turbo"}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {/* Auto Mode */}
              <button
                onClick={() => setExecutionMode("auto")}
                className={cn(
                  "p-3 rounded-lg border transition-all text-left",
                  executionMode === "auto"
                    ? "border-blue-500/50 bg-blue-500/10 text-blue-300"
                    : "border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-300"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Wifi className="h-4 w-4" />
                  <span className="font-medium text-sm">Auto</span>
                </div>
                <p className="text-xs opacity-70">Best available</p>
              </button>

              {/* Local Mode (LM Studio - FREE) */}
              <button
                onClick={() => setExecutionMode("local")}
                className={cn(
                  "p-3 rounded-lg border transition-all text-left",
                  executionMode === "local"
                    ? "border-green-500/50 bg-green-500/10 text-green-300"
                    : "border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-300"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <WifiOff className="h-4 w-4" />
                  <span className="font-medium text-sm">Local</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">FREE</span>
                </div>
                <p className="text-xs opacity-70">Works offline</p>
              </button>

              {/* Turbo Mode (Claude Code - PAID) */}
              <button
                onClick={() => setExecutionMode("turbo")}
                className={cn(
                  "p-3 rounded-lg border transition-all text-left",
                  executionMode === "turbo"
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                    : "border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-300"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4" />
                  <span className="font-medium text-sm">Turbo</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">PRO</span>
                </div>
                <p className="text-xs opacity-70">Cloud-powered</p>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {executionMode === "auto" && "Uses Local when available, falls back to Turbo"}
              {executionMode === "local" && "LM Studio - No internet required, zero subscriptions"}
              {executionMode === "turbo" && "Claude Code - Higher quality, requires API subscription"}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-400 font-medium">Execution Error</p>
                <p className="text-xs text-red-400/70 mt-1">{error}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleRetry}>
                Retry
              </Button>
            </div>
          )}

          {/* No repo warning */}
          {!project.repos?.length && (
            <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-yellow-400 font-medium">No Repository Linked</p>
                <p className="text-xs text-yellow-400/70 mt-1">
                  Link a GitLab or GitHub repository to enable execution
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <a href={`/projects/${project.id}/settings`}>
                  <Settings2 className="h-4 w-4 mr-1" />
                  Settings
                </a>
              </Button>
            </div>
          )}

          {/* Refine & Iterate - NICU for newborn apps */}
          {status === "complete" && project.repos?.length > 0 && (
            <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <Sparkles className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium text-purple-300">Refine & Iterate</p>
                    <p className="text-xs text-purple-400/70">
                      {refinementCount === 0
                        ? "Polish the code - click as many times as needed"
                        : `${refinementCount} refinement${refinementCount > 1 ? "s" : ""} completed`}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleRefine}
                  disabled={isRefining}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white"
                >
                  {isRefining ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Refining...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Refine #{refinementCount + 1}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Stream */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Activity</CardTitle>
            <ActivityIndicator
              isRunning={status === "running"}
              eventCount={events.length}
              latestMessage={events[events.length - 1]?.message}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] -mx-2">
            <ActivityStream
              events={events}
              isRunning={status === "running"}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Compact execution widget for dashboard/sidebar
 */
export function ExecutionWidget({
  projectId,
  projectName,
  status,
  progress,
  latestEvent
}: {
  projectId: string
  projectName: string
  status: ExecutionStatus
  progress: number
  latestEvent?: string
}) {
  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-sm">{projectName}</span>
        <GoButton
          onClick={() => window.location.href = `/projects/${projectId}`}
          status={status}
          progress={progress}
          size="default"
        />
      </div>
      {latestEvent && (
        <p className="text-xs text-muted-foreground truncate">{latestEvent}</p>
      )}
    </div>
  )
}
