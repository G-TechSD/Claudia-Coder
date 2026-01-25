"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { getRecommendedModel, getRecommendedModels } from "@/lib/ai/providers"
import { getGlobalSettings } from "@/lib/settings/global-settings"

export interface AvailableModel {
  id: string
  name: string
  provider: string
  type: "local" | "cloud" | "cli"
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
      // Get settings from global settings to pass to API
      // Note: API keys are now stored server-side, so we just pass enabled providers
      // The server will check for keys in DB, then fall back to env vars
      const globalSettings = getGlobalSettings()
      const enabledLocalServers = globalSettings.localServers.filter(s => s.enabled)
      const enabledCloudProviders = globalSettings.cloudProviders.filter(p => p.enabled)

      // Use POST to pass cloud provider API keys securely (not in URL)
      const body: Record<string, unknown> = {}
      if (forceRefresh) body.refresh = true
      if (enabledLocalServers.length > 0) {
        body.localServers = enabledLocalServers.map(s => ({
          id: s.id,
          name: s.name,
          type: s.type,
          baseUrl: s.baseUrl
        }))
      }
      if (enabledCloudProviders.length > 0) {
        body.cloudProviders = enabledCloudProviders.map(p => ({
          provider: p.provider,
          apiKey: p.apiKey
        }))
      }

      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

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
    // Include both cloud and CLI providers (all remote/non-local models)
    return models.filter(m => m.type === "cloud" || m.type === "cli")
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
    // Get settings from global settings to pass to API
    // Note: API keys are now stored server-side
    const globalSettings = getGlobalSettings()
    const enabledLocalServers = globalSettings.localServers.filter(s => s.enabled)
    const enabledCloudProviders = globalSettings.cloudProviders.filter(p => p.enabled)

    // Build request body for POST
    const body: Record<string, unknown> = {}
    if (provider) body.provider = provider
    if (refresh) body.refresh = true

    if (enabledLocalServers.length > 0) {
      body.localServers = enabledLocalServers.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        baseUrl: s.baseUrl
      }))
    }

    if (enabledCloudProviders.length > 0) {
      body.cloudProviders = enabledCloudProviders.map(p => ({
        provider: p.provider,
        apiKey: p.apiKey
      }))
    }

    const response = await fetch("/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
    if (!response.ok) return []

    const data = await response.json()
    return data.models || []
  } catch {
    return []
  }
}
