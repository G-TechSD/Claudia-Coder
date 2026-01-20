"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GoButton, HeroGoButton } from "./go-button"
import { ActivityStream, ActivityEvent, ActivityIndicator } from "./activity-stream"
import { AlertCircle, AlertTriangle, Settings2, Sparkles, RefreshCw, Zap, Wifi, WifiOff, GitBranch, RotateCcw, CheckCircle2, Loader2, FlaskConical, Pause, Cpu, Cloud, Terminal, Trash2, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth/auth-provider"
import { BetaUsageBanner } from "@/components/beta/usage-banner"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useAvailableModels, AvailableModel } from "@/hooks/useAvailableModels"

type ExecutionMode = "local" | "turbo" | "auto" | "n8n"

type N8NStage = "generating" | "validating" | "iterating" | "complete" | "idle"

interface N8NStatus {
  stage: N8NStage
  iteration: number
  maxIterations: number
  qualityScore: number | null
  validatorFeedback: string | null
}

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
  workingDirectory?: string
  basePath?: string
  id: string
  name: string
  description: string
  repos: Array<{
    provider: string
    id: number
    name: string
    path: string
    url: string
    localPath?: string
  }>
  // Model Selection - project-specific default model
  defaultModelId?: string
  defaultProviderId?: string
}

// Helper to check if a project has a valid working directory for execution
function hasValidWorkingDir(project: Project): boolean {
  return !!(project.workingDirectory || project.basePath || project.repos?.some(r => r.localPath))
}

/**
 * Restored session data from server for resuming execution state
 */
export interface RestoredSession {
  id: string
  status: "running" | "complete" | "error" | "cancelled"
  progress: number
  events: Array<{
    id: string
    type: "start" | "iteration" | "file_change" | "test" | "complete" | "error" | "info" | "success" | "warning" | "progress"
    message: string
    timestamp: string
    detail?: string
  }>
  currentPacketIndex: number
}

interface ExecutionPanelProps {
  project: Project
  packets: WorkPacket[]
  className?: string
  /** Optional restored session from server to resume execution state */
  restoredSession?: RestoredSession | null
  /** Callback when execution session ID changes (for external tracking/polling) */
  onSessionChange?: (sessionId: string | null) => void
  /** Callback to reset all packets back to queued status */
  onResetPackets?: () => void
}

// Imperative handle exposed via ref
export interface ExecutionPanelRef {
  triggerExecution: () => void
}

type ExecutionStatus = "idle" | "ready" | "running" | "complete" | "error" | "stopped" | "partial" | "failed"

// Packet execution results for tracking
interface PacketCounts {
  successCount: number      // Passed quality gates
  failedCount: number       // Failed quality gates
  cancelledCount: number    // Stopped by user
  remainingCount: number    // Not yet processed
  totalCount: number        // Total packets
  unverifiedCount: number   // Skipped quality gates
}

/**
 * Execution Panel - The command center for project execution
 *
 * Features:
 * - Hero GO button for one-click execution
 * - Real-time activity stream
 * - Progress tracking
 * - Error handling with recovery options
 */
export const ExecutionPanel = React.forwardRef<ExecutionPanelRef, ExecutionPanelProps>(
  function ExecutionPanel({ project, packets, className, restoredSession, onSessionChange, onResetPackets }, ref) {
  const { user, isBetaTester, betaLimits, refreshBetaLimits } = useAuth()

  // Determine initial status based on packet states
  const getInitialStatus = (): ExecutionStatus => {
    if (packets.length === 0) return "ready"
    const completedCount = packets.filter(p => p.status === "completed").length
    const failedCount = packets.filter(p => p.status === "failed").length
    // If all packets are completed, show complete status
    if (completedCount === packets.length) return "complete"
    // If some failed, show partial/error
    if (failedCount > 0 && completedCount + failedCount === packets.length) return "partial"
    return "ready"
  }

  const [status, setStatus] = React.useState<ExecutionStatus>(getInitialStatus)
  const [progress, setProgress] = React.useState(0)
  const [events, setEvents] = React.useState<ActivityEvent[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [refinementCount, setRefinementCount] = React.useState(0)
  const [isRefining, setIsRefining] = React.useState(false)
  // Default execution mode: "turbo" (Claude Code) for best experience
  // Users can override in project settings or via the dropdown
  const [executionMode, setExecutionMode] = React.useState<ExecutionMode>(() => {
    // Check project-level default first
    if (project.defaultProviderId) {
      if (project.defaultProviderId === "anthropic" || project.defaultProviderId === "claude-code") {
        return "turbo"
      }
      if (project.defaultProviderId === "n8n") {
        return "n8n"
      }
      if (project.defaultProviderId === "lmstudio" || project.defaultProviderId === "ollama" || project.defaultProviderId === "custom") {
        return "local"
      }
    }
    // Default to "turbo" mode (Claude Code) for best development experience
    return "turbo"
  })
  const [lastUsedMode, setLastUsedMode] = React.useState<string | null>(null)
  const [betaLimitReached, setBetaLimitReached] = React.useState(false)
  const [n8nStatus, setN8NStatus] = React.useState<N8NStatus>({
    stage: "idle",
    iteration: 0,
    maxIterations: 5,
    qualityScore: null,
    validatorFeedback: null
  })
  // Current session ID for tracking (used for polling and session management)
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(null)
  // Pause state - when true, execution stops after current packet completes
  const [isPaused, setIsPaused] = React.useState(false)
  // Ref to track pause state in async loops (state may be stale in closures)
  const isPausedRef = React.useRef(false)
  // AbortController for immediate pause/stop functionality
  const abortControllerRef = React.useRef<AbortController | null>(null)
  // Track if current execution was stopped (for marking packet as cancelled vs failed)
  const wasStoppedRef = React.useRef(false)
  // Track packet execution results
  const [packetCounts, setPacketCounts] = React.useState<PacketCounts>({
    successCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    remainingCount: 0,
    totalCount: 0,
    unverifiedCount: 0
  })
  // Skip quality gates option (not recommended)
  const [skipQualityGates, setSkipQualityGates] = React.useState(false)

  // Available models hook for provider/model selection
  const { models: availableModels, loading: modelsLoading } = useAvailableModels()

  // Selected provider and model for execution
  const [selectedProviderId, setSelectedProviderId] = React.useState<string>(() => {
    // Initialize from project defaults or fall back to Claude Code
    if (project.defaultProviderId) {
      return project.defaultProviderId
    }
    // Map execution mode to provider ID, default to Claude Code
    if (executionMode === "turbo") return "claude-code"
    if (executionMode === "n8n") return "n8n"
    if (executionMode === "local") return "lmstudio"
    return "claude-code" // Default to Claude Code
  })
  const [selectedModelId, setSelectedModelId] = React.useState<string>(() => {
    return project.defaultModelId || ""
  })

  // Group models by provider for the dropdown
  const groupedModels = React.useMemo(() => {
    const groups: { [key: string]: { displayName: string; type: "local" | "cloud" | "cli"; models: AvailableModel[] } } = {}

    availableModels.forEach(model => {
      if (!groups[model.provider]) {
        let displayName = model.provider
        // Create human-readable provider names
        if (model.provider === "claude-code") displayName = "Claude Code"
        else if (model.provider === "anthropic") displayName = "Anthropic"
        else if (model.provider === "openai") displayName = "OpenAI"
        else if (model.provider === "google") displayName = "Google"
        else if (model.provider === "lmstudio" || model.provider === "local-llm-server") displayName = "LM Studio"
        else if (model.provider === "ollama") displayName = "Ollama"

        groups[model.provider] = {
          displayName,
          type: model.type,
          models: []
        }
      }
      groups[model.provider].models.push(model)
    })

    return groups
  }, [availableModels])

  // Handle provider/model selection change
  const handleProviderModelChange = React.useCallback((value: string) => {
    // Value format: "provider:modelId" or just "provider" for provider-only selection
    const [provider, modelId] = value.split(":")

    setSelectedProviderId(provider)
    setSelectedModelId(modelId || "")

    // Update execution mode based on provider type
    if (provider === "claude-code" || provider === "anthropic") {
      setExecutionMode("turbo")
    } else if (provider === "n8n") {
      setExecutionMode("n8n")
    } else {
      setExecutionMode("local")
    }
  }, [])

  // Ref to store the latest handleGo function for use in useImperativeHandle
  // This avoids dependency issues with useCallback
  const handleGoRef = React.useRef<() => void>(() => {})

  // Restore execution state from a restored session on mount or when restoredSession changes
  React.useEffect(() => {
    if (restoredSession) {
      // Map server status to local ExecutionStatus type
      const statusMap: Record<string, ExecutionStatus> = {
        running: "running",
        complete: "complete",
        error: "error",
        cancelled: "error" // Treat cancelled as error for display purposes
      }

      const mappedStatus = statusMap[restoredSession.status] || "ready"
      setStatus(mappedStatus)
      setProgress(restoredSession.progress)
      setCurrentSessionId(restoredSession.id)

      // Convert server events to ActivityEvent format
      const restoredEvents: ActivityEvent[] = restoredSession.events.map(evt => ({
        id: evt.id,
        type: evt.type as ActivityEvent["type"],
        message: evt.message,
        timestamp: new Date(evt.timestamp),
        detail: evt.detail
      }))
      setEvents(restoredEvents)

      // Notify parent of session restoration
      onSessionChange?.(restoredSession.id)

      console.log(`[ExecutionPanel] Restored session ${restoredSession.id} with status: ${restoredSession.status}, progress: ${restoredSession.progress}%`)
    }
  }, [restoredSession, onSessionChange])

  // Update status when packets change (but not while running)
  React.useEffect(() => {
    if (status === "running") return // Don't change status while executing

    const completedCount = packets.filter(p => p.status === "completed").length
    const failedCount = packets.filter(p => p.status === "failed").length

    if (packets.length > 0 && completedCount === packets.length) {
      setStatus("complete")
    } else if (packets.length > 0 && failedCount > 0 && completedCount + failedCount === packets.length) {
      setStatus("partial")
    } else if (status === "complete" || status === "partial") {
      // Reset to ready if packets were reset
      setStatus("ready")
    }
  }, [packets, status])

  // Persist events to localStorage whenever they change
  React.useEffect(() => {
    if (events.length > 0) {
      const persistedEvents = events.map(event => ({
        id: event.id,
        type: event.type,
        message: event.message,
        timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp,
        projectId: project.id
      }))
      localStorage.setItem("claudia_activity_events", JSON.stringify(persistedEvents))
    }
  }, [events, project.id])

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

  // Helper function to update session on the server
  const updateSession = async (
    sessionIdToUpdate: string,
    updates: {
      progress?: number
      currentPacketIndex?: number
      status?: "running" | "complete" | "error" | "cancelled"
      output?: string
      error?: string
    },
    event?: {
      type: "info" | "success" | "error" | "warning" | "progress"
      message: string
      detail?: string
    }
  ) => {
    try {
      await fetch("/api/execution-sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdToUpdate, updates, event })
      })
    } catch (err) {
      console.error("[ExecutionPanel] Failed to update session:", err)
    }
  }

  // Helper function to complete session on the server
  const completeSession = async (
    sessionIdToComplete: string,
    action: "complete" | "cancel" = "complete",
    errorMessage?: string
  ) => {
    try {
      const params = new URLSearchParams({ sessionId: sessionIdToComplete, action })
      if (errorMessage) {
        params.set("error", errorMessage)
      }
      await fetch(`/api/execution-sessions?${params.toString()}`, {
        method: "DELETE"
      })
      setCurrentSessionId(null)
      onSessionChange?.(null)
    } catch (err) {
      console.error("[ExecutionPanel] Failed to complete session:", err)
    }
  }

  const handleGo = async () => {
    if (readyPackets.length === 0) return

    // Check beta limits before starting
    if (isBetaTester && betaLimits && !betaLimits.canExecute) {
      setBetaLimitReached(true)
      setError(`Beta execution limit reached. You have used ${betaLimits.current.executions}/${betaLimits.limits.executions} executions today.`)
      return
    }

    setBetaLimitReached(false)
    setStatus("running")
    setProgress(0)
    setError(null)
    // DON'T clear events - persist activity audit trail across executions
    // Add a separator for new execution run
    if (events.length > 0) {
      setEvents(prev => [...prev, {
        id: `separator-${Date.now()}`,
        type: "start" as const,
        timestamp: new Date(),
        message: "--- New Processing Run ---",
        detail: `Starting processing of ${readyPackets.length} packets`
      }])
    }
    // Reset pause state when starting new execution
    setIsPaused(false)
    isPausedRef.current = false
    wasStoppedRef.current = false
    // Create new AbortController for this execution
    abortControllerRef.current = new AbortController()
    // Reset packet counts
    setPacketCounts({
      successCount: 0,
      failedCount: 0,
      cancelledCount: 0,
      remainingCount: readyPackets.length,
      totalCount: readyPackets.length,
      unverifiedCount: 0
    })

    // Reset N8N status if using N8N mode
    if (executionMode === "n8n") {
      setN8NStatus({
        stage: "generating",
        iteration: 1,
        maxIterations: 5,
        qualityScore: null,
        validatorFeedback: null
      })
    }

    // Determine provider and model for activity events - use selected values
    const getProviderInfo = () => {
      // Prefer user selection, then project defaults, then execution mode
      let provider = selectedProviderId || project.defaultProviderId || executionMode
      const model = selectedModelId || project.defaultModelId || undefined

      // Map execution mode to provider name if not explicitly set
      if (!selectedProviderId && !project.defaultProviderId) {
        if (executionMode === "turbo") {
          provider = "claude-code"
        } else if (executionMode === "local") {
          provider = "lmstudio"
        } else if (executionMode === "n8n") {
          provider = "n8n"
        }
      }

      return { provider, model }
    }

    const { provider: currentProvider, model: currentModel } = getProviderInfo()

    addEvent("start", "Processing started", `Processing ${readyPackets.length} packets`, {
      provider: currentProvider,
      model: currentModel
    })

    // Create execution session on the server
    let activeSessionId: string | null = null
    try {
      const sessionResponse = await fetch("/api/execution-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          packetIds: readyPackets.map(p => p.id),
          userId: user?.id || "anonymous",
          projectName: project.name,
          packetTitles: readyPackets.map(p => p.title),
          mode: executionMode
        })
      })
      const sessionData = await sessionResponse.json()
      if (sessionData.success && sessionData.session) {
        activeSessionId = sessionData.session.id
        setCurrentSessionId(activeSessionId)
        onSessionChange?.(activeSessionId)
        console.log(`[ExecutionPanel] Created session ${activeSessionId}`)
      }
    } catch (err) {
      console.error("[ExecutionPanel] Failed to create session:", err)
      // Continue execution even if session creation fails
    }

    try {
      // Track packet results to report correct status at the end
      const failedPackets: string[] = []
      const completedPackets: string[] = []
      const cancelledPackets: string[] = []
      const unverifiedPackets: string[] = []

      // Process packets sequentially
      for (let i = 0; i < readyPackets.length; i++) {
        const packet = readyPackets[i]
        const packetProgress = Math.round((i / readyPackets.length) * 100)

        addEvent("iteration", `Starting: ${packet.title}`, packet.description, {
          iteration: i + 1,
          progress: packetProgress,
          provider: currentProvider,
          model: currentModel
        })

        setProgress(packetProgress)

        // Update session progress on the server
        if (activeSessionId) {
          updateSession(
            activeSessionId,
            { progress: packetProgress, currentPacketIndex: i },
            { type: "progress", message: `Starting: ${packet.title}`, detail: packet.description }
          )
        }

        // Check if stopped before starting fetch
        if (wasStoppedRef.current) {
          addEvent("warning", `Cancelled: ${packet.title}`, "Processing was stopped by user")
          cancelledPackets.push(packet.title)
          // Update packet counts for remaining packets
          const remainingPacketCount = readyPackets.length - i
          setPacketCounts(prev => ({
            ...prev,
            cancelledCount: prev.cancelledCount + remainingPacketCount,
            remainingCount: 0
          }))
          break
        }

        // Call the Claudia execution API with abort signal for immediate cancellation
        let response: Response
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let result: any
        try {
          response = await fetch("/api/claude-execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abortControllerRef.current?.signal,
            body: JSON.stringify({
              projectId: project.id,
              projectName: project.name,
              repoPath: project.workingDirectory || project.repos[0]?.localPath || `~/claudia-projects/${project.name.toLowerCase().replace(/\s+/g, '-')}`,
              packet: {
                id: packet.id,
                title: packet.title,
                description: packet.description,
                type: packet.type,
                priority: packet.priority,
                tasks: packet.tasks,
                acceptanceCriteria: packet.acceptanceCriteria
              },
              // Pass selected model settings (user selection takes priority)
              projectModelId: selectedModelId || project.defaultModelId,
              projectProviderId: selectedProviderId || project.defaultProviderId,
              options: {
                maxIterations: 5,
                runTests: true,
                createCommit: true,
                mode: executionMode, // "local" = LM Studio (free), "turbo" = Claude Code (paid)
                selectedModel: selectedModelId || undefined,
                selectedProvider: selectedProviderId || undefined,
                skipQualityGates: skipQualityGates // Skip quality gates if checked (not recommended)
              }
            })
          })
          result = await response.json()
        } catch (fetchError) {
          // Check if this was an abort
          if (fetchError instanceof Error && fetchError.name === "AbortError") {
            addEvent("warning", `Cancelled: ${packet.title}`, "Processing was stopped by user")
            cancelledPackets.push(packet.title)
            // Update packet counts for remaining packets (including current one)
            const remainingPacketCount = readyPackets.length - i
            setPacketCounts(prev => ({
              ...prev,
              cancelledCount: prev.cancelledCount + remainingPacketCount,
              remainingCount: 0
            }))
            // Mark as cancelled, not failed
            if (activeSessionId) {
              await updateSession(
                activeSessionId,
                { status: "cancelled" },
                { type: "warning", message: `Cancelled: ${packet.title}`, detail: "Stopped by user" }
              )
            }
            break // Exit the packet loop
          }
          throw fetchError // Re-throw other errors
        }

        // Check for beta limit error
        if (result.code === "BETA_EXECUTION_LIMIT") {
          setBetaLimitReached(true)
          setError(result.error)
          setStatus("error")
          // Complete session with error
          if (activeSessionId) {
            await completeSession(activeSessionId, "complete", result.error)
          }
          // Refresh beta limits to get updated count
          if (refreshBetaLimits) {
            await refreshBetaLimits()
          }
          return
        }

        // Refresh beta limits after execution (to update count)
        if (isBetaTester && refreshBetaLimits) {
          refreshBetaLimits()
        }

        // Track which mode was actually used
        if (result.mode) {
          setLastUsedMode(result.mode)
        }

        // Update N8N status if present in result
        if (result.n8nStatus) {
          setN8NStatus(prev => ({
            ...prev,
            stage: result.n8nStatus.stage || prev.stage,
            iteration: result.n8nStatus.iteration || prev.iteration,
            maxIterations: result.n8nStatus.maxIterations || prev.maxIterations,
            qualityScore: result.n8nStatus.qualityScore ?? prev.qualityScore,
            validatorFeedback: result.n8nStatus.validatorFeedback || prev.validatorFeedback
          }))
        }

        if (!result.success) {
          failedPackets.push(packet.title)
          // Use mode from result if available, otherwise use current provider info
          const resultProvider = result.mode === "local" ? "lmstudio" : result.mode === "turbo" ? "claude-code" : result.mode || currentProvider
          addEvent("error", `Failed: ${packet.title}`, result.error, {
            provider: resultProvider,
            model: result.model || currentModel
          })
          // Update packet counts
          setPacketCounts(prev => ({
            ...prev,
            failedCount: prev.failedCount + 1,
            remainingCount: Math.max(0, prev.remainingCount - 1)
          }))
          // Update session with error event
          if (activeSessionId) {
            updateSession(
              activeSessionId,
              { status: "error" },
              { type: "error", message: `Failed: ${packet.title}`, detail: result.error }
            )
          }
          continue
        }

        // Add events from the execution
        if (result.events) {
          const resultProvider = result.mode === "local" ? "lmstudio" : result.mode === "turbo" ? "claude-code" : result.mode || currentProvider
          result.events.forEach((evt: { type: ActivityEvent["type"]; message: string; detail?: string; provider?: string; model?: string }) => {
            addEvent(evt.type, evt.message, evt.detail, {
              provider: evt.provider || resultProvider,
              model: evt.model || result.model || currentModel
            })
          })
        }

        if (result.filesChanged?.length > 0) {
          const resultProvider = result.mode === "local" ? "lmstudio" : result.mode === "turbo" ? "claude-code" : result.mode || currentProvider
          addEvent("file_change", `Modified ${result.filesChanged.length} files`, undefined, {
            files: result.filesChanged,
            provider: resultProvider,
            model: result.model || currentModel
          })
          // Update session with file change event
          if (activeSessionId) {
            updateSession(
              activeSessionId,
              {},
              { type: "info", message: `Modified ${result.filesChanged.length} files` }
            )
          }
        }

        completedPackets.push(packet.title)
        // Track if this was unverified (quality gates skipped)
        const isUnverified = result.unverified || skipQualityGates
        if (isUnverified) {
          unverifiedPackets.push(packet.title)
        }
        const completedProvider = result.mode === "local" ? "lmstudio" : result.mode === "turbo" ? "claude-code" : result.mode || currentProvider
        const completionMessage = isUnverified
          ? `Completed (UNVERIFIED): ${packet.title}`
          : `Completed: ${packet.title}`
        addEvent("complete", completionMessage, `Duration: ${Math.round(result.duration / 1000)}s`, {
          provider: completedProvider,
          model: result.model || currentModel
        })
        // Update packet counts
        setPacketCounts(prev => ({
          ...prev,
          successCount: isUnverified ? prev.successCount : prev.successCount + 1,
          unverifiedCount: isUnverified ? prev.unverifiedCount + 1 : prev.unverifiedCount,
          remainingCount: Math.max(0, prev.remainingCount - 1)
        }))
        // Update session with completion event for this packet
        if (activeSessionId) {
          updateSession(
            activeSessionId,
            {},
            { type: "success", message: completionMessage, detail: `Duration: ${Math.round(result.duration / 1000)}s` }
          )
        }

        // Check if pause was requested - stop after current packet
        if (isPausedRef.current) {
          const pausedProgress = Math.round(((i + 1) / readyPackets.length) * 100)
          setProgress(pausedProgress)
          addEvent("warning", "Processing paused", `Stopped after ${completedPackets.length} of ${readyPackets.length} packets. ${failedPackets.length} failed.`)
          setStatus("ready") // Set to ready so user can resume
          if (activeSessionId) {
            await updateSession(
              activeSessionId,
              { progress: pausedProgress, status: "cancelled" },
              { type: "warning", message: "Processing paused by user" }
            )
          }
          return
        }
      }

      setProgress(100)

      // Calculate final packet counts
      const finalCounts: PacketCounts = {
        successCount: completedPackets.length - unverifiedPackets.length,
        failedCount: failedPackets.length,
        cancelledCount: cancelledPackets.length,
        remainingCount: readyPackets.length - completedPackets.length - failedPackets.length - cancelledPackets.length,
        totalCount: readyPackets.length,
        unverifiedCount: unverifiedPackets.length
      }
      setPacketCounts(finalCounts)

      // Determine final status based on packet results
      const hasFailures = failedPackets.length > 0
      const hasCancelled = cancelledPackets.length > 0
      const allFailed = failedPackets.length === readyPackets.length
      const allCancelled = cancelledPackets.length === readyPackets.length
      const allSucceeded = finalCounts.successCount + finalCounts.unverifiedCount === readyPackets.length
      const someSucceeded = completedPackets.length > 0
      const totalProcessed = completedPackets.length + failedPackets.length + cancelledPackets.length

      if (allCancelled || (hasCancelled && !someSucceeded)) {
        // User stopped execution before any completion
        setStatus("stopped")
        setError(`Processing stopped by user. ${cancelledPackets.length} packet(s) cancelled.`)
        addEvent("warning", "Processing stopped", `${cancelledPackets.length} packet(s) cancelled by user`, {
          progress: 100,
          provider: currentProvider,
          model: currentModel
        })

        if (activeSessionId) {
          await updateSession(
            activeSessionId,
            { progress: 100, status: "cancelled", error: `Stopped by user: ${cancelledPackets.length} cancelled` },
            { type: "warning", message: "Processing stopped by user" }
          )
          await completeSession(activeSessionId, "cancel")
        }
      } else if (allFailed) {
        // All packets failed
        setStatus("failed")
        setError(`All ${failedPackets.length} packets failed`)
        addEvent("error", "Processing failed", `All ${failedPackets.length} packets failed: ${failedPackets.join(", ")}`, {
          progress: 100,
          provider: currentProvider,
          model: currentModel
        })

        if (activeSessionId) {
          await updateSession(
            activeSessionId,
            { progress: 100, status: "error", error: `All ${failedPackets.length} packets failed` },
            { type: "error", message: "Processing failed - all packets failed" }
          )
          await completeSession(activeSessionId, "complete", `All ${failedPackets.length} packets failed`)
        }
      } else if (hasFailures || hasCancelled) {
        // Some packets failed/cancelled, some succeeded - partial success
        setStatus("partial")
        const errorParts: string[] = []
        if (failedPackets.length > 0) errorParts.push(`${failedPackets.length} failed`)
        if (cancelledPackets.length > 0) errorParts.push(`${cancelledPackets.length} cancelled`)
        setError(`${completedPackets.length}/${totalProcessed} succeeded, ${errorParts.join(", ")}`)
        addEvent("warning", "Processing partially completed",
          `${completedPackets.length} succeeded, ${errorParts.join(", ")}`, {
          progress: 100,
          provider: currentProvider,
          model: currentModel
        })

        if (activeSessionId) {
          await updateSession(
            activeSessionId,
            { progress: 100, status: "complete", output: `${completedPackets.length} succeeded, ${errorParts.join(", ")}` },
            { type: "warning", message: `Partial completion: ${completedPackets.length} succeeded, ${errorParts.join(", ")}` }
          )
          await completeSession(activeSessionId, "complete")
        }
      } else if (allSucceeded) {
        // All packets succeeded (complete = passed quality gates OR marked unverified)
        setStatus("complete")
        const successMessage = unverifiedPackets.length > 0
          ? `${readyPackets.length} packets processed (${unverifiedPackets.length} unverified)`
          : `${readyPackets.length} packets processed successfully`
        addEvent("complete", "All packets completed!", successMessage, {
          progress: 100,
          provider: currentProvider,
          model: currentModel
        })

        if (activeSessionId) {
          await updateSession(
            activeSessionId,
            { progress: 100, status: "complete", output: successMessage },
            { type: "success", message: "All packets completed!" }
          )
          await completeSession(activeSessionId, "complete")
        }
      } else {
        // Some packets remain (shouldn't normally happen)
        setStatus("ready")
        setError(`${finalCounts.remainingCount} packets not processed`)
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
      setStatus("error")
      addEvent("error", "Processing failed", message, {
        provider: currentProvider,
        model: currentModel
      })

      // Complete session with error
      if (activeSessionId) {
        await completeSession(activeSessionId, "complete", message)
      }
    }
  }

  // Keep ref updated with latest handleGo
  handleGoRef.current = handleGo

  const handleRetry = () => {
    setStatus("ready")
    setError(null)
    setIsPaused(false)
    isPausedRef.current = false
  }

  // Clear activity history
  const handleClearHistory = () => {
    setEvents([])
    localStorage.removeItem("claudia_activity_events")
  }

  // Handle stop button click - immediately cancels the current fetch request
  const handleStop = () => {
    setIsPaused(true)
    isPausedRef.current = true
    wasStoppedRef.current = true
    // Immediately abort the current fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    addEvent("warning", "Processing stopped", "Current packet cancelled immediately")
  }

  // Refine & Iterate - NICU for newborn apps
  const handleRefine = async () => {
    if (!project.repos?.length) return

    setIsRefining(true)
    const iteration = refinementCount + 1
    setRefinementCount(iteration)

    // Determine provider and model for refinement events
    const getRefineProviderInfo = () => {
      let provider = project.defaultProviderId || executionMode
      const model = project.defaultModelId || undefined

      if (!project.defaultProviderId) {
        if (executionMode === "turbo") {
          provider = "claude-code"
        } else if (executionMode === "local") {
          provider = "lmstudio"
        } else if (executionMode === "n8n") {
          provider = "n8n"
        }
      }

      return { provider, model }
    }

    const { provider: refineProvider, model: refineModel } = getRefineProviderInfo()

    addEvent("iteration", `Refinement Pass #${iteration}`, "Analyzing and improving code quality...", {
      provider: refineProvider,
      model: refineModel
    })

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
        const modeLabel = result.mode === "local" ? "Local" : result.mode === "n8n" ? "N8N" : "Turbo"
        const resultProvider = result.mode === "local" ? "lmstudio" : result.mode === "turbo" ? "claude-code" : result.mode || refineProvider
        addEvent("complete", `Refinement #${iteration} complete`,
          `${result.filesChanged?.length || 0} files improved (${modeLabel} mode)`, {
            provider: resultProvider,
            model: result.model || refineModel
          })
      } else {
        const resultProvider = result.mode === "local" ? "lmstudio" : result.mode === "turbo" ? "claude-code" : result.mode || refineProvider
        addEvent("error", `Refinement #${iteration} had issues`, result.error, {
          provider: resultProvider,
          model: result.model || refineModel
        })
      }
    } catch (err) {
      addEvent("error", "Refinement failed", err instanceof Error ? err.message : "Unknown error", {
        provider: refineProvider,
        model: refineModel
      })
    } finally {
      setIsRefining(false)
    }
  }

  // Expose triggerExecution method via ref for parent components
  React.useImperativeHandle(ref, () => ({
    triggerExecution: () => {
      // Only trigger if we have ready packets and a valid working directory
      if (readyPackets.length > 0 && hasValidWorkingDir(project)) {
        handleGoRef.current()
      }
    }
  }), [readyPackets.length, project])

  return (
    <div className={cn("space-y-6", className)}>
      {/* Hero Section with GO Button and Activity Stream */}
      <Card className="border-green-500/20 bg-gradient-to-br from-gray-900 to-gray-900/50 overflow-hidden">
        <CardContent className="pt-6">
          {/* Main execution area with slide animation */}
          <div className={cn(
            "flex transition-all duration-500 ease-in-out",
            status === "running" || events.length > 0
              ? "gap-6"
              : "gap-0"
          )}>
            {/* GO Button Area - slides left when running */}
            <div className={cn(
              "transition-all duration-500 ease-in-out flex-shrink-0",
              status === "running" || events.length > 0
                ? "w-[40%]"
                : "w-full"
            )}>
              {/* Title with packet count */}
              <div className="text-center mb-4">
                <h2 className="text-xl font-semibold text-white">
                  {project.name}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {readyPackets.length} work packet{readyPackets.length !== 1 ? "s" : ""} ready to process
                </p>
              </div>

              {/* Provider/Model Selector - positioned between title and GO button */}
              <div className="mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground">Execute with:</span>
                </div>
                <div className={cn(
                  "mx-auto transition-all duration-300",
                  status === "running" || events.length > 0 ? "max-w-full" : "max-w-md"
                )}>
                  <Select
                    value={selectedModelId ? `${selectedProviderId}:${selectedModelId}` : selectedProviderId}
                    onValueChange={handleProviderModelChange}
                    disabled={status === "running"}
                  >
                    <SelectTrigger className="w-full h-12 text-sm bg-gray-800/50 border-gray-700 hover:border-green-500/50 transition-colors">
                      <div className="flex items-center gap-2">
                        {selectedProviderId && groupedModels[selectedProviderId]?.type === "local" && (
                          <Cpu className="h-4 w-4 text-blue-400" />
                        )}
                        {selectedProviderId && groupedModels[selectedProviderId]?.type === "cloud" && (
                          <Cloud className="h-4 w-4 text-purple-400" />
                        )}
                        {selectedProviderId && (groupedModels[selectedProviderId]?.type === "cli" || selectedProviderId === "claude-code") && (
                          <Terminal className="h-4 w-4 text-green-400" />
                        )}
                        {modelsLoading ? (
                          <span className="text-muted-foreground">Loading models...</span>
                        ) : (
                          <SelectValue placeholder="Select provider & model" />
                        )}
                      </div>
                    </SelectTrigger>
                    <SelectContent className="max-h-80 overflow-y-auto">
                      {/* Claude Code - CLI Provider (always available) */}
                      {groupedModels["claude-code"] && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-green-400 flex items-center gap-2">
                            <Terminal className="h-3 w-3" />
                            Claude Code (CLI)
                          </div>
                          {groupedModels["claude-code"].models.map((model) => (
                            <SelectItem
                              key={`claude-code:${model.id}`}
                              value={`claude-code:${model.id}`}
                            >
                              <div className="flex flex-col">
                                <span>{model.name || model.id}</span>
                                {model.description && (
                                  <span className="text-xs text-muted-foreground">{model.description}</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                          <SelectSeparator />
                        </>
                      )}

                      {/* Cloud Providers */}
                      {Object.entries(groupedModels)
                        .filter(([, group]) => group.type === "cloud")
                        .map(([providerId, group]) => (
                          <React.Fragment key={providerId}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-purple-400 flex items-center gap-2">
                              <Cloud className="h-3 w-3" />
                              {group.displayName}
                            </div>
                            {group.models.map((model) => (
                              <SelectItem
                                key={`${providerId}:${model.id}`}
                                value={`${providerId}:${model.id}`}
                              >
                                <div className="flex flex-col">
                                  <span>{model.name || model.id}</span>
                                  {model.description && (
                                    <span className="text-xs text-muted-foreground">{model.description}</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                            <SelectSeparator />
                          </React.Fragment>
                        ))}

                      {/* Local Providers */}
                      {Object.entries(groupedModels)
                        .filter(([, group]) => group.type === "local")
                        .map(([providerId, group]) => (
                          <React.Fragment key={providerId}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-blue-400 flex items-center gap-2">
                              <Cpu className="h-3 w-3" />
                              {group.displayName}
                            </div>
                            {group.models.length > 0 ? (
                              group.models.map((model) => (
                                <SelectItem
                                  key={`${providerId}:${model.id}`}
                                  value={`${providerId}:${model.id}`}
                                >
                                  <div className="flex flex-col">
                                    <span className="truncate max-w-[250px]">{model.name || model.id}</span>
                                  </div>
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value={providerId} disabled>
                                <span className="text-muted-foreground">No models loaded</span>
                              </SelectItem>
                            )}
                            <SelectSeparator />
                          </React.Fragment>
                        ))}

                      {/* Empty State */}
                      {Object.keys(groupedModels).length === 0 && !modelsLoading && (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                          No providers available. Check your connections in Settings.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Skip Quality Gates Option */}
              <div className="mb-4 flex justify-center">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="skip-quality-gates"
                    checked={skipQualityGates}
                    onCheckedChange={(checked) => setSkipQualityGates(checked === true)}
                    disabled={status === "running"}
                  />
                  <Label
                    htmlFor="skip-quality-gates"
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Skip quality gates (not recommended)
                  </Label>
                </div>
              </div>
              {skipQualityGates && (
                <div className="mb-4 mx-auto max-w-md p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-400">
                    Code will not be verified. Tests, TypeScript checks, and builds will be skipped.
                    Use at your own risk.
                  </p>
                </div>
              )}

              {/* GO Button */}
              <div className="flex items-center justify-center">
                <HeroGoButton
                  projectName={project.name}
                  packetCount={readyPackets.length}
                  onGo={handleGo}
                  disabled={readyPackets.length === 0 || (!project.repos?.length && !project.workingDirectory && !project.basePath)}
                  loading={status === "running"}
                  status={status === "error" ? "failed" : status}
                  progress={progress}
                  successCount={packetCounts.successCount + packetCounts.unverifiedCount}
                  totalCount={packetCounts.totalCount}
                />
              </div>

              {/* Beta Usage Banner */}
              {isBetaTester && betaLimits && (
                <div className="mt-4">
                  <BetaUsageBanner
                    type="executions"
                    current={betaLimits.current.executions}
                    limit={betaLimits.limits.executions}
                  />
                </div>
              )}
            </div>

            {/* Activity Feed - slides in from right when running or has events */}
            <div className={cn(
              "transition-all duration-500 ease-in-out overflow-hidden border-l border-gray-700/50",
              status === "running" || events.length > 0
                ? "w-[60%] opacity-100 pl-6"
                : "w-0 opacity-0 pl-0"
            )}>
              {/* Activity Header with Stop and Clear History buttons */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">Activity</h3>
                  <ActivityIndicator
                    isRunning={status === "running"}
                    eventCount={events.length}
                    latestMessage={events[events.length - 1]?.message}
                  />
                </div>
                <div className="flex items-center gap-2">
                  {/* Stop button - visible when execution is running */}
                  {status === "running" && (
                    <button
                      onClick={handleStop}
                      disabled={isPaused}
                      className={cn(
                        "flex items-center gap-1 text-xs transition-colors",
                        isPaused
                          ? "text-yellow-400/50 cursor-not-allowed"
                          : "text-red-400 hover:text-red-300"
                      )}
                    >
                      <Square className="h-3 w-3 fill-current" />
                      {isPaused ? "Stopping..." : "Stop"}
                    </button>
                  )}
                  {events.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearHistory}
                      className="text-xs text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Clear History
                    </Button>
                  )}
                </div>
              </div>
              {/* Activity Stream */}
              <div className="h-[600px]">
                <ActivityStream
                  events={events}
                  isRunning={status === "running"}
                />
              </div>
            </div>
          </div>


          {/* N8N Status Display - Shows when N8N mode is active and running */}
          {executionMode === "n8n" && status === "running" && (
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-orange-400 animate-spin" />
                  <span className="font-medium text-orange-300">N8N Pipeline Active</span>
                </div>
                <span className="text-xs text-orange-400/70">
                  Iteration {n8nStatus.iteration}/{n8nStatus.maxIterations}
                </span>
              </div>

              {/* Stage Indicators */}
              <div className="flex items-center gap-2 mb-3">
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs",
                  n8nStatus.stage === "generating"
                    ? "bg-orange-500/20 text-orange-300"
                    : n8nStatus.stage === "validating" || n8nStatus.stage === "iterating" || n8nStatus.stage === "complete"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-gray-700/50 text-gray-500"
                )}>
                  {n8nStatus.stage === "generating" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  Generating
                </div>
                <GitBranch className="h-3 w-3 text-gray-600" />
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs",
                  n8nStatus.stage === "validating"
                    ? "bg-orange-500/20 text-orange-300"
                    : n8nStatus.stage === "iterating" || n8nStatus.stage === "complete"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-gray-700/50 text-gray-500"
                )}>
                  {n8nStatus.stage === "validating" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : n8nStatus.stage === "iterating" || n8nStatus.stage === "complete" ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <span className="h-3 w-3 rounded-full border border-current" />
                  )}
                  Validating
                </div>
                <GitBranch className="h-3 w-3 text-gray-600" />
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs",
                  n8nStatus.stage === "iterating"
                    ? "bg-orange-500/20 text-orange-300"
                    : n8nStatus.stage === "complete"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-gray-700/50 text-gray-500"
                )}>
                  {n8nStatus.stage === "iterating" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : n8nStatus.stage === "complete" ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <span className="h-3 w-3 rounded-full border border-current" />
                  )}
                  Iterating
                </div>
              </div>

              {/* Quality Score */}
              {n8nStatus.qualityScore !== null && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-gray-800/50">
                  <span className="text-xs text-gray-400">Quality Score</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 rounded-full bg-gray-700 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          n8nStatus.qualityScore >= 80 ? "bg-green-500" :
                          n8nStatus.qualityScore >= 60 ? "bg-yellow-500" :
                          "bg-red-500"
                        )}
                        style={{ width: `${n8nStatus.qualityScore}%` }}
                      />
                    </div>
                    <span className={cn(
                      "text-sm font-medium",
                      n8nStatus.qualityScore >= 80 ? "text-green-400" :
                      n8nStatus.qualityScore >= 60 ? "text-yellow-400" :
                      "text-red-400"
                    )}>
                      {n8nStatus.qualityScore}%
                    </span>
                  </div>
                </div>
              )}

              {/* Validator Feedback */}
              {n8nStatus.validatorFeedback && (
                <div className="mt-2 p-2 rounded-lg bg-gray-800/50">
                  <p className="text-xs text-gray-400 mb-1">Validator Feedback</p>
                  <p className="text-xs text-gray-300">{n8nStatus.validatorFeedback}</p>
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-400 font-medium">Processing Error</p>
                <p className="text-xs text-red-400/70 mt-1">{error}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleRetry}>
                Retry
              </Button>
            </div>
          )}

          {/* No working directory warning */}
          {!project.basePath && !project.workingDirectory && !project.repos?.some(r => r.localPath) && (
            <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-400 font-medium">Using Default Directory</p>
                <p className="text-xs text-blue-400/70 mt-1">
                  Will use ~/claudia-projects/{project.name.toLowerCase().replace(/\s+/g, "-")} for execution
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <a href={`/projects/${project.id}/settings`}>
                  <Settings2 className="h-4 w-4 mr-1" />
                  Configure
                </a>
              </Button>
            </div>
          )}

          {/* Refine & Iterate - NICU for newborn apps */}
          {status === "complete" && hasValidWorkingDir(project) && (
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

          {/* Reset & Run Again - when all packets are complete */}
          {status === "complete" && onResetPackets && (
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/20">
                    <RotateCcw className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="font-medium text-cyan-300">Reset & Run Again</p>
                    <p className="text-xs text-cyan-400/70">
                      Reset all packets to queued status to run them again
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    onResetPackets()
                    setStatus("ready")
                    setProgress(0)
                    setPacketCounts({
                      successCount: 0,
                      failedCount: 0,
                      cancelledCount: 0,
                      remainingCount: packets.length,
                      totalCount: packets.length,
                      unverifiedCount: 0
                    })
                  }}
                  variant="outline"
                  className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset All Packets
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
})

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
