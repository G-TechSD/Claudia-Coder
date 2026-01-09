"use client"

/**
 * Packet Execution Hook
 *
 * React hook for managing packet execution state and actions.
 * Uses packet-runs storage module for persistence.
 */

import { useState, useEffect, useCallback, useRef } from "react"
import { getProject } from "@/lib/data/projects"
import { getPacketsForProject, updatePacket } from "@/lib/ai/build-plan"
import type { PacketRun, PacketRunStatus, PacketRunRating } from "@/lib/data/types"
import {
  getPacketRuns,
  getPacketRun,
  createPacketRun,
  updatePacketRun,
  addRunFeedback
} from "@/lib/data/packet-runs"

// ============ Types ============

export interface ExecutionOptions {
  preferredServer?: string
  temperature?: number
  maxTokens?: number
  createBranch?: boolean
  branchName?: string
  useIteration?: boolean
  maxIterations?: number
  minConfidence?: number
}

export interface UsePacketExecutionReturn {
  // State
  isExecuting: boolean
  currentRun: PacketRun | null
  runs: PacketRun[]
  error: string | null

  // Actions
  startExecution: (options?: ExecutionOptions) => Promise<PacketRun | null>
  stopExecution: () => Promise<void>
  addFeedback: (rating: "thumbs_up" | "thumbs_down" | null, comment?: string) => void

  // Utilities
  refreshRuns: () => void
}

// Re-export types for consumers
export type { PacketRun, PacketRunStatus, PacketRunRating }

// ============ Hook ============

export function usePacketExecution(packetId: string, projectId: string): UsePacketExecutionReturn {
  // State
  const [isExecuting, setIsExecuting] = useState(false)
  const [currentRun, setCurrentRun] = useState<PacketRun | null>(null)
  const [runs, setRuns] = useState<PacketRun[]>([])
  const [error, setError] = useState<string | null>(null)

  // Refs for cleanup
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Load runs on mount and when packetId changes
  const refreshRuns = useCallback(() => {
    const packetRuns = getPacketRuns(packetId)
    setRuns(packetRuns)

    // Check if there's a running execution
    const running = packetRuns.find(r => r.status === "running")
    if (running) {
      setCurrentRun(running)
      setIsExecuting(true)
    } else {
      // Only clear if there's no execution in progress
      if (!isExecuting) {
        setCurrentRun(null)
      }
    }
  }, [packetId, isExecuting])

  useEffect(() => {
    refreshRuns()
  }, [refreshRuns])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Poll for execution status updates (mock implementation)
  const startPolling = useCallback((runId: string) => {
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    pollingIntervalRef.current = setInterval(() => {
      const run = getPacketRun(runId)
      if (run) {
        setCurrentRun(run)

        // Stop polling if execution is complete
        if (run.status !== "running") {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          setIsExecuting(false)
          refreshRuns()
        }
      }
    }, 1000) // Poll every second
  }, [refreshRuns])

  // Start execution
  const startExecution = useCallback(async (options?: ExecutionOptions): Promise<PacketRun | null> => {
    setError(null)

    try {
      // Get project and packet from localStorage
      const project = getProject(projectId)
      if (!project) {
        throw new Error(`Project not found: ${projectId}`)
      }

      const packets = getPacketsForProject(projectId)
      const packet = packets.find(p => p.id === packetId)
      if (!packet) {
        throw new Error(`Packet not found: ${packetId}`)
      }

      if (project.repos.length === 0) {
        throw new Error("Project has no linked repositories")
      }

      // Create a new run record
      const run = createPacketRun(packetId, projectId)

      setCurrentRun(run)
      setIsExecuting(true)

      // Update packet status
      updatePacket(projectId, packetId, { status: "in_progress" })

      // Create abort controller for this execution
      abortControllerRef.current = new AbortController()

      // Get GitLab token
      const gitlabToken = localStorage.getItem("gitlab_token")
      if (!gitlabToken) {
        throw new Error("GitLab token not configured. Please configure it in settings.")
      }

      // Start polling for updates
      startPolling(run.id)

      // Call execution API
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GitLab-Token": gitlabToken
        },
        body: JSON.stringify({
          packetId,
          projectId,
          packet,
          project,
          options,
          runId: run.id
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()

      // Update run with results
      if (result.success) {
        updatePacketRun(run.id, {
          status: "completed",
          completedAt: new Date().toISOString(),
          output: result.rawOutput || JSON.stringify(result.files || [], null, 2),
          exitCode: 0
        })
        updatePacket(projectId, packetId, { status: "completed" })
      } else {
        updatePacketRun(run.id, {
          status: "failed",
          completedAt: new Date().toISOString(),
          output: result.errors?.join("\n") || "Unknown error",
          exitCode: 1
        })
        updatePacket(projectId, packetId, { status: "blocked" })
      }

      // Refresh to get the updated run
      const updatedRun = getPacketRun(run.id)
      setCurrentRun(updatedRun)
      setIsExecuting(false)
      refreshRuns()

      return updatedRun

    } catch (err) {
      // Handle abort
      if (err instanceof Error && err.name === "AbortError") {
        return currentRun
      }

      const message = err instanceof Error ? err.message : "Execution failed"
      setError(message)

      // If we have a current run, fail it
      if (currentRun) {
        updatePacketRun(currentRun.id, {
          status: "failed",
          completedAt: new Date().toISOString(),
          output: message,
          exitCode: 1
        })
        updatePacket(projectId, packetId, { status: "blocked" })
      }

      setIsExecuting(false)
      refreshRuns()
      return null
    }
  }, [packetId, projectId, currentRun, startPolling, refreshRuns])

  // Stop execution
  const stopExecution = useCallback(async () => {
    // Stop polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Cancel the current run if there is one
    if (currentRun && currentRun.status === "running") {
      updatePacketRun(currentRun.id, {
        status: "cancelled",
        completedAt: new Date().toISOString(),
        output: currentRun.output + "\n[Cancelled by user]"
      })
      updatePacket(projectId, packetId, { status: "queued" })
    }

    setIsExecuting(false)
    refreshRuns()
  }, [currentRun, projectId, packetId, refreshRuns])

  // Add feedback to the current or most recent run
  const addFeedback = useCallback((rating: "thumbs_up" | "thumbs_down" | null, comment?: string) => {
    // Find the run to add feedback to (current or most recent)
    const targetRun = currentRun || runs[0]

    if (!targetRun) {
      console.warn("No run found to add feedback to")
      return
    }

    addRunFeedback(targetRun.id, rating, comment)

    // Update local state
    const updatedRun = getPacketRun(targetRun.id)
    if (updatedRun) {
      if (currentRun?.id === targetRun.id) {
        setCurrentRun(updatedRun)
      }
      refreshRuns()
    }
  }, [currentRun, runs, refreshRuns])

  return {
    isExecuting,
    currentRun,
    runs,
    error,
    startExecution,
    stopExecution,
    addFeedback,
    refreshRuns
  }
}

// ============ Legacy Exports (for backwards compatibility) ============

// Re-export the old types and hook signature for components still using them
export interface ExecutionLog {
  timestamp: string
  level: "info" | "warn" | "error" | "success"
  message: string
  data?: unknown
}

export interface FileChange {
  path: string
  content: string
  action: "create" | "update" | "delete"
}

export interface ExecutionResult {
  success: boolean
  packetId: string
  files: FileChange[]
  logs: ExecutionLog[]
  commitUrl?: string
  branch?: string
  errors: string[]
  duration: number
  rawOutput?: string
}

export interface LegacyUsePacketExecutionReturn {
  execute: (packetId: string, projectId: string, options?: ExecutionOptions) => Promise<ExecutionResult>
  isExecuting: boolean
  currentPacketId: string | null
  lastResult: ExecutionResult | null
  logs: ExecutionLog[]
  error: string | null
  checkServerStatus: () => Promise<{ servers: unknown[]; available: boolean }>
}

/**
 * Legacy hook for backwards compatibility
 * @deprecated Use usePacketExecution(packetId, projectId) instead
 */
export function useLegacyPacketExecution(): LegacyUsePacketExecutionReturn {
  const [isExecuting, setIsExecuting] = useState(false)
  const [currentPacketId, setCurrentPacketId] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null)
  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [error, setError] = useState<string | null>(null)

  const checkServerStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/execute")
      if (!response.ok) {
        return { servers: [], available: false }
      }
      return response.json()
    } catch {
      return { servers: [], available: false }
    }
  }, [])

  const execute = useCallback(async (
    packetId: string,
    projectId: string,
    options?: ExecutionOptions
  ): Promise<ExecutionResult> => {
    setIsExecuting(true)
    setCurrentPacketId(packetId)
    setError(null)
    setLogs([])

    const addLog = (level: ExecutionLog["level"], message: string) => {
      const log = { timestamp: new Date().toISOString(), level, message }
      setLogs(prev => [...prev, log])
    }

    try {
      addLog("info", "Starting execution...")

      // Get project and packet from localStorage
      const project = getProject(projectId)
      if (!project) {
        throw new Error(`Project not found: ${projectId}`)
      }

      const packets = getPacketsForProject(projectId)
      const packet = packets.find(p => p.id === packetId)
      if (!packet) {
        throw new Error(`Packet not found: ${packetId}`)
      }

      if (project.repos.length === 0) {
        throw new Error("Project has no linked repositories")
      }

      addLog("info", `Executing packet: ${packet.title}`)
      addLog("info", `Repository: ${project.repos[0].name}`)

      // Get GitLab token
      const gitlabToken = localStorage.getItem("gitlab_token")
      if (!gitlabToken) {
        throw new Error("GitLab token not configured. Please configure it in settings.")
      }

      // Update packet status to in_progress
      updatePacket(projectId, packetId, { status: "in_progress" })

      // Call execution API
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GitLab-Token": gitlabToken
        },
        body: JSON.stringify({
          packetId,
          projectId,
          packet,
          project,
          options
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result: ExecutionResult = await response.json()

      // Merge logs
      setLogs(prev => [...prev, ...result.logs])

      // Update packet status based on result
      if (result.success) {
        updatePacket(projectId, packetId, { status: "completed" })
        addLog("success", `Execution completed! ${result.files.length} files generated.`)
        if (result.commitUrl) {
          addLog("success", `Commit: ${result.commitUrl}`)
        }
      } else {
        updatePacket(projectId, packetId, { status: "blocked" })
        addLog("error", `Execution failed: ${result.errors.join(", ")}`)
      }

      setLastResult(result)
      return result

    } catch (err) {
      const message = err instanceof Error ? err.message : "Execution failed"
      setError(message)
      addLog("error", message)

      // Update packet status to blocked
      updatePacket(projectId, packetId, { status: "blocked" })

      const failedResult: ExecutionResult = {
        success: false,
        packetId,
        files: [],
        logs,
        errors: [message],
        duration: 0
      }
      setLastResult(failedResult)
      return failedResult

    } finally {
      setIsExecuting(false)
      setCurrentPacketId(null)
    }
  }, [logs])

  return {
    execute,
    isExecuting,
    currentPacketId,
    lastResult,
    logs,
    error,
    checkServerStatus
  }
}

/**
 * Hook for batch packet execution
 */
export function useBatchExecution() {
  const [isExecuting, setIsExecuting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState<ExecutionResult[]>([])
  const { execute } = useLegacyPacketExecution()

  const executeBatch = useCallback(async (
    packetIds: string[],
    projectId: string,
    options?: ExecutionOptions
  ): Promise<ExecutionResult[]> => {
    setIsExecuting(true)
    setProgress({ current: 0, total: packetIds.length })
    setResults([])

    const batchResults: ExecutionResult[] = []

    for (let i = 0; i < packetIds.length; i++) {
      setProgress({ current: i + 1, total: packetIds.length })

      const result = await execute(packetIds[i], projectId, options)
      batchResults.push(result)
      setResults([...batchResults])

      // Stop on failure if configured
      if (!result.success && options?.branchName) {
        break
      }
    }

    setIsExecuting(false)
    return batchResults
  }, [execute])

  return {
    executeBatch,
    isExecuting,
    progress,
    results
  }
}
