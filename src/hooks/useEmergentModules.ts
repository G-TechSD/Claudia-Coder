"use client"

import { useState, useEffect, useCallback } from "react"
import { StoredModule } from "@/lib/emergent-modules/types"

interface UseEmergentModulesResult {
  modules: StoredModule[]
  activeModules: StoredModule[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Hook to fetch and manage emergent modules
 */
export function useEmergentModules(): UseEmergentModulesResult {
  const [modules, setModules] = useState<StoredModule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchModules = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/emergent-modules")
      if (!response.ok) {
        throw new Error("Failed to fetch modules")
      }

      const data = await response.json()
      setModules(data.modules || [])
    } catch (err) {
      console.error("[useEmergentModules] Error:", err)
      setError(err instanceof Error ? err.message : "Failed to load modules")
      setModules([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchModules()
  }, [fetchModules])

  const activeModules = modules.filter((m) => m.status === "active")

  return {
    modules,
    activeModules,
    isLoading,
    error,
    refresh: fetchModules,
  }
}

/**
 * Map icon names to Lucide icon components
 * This allows modules to specify icons by name
 */
export function getIconComponent(iconName: string): React.ElementType | null {
  // Dynamic import would be ideal, but for now we'll use a static map
  // of commonly used icons. Modules can use these.
  const iconMap: Record<string, React.ElementType> = {}

  // We'll dynamically import Lucide icons
  // For now, return null and let the component handle it
  return iconMap[iconName] || null
}
