/**
 * Providers API
 * Returns available AI providers and their status
 * Checks both local LLM servers and cloud API configurations
 */

import { NextResponse } from "next/server"

export interface ProviderInfo {
  name: string
  displayName: string
  type: "local" | "cloud"
  status: "online" | "offline" | "checking" | "not-configured"
  baseUrl?: string
  model?: string  // Currently loaded model (if any)
  models?: string[]  // All available models on this server
}

// Check if a local server is reachable and get available models
async function checkLocalServer(url: string, type: "lmstudio" | "ollama"): Promise<{
  online: boolean
  loadedModel?: string
  availableModels?: string[]
}> {
  try {
    const modelsUrl = type === "ollama"
      ? `${url}/api/tags`
      : `${url}/v1/models`

    const response = await fetch(modelsUrl, {
      method: "GET",
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
      return { online: false }
    }

    const data = await response.json()

    // Extract all available models and filter out embedding models
    // Embedding models should NEVER be used for chat/generation
    let availableModels: string[] = []
    if (type === "lmstudio" && data.data) {
      availableModels = data.data
        .filter((m: { id: string; type?: string }) => {
          const id = m.id.toLowerCase()
          // Filter out embedding models by name patterns or type
          return !id.includes('embed') &&
                 !id.includes('embedding') &&
                 m.type !== 'embedding'
        })
        .map((m: { id: string }) => m.id)
    } else if (type === "ollama" && data.models) {
      availableModels = data.models
        .filter((m: { name: string }) => {
          const name = m.name.toLowerCase()
          return !name.includes('embed') && !name.includes('embedding')
        })
        .map((m: { name: string }) => m.name)
    }

    // For LM Studio, try to detect which model is actually loaded
    // by making a minimal test request
    let loadedModel: string | undefined
    if (type === "lmstudio") {
      loadedModel = await detectLoadedLMStudioModel(url)
    } else if (type === "ollama" && availableModels.length > 0) {
      // Ollama doesn't have a "loaded" concept - models load on demand
      loadedModel = undefined
    }

    return { online: true, loadedModel, availableModels }
  } catch {
    return { online: false }
  }
}

/**
 * Test cloud provider connectivity by making a minimal API call
 */
async function testCloudProvider(provider: "anthropic" | "openai" | "google"): Promise<{
  online: boolean
  models?: string[]
  error?: string
}> {
  try {
    switch (provider) {
      case "anthropic": {
        const key = process.env.ANTHROPIC_API_KEY
        if (!key) return { online: false, error: "No API key" }

        // Test with models endpoint
        const response = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01"
          },
          signal: AbortSignal.timeout(10000)
        })

        if (response.ok) {
          const data = await response.json()
          const models = data.data?.map((m: { id: string }) => m.id) || []
          return { online: true, models }
        }
        return { online: false, error: `API returned ${response.status}` }
      }

      case "openai": {
        const key = process.env.OPENAI_API_KEY
        if (!key) return { online: false, error: "No API key" }

        const response = await fetch("https://api.openai.com/v1/models", {
          headers: { "Authorization": `Bearer ${key}` },
          signal: AbortSignal.timeout(10000)
        })

        if (response.ok) {
          const data = await response.json()
          // Filter to just chat models
          const models = data.data
            ?.filter((m: { id: string }) =>
              m.id.includes("gpt") || m.id.includes("o1") || m.id.includes("o3"))
            .map((m: { id: string }) => m.id) || []
          return { online: true, models }
        }
        return { online: false, error: `API returned ${response.status}` }
      }

      case "google": {
        const key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
        if (!key) return { online: false, error: "No API key" }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
          { signal: AbortSignal.timeout(10000) }
        )

        if (response.ok) {
          const data = await response.json()
          const models = data.models
            ?.filter((m: { name: string }) => m.name.includes("gemini"))
            .map((m: { name: string }) => m.name.replace("models/", "")) || []
          return { online: true, models }
        }
        return { online: false, error: `API returned ${response.status}` }
      }

      default:
        return { online: false, error: "Unknown provider" }
    }
  } catch (error) {
    return { online: false, error: error instanceof Error ? error.message : "Connection failed" }
  }
}

// Detect which model is currently loaded in LM Studio
async function detectLoadedLMStudioModel(url: string): Promise<string | undefined> {
  try {
    // Make a minimal request to see which model responds
    const response = await fetch(`${url}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "test" }],
        max_tokens: 1,
        stream: false
      }),
      signal: AbortSignal.timeout(3000)
    })

    if (response.ok) {
      const data = await response.json()
      return data.model || undefined
    }

    // If we get a 400/422 with "No models loaded", no model is loaded
    return undefined
  } catch {
    return undefined
  }
}

export async function GET() {
  const providers: ProviderInfo[] = []

  // Check local LM Studio servers
  const lmstudioServer1 = process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_1
  const lmstudioServer2 = process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_2
  const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL

  // LM Studio Server 1 - only include if online
  if (lmstudioServer1) {
    const status = await checkLocalServer(lmstudioServer1, "lmstudio")
    if (status.online) {
      providers.push({
        name: "local-llm-server",
        displayName: "Local LLM Server (LM Studio)",
        type: "local",
        status: "online",
        baseUrl: lmstudioServer1,
        model: status.loadedModel,
        models: status.availableModels || []
      })
    }
  }

  // LM Studio Server 2 - only include if online
  if (lmstudioServer2) {
    const status = await checkLocalServer(lmstudioServer2, "lmstudio")
    if (status.online) {
      providers.push({
        name: "local-llm-server-2",
        displayName: "Local LLM Server 2 (LM Studio)",
        type: "local",
        status: "online",
        baseUrl: lmstudioServer2,
        model: status.loadedModel,
        models: status.availableModels || []
      })
    }
  }

  // Ollama - only include if online
  if (ollamaUrl) {
    const status = await checkLocalServer(ollamaUrl, "ollama")
    if (status.online) {
      providers.push({
        name: "ollama",
        displayName: "Ollama",
        type: "local",
        status: "online",
        baseUrl: ollamaUrl,
        model: status.loadedModel,
        models: status.availableModels || []
      })
    }
  }

  // Cloud Providers - actually test connectivity, don't just check for API keys

  // Test all cloud providers in parallel for faster response
  const notConfigured = { online: false, models: undefined, error: "No API key" }
  const [anthropicStatus, openaiStatus, googleStatus] = await Promise.all([
    process.env.ANTHROPIC_API_KEY ? testCloudProvider("anthropic") : Promise.resolve(notConfigured),
    process.env.OPENAI_API_KEY ? testCloudProvider("openai") : Promise.resolve(notConfigured),
    (process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY) ? testCloudProvider("google") : Promise.resolve(notConfigured)
  ])

  // Anthropic (Claude) - only show if online with fetched models
  if (anthropicStatus.online && anthropicStatus.models?.length) {
    providers.push({
      name: "anthropic",
      displayName: "Anthropic (Claude)",
      type: "cloud",
      status: "online",
      model: anthropicStatus.models[0],
      models: anthropicStatus.models
    })
  }

  // OpenAI - only show if online with fetched models
  if (openaiStatus.online && openaiStatus.models?.length) {
    providers.push({
      name: "openai",
      displayName: "OpenAI",
      type: "cloud",
      status: "online",
      model: openaiStatus.models[0],
      models: openaiStatus.models
    })
  }

  // Google (Gemini) - only show if online with fetched models
  if (googleStatus.online && googleStatus.models?.length) {
    providers.push({
      name: "google",
      displayName: "Google (Gemini)",
      type: "cloud",
      status: "online",
      model: googleStatus.models[0],
      models: googleStatus.models
    })
  }

  return NextResponse.json({
    providers,
    localCount: providers.filter(p => p.type === "local").length,
    cloudCount: providers.filter(p => p.type === "cloud").length,
    onlineCount: providers.filter(p => p.status === "online").length
  })
}
