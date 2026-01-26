/**
 * Providers API
 * Returns available AI providers and their status
 * Checks both local LLM servers and cloud API configurations
 *
 * API keys are fetched from (in order of priority):
 * 1. Server-side settings database (for authenticated users)
 * 2. Environment variables
 */

import { NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/auth/api-helpers"
import { getUserApiKeysFromDb } from "@/lib/settings/settings-db"

export interface ProviderInfo {
  name: string
  displayName: string
  type: "local" | "cloud" | "cli"
  serverType?: "lmstudio" | "ollama" | "custom"  // For local providers, the specific server type
  status: "online" | "offline" | "checking" | "not-configured"
  baseUrl?: string
  model?: string  // Currently loaded model (if any)
  models?: string[]  // All available models on this server
  usesCli?: boolean  // True for CLI-based providers like Claude Code
  requiresApiKey?: boolean  // False for providers that don't need API keys
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
 * @param provider - The provider to test
 * @param apiKey - The API key to use (from DB or environment)
 */
async function testCloudProvider(provider: "anthropic" | "openai" | "google", apiKey: string): Promise<{
  online: boolean
  models?: string[]
  error?: string
}> {
  try {
    switch (provider) {
      case "anthropic": {
        // Test with models endpoint
        const response = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": apiKey,
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
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: { "Authorization": `Bearer ${apiKey}` },
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
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
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

  // Try to get API keys from server-side database (for authenticated users)
  let dbApiKeys: { anthropic?: string; openai?: string; google?: string } | null = null
  try {
    const auth = await verifyApiAuth()
    if (auth?.user?.id) {
      dbApiKeys = getUserApiKeysFromDb(auth.user.id)
    }
  } catch {
    // Not authenticated or error - continue with environment variables
  }

  // Helper to get API key from DB first, then environment
  const getApiKey = (provider: "anthropic" | "openai" | "google"): string | undefined => {
    if (dbApiKeys) {
      const dbKey = dbApiKeys[provider]
      if (dbKey) return dbKey
    }
    switch (provider) {
      case "anthropic": return process.env.ANTHROPIC_API_KEY
      case "openai": return process.env.OPENAI_API_KEY
      case "google": return process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
    }
  }

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
        serverType: "lmstudio",
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
        serverType: "lmstudio",
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
        serverType: "ollama",
        status: "online",
        baseUrl: ollamaUrl,
        model: status.loadedModel,
        models: status.availableModels || []
      })
    }
  }

  // Cloud Providers - actually test connectivity, don't just check for API keys
  // Get API keys from DB or environment
  const anthropicKey = getApiKey("anthropic")
  const openaiKey = getApiKey("openai")
  const googleKey = getApiKey("google")

  // Test all cloud providers in parallel for faster response
  const notConfigured = { online: false, models: undefined, error: "No API key" }
  const [anthropicStatus, openaiStatus, googleStatus] = await Promise.all([
    anthropicKey ? testCloudProvider("anthropic", anthropicKey) : Promise.resolve(notConfigured),
    openaiKey ? testCloudProvider("openai", openaiKey) : Promise.resolve(notConfigured),
    googleKey ? testCloudProvider("google", googleKey) : Promise.resolve(notConfigured)
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

  // Claude Code CLI - always available (uses Claude Code CLI with Max subscription)
  // Offers multiple Claude models via the CLI
  providers.push({
    name: "claude-code",
    displayName: "Claude Code",
    type: "cli",
    status: "online",
    model: "claude-sonnet-4-20250514",  // Default to Sonnet 4 (balanced)
    models: [
      "claude-opus-4-20250514",      // Best for coding, most capable
      "claude-sonnet-4-20250514",    // Good for coding, balanced
      "claude-3-5-haiku-20241022"    // Fast, but not recommended for complex coding
    ],
    usesCli: true,
    requiresApiKey: false
  })

  return NextResponse.json({
    providers,
    localCount: providers.filter(p => p.type === "local").length,
    cloudCount: providers.filter(p => p.type === "cloud").length,
    cliCount: providers.filter(p => p.type === "cli").length,
    onlineCount: providers.filter(p => p.status === "online").length
  })
}
