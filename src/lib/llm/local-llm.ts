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
export async function checkServerStatus(server: LLMServer): Promise<LLMServer> {
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

    if (server.type === "lmstudio" && data.data?.[0]?.id) {
      currentModel = data.data[0].id
    } else if (server.type === "ollama" && data.models?.[0]?.name) {
      currentModel = data.models[0].name
    }

    return {
      ...server,
      status: "online",
      currentModel
    }
  } catch {
    return { ...server, status: "offline" }
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
      signal: AbortSignal.timeout(60000) // 60 second timeout for generation
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
    const status = await checkServerStatus(server)
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
