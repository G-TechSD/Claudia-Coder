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
  const lmstudioBeast = process.env.NEXT_PUBLIC_LMSTUDIO_BEAST
  const lmstudioBedroom = process.env.NEXT_PUBLIC_LMSTUDIO_BEDROOM
  const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL

  // LM Studio Beast
  if (lmstudioBeast) {
    const status = await checkLocalServer(lmstudioBeast, "lmstudio")
    providers.push({
      name: "Beast",
      displayName: "Beast (LM Studio)",
      type: "local",
      status: status.online ? "online" : "offline",
      baseUrl: lmstudioBeast,
      model: status.loadedModel,  // Currently loaded model (may be undefined)
      models: status.availableModels || []  // All available models
    })
  }

  // LM Studio Bedroom
  if (lmstudioBedroom) {
    const status = await checkLocalServer(lmstudioBedroom, "lmstudio")
    providers.push({
      name: "Bedroom",
      displayName: "Bedroom (LM Studio)",
      type: "local",
      status: status.online ? "online" : "offline",
      baseUrl: lmstudioBedroom,
      model: status.loadedModel,  // Currently loaded model (may be undefined)
      models: status.availableModels || []  // All available models
    })
  }

  // Ollama
  if (ollamaUrl) {
    const status = await checkLocalServer(ollamaUrl, "ollama")
    providers.push({
      name: "ollama",
      displayName: "Ollama",
      type: "local",
      status: status.online ? "online" : "offline",
      baseUrl: ollamaUrl,
      model: status.loadedModel,
      models: status.availableModels || []
    })
  }

  // Cloud Providers - check if API keys are configured

  // Anthropic (Claude)
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({
      name: "anthropic-opus",
      displayName: "Claude Opus 4",
      type: "cloud",
      status: "online",
      model: "claude-opus-4-20250514",
      models: ["claude-opus-4-20250514"]
    })
    providers.push({
      name: "anthropic-sonnet",
      displayName: "Claude Sonnet 4",
      type: "cloud",
      status: "online",
      model: "claude-sonnet-4-20250514",
      models: ["claude-sonnet-4-20250514"]
    })
    providers.push({
      name: "anthropic-haiku",
      displayName: "Claude Haiku 3.5",
      type: "cloud",
      status: "online",
      model: "claude-3-5-haiku-20241022",
      models: ["claude-3-5-haiku-20241022"]
    })
  }

  // OpenAI (ChatGPT / Codex)
  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: "openai-gpt4",
      displayName: "GPT-4o",
      type: "cloud",
      status: "online",
      model: "gpt-4o",
      models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]
    })
    providers.push({
      name: "openai-o1",
      displayName: "o1",
      type: "cloud",
      status: "online",
      model: "o1",
      models: ["o1", "o1-mini"]
    })
  }

  // Google (Gemini)
  if (process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY) {
    providers.push({
      name: "gemini-pro",
      displayName: "Gemini 2.0 Flash",
      type: "cloud",
      status: "online",
      model: "gemini-2.0-flash-exp",
      models: ["gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"]
    })
  }

  return NextResponse.json({
    providers,
    localCount: providers.filter(p => p.type === "local").length,
    cloudCount: providers.filter(p => p.type === "cloud").length,
    onlineCount: providers.filter(p => p.status === "online").length
  })
}
