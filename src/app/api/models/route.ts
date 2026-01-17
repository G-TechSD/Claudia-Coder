/**
 * Dynamic Model Fetching API
 * Fetches available models from each provider's API
 */

import { NextRequest, NextResponse } from "next/server"

export interface FetchedModel {
  id: string
  name: string
  provider: string
  type: "local" | "cloud"
  contextWindow?: number
  maxOutput?: number
  created?: string
  description?: string
  capabilities?: string[]
  pricing?: {
    input?: number   // per 1M tokens
    output?: number  // per 1M tokens
  }
}

interface CachedModels {
  models: FetchedModel[]
  fetchedAt: number
  ttl: number // ms
}

// In-memory cache (per-server instance)
const modelCache: Record<string, CachedModels> = {}
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch models from Anthropic API
 * Endpoint: GET https://api.anthropic.com/v1/models
 */
async function fetchAnthropicModels(apiKey?: string): Promise<FetchedModel[]> {
  const key = apiKey || process.env.ANTHROPIC_API_KEY
  if (!key) return []

  try {
    const response = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      }
    })

    if (!response.ok) {
      console.error("Anthropic API error:", response.status)
      return []
    }

    const data = await response.json()

    return (data.data || []).map((model: {
      id: string
      display_name?: string
      created_at?: string
    }) => ({
      id: model.id,
      name: model.display_name || model.id,
      provider: "anthropic",
      type: "cloud" as const,
      created: model.created_at,
      // Anthropic doesn't return pricing in the API, we'd need to maintain that separately
      contextWindow: model.id.includes("opus") ? 200000 : 200000,
      maxOutput: model.id.includes("opus") ? 32000 : 16000
    }))
  } catch (error) {
    console.error("Failed to fetch Anthropic models:", error)
    return []
  }
}

/**
 * Fetch models from OpenAI API
 * Endpoint: GET https://api.openai.com/v1/models
 */
async function fetchOpenAIModels(apiKey?: string): Promise<FetchedModel[]> {
  const key = apiKey || process.env.OPENAI_API_KEY
  if (!key) return []

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        "Authorization": `Bearer ${key}`
      }
    })

    if (!response.ok) {
      console.error("OpenAI API error:", response.status)
      return []
    }

    const data = await response.json()

    // Filter to only include chat-capable models
    const chatModels = (data.data || []).filter((model: { id: string }) => {
      const id = model.id.toLowerCase()
      return (
        id.startsWith("gpt-") ||
        id.startsWith("o1") ||
        id.startsWith("o3") ||
        id.startsWith("o4") ||
        id.includes("chatgpt")
      ) && !id.includes("instruct") && !id.includes("vision") && !id.includes("audio")
    })

    return chatModels.map((model: {
      id: string
      created?: number
      owned_by?: string
    }) => ({
      id: model.id,
      name: formatOpenAIModelName(model.id),
      provider: "openai",
      type: "cloud" as const,
      created: model.created ? new Date(model.created * 1000).toISOString() : undefined,
      contextWindow: getOpenAIContextWindow(model.id),
      maxOutput: getOpenAIMaxOutput(model.id)
    }))
  } catch (error) {
    console.error("Failed to fetch OpenAI models:", error)
    return []
  }
}

function formatOpenAIModelName(id: string): string {
  // Convert model IDs to human-readable names
  const parts = id.split("-")
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ")
}

function getOpenAIContextWindow(id: string): number {
  if (id.includes("o1") || id.includes("o3") || id.includes("o4")) return 200000
  if (id.includes("gpt-4o")) return 128000
  if (id.includes("gpt-4-turbo")) return 128000
  if (id.includes("gpt-4")) return 128000
  if (id.includes("gpt-5")) return 256000
  return 128000
}

function getOpenAIMaxOutput(id: string): number {
  if (id.includes("o1") || id.includes("o3") || id.includes("o4")) return 100000
  return 16384
}

/**
 * Fetch models from Google Gemini API
 * Endpoint: GET https://generativelanguage.googleapis.com/v1beta/models
 */
async function fetchGoogleModels(apiKey?: string): Promise<FetchedModel[]> {
  const key = apiKey || process.env.GOOGLE_AI_API_KEY
  if (!key) return []

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
    )

    if (!response.ok) {
      console.error("Google API error:", response.status)
      return []
    }

    const data = await response.json()

    // Filter to models that support generateContent
    const chatModels = (data.models || []).filter((model: {
      supportedGenerationMethods?: string[]
    }) => {
      return model.supportedGenerationMethods?.includes("generateContent")
    })

    return chatModels.map((model: {
      name: string
      displayName?: string
      description?: string
      inputTokenLimit?: number
      outputTokenLimit?: number
    }) => ({
      id: model.name.replace("models/", ""),
      name: model.displayName || model.name.replace("models/", ""),
      provider: "google",
      type: "cloud" as const,
      description: model.description,
      contextWindow: model.inputTokenLimit,
      maxOutput: model.outputTokenLimit
    }))
  } catch (error) {
    console.error("Failed to fetch Google models:", error)
    return []
  }
}

/**
 * Fetch models from LM Studio
 * Endpoint: GET http://{baseUrl}/v1/models
 */
async function fetchLMStudioModels(baseUrl: string): Promise<FetchedModel[]> {
  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      signal: AbortSignal.timeout(3000)
    })

    if (!response.ok) return []

    const data = await response.json()

    // Filter out embedding models - they cannot be used for chat/generation
    return (data.data || [])
      .filter((model: { id: string; type?: string }) => {
        const id = model.id.toLowerCase()
        return !id.includes('embed') && !id.includes('embedding') && model.type !== 'embedding'
      })
      .map((model: { id: string }) => ({
        id: model.id,
        name: model.id,
        provider: "lmstudio",
        type: "local" as const
      }))
  } catch {
    return []
  }
}

/**
 * Fetch models from Ollama
 * Endpoint: GET http://{baseUrl}/api/tags
 */
async function fetchOllamaModels(baseUrl: string): Promise<FetchedModel[]> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000)
    })

    if (!response.ok) return []

    const data = await response.json()

    // Filter out embedding models - they cannot be used for chat/generation
    return (data.models || [])
      .filter((model: { name: string }) => {
        const name = model.name.toLowerCase()
        return !name.includes('embed') && !name.includes('embedding')
      })
      .map((model: {
        name: string
        details?: { parameter_size?: string }
      }) => ({
        id: model.name,
        name: model.name,
        provider: "ollama",
        type: "local" as const,
        description: model.details?.parameter_size
      }))
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const provider = searchParams.get("provider")
  const refresh = searchParams.get("refresh") === "true"

  // Check cache
  const cacheKey = provider || "all"
  const cached = modelCache[cacheKey]
  if (!refresh && cached && Date.now() - cached.fetchedAt < cached.ttl) {
    return NextResponse.json({
      models: cached.models,
      cached: true,
      fetchedAt: new Date(cached.fetchedAt).toISOString()
    })
  }

  const allModels: FetchedModel[] = []

  // Fetch based on provider filter
  if (!provider || provider === "anthropic") {
    const models = await fetchAnthropicModels()
    allModels.push(...models)
  }

  if (!provider || provider === "openai") {
    const models = await fetchOpenAIModels()
    allModels.push(...models)
  }

  if (!provider || provider === "google") {
    const models = await fetchGoogleModels()
    allModels.push(...models)
  }

  // Local providers - get from env or request params
  if (!provider || provider === "lmstudio") {
    const lmStudioUrls = [
      process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_1,
      process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_2,
      searchParams.get("lmstudio_url")
    ].filter(Boolean) as string[]

    for (const url of lmStudioUrls) {
      const models = await fetchLMStudioModels(url)
      // Tag models with their source server
      allModels.push(...models.map(m => ({
        ...m,
        description: url
      })))
    }
  }

  if (!provider || provider === "ollama") {
    const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434"
    const models = await fetchOllamaModels(ollamaUrl)
    allModels.push(...models)
  }

  // Sort: local first, then by provider, then by name
  allModels.sort((a, b) => {
    if (a.type !== b.type) return a.type === "local" ? -1 : 1
    if (a.provider !== b.provider) return a.provider.localeCompare(b.provider)
    return a.name.localeCompare(b.name)
  })

  // Update cache
  modelCache[cacheKey] = {
    models: allModels,
    fetchedAt: Date.now(),
    ttl: CACHE_TTL
  }

  return NextResponse.json({
    models: allModels,
    cached: false,
    fetchedAt: new Date().toISOString(),
    counts: {
      total: allModels.length,
      local: allModels.filter(m => m.type === "local").length,
      cloud: allModels.filter(m => m.type === "cloud").length,
      byProvider: {
        anthropic: allModels.filter(m => m.provider === "anthropic").length,
        openai: allModels.filter(m => m.provider === "openai").length,
        google: allModels.filter(m => m.provider === "google").length,
        lmstudio: allModels.filter(m => m.provider === "lmstudio").length,
        ollama: allModels.filter(m => m.provider === "ollama").length
      }
    }
  })
}
