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
  model?: string
  models?: string[]
}

// Check if a local server is reachable
async function checkLocalServer(url: string, type: "lmstudio" | "ollama"): Promise<{ online: boolean; model?: string }> {
  try {
    const modelsUrl = type === "ollama"
      ? `${url}/api/tags`
      : `${url}/v1/models`

    const response = await fetch(modelsUrl, {
      method: "GET",
      signal: AbortSignal.timeout(3000)
    })

    if (!response.ok) {
      return { online: false }
    }

    const data = await response.json()

    // Extract current/first model
    let model: string | undefined
    if (type === "lmstudio" && data.data?.[0]?.id) {
      model = data.data[0].id
    } else if (type === "ollama" && data.models?.[0]?.name) {
      model = data.models[0].name
    }

    return { online: true, model }
  } catch {
    return { online: false }
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
      name: "beast",
      displayName: "Beast (LM Studio)",
      type: "local",
      status: status.online ? "online" : "offline",
      model: status.model
    })
  }

  // LM Studio Bedroom
  if (lmstudioBedroom) {
    const status = await checkLocalServer(lmstudioBedroom, "lmstudio")
    providers.push({
      name: "bedroom",
      displayName: "Bedroom (LM Studio)",
      type: "local",
      status: status.online ? "online" : "offline",
      model: status.model
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
      model: status.model
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
