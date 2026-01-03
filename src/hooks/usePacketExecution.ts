"use client"

/**
 * Packet Execution Hook
 *
 * React hook for executing work packets via the execution API.
 */

import { useState, useCallback } from "react"
import { getProject } from "@/lib/data/projects"
import { getPacketsForProject, updatePacket, type WorkPacket } from "@/lib/ai/build-plan"

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

export interface ExecutionOptions {
  preferredServer?: string
  temperature?: number
  maxTokens?: number
  createBranch?: boolean
  branchName?: string
  // Iteration loop options
  useIteration?: boolean
  maxIterations?: number
  minConfidence?: number
}

export interface UsePacketExecutionReturn {
  execute: (packetId: string, projectId: string, options?: ExecutionOptions) => Promise<ExecutionResult>
  isExecuting: boolean
  currentPacketId: string | null
  lastResult: ExecutionResult | null
  logs: ExecutionLog[]
  error: string | null
  checkServerStatus: () => Promise<{ servers: unknown[]; available: boolean }>
}

export function usePacketExecution(): UsePacketExecutionReturn {
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
  const { execute } = usePacketExecution()

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
