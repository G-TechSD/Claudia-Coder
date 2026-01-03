"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { getRecommendedModel, getRecommendedModels } from "@/lib/ai/providers"

export interface AvailableModel {
  id: string
  name: string
  provider: string
  type: "local" | "cloud"
  contextWindow?: number
  maxOutput?: number
  description?: string
  pricing?: {
    input?: number
    output?: number
  }
}

interface UseAvailableModelsResult {
  models: AvailableModel[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  getModelsByProvider: (provider: string) => AvailableModel[]
  getLocalModels: () => AvailableModel[]
  getCloudModels: () => AvailableModel[]
  getRecommendedForProvider: (provider: string) => AvailableModel | undefined
  recommendedModels: Record<string, AvailableModel | undefined>
}

export function useAvailableModels(): UseAvailableModelsResult {
  const [models, setModels] = useState<AvailableModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchModels = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError(null)

    try {
      const url = `/api/models${forceRefresh ? "?refresh=true" : ""}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`)
      }

      const data = await response.json()
      setModels(data.models || [])
    } catch (err) {
      console.error("Error fetching models:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch models")
      // Keep existing models on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  const refresh = useCallback(async () => {
    await fetchModels(true)
  }, [fetchModels])

  const getModelsByProvider = useCallback((provider: string) => {
    return models.filter(m => m.provider === provider)
  }, [models])

  const getLocalModels = useCallback(() => {
    return models.filter(m => m.type === "local")
  }, [models])

  const getCloudModels = useCallback(() => {
    return models.filter(m => m.type === "cloud")
  }, [models])

  const getRecommendedForProvider = useCallback((provider: string): AvailableModel | undefined => {
    const recommended = getRecommendedModel(models, provider)
    if (!recommended) return undefined
    return models.find(m => m.id === recommended.id && m.provider === recommended.provider)
  }, [models])

  const recommendedModels = useMemo(() => {
    const recs = getRecommendedModels(models)
    const result: Record<string, AvailableModel | undefined> = {}
    for (const [provider, rec] of Object.entries(recs)) {
      if (rec) {
        result[provider] = models.find(m => m.id === rec.id && m.provider === rec.provider)
      }
    }
    return result
  }, [models])

  return {
    models,
    loading,
    error,
    refresh,
    getModelsByProvider,
    getLocalModels,
    getCloudModels,
    getRecommendedForProvider,
    recommendedModels
  }
}

// Standalone function to fetch models (for server components or outside React)
export async function fetchAvailableModels(
  provider?: string,
  refresh = false
): Promise<AvailableModel[]> {
  try {
    const params = new URLSearchParams()
    if (provider) params.set("provider", provider)
    if (refresh) params.set("refresh", "true")

    const response = await fetch(`/api/models?${params}`)
    if (!response.ok) return []

    const data = await response.json()
    return data.models || []
  } catch {
    return []
  }
}
