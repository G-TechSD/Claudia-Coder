/**
 * useProjects - React hook for project data with server sync
 *
 * This hook ensures projects are synced from the server, not just localStorage.
 * It provides:
 * 1. Immediate cache data for fast initial render
 * 2. Auto-fetch from server on mount
 * 3. Automatic cache updates when server data arrives
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import { Project } from "@/lib/data/types"
import {
  getAllProjects,
  fetchProjects,
  getEffectiveWorkingDirectory,
} from "@/lib/data/projects"

interface UseProjectsOptions {
  userId?: string
  isAdmin?: boolean
  includeTrashed?: boolean
  autoFetch?: boolean  // default true
}

interface UseProjectsResult {
  projects: Project[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  getProjectById: (id: string) => Project | undefined
  getProjectWorkingDir: (project: Project) => string
}

/**
 * Hook to get projects with automatic server sync
 */
export function useProjects(options: UseProjectsOptions = {}): UseProjectsResult {
  const { userId, isAdmin, includeTrashed, autoFetch = true } = options

  // Start with cached data for immediate render
  const [projects, setProjects] = useState<Project[]>(() => {
    if (!userId) return []
    return getAllProjects({ userId, isAdmin, includeTrashed })
  })
  const [loading, setLoading] = useState(autoFetch)
  const [error, setError] = useState<Error | null>(null)

  // Fetch fresh data from server
  const refetch = useCallback(async () => {
    if (!userId) {
      setProjects([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const serverProjects = await fetchProjects(userId, { includeTrashed })
      setProjects(serverProjects)
    } catch (err) {
      console.error("[useProjects] Failed to fetch from server:", err)
      setError(err instanceof Error ? err : new Error("Failed to fetch projects"))
      // Keep cached data on error
    } finally {
      setLoading(false)
    }
  }, [userId, includeTrashed])

  // Auto-fetch on mount and when userId changes
  useEffect(() => {
    if (autoFetch && userId) {
      refetch()
    }
  }, [autoFetch, userId, refetch])

  // Update projects when userId changes (from cache first)
  useEffect(() => {
    if (userId) {
      const cached = getAllProjects({ userId, isAdmin, includeTrashed })
      setProjects(cached)
    } else {
      setProjects([])
    }
  }, [userId, isAdmin, includeTrashed])

  // Helper to get project by ID
  const getProjectById = useCallback((id: string): Project | undefined => {
    return projects.find(p => p.id === id)
  }, [projects])

  // Helper to get working directory
  const getProjectWorkingDir = useCallback((project: Project): string => {
    return getEffectiveWorkingDirectory(project)
  }, [])

  // Memoize the result to prevent unnecessary re-renders
  const result = useMemo(() => ({
    projects,
    loading,
    error,
    refetch,
    getProjectById,
    getProjectWorkingDir,
  }), [projects, loading, error, refetch, getProjectById, getProjectWorkingDir])

  return result
}

/**
 * Hook to get user projects for project selectors
 * Returns projects formatted for dropdown/selection use
 */
export function useProjectsForSelector(userId?: string) {
  const { projects, loading, error } = useProjects({
    userId,
    includeTrashed: false,
  })

  const activeProjects = useMemo(() => {
    return projects
      .filter(p => p.status !== "trashed" && p.status !== "archived")
      .sort((a, b) => {
        // Starred first
        if (a.starred && !b.starred) return -1
        if (!a.starred && b.starred) return 1
        // Then by updated date
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })
  }, [projects])

  return { projects: activeProjects, loading, error }
}

export default useProjects
