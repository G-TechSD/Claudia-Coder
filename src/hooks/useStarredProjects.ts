"use client"

import { useState, useEffect, useCallback } from "react"
import type { Project } from "@/lib/data/types"
import { getStarredProjects, toggleProjectStar, getAllProjects } from "@/lib/data/projects"
import { useAuth } from "@/components/auth/auth-provider"

const STORAGE_EVENT_KEY = "claudia_projects_starred_update"

/**
 * Hook for managing starred/pinned projects
 * Provides starred projects list and toggle functionality with cross-component sync
 */
export function useStarredProjects() {
  const { user } = useAuth()
  const userId = user?.id
  const [starredProjects, setStarredProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load starred projects
  const loadStarred = useCallback(() => {
    if (!userId) {
      setStarredProjects([])
      setIsLoading(false)
      return
    }
    const starred = getStarredProjects(userId)
    setStarredProjects(starred)
    setIsLoading(false)
  }, [userId])

  // Initial load
  useEffect(() => {
    loadStarred()
  }, [loadStarred])

  // Listen for storage events (cross-tab sync and custom events)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Listen for both legacy and user-scoped storage keys
      if (e.key === "claudia_projects" ||
          (userId && e.key === `claudia_user_${userId}_projects`) ||
          e.key?.startsWith("claudia_user_") && e.key?.endsWith("_projects")) {
        loadStarred()
      }
    }

    const handleCustomEvent = () => {
      loadStarred()
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener(STORAGE_EVENT_KEY, handleCustomEvent)
    // Also listen for user storage changes
    window.addEventListener("claudia_user_storage_change", handleCustomEvent)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener(STORAGE_EVENT_KEY, handleCustomEvent)
      window.removeEventListener("claudia_user_storage_change", handleCustomEvent)
    }
  }, [loadStarred, userId])

  // Toggle star status for a project
  const toggleStar = useCallback((projectId: string) => {
    const updated = toggleProjectStar(projectId, userId)
    if (updated) {
      loadStarred()
      // Dispatch custom event for same-window components
      window.dispatchEvent(new CustomEvent(STORAGE_EVENT_KEY))
    }
    return updated
  }, [loadStarred, userId])

  // Check if a project is starred
  const isStarred = useCallback((projectId: string) => {
    return starredProjects.some(p => p.id === projectId)
  }, [starredProjects])

  return {
    starredProjects,
    isLoading,
    toggleStar,
    isStarred,
    refresh: loadStarred
  }
}
