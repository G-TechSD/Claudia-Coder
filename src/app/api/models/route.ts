/**
 * Dynamic Model Fetching API
 * Fetches available models from each provider's API
 *
 * API keys are fetched from (in order of priority):
 * 1. Server-side settings database (for authenticated users)
 * 2. Request body/query params (for backwards compatibility)
 * 3. Environment variables
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/auth/api-helpers"
import { getUserApiKeysFromDb } from "@/lib/settings/settings-db"

export interface FetchedModel {
  id: string
  name: string
  provider: string
  type: "local" | "cloud" | "cli"
  contextWindow?: number
  maxOutput?: number
  created?: string
  description?: string
  capabilities?: string[]
  pricing?: {
    input?: number   // per 1M tokens
    output?: number  // per 1M tokens
  }
  // Server info for local models
  serverId?: string
  serverUrl?: string
  // CLI-specific flags
  usesCli?: boolean
  requiresApiKey?: boolean
}

interface CachedModels {
  models: FetchedModel[]
  fetchedAt: number
  ttl: number // ms
}

// In-memory cache (per-server instance)
const modelCache: Record<string, CachedModels> = {}
const CACHE_TTL = 1 * 60 * 1000 // 1 minute (reduced for fresher data)

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
  console.log(`[OpenAI] Attempting fetch with key: ${key ? key.substring(0, 10) + "..." : "NO KEY"}`)
  if (!key) return []

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        "Authorization": `Bearer ${key}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      console.error("OpenAI API error:", response.status, errorText)
      return []
    }

    const data = await response.json()

    // Get all models from API response
    const allModels = data.data || []
    console.log(`[OpenAI API] Returned ${allModels.length} total models:`, allModels.map((m: {id: string}) => m.id))

    // Filter to only include chat-capable models
    // Be very permissive - better to show too many than miss important ones
    const chatModels = allModels.filter((model: { id: string }) => {
      const id = model.id.toLowerCase()

      // Hard exclusions - definitely not chat models
      const isExcluded = (
        id.includes("embed") ||
        id.includes("whisper") ||
        id.includes("tts") ||
        id.includes("dall-e") ||
        id.includes("moderation") ||
        id.includes("audio") ||
        id.includes("realtime") ||
        id.includes("transcri") ||
        id.includes("babbage") ||  // Old completion models
        id.includes("davinci") ||  // Old completion models (except gpt-4-davinci)
        id.includes("curie") ||    // Old completion models
        id.includes("ada")         // Old completion models
      )

      if (isExcluded && !id.startsWith("gpt")) {
        return false
      }

      // Include anything that looks like a chat model
      // This is intentionally very permissive to catch new model names
      const isIncluded = (
        id.startsWith("gpt") ||         // All GPT models (gpt-3, gpt-4, gpt-5, etc.)
        id.startsWith("o1") ||          // o1 reasoning models
        id.startsWith("o3") ||          // o3 reasoning models
        id.startsWith("o4") ||          // o4 reasoning models
        id.startsWith("o5") ||          // future o5 models
        id.includes("chatgpt") ||       // ChatGPT models
        id.includes("turbo") ||         // Turbo variants
        id.includes("preview") ||       // Preview models
        id.includes("chat") ||          // Any chat model
        id.includes("instruct")         // Instruction-tuned models
      )

      return isIncluded
    })

    console.log(`[OpenAI API] Filtered to ${chatModels.length} chat models:`, chatModels.map((m: {id: string}) => m.id))

    // Store debug info for troubleshooting (temporarily)
    if (typeof global !== "undefined") {
      (global as Record<string, unknown>).openaiDebug = {
        allModelsCount: allModels.length,
        allModelIds: allModels.map((m: {id: string}) => m.id),
        chatModelsCount: chatModels.length,
        chatModelIds: chatModels.map((m: {id: string}) => m.id),
        fetchedAt: new Date().toISOString()
      }
    }

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

// Interface for user-provided local servers from settings
interface LocalServerParam {
  id?: string
  name?: string
  type: "lmstudio" | "ollama" | "custom"
  baseUrl: string
}

// Interface for user-provided cloud provider API keys
interface CloudProviderParam {
  provider: "anthropic" | "openai" | "google"
  apiKey: string
}

// Parse local servers from query param or POST body
function parseLocalServers(param: string | null): LocalServerParam[] {
  if (!param) return []
  try {
    const parsed = JSON.parse(param)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((s): s is LocalServerParam =>
      typeof s === "object" &&
      s !== null &&
      typeof s.baseUrl === "string" &&
      typeof s.type === "string"
    )
  } catch {
    return []
  }
}

// Parse cloud providers from query param or POST body
function parseCloudProviders(param: string | null): CloudProviderParam[] {
  if (!param) return []
  try {
    const parsed = JSON.parse(param)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((p): p is CloudProviderParam =>
      typeof p === "object" &&
      p !== null &&
      typeof p.provider === "string" &&
      typeof p.apiKey === "string"
    )
  } catch {
    return []
  }
}

// Get unique servers by URL (user servers override env servers)
function mergeServers(
  envServers: { url: string; type: "lmstudio" | "ollama" }[],
  userServers: LocalServerParam[]
): LocalServerParam[] {
  const seenUrls = new Set<string>()
  const result: LocalServerParam[] = []

  // User servers take priority
  for (const server of userServers) {
    const normalizedUrl = server.baseUrl.replace(/\/$/, "")
    if (!seenUrls.has(normalizedUrl)) {
      seenUrls.add(normalizedUrl)
      result.push(server)
    }
  }

  // Add env servers that aren't already included
  for (const server of envServers) {
    const normalizedUrl = server.url.replace(/\/$/, "")
    if (!seenUrls.has(normalizedUrl)) {
      seenUrls.add(normalizedUrl)
      result.push({
        baseUrl: server.url,
        type: server.type,
        name: server.type === "ollama" ? "Ollama" : "LM Studio"
      })
    }
  }

  return result
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const provider = searchParams.get("provider")
  const refresh = searchParams.get("refresh") === "true"

  // Parse user-added local servers from query params
  const userLocalServers = parseLocalServers(searchParams.get("localServers"))

  // Parse user cloud provider API keys from query params (for backwards compatibility)
  const cloudProvidersRaw = searchParams.get("cloudProviders")
  const userCloudProviders = parseCloudProviders(cloudProvidersRaw)
  console.log("[Models API] cloudProviders raw:", cloudProvidersRaw?.substring(0, 100))
  console.log("[Models API] parsed providers:", userCloudProviders.map(p => ({ provider: p.provider, hasKey: !!p.apiKey })))

  // Try to get API keys from server-side database (for authenticated users)
  let serverApiKeys: { anthropic?: string; openai?: string; google?: string } | null = null
  try {
    const auth = await verifyApiAuth()
    if (auth?.user?.id) {
      serverApiKeys = getUserApiKeysFromDb(auth.user.id)
    }
  } catch {
    // Not authenticated or error - continue with other sources
  }

  // Build unique cache key that includes local servers and cloud providers
  const serverKey = userLocalServers.map(s => s.baseUrl).sort().join(",")
  const cloudKey = userCloudProviders.map(p => p.provider).sort().join(",")
  const cacheKey = `${provider || "all"}:${serverKey}:${cloudKey}`

  const cached = modelCache[cacheKey]
  if (!refresh && cached && Date.now() - cached.fetchedAt < cached.ttl) {
    return NextResponse.json({
      models: cached.models,
      cached: true,
      fetchedAt: new Date(cached.fetchedAt).toISOString()
    })
  }

  const allModels: FetchedModel[] = []
  const providerStatus: Record<string, "online" | "offline" | "invalid_key" | "no_key"> = {}

  // Helper to get API key from: 1) request params (explicit), 2) server DB, 3) environment
  const getApiKey = (providerName: string): string | undefined => {
    // First priority: Request body/query params (when user is explicitly passing a key)
    // This allows testing new keys before saving them
    const userKey = userCloudProviders.find(p => p.provider === providerName)?.apiKey
    if (userKey) return userKey

    // Second priority: Server-side database (authenticated user's saved keys)
    if (serverApiKeys) {
      switch (providerName) {
        case "anthropic":
          if (serverApiKeys.anthropic) return serverApiKeys.anthropic
          break
        case "openai":
          if (serverApiKeys.openai) return serverApiKeys.openai
          break
        case "google":
          if (serverApiKeys.google) return serverApiKeys.google
          break
      }
    }

    // Fall back to environment variables
    switch (providerName) {
      case "anthropic": return process.env.ANTHROPIC_API_KEY
      case "openai": return process.env.OPENAI_API_KEY
      case "google": return process.env.GOOGLE_AI_API_KEY
      default: return undefined
    }
  }

  // Fetch based on provider filter
  if (!provider || provider === "anthropic") {
    const apiKey = getApiKey("anthropic")
    if (apiKey) {
      const models = await fetchAnthropicModels(apiKey)
      if (models.length > 0) {
        allModels.push(...models)
        providerStatus.anthropic = "online"
      } else {
        providerStatus.anthropic = "offline"
      }
    } else {
      providerStatus.anthropic = "no_key"
    }
  }

  if (!provider || provider === "openai") {
    const apiKey = getApiKey("openai")
    if (apiKey) {
      const models = await fetchOpenAIModels(apiKey)
      if (models.length > 0) {
        allModels.push(...models)
        providerStatus.openai = "online"
      } else {
        providerStatus.openai = "offline"
      }
    } else {
      providerStatus.openai = "no_key"
    }
  }

  if (!provider || provider === "google") {
    const apiKey = getApiKey("google")
    if (apiKey) {
      const models = await fetchGoogleModels(apiKey)
      if (models.length > 0) {
        allModels.push(...models)
        providerStatus.google = "online"
      } else {
        providerStatus.google = "offline"
      }
    } else {
      providerStatus.google = "no_key"
    }
  }

  // Claude Code CLI uses Anthropic models - fetch from Anthropic API and mark as CLI type
  if (!provider || provider === "claude-code") {
    // Try to get Anthropic models for Claude Code (uses same API)
    const anthropicKey = getApiKey("anthropic")
    if (anthropicKey) {
      const anthropicModels = await fetchAnthropicModels(anthropicKey)
      if (anthropicModels.length > 0) {
        // Convert Anthropic models to Claude Code CLI models
        const cliModels = anthropicModels.map(m => ({
          ...m,
          provider: "claude-code" as const,
          type: "cli" as const,
          usesCli: true,
          requiresApiKey: false,
          description: m.name.toLowerCase().includes("opus")
            ? "Most capable - recommended for complex coding"
            : m.name.toLowerCase().includes("sonnet")
            ? "Balanced performance for coding"
            : "Fast - for simpler tasks"
        }))
        allModels.push(...cliModels)
        providerStatus["claude-code"] = "online"
      } else {
        providerStatus["claude-code"] = "offline"
      }
    } else {
      providerStatus["claude-code"] = "no_key"
    }
  }

  // Build list of env-configured local servers
  const envServers: { url: string; type: "lmstudio" | "ollama" }[] = []

  if (!provider || provider === "lmstudio") {
    if (process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_1) {
      envServers.push({ url: process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_1, type: "lmstudio" })
    }
    if (process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_2) {
      envServers.push({ url: process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_2, type: "lmstudio" })
    }
  }

  if (!provider || provider === "ollama") {
    const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL
    if (ollamaUrl) {
      envServers.push({ url: ollamaUrl, type: "ollama" })
    }
  }

  // Merge env servers with user-provided servers (user servers take priority)
  const allLocalServers = mergeServers(envServers, userLocalServers)

  // Fetch models from all local servers in parallel
  const localServerResults = await Promise.all(
    allLocalServers.map(async (server) => {
      const serverType = server.type === "ollama" ? "ollama" : "lmstudio"
      const fetchFn = serverType === "ollama" ? fetchOllamaModels : fetchLMStudioModels

      try {
        const models = await fetchFn(server.baseUrl)
        return {
          server,
          models,
          status: models.length > 0 ? "online" as const : "offline" as const
        }
      } catch {
        return {
          server,
          models: [] as FetchedModel[],
          status: "offline" as const
        }
      }
    })
  )

  // Add models from online local servers
  for (const result of localServerResults) {
    if (result.models.length > 0) {
      // Tag models with their source server
      const taggedModels = result.models.map(m => ({
        ...m,
        description: result.server.name || result.server.baseUrl,
        // Add server info for routing
        serverId: result.server.id,
        serverUrl: result.server.baseUrl
      }))
      allModels.push(...taggedModels)
    }

    // Track status
    const serverKey = result.server.name || result.server.baseUrl
    providerStatus[serverKey] = result.status
  }

  // Sort: local first, then CLI, then cloud - then by provider, then by name
  allModels.sort((a, b) => {
    // Type priority: local > cli > cloud
    const typePriority = { local: 0, cli: 1, cloud: 2 }
    const aTypePriority = typePriority[a.type] ?? 2
    const bTypePriority = typePriority[b.type] ?? 2
    if (aTypePriority !== bTypePriority) return aTypePriority - bTypePriority
    if (a.provider !== b.provider) return a.provider.localeCompare(b.provider)
    return a.name.localeCompare(b.name)
  })

  // Update cache
  modelCache[cacheKey] = {
    models: allModels,
    fetchedAt: Date.now(),
    ttl: CACHE_TTL
  }

  // Include debug info if requested
  const debug = searchParams.get("debug") === "true"
  const openaiDebug = typeof global !== "undefined" ? (global as Record<string, unknown>).openaiDebug : null
  const debugInfo = debug ? {
    cloudProvidersRaw: cloudProvidersRaw?.substring(0, 50),
    parsedProviders: userCloudProviders.map(p => ({ provider: p.provider, keyPrefix: p.apiKey?.substring(0, 10) })),
    serverApiKeys: serverApiKeys ? Object.keys(serverApiKeys).filter(k => (serverApiKeys as Record<string, string>)[k]) : []
  } : null

  return NextResponse.json({
    models: allModels,
    cached: false,
    fetchedAt: new Date().toISOString(),
    providerStatus,
    counts: {
      total: allModels.length,
      local: allModels.filter(m => m.type === "local").length,
      cloud: allModels.filter(m => m.type === "cloud").length,
      cli: allModels.filter(m => m.type === "cli").length,
      byProvider: {
        anthropic: allModels.filter(m => m.provider === "anthropic").length,
        openai: allModels.filter(m => m.provider === "openai").length,
        google: allModels.filter(m => m.provider === "google").length,
        lmstudio: allModels.filter(m => m.provider === "lmstudio").length,
        ollama: allModels.filter(m => m.provider === "ollama").length,
        "claude-code": allModels.filter(m => m.provider === "claude-code").length
      }
    },
    ...(debug && openaiDebug ? { openaiDebug } : {}),
    ...(debug && debugInfo ? { debugInfo } : {})
  })
}

/**
 * POST handler - accepts local servers and cloud providers via request body
 * Body: { localServers: LocalServerParam[], cloudProviders: CloudProviderParam[], provider?: string, refresh?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { localServers, cloudProviders, provider, refresh } = body

    // Build URL with query params to reuse GET logic
    const url = new URL(request.url)
    if (provider) url.searchParams.set("provider", provider)
    if (refresh) url.searchParams.set("refresh", "true")
    if (localServers && Array.isArray(localServers)) {
      url.searchParams.set("localServers", JSON.stringify(localServers))
    }
    if (cloudProviders && Array.isArray(cloudProviders)) {
      url.searchParams.set("cloudProviders", JSON.stringify(cloudProviders))
    }

    // Create a new request with the modified URL
    const modifiedRequest = new NextRequest(url, {
      method: "GET",
      headers: request.headers
    })

    return GET(modifiedRequest)
  } catch (error) {
    console.error("Error in POST /api/models:", error)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }
}
