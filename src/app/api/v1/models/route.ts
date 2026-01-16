/**
 * OpenAI-compatible Models API
 * GET /api/v1/models
 *
 * Returns models from all configured providers in OpenAI format
 * Compatible with OpenWebUI and other OpenAI-compatible clients
 */

import { NextResponse } from "next/server"

interface OpenAIModel {
  id: string
  object: "model"
  created: number
  owned_by: string
}

interface OpenAIModelsResponse {
  object: "list"
  data: OpenAIModel[]
}

// Cache for models
let modelCache: { models: OpenAIModel[]; fetchedAt: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch models from Anthropic API
 */
async function fetchAnthropicModels(): Promise<OpenAIModel[]> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return []

  try {
    const response = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) return []

    const data = await response.json()
    return (data.data || []).map((model: { id: string; created_at?: string }) => ({
      id: model.id,
      object: "model" as const,
      created: model.created_at ? Math.floor(new Date(model.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000),
      owned_by: "anthropic"
    }))
  } catch {
    return []
  }
}

/**
 * Fetch models from OpenAI API
 */
async function fetchOpenAIModels(): Promise<OpenAIModel[]> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return []

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { "Authorization": `Bearer ${key}` },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) return []

    const data = await response.json()

    // Filter to chat-capable models
    const chatModels = (data.data || []).filter((model: { id: string }) => {
      const id = model.id.toLowerCase()
      return (
        id.startsWith("gpt-") ||
        id.startsWith("o1") ||
        id.startsWith("o3") ||
        id.startsWith("o4") ||
        id.includes("chatgpt")
      ) && !id.includes("instruct") && !id.includes("audio")
    })

    return chatModels.map((model: { id: string; created?: number; owned_by?: string }) => ({
      id: model.id,
      object: "model" as const,
      created: model.created || Math.floor(Date.now() / 1000),
      owned_by: model.owned_by || "openai"
    }))
  } catch {
    return []
  }
}

/**
 * Fetch models from Google Gemini API
 */
async function fetchGoogleModels(): Promise<OpenAIModel[]> {
  const key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!key) return []

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      { signal: AbortSignal.timeout(10000) }
    )

    if (!response.ok) return []

    const data = await response.json()

    // Filter to chat-capable models
    const chatModels = (data.models || []).filter((model: {
      supportedGenerationMethods?: string[]
      name: string
    }) => {
      return model.supportedGenerationMethods?.includes("generateContent") &&
             model.name.includes("gemini")
    })

    return chatModels.map((model: { name: string }) => ({
      // Prefix with google- for routing
      id: `google-${model.name.replace("models/", "")}`,
      object: "model" as const,
      created: Math.floor(Date.now() / 1000),
      owned_by: "google"
    }))
  } catch {
    return []
  }
}

/**
 * Fetch models from LM Studio
 */
async function fetchLMStudioModels(baseUrl: string, serverName: string): Promise<OpenAIModel[]> {
  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      signal: AbortSignal.timeout(3000)
    })

    if (!response.ok) return []

    const data = await response.json()

    // Filter out embedding models
    return (data.data || [])
      .filter((model: { id: string; type?: string }) => {
        const id = model.id.toLowerCase()
        return !id.includes('embed') && !id.includes('embedding') && model.type !== 'embedding'
      })
      .map((model: { id: string; created?: number }) => ({
        // Prefix with lmstudio- for routing
        id: `lmstudio-${serverName.toLowerCase()}-${model.id}`,
        object: "model" as const,
        created: model.created || Math.floor(Date.now() / 1000),
        owned_by: `lmstudio-${serverName.toLowerCase()}`
      }))
  } catch {
    return []
  }
}

/**
 * Fetch models from Ollama
 */
async function fetchOllamaModels(baseUrl: string): Promise<OpenAIModel[]> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000)
    })

    if (!response.ok) return []

    const data = await response.json()

    // Filter out embedding models
    return (data.models || [])
      .filter((model: { name: string }) => {
        const name = model.name.toLowerCase()
        return !name.includes('embed') && !name.includes('embedding')
      })
      .map((model: { name: string; modified_at?: string }) => ({
        // Prefix with ollama- for routing
        id: `ollama-${model.name}`,
        object: "model" as const,
        created: model.modified_at
          ? Math.floor(new Date(model.modified_at).getTime() / 1000)
          : Math.floor(Date.now() / 1000),
        owned_by: "ollama"
      }))
  } catch {
    return []
  }
}

/**
 * Fetch all models from all providers
 */
async function fetchAllModels(): Promise<OpenAIModel[]> {
  const allModels: OpenAIModel[] = []

  // Fetch from all providers in parallel
  const [anthropicModels, openaiModels, googleModels] = await Promise.all([
    fetchAnthropicModels(),
    fetchOpenAIModels(),
    fetchGoogleModels()
  ])

  allModels.push(...anthropicModels, ...openaiModels, ...googleModels)

  // Local providers
  const lmStudioBeast = process.env.NEXT_PUBLIC_LMSTUDIO_BEAST
  const lmStudioBedroom = process.env.NEXT_PUBLIC_LMSTUDIO_BEDROOM
  const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL

  const localPromises: Promise<OpenAIModel[]>[] = []

  if (lmStudioBeast) {
    localPromises.push(fetchLMStudioModels(lmStudioBeast, "beast"))
  }
  if (lmStudioBedroom) {
    localPromises.push(fetchLMStudioModels(lmStudioBedroom, "bedroom"))
  }
  if (ollamaUrl) {
    localPromises.push(fetchOllamaModels(ollamaUrl))
  }

  const localResults = await Promise.all(localPromises)
  for (const models of localResults) {
    allModels.push(...models)
  }

  // Sort: local models first, then by provider, then by id
  allModels.sort((a, b) => {
    const aIsLocal = a.owned_by.startsWith("lmstudio") || a.owned_by === "ollama"
    const bIsLocal = b.owned_by.startsWith("lmstudio") || b.owned_by === "ollama"

    if (aIsLocal !== bIsLocal) return aIsLocal ? -1 : 1
    if (a.owned_by !== b.owned_by) return a.owned_by.localeCompare(b.owned_by)
    return a.id.localeCompare(b.id)
  })

  return allModels
}

export async function GET(): Promise<NextResponse<OpenAIModelsResponse>> {
  // Check cache
  if (modelCache && Date.now() - modelCache.fetchedAt < CACHE_TTL) {
    return NextResponse.json({
      object: "list",
      data: modelCache.models
    })
  }

  const models = await fetchAllModels()

  // Update cache
  modelCache = {
    models,
    fetchedAt: Date.now()
  }

  return NextResponse.json({
    object: "list",
    data: models
  })
}
