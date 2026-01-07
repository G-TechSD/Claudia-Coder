"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  GripVertical
} from "lucide-react"
import Link from "next/link"

// Types matching agent-controller
type AgentState = "idle" | "running" | "paused" | "completed" | "failed"
type GenerationPhase = "scaffold" | "shared" | "features" | "integration" | "polish"

interface QueuedProject {
  projectId: string
  project: {
    id: string
    name: string
    description: string
  }
  priority: number
  estimatedPackets: number
}

interface ExecutionProgress {
  currentPacketIndex: number
  totalPackets: number
  currentPacketTitle: string
  currentPhase: GenerationPhase
  iteration: number
  maxIterations: number
  confidence: number
  filesGenerated: number
}

interface AgentStatus {
  state: AgentState
  activeProject: QueuedProject | null
  progress: ExecutionProgress | null
  queue: QueuedProject[]
}

const stateConfig: Record<AgentState, { label: string; color: string; icon: React.ElementType }> = {
  idle: { label: "Idle", color: "text-muted-foreground", icon: Clock },
  running: { label: "Running", color: "text-green-500", icon: Play },
  paused: { label: "Paused", color: "text-yellow-500", icon: Pause },
  completed: { label: "Completed", color: "text-blue-500", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-red-500", icon: AlertCircle }
}

const phaseLabels: Record<GenerationPhase, string> = {
  scaffold: "Setup",
  shared: "Components",
  features: "Features",
  integration: "Integration",
  polish: "Polish"
}

export function AgentControl() {
  const [status, setStatus] = useState<AgentStatus>({
    state: "idle",
    activeProject: null,
    progress: null,
    queue: []
  })
  const [isLoading, setIsLoading] = useState(false)

  // Load status from localStorage on mount
  useEffect(() => {
    loadStatus()
    // Poll for updates when running
    const interval = setInterval(() => {
      if (status.state === "running") {
        loadStatus()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [status.state])

  const loadStatus = () => {
    try {
      const stateData = localStorage.getItem("claudia_agent_state")
      const queueData = localStorage.getItem("claudia_execution_queue")

      if (stateData) {
        const { state } = JSON.parse(stateData)
        setStatus(prev => ({ ...prev, state }))
      }

      if (queueData) {
        const queue = JSON.parse(queueData)
        setStatus(prev => ({
          ...prev,
          queue,
          activeProject: queue[0] || null
        }))
      }
    } catch (error) {
      console.error("Failed to load agent status:", error)
    }
  }

  const handleStart = async () => {
    if (status.queue.length === 0) {
      alert("No projects in queue. Add a project first.")
      return
    }

    setIsLoading(true)
    try {
      // Update state
      localStorage.setItem("claudia_agent_state", JSON.stringify({ state: "running" }))
      setStatus(prev => ({ ...prev, state: "running" }))

      // In a real implementation, this would trigger the agent controller
      // For now, we just update the state
    } catch (error) {
      console.error("Failed to start:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStop = () => {
    localStorage.setItem("claudia_agent_state", JSON.stringify({ state: "paused" }))
    setStatus(prev => ({ ...prev, state: "paused" }))
  }

  const handleResume = async () => {
    await handleStart()
  }

  const StateIcon = stateConfig[status.state].icon

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Agent Control</CardTitle>
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full",
              status.state === "running" ? "bg-green-500 animate-pulse" :
              status.state === "paused" ? "bg-yellow-500" :
              "bg-muted-foreground"
            )} />
            <span className={cn("text-sm font-medium", stateConfig[status.state].color)}>
              {stateConfig[status.state].label}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Control Buttons */}
        <div className="flex gap-2">
          {status.state === "idle" || status.state === "completed" || status.state === "failed" ? (
            <Button
              className="flex-1 gap-2"
              onClick={handleStart}
              disabled={isLoading || status.queue.length === 0}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Start
            </Button>
          ) : status.state === "running" ? (
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleStop}
            >
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          ) : (
            <Button
              className="flex-1 gap-2"
              onClick={handleResume}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Resume
            </Button>
          )}

          {(status.state === "running" || status.state === "paused") && (
            <Button
              variant="destructive"
              size="icon"
              onClick={() => {
                if (confirm("Stop all execution?")) {
                  localStorage.setItem("claudia_agent_state", JSON.stringify({ state: "idle" }))
                  setStatus(prev => ({ ...prev, state: "idle" }))
                }
              }}
            >
              <Square className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Active Project */}
        {status.activeProject && (
          <div className="p-3 rounded-lg border bg-accent/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase">Active Project</span>
              {status.state === "running" && (
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              )}
            </div>
            <Link
              href={`/projects/${status.activeProject.projectId}`}
              className="font-medium hover:text-primary transition-colors flex items-center gap-1"
            >
              {status.activeProject.project.name}
              <ChevronRight className="h-4 w-4" />
            </Link>

            {status.progress && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Packet {status.progress.currentPacketIndex}/{status.progress.totalPackets}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {phaseLabels[status.progress.currentPhase]}
                  </Badge>
                </div>
                <p className="text-sm truncate">{status.progress.currentPacketTitle}</p>
                <Progress
                  value={(status.progress.currentPacketIndex / status.progress.totalPackets) * 100}
                  className="h-1.5"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Iteration {status.progress.iteration}/{status.progress.maxIterations}</span>
                  <span>{status.progress.filesGenerated} files</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Queue */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Queue</span>
            <span className="text-xs text-muted-foreground">
              {status.queue.length} project{status.queue.length !== 1 ? "s" : ""}
            </span>
          </div>

          {status.queue.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No projects queued</p>
              <Link href="/projects" className="text-primary hover:underline text-xs">
                Add a project →
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {status.queue.slice(0, 5).map((item, index) => (
                <div
                  key={item.projectId}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded text-sm",
                    index === 0 && status.state === "running"
                      ? "bg-primary/10 border border-primary/30"
                      : "bg-muted/50"
                  )}
                >
                  <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                  <span className="flex-1 truncate">{item.project.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {item.estimatedPackets} pkt
                  </Badge>
                </div>
              ))}
              {status.queue.length > 5 && (
                <p className="text-xs text-muted-foreground text-center py-1">
                  +{status.queue.length - 5} more
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
