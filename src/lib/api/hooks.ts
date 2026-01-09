"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { n8nApi } from "./n8n"
import { gitlabApi, GitLabProject, GitLabCommit, GitLabBranch, GitLabTreeItem, GitLabMergeRequest, GitLabPipeline } from "./gitlab"
import {
  createUserWorkflowService,
  type UserWorkflow,
  type UserExecution,
} from "@/lib/n8n/user-workflows"
import {
  getUserWorkflowTag,
  getUserN8NConfig,
} from "@/lib/data/user-settings"

type ActionType = "rollback" | "comment" | "approve" | "reject" | "flag"

interface ActionTarget {
  type: "commit" | "pr" | "branch" | "activity" | "packet"
  id: string
  sha?: string
  branch?: string
  repo?: string
}

interface UseGitActionResult {
  execute: (action: ActionType, target: ActionTarget, data: { comment?: string; reason?: string }) => Promise<void>
  isLoading: boolean
  error: Error | null
  lastResult: unknown
}

export function useGitAction(): UseGitActionResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [lastResult, setLastResult] = useState<unknown>(null)

  const execute = useCallback(async (
    action: ActionType,
    target: ActionTarget,
    data: { comment?: string; reason?: string }
  ) => {
    setIsLoading(true)
    setError(null)

    try {
      let result: unknown

      switch (action) {
        case "rollback":
          result = await n8nApi.requestRollback(target, data.reason || "")
          break
        case "comment":
          result = await n8nApi.addComment(target, data.comment || "")
          break
        case "approve":
          result = await n8nApi.approveAction(target, data.comment)
          break
        case "reject":
          result = await n8nApi.rejectAction(target, data.reason || "")
          break
        case "flag":
          result = await n8nApi.flagForReview(target, data.reason || "")
          break
      }

      setLastResult(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { execute, isLoading, error, lastResult }
}

interface UsePacketActionResult {
  start: (packetId: string) => Promise<void>
  pause: (packetId: string) => Promise<void>
  cancel: (packetId: string, reason?: string) => Promise<void>
  retry: (packetId: string) => Promise<void>
  isLoading: boolean
  error: Error | null
}

export function usePacketAction(): UsePacketActionResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const wrapAction = useCallback(async (action: () => Promise<unknown>) => {
    setIsLoading(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    start: (packetId: string) => wrapAction(() => n8nApi.startPacket(packetId)),
    pause: (packetId: string) => wrapAction(() => n8nApi.pausePacket(packetId)),
    cancel: (packetId: string, reason?: string) => wrapAction(() => n8nApi.cancelPacket(packetId, reason)),
    retry: (packetId: string) => wrapAction(() => n8nApi.retryPacket(packetId)),
    isLoading,
    error
  }
}

interface UseAgentControlResult {
  pauseAll: () => Promise<void>
  resumeAll: () => Promise<void>
  isLoading: boolean
  error: Error | null
}

export function useAgentControl(): UseAgentControlResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const wrapAction = useCallback(async (action: () => Promise<unknown>) => {
    setIsLoading(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    pauseAll: () => wrapAction(() => n8nApi.pauseAllAgents()),
    resumeAll: () => wrapAction(() => n8nApi.resumeAllAgents()),
    isLoading,
    error
  }
}

interface UseN8NHealthResult {
  isHealthy: boolean | null
  check: () => Promise<boolean>
  isChecking: boolean
}

export function useN8NHealth(): UseN8NHealthResult {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const check = useCallback(async () => {
    setIsChecking(true)
    try {
      const healthy = await n8nApi.healthCheck()
      setIsHealthy(healthy)
      return healthy
    } catch {
      setIsHealthy(false)
      return false
    } finally {
      setIsChecking(false)
    }
  }, [])

  return { isHealthy, check, isChecking }
}

interface UseWorkflowsResult {
  workflows: Awaited<ReturnType<typeof n8nApi.getWorkflows>>
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
  activate: (id: string) => Promise<void>
  deactivate: (id: string) => Promise<void>
}

export function useWorkflows(): UseWorkflowsResult {
  const [workflows, setWorkflows] = useState<Awaited<ReturnType<typeof n8nApi.getWorkflows>>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await n8nApi.getWorkflows()
      setWorkflows(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const activate = useCallback(async (id: string) => {
    await n8nApi.activateWorkflow(id)
    await refresh()
  }, [refresh])

  const deactivate = useCallback(async (id: string) => {
    await n8nApi.deactivateWorkflow(id)
    await refresh()
  }, [refresh])

  return { workflows, isLoading, error, refresh, activate, deactivate }
}

// ============ User-Specific N8N Hooks ============

interface UseUserWorkflowsResult {
  workflows: UserWorkflow[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
  activate: (id: string) => Promise<void>
  deactivate: (id: string) => Promise<void>
  createWorkflow: (params: { name: string; nodes: unknown[]; connections: Record<string, unknown> }) => Promise<UserWorkflow>
  deleteWorkflow: (id: string) => Promise<boolean>
  connectionStatus: {
    healthy: boolean
    mode: "shared" | "personal"
    url: string
    message: string
  } | null
  checkConnection: () => Promise<void>
}

/**
 * Hook for managing user-specific workflows.
 * Uses the UserWorkflowService for proper isolation.
 *
 * @param userId - The ID of the current user
 * @param autoFetch - Whether to automatically fetch workflows on mount (default: true)
 */
export function useUserWorkflows(userId: string | null, autoFetch = true): UseUserWorkflowsResult {
  const [workflows, setWorkflows] = useState<UserWorkflow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<UseUserWorkflowsResult["connectionStatus"]>(null)

  // Create a memoized service instance
  const service = useMemo(() => {
    if (!userId) return null
    return createUserWorkflowService(userId)
  }, [userId])

  const refresh = useCallback(async () => {
    if (!service) return

    setIsLoading(true)
    setError(null)
    try {
      const data = await service.getWorkflows()
      setWorkflows(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load workflows"))
      setWorkflows([])
    } finally {
      setIsLoading(false)
    }
  }, [service])

  const checkConnection = useCallback(async () => {
    if (!service) return

    try {
      const status = await service.getStatus()
      setConnectionStatus(status)
    } catch (err) {
      setConnectionStatus({
        healthy: false,
        mode: "shared",
        url: "",
        message: err instanceof Error ? err.message : "Connection check failed",
      })
    }
  }, [service])

  const activate = useCallback(async (id: string) => {
    if (!service) throw new Error("No user context")
    await service.activateWorkflow(id)
    await refresh()
  }, [service, refresh])

  const deactivate = useCallback(async (id: string) => {
    if (!service) throw new Error("No user context")
    await service.deactivateWorkflow(id)
    await refresh()
  }, [service, refresh])

  const createWorkflow = useCallback(async (params: {
    name: string
    nodes: unknown[]
    connections: Record<string, unknown>
  }) => {
    if (!service) throw new Error("No user context")
    const workflow = await service.createWorkflow(params)
    await refresh()
    return workflow
  }, [service, refresh])

  const deleteWorkflow = useCallback(async (id: string) => {
    if (!service) throw new Error("No user context")
    const result = await service.deleteWorkflow(id)
    if (result) {
      await refresh()
    }
    return result
  }, [service, refresh])

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && service) {
      refresh()
      checkConnection()
    }
  }, [autoFetch, service, refresh, checkConnection])

  return {
    workflows,
    isLoading,
    error,
    refresh,
    activate,
    deactivate,
    createWorkflow,
    deleteWorkflow,
    connectionStatus,
    checkConnection,
  }
}

interface UseUserExecutionsResult {
  executions: UserExecution[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

/**
 * Hook for viewing user-specific workflow executions.
 *
 * @param userId - The ID of the current user
 * @param workflowId - Optional workflow ID to filter executions
 * @param autoFetch - Whether to automatically fetch on mount (default: true)
 */
export function useUserExecutions(
  userId: string | null,
  workflowId?: string,
  autoFetch = true
): UseUserExecutionsResult {
  const [executions, setExecutions] = useState<UserExecution[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const service = useMemo(() => {
    if (!userId) return null
    return createUserWorkflowService(userId)
  }, [userId])

  const refresh = useCallback(async () => {
    if (!service) return

    setIsLoading(true)
    setError(null)
    try {
      const data = await service.getExecutions(workflowId)
      setExecutions(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load executions"))
      setExecutions([])
    } finally {
      setIsLoading(false)
    }
  }, [service, workflowId])

  useEffect(() => {
    if (autoFetch && service) {
      refresh()
    }
  }, [autoFetch, service, refresh])

  return { executions, isLoading, error, refresh }
}

interface UseUserN8NConfigResult {
  config: ReturnType<typeof getUserN8NConfig> | null
  workflowTag: string | null
  isPersonalInstance: boolean
  refresh: () => void
}

/**
 * Hook for accessing user's n8n configuration.
 *
 * @param userId - The ID of the current user
 */
export function useUserN8NConfig(userId: string | null): UseUserN8NConfigResult {
  const [config, setConfig] = useState<ReturnType<typeof getUserN8NConfig> | null>(null)

  const refresh = useCallback(() => {
    if (userId) {
      setConfig(getUserN8NConfig(userId))
    } else {
      setConfig(null)
    }
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const workflowTag = useMemo(() => {
    if (!userId) return null
    return getUserWorkflowTag(userId)
  }, [userId])

  const isPersonalInstance = useMemo(() => {
    return config?.mode === "personal" && !!config.personalInstance?.baseUrl
  }, [config])

  return {
    config,
    workflowTag,
    isPersonalInstance,
    refresh,
  }
}

// ============ GitLab Hooks ============

interface UseGitLabProjectsResult {
  projects: GitLabProject[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useGitLabProjects(autoFetch = true): UseGitLabProjectsResult {
  const [projects, setProjects] = useState<GitLabProject[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await gitlabApi.getProjects(50)
      setProjects(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch projects"))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (autoFetch) {
      refresh()
    }
  }, [autoFetch, refresh])

  return { projects, isLoading, error, refresh }
}

interface UseGitLabCommitsResult {
  commits: GitLabCommit[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  hasMore: boolean
}

export function useGitLabCommits(
  projectId: number | string | null,
  options?: { ref?: string; perPage?: number }
): UseGitLabCommitsResult {
  const [commits, setCommits] = useState<GitLabCommit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const perPage = options?.perPage || 20

  const refresh = useCallback(async () => {
    if (!projectId) return
    setIsLoading(true)
    setError(null)
    setPage(1)
    try {
      const data = await gitlabApi.getCommits(projectId, {
        ref: options?.ref,
        perPage,
        page: 1
      })
      setCommits(data)
      setHasMore(data.length === perPage)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch commits"))
      setCommits([])
    } finally {
      setIsLoading(false)
    }
  }, [projectId, options?.ref, perPage])

  const loadMore = useCallback(async () => {
    if (!projectId || isLoading || !hasMore) return
    setIsLoading(true)
    try {
      const nextPage = page + 1
      const data = await gitlabApi.getCommits(projectId, {
        ref: options?.ref,
        perPage,
        page: nextPage
      })
      setCommits(prev => [...prev, ...data])
      setPage(nextPage)
      setHasMore(data.length === perPage)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load more commits"))
    } finally {
      setIsLoading(false)
    }
  }, [projectId, options?.ref, perPage, page, isLoading, hasMore])

  useEffect(() => {
    if (projectId) {
      refresh()
    } else {
      setCommits([])
    }
  }, [projectId, refresh])

  return { commits, isLoading, error, refresh, loadMore, hasMore }
}

interface UseGitLabBranchesResult {
  branches: GitLabBranch[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useGitLabBranches(projectId: number | string | null): UseGitLabBranchesResult {
  const [branches, setBranches] = useState<GitLabBranch[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!projectId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await gitlabApi.getBranches(projectId)
      setBranches(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch branches"))
      setBranches([])
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (projectId) {
      refresh()
    } else {
      setBranches([])
    }
  }, [projectId, refresh])

  return { branches, isLoading, error, refresh }
}

interface UseGitLabTreeResult {
  tree: GitLabTreeItem[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
  navigateTo: (path: string) => void
  currentPath: string
}

export function useGitLabTree(
  projectId: number | string | null,
  options?: { ref?: string }
): UseGitLabTreeResult {
  const [tree, setTree] = useState<GitLabTreeItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [currentPath, setCurrentPath] = useState("")

  const refresh = useCallback(async () => {
    if (!projectId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await gitlabApi.getTree(projectId, {
        path: currentPath || undefined,
        ref: options?.ref
      })
      setTree(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch file tree"))
      setTree([])
    } finally {
      setIsLoading(false)
    }
  }, [projectId, currentPath, options?.ref])

  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path)
  }, [])

  useEffect(() => {
    if (projectId) {
      refresh()
    } else {
      setTree([])
    }
  }, [projectId, currentPath, refresh])

  return { tree, isLoading, error, refresh, navigateTo, currentPath }
}

interface UseGitLabMergeRequestsResult {
  mergeRequests: GitLabMergeRequest[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useGitLabMergeRequests(
  projectId: number | string | null,
  state?: "opened" | "closed" | "merged" | "all"
): UseGitLabMergeRequestsResult {
  const [mergeRequests, setMergeRequests] = useState<GitLabMergeRequest[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!projectId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await gitlabApi.getMergeRequests(projectId, state)
      setMergeRequests(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch merge requests"))
      setMergeRequests([])
    } finally {
      setIsLoading(false)
    }
  }, [projectId, state])

  useEffect(() => {
    if (projectId) {
      refresh()
    } else {
      setMergeRequests([])
    }
  }, [projectId, refresh])

  return { mergeRequests, isLoading, error, refresh }
}

interface UseGitLabPipelinesResult {
  pipelines: GitLabPipeline[]
  latestPipeline: GitLabPipeline | null
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useGitLabPipelines(projectId: number | string | null): UseGitLabPipelinesResult {
  const [pipelines, setPipelines] = useState<GitLabPipeline[]>([])
  const [latestPipeline, setLatestPipeline] = useState<GitLabPipeline | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!projectId) return
    setIsLoading(true)
    setError(null)
    try {
      const [pipelineData, latest] = await Promise.all([
        gitlabApi.getPipelines(projectId),
        gitlabApi.getLatestPipeline(projectId)
      ])
      setPipelines(pipelineData)
      setLatestPipeline(latest)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch pipelines"))
      setPipelines([])
      setLatestPipeline(null)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (projectId) {
      refresh()
    } else {
      setPipelines([])
      setLatestPipeline(null)
    }
  }, [projectId, refresh])

  return { pipelines, latestPipeline, isLoading, error, refresh }
}
