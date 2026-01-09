/**
 * Hook for user-scoped projects
 * Provides projects filtered by the current user
 */

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import {
  getAllProjects,
  createProject as createProjectBase,
  updateProject,
  trashProject,
  restoreProject,
  permanentlyDeleteProject,
  getProject,
  getTrashedProjects as getTrashedProjectsBase,
} from "@/lib/data/projects"
import type { Project, ProjectFilter } from "@/lib/data/types"

/**
 * Hook that provides user-scoped project management
 * Projects are automatically filtered by the current user
 */
export function useUserProjects() {
  const { user, isLoading: authLoading } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load projects for current user
  const loadProjects = useCallback(() => {
    if (authLoading) return

    try {
      const userProjects = getAllProjects({
        userId: user?.id,
        includeTrashed: false,
      })
      setProjects(userProjects)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects")
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, authLoading])

  // Reload projects when user changes
  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Create a new project with user ID
  const createProject = useCallback(
    (data: Omit<Project, "id" | "createdAt" | "updatedAt" | "userId">) => {
      if (!user) {
        setError("Must be logged in to create projects")
        return null
      }

      try {
        const project = createProjectBase({
          ...data,
          userId: user.id,
        })
        loadProjects() // Refresh the list
        return project
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create project")
        return null
      }
    },
    [user, loadProjects]
  )

  // Update a project (with ownership check)
  const update = useCallback(
    (id: string, updates: Partial<Project>) => {
      const project = getProject(id)

      // Check ownership
      if (project && user && project.userId && project.userId !== user.id) {
        if (!project.collaboratorIds?.includes(user.id)) {
          setError("You don't have permission to edit this project")
          return null
        }
      }

      try {
        const updated = updateProject(id, updates)
        loadProjects()
        return updated
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update project")
        return null
      }
    },
    [user, loadProjects]
  )

  // Trash a project
  const trash = useCallback(
    (id: string) => {
      try {
        const result = trashProject(id)
        loadProjects()
        return result
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to trash project")
        return null
      }
    },
    [loadProjects]
  )

  // Restore a project from trash
  const restore = useCallback(
    (id: string) => {
      try {
        const result = restoreProject(id)
        loadProjects()
        return result
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to restore project")
        return null
      }
    },
    [loadProjects]
  )

  // Permanently delete a project
  const permanentDelete = useCallback(
    (id: string) => {
      try {
        const result = permanentlyDeleteProject(id)
        loadProjects()
        return result
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete project")
        return false
      }
    },
    [loadProjects]
  )

  // Get trashed projects for current user
  const getTrashedProjects = useCallback(() => {
    const allTrashed = getTrashedProjectsBase()
    if (!user) return []

    return allTrashed.filter(
      (p) =>
        p.userId === user.id ||
        p.isPublic === true ||
        !p.userId // Legacy projects
    )
  }, [user])

  return {
    projects,
    isLoading: isLoading || authLoading,
    error,
    userId: user?.id,
    createProject,
    updateProject: update,
    trashProject: trash,
    restoreProject: restore,
    permanentlyDeleteProject: permanentDelete,
    getTrashedProjects,
    refreshProjects: loadProjects,
  }
}

/**
 * Hook to check if current user owns a project
 */
export function useProjectOwnership(projectId: string) {
  const { user } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [isCollaborator, setIsCollaborator] = useState(false)
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    if (!projectId || !user) {
      setIsOwner(false)
      setIsCollaborator(false)
      setCanEdit(false)
      return
    }

    const p = getProject(projectId)
    setProject(p)

    if (p) {
      const isUserOwner = p.userId === user.id || !p.userId // Legacy projects are editable
      const isUserCollaborator = p.collaboratorIds?.includes(user.id) || false

      setIsOwner(isUserOwner)
      setIsCollaborator(isUserCollaborator)
      setCanEdit(isUserOwner || isUserCollaborator)
    }
  }, [projectId, user])

  return {
    project,
    isOwner,
    isCollaborator,
    canEdit,
    userId: user?.id,
  }
}
