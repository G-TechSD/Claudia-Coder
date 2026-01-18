"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import type { SubAgentStatus, SubAgentSerialized } from "@/lib/claude-code/sub-agents"

/**
 * Local sub-agent state for the hook
 */
interface LocalSubAgent {
  id: string
  sessionId: string
  taskDescription: string
  status: SubAgentStatus
  startedAt: Date
  completedAt?: Date
  result?: string
  error?: string
  progress?: number
  metadata?: Record<string, unknown>
}

interface UseSubAgentsOptions {
  /** Session ID to track sub-agents for */
  sessionId: string | null
  /** Enable polling for sub-agent updates from the API */
  enablePolling?: boolean
  /** Polling interval in milliseconds (default: 2000) */
  pollingInterval?: number
  /** Callback when a sub-agent is created */
  onSubAgentCreated?: (subAgent: LocalSubAgent) => void
  /** Callback when a sub-agent status changes */
  onStatusChange?: (subAgent: LocalSubAgent, previousStatus: SubAgentStatus) => void
  /** Callback when a sub-agent completes */
  onSubAgentCompleted?: (subAgent: LocalSubAgent) => void
  /** Callback when a sub-agent fails */
  onSubAgentFailed?: (subAgent: LocalSubAgent) => void
}

interface UseSubAgentsReturn {
  /** All sub-agents for this session */
  subAgents: LocalSubAgent[]
  /** Whether we're loading sub-agents from the API */
  isLoading: boolean
  /** Error message if API call failed */
  error: string | null

  // Actions
  /** Add a new sub-agent */
  addSubAgent: (taskDescription: string, metadata?: Record<string, unknown>) => Promise<LocalSubAgent | null>
  /** Update the status of a sub-agent */
  updateStatus: (
    subAgentId: string,
    status: SubAgentStatus,
    options?: { result?: string; error?: string; progress?: number }
  ) => Promise<boolean>
  /** Remove a sub-agent */
  removeSubAgent: (subAgentId: string) => void
  /** Clear all sub-agents */
  clearSubAgents: () => void
  /** Refresh sub-agents from the API */
  refresh: () => Promise<void>

  // Derived state
  /** Number of active (pending + running) sub-agents */
  activeCount: number
  /** Number of completed sub-agents */
  completedCount: number
  /** Number of failed sub-agents */
  failedCount: number
  /** Total number of sub-agents */
  totalCount: number
  /** Whether any sub-agents are currently running */
  hasRunning: boolean
  /** Get sub-agents by status */
  getByStatus: (status: SubAgentStatus) => LocalSubAgent[]
}

/**
 * React hook for managing sub-agent state in the UI
 */
export function useSubAgents(options: UseSubAgentsOptions): UseSubAgentsReturn {
  const {
    sessionId,
    enablePolling = false,
    pollingInterval = 10000,
    onSubAgentCreated,
    onStatusChange,
    onSubAgentCompleted,
    onSubAgentFailed
  } = options

  const [subAgents, setSubAgents] = useState<LocalSubAgent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs for callbacks to avoid stale closures
  const callbacksRef = useRef({
    onSubAgentCreated,
    onStatusChange,
    onSubAgentCompleted,
    onSubAgentFailed
  })

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onSubAgentCreated,
      onStatusChange,
      onSubAgentCompleted,
      onSubAgentFailed
    }
  }, [onSubAgentCreated, onStatusChange, onSubAgentCompleted, onSubAgentFailed])

  /**
   * Fetch sub-agents from the API
   */
  const refresh = useCallback(async () => {
    if (!sessionId) {
      setSubAgents([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/claude-code/sub-agents?sessionId=${sessionId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch sub-agents")
      }

      // Convert API response to local state
      const fetchedAgents: LocalSubAgent[] = (data.subAgents || []).map(
        (agent: SubAgentSerialized) => ({
          id: agent.id,
          sessionId: agent.sessionId,
          taskDescription: agent.taskDescription,
          status: agent.status,
          startedAt: new Date(agent.startedAt),
          completedAt: agent.completedAt ? new Date(agent.completedAt) : undefined,
          result: agent.result,
          error: agent.error,
          progress: agent.progress,
          metadata: agent.metadata
        })
      )

      // Check for status changes and trigger callbacks
      setSubAgents(prevAgents => {
        for (const newAgent of fetchedAgents) {
          const prevAgent = prevAgents.find(a => a.id === newAgent.id)
          if (prevAgent && prevAgent.status !== newAgent.status) {
            callbacksRef.current.onStatusChange?.(newAgent, prevAgent.status)

            if (newAgent.status === "completed") {
              callbacksRef.current.onSubAgentCompleted?.(newAgent)
            } else if (newAgent.status === "failed") {
              callbacksRef.current.onSubAgentFailed?.(newAgent)
            }
          }
        }

        return fetchedAgents
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch sub-agents"
      setError(message)
      console.error("[useSubAgents] Error fetching sub-agents:", message)
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  /**
   * Add a new sub-agent
   */
  const addSubAgent = useCallback(
    async (
      taskDescription: string,
      metadata?: Record<string, unknown>
    ): Promise<LocalSubAgent | null> => {
      if (!sessionId) {
        console.warn("[useSubAgents] Cannot add sub-agent: no sessionId")
        return null
      }

      try {
        const response = await fetch("/api/claude-code/sub-agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            taskDescription,
            metadata
          })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to create sub-agent")
        }

        const newAgent: LocalSubAgent = {
          id: data.subAgent.id,
          sessionId: data.subAgent.sessionId,
          taskDescription: data.subAgent.taskDescription,
          status: data.subAgent.status,
          startedAt: new Date(data.subAgent.startedAt),
          completedAt: data.subAgent.completedAt
            ? new Date(data.subAgent.completedAt)
            : undefined,
          result: data.subAgent.result,
          error: data.subAgent.error,
          progress: data.subAgent.progress,
          metadata: data.subAgent.metadata
        }

        setSubAgents(prev => [...prev, newAgent])
        callbacksRef.current.onSubAgentCreated?.(newAgent)

        return newAgent
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create sub-agent"
        setError(message)
        console.error("[useSubAgents] Error creating sub-agent:", message)
        return null
      }
    },
    [sessionId]
  )

  /**
   * Update the status of a sub-agent
   */
  const updateStatus = useCallback(
    async (
      subAgentId: string,
      status: SubAgentStatus,
      opts?: { result?: string; error?: string; progress?: number }
    ): Promise<boolean> => {
      if (!sessionId) {
        console.warn("[useSubAgents] Cannot update status: no sessionId")
        return false
      }

      try {
        const response = await fetch("/api/claude-code/sub-agents", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            subAgentId,
            status,
            ...opts
          })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to update sub-agent")
        }

        // Update local state
        setSubAgents(prev =>
          prev.map(agent => {
            if (agent.id === subAgentId) {
              const previousStatus = agent.status
              const updatedAgent: LocalSubAgent = {
                ...agent,
                status,
                result: opts?.result ?? agent.result,
                error: opts?.error ?? agent.error,
                progress: opts?.progress ?? agent.progress,
                completedAt:
                  status === "completed" || status === "failed"
                    ? new Date()
                    : agent.completedAt
              }

              // Trigger callbacks
              if (previousStatus !== status) {
                callbacksRef.current.onStatusChange?.(updatedAgent, previousStatus)

                if (status === "completed") {
                  callbacksRef.current.onSubAgentCompleted?.(updatedAgent)
                } else if (status === "failed") {
                  callbacksRef.current.onSubAgentFailed?.(updatedAgent)
                }
              }

              return updatedAgent
            }
            return agent
          })
        )

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update sub-agent"
        setError(message)
        console.error("[useSubAgents] Error updating sub-agent:", message)
        return false
      }
    },
    [sessionId]
  )

  /**
   * Remove a sub-agent from local state
   */
  const removeSubAgent = useCallback((subAgentId: string) => {
    setSubAgents(prev => prev.filter(agent => agent.id !== subAgentId))
  }, [])

  /**
   * Clear all sub-agents
   */
  const clearSubAgents = useCallback(() => {
    setSubAgents([])
    setError(null)
  }, [])

  /**
   * Get sub-agents by status
   */
  const getByStatus = useCallback(
    (status: SubAgentStatus): LocalSubAgent[] => {
      return subAgents.filter(agent => agent.status === status)
    },
    [subAgents]
  )

  // Computed values
  const activeCount = useMemo(
    () => subAgents.filter(a => a.status === "pending" || a.status === "running").length,
    [subAgents]
  )

  const completedCount = useMemo(
    () => subAgents.filter(a => a.status === "completed").length,
    [subAgents]
  )

  const failedCount = useMemo(
    () => subAgents.filter(a => a.status === "failed").length,
    [subAgents]
  )

  const totalCount = subAgents.length

  const hasRunning = useMemo(
    () => subAgents.some(a => a.status === "running"),
    [subAgents]
  )

  // Polling effect - only poll when there are actively running sub-agents
  useEffect(() => {
    if (!enablePolling || !sessionId) {
      return
    }

    // Initial fetch
    refresh()

    // Only set up polling if there are running sub-agents (reduces unnecessary requests)
    if (!hasRunning) {
      return
    }

    // Set up polling interval (10s default, only when actively running)
    const intervalId = setInterval(refresh, pollingInterval)

    return () => {
      clearInterval(intervalId)
    }
  }, [enablePolling, sessionId, pollingInterval, refresh, hasRunning])

  // Clear sub-agents when session changes
  useEffect(() => {
    if (!sessionId) {
      setSubAgents([])
      setError(null)
    }
  }, [sessionId])

  return {
    subAgents,
    isLoading,
    error,
    addSubAgent,
    updateStatus,
    removeSubAgent,
    clearSubAgents,
    refresh,
    activeCount,
    completedCount,
    failedCount,
    totalCount,
    hasRunning,
    getByStatus
  }
}

export type { LocalSubAgent, UseSubAgentsOptions, UseSubAgentsReturn }
