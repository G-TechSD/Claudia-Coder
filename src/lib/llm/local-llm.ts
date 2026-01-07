/**
 * Local LLM Client
 * Supports LM Studio and Ollama with OpenAI-compatible API
 * This is the PRIMARY LLM backend - paid APIs are fallback only
 */

export interface LLMServer {
  name: string
  url: string
  type: "lmstudio" | "ollama"
  status: "unknown" | "online" | "offline" | "busy"
  currentModel?: string
  availableModels?: string[]
}

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface ChatCompletionRequest {
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

export interface ChatCompletionResponse {
  content: string
  model?: string
  error?: string
}

// Get configured LM Studio servers from environment
export function getConfiguredServers(): LLMServer[] {
  const servers: LLMServer[] = []

  // LM Studio servers
  if (process.env.NEXT_PUBLIC_LMSTUDIO_BEAST) {
    servers.push({
      name: "Beast",
      url: process.env.NEXT_PUBLIC_LMSTUDIO_BEAST,
      type: "lmstudio",
      status: "unknown"
    })
  }

  if (process.env.NEXT_PUBLIC_LMSTUDIO_BEDROOM) {
    servers.push({
      name: "Bedroom",
      url: process.env.NEXT_PUBLIC_LMSTUDIO_BEDROOM,
      type: "lmstudio",
      status: "unknown"
    })
  }

  // Ollama servers (can be added to env)
  if (process.env.NEXT_PUBLIC_OLLAMA_URL) {
    servers.push({
      name: "Ollama",
      url: process.env.NEXT_PUBLIC_OLLAMA_URL,
      type: "ollama",
      status: "unknown"
    })
  }

  return servers
}

// Check if a server is online and get loaded model
export async function checkServerStatus(server: LLMServer, verifyModel = false): Promise<LLMServer> {
  try {
    const modelsUrl = server.type === "ollama"
      ? `${server.url}/api/tags`
      : `${server.url}/v1/models`

    const response = await fetch(modelsUrl, {
      method: "GET",
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
      return { ...server, status: "offline" }
    }

    const data = await response.json()

    // LM Studio returns { data: [{ id: "model-name", ... }] }
    // Ollama returns { models: [{ name: "model-name", ... }] }
    let currentModel: string | undefined
    let availableModels: string[] = []

    if (server.type === "lmstudio" && data.data) {
      availableModels = data.data.map((m: { id: string }) => m.id)
      currentModel = data.data[0]?.id
    } else if (server.type === "ollama" && data.models) {
      availableModels = data.models.map((m: { name: string }) => m.name)
      currentModel = data.models[0]?.name
    }

    // Optionally verify the model is actually loaded and ready
    if (verifyModel && currentModel) {
      const verified = await verifyModelLoaded(server, currentModel)
      if (!verified) {
        return { ...server, status: "busy", currentModel, availableModels }
      }
    }

    return {
      ...server,
      status: "online",
      currentModel,
      availableModels
    }
  } catch {
    return { ...server, status: "offline" }
  }
}

// Get detailed server info including all models
export async function getServerDetails(server: LLMServer): Promise<LLMServer & {
  modelInfo?: { id: string; size?: number; modified?: string }[]
}> {
  const status = await checkServerStatus(server)

  if (status.status !== "online") {
    return status
  }

  // For LM Studio, try to get more model details
  if (server.type === "lmstudio") {
    try {
      const response = await fetch(`${server.url}/v1/models`, {
        signal: AbortSignal.timeout(5000)
      })
      const data = await response.json()
      return {
        ...status,
        modelInfo: data.data?.map((m: { id: string; owned_by?: string }) => ({
          id: m.id,
          owner: m.owned_by
        }))
      }
    } catch {
      return status
    }
  }

  return status
}

// Get all configured servers with their status
export async function getAllServersWithStatus(): Promise<LLMServer[]> {
  const servers = getConfiguredServers()
  const results = await Promise.all(
    servers.map(server => checkServerStatus(server))
  )
  return results
}

// Quick test to verify model is actually loaded (not just listed)
async function verifyModelLoaded(server: LLMServer, _model: string): Promise<boolean> {
  try {
    const endpoint = server.type === "ollama"
      ? `${server.url}/api/chat`
      : `${server.url}/v1/chat/completions`

    const body = server.type === "ollama"
      ? { model: _model, messages: [{ role: "user", content: "Hi" }], stream: false, options: { num_predict: 1 } }
      : { messages: [{ role: "user", content: "Hi" }], max_tokens: 1, stream: false }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000)
    })

    return response.ok
  } catch {
    return false
  }
}

// Get first available server
export async function getAvailableServer(): Promise<LLMServer | null> {
  const servers = getConfiguredServers()

  for (const server of servers) {
    const status = await checkServerStatus(server)
    if (status.status === "online") {
      return status
    }
  }

  return null
}

// Send chat completion request to local LLM
export async function chatCompletion(
  server: LLMServer,
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  try {
    const endpoint = server.type === "ollama"
      ? `${server.url}/api/chat`
      : `${server.url}/v1/chat/completions`

    // Format request based on server type
    let body: unknown

    if (server.type === "ollama") {
      // Ollama format
      body = {
        model: server.currentModel || "llama2",
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.max_tokens ?? 1024
        }
      }
    } else {
      // LM Studio (OpenAI-compatible)
      body = {
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 1024,
        stream: false
      }
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000) // 180 second timeout for generation
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { content: "", error: `Server error: ${response.status} - ${errorText}` }
    }

    const data = await response.json()

    // Extract content based on server type
    let content: string

    if (server.type === "ollama") {
      content = data.message?.content || ""
    } else {
      // OpenAI format
      content = data.choices?.[0]?.message?.content || ""
    }

    return {
      content,
      model: data.model || server.currentModel
    }
  } catch (error) {
    return {
      content: "",
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

// High-level function: Generate with local LLM, with automatic server selection
export async function generateWithLocalLLM(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    temperature?: number
    max_tokens?: number
    preferredServer?: string
  }
): Promise<{ content: string; server?: string; model?: string; error?: string }> {
  const servers = getConfiguredServers()

  // Try preferred server first if specified
  let serversToTry = servers
  if (options?.preferredServer) {
    // Case-insensitive comparison (API uses lowercase, servers use capitalized)
    const preferredLower = options.preferredServer.toLowerCase()
    const preferred = servers.find(s => s.name.toLowerCase() === preferredLower)
    if (preferred) {
      serversToTry = [preferred, ...servers.filter(s => s.name.toLowerCase() !== preferredLower)]
    }
  }

  for (const server of serversToTry) {
    // Use verifyModel=true to skip servers with unloaded models
    const status = await checkServerStatus(server, true)
    if (status.status !== "online") continue

    const response = await chatCompletion(status, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: options?.temperature,
      max_tokens: options?.max_tokens
    })

    if (!response.error) {
      return {
        content: response.content,
        server: server.name,
        model: response.model
      }
    }

    console.warn(`LLM error on ${server.name}:`, response.error)
  }

  return {
    content: "",
    error: "No local LLM servers available"
  }
}
