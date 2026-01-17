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
// IMPORTANT: Do NOT change models or try to load others - use what's configured:
// - local-llm-server: gpt-oss-20b
// - local-llm-server-2: ministral-3-3b
export function getConfiguredServers(): LLMServer[] {
  const servers: LLMServer[] = []

  // LM Studio servers
  if (process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_1) {
    servers.push({
      name: "local-llm-server",
      url: process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_1,
      type: "lmstudio",
      status: "unknown"
    })
  }

  if (process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_2) {
    servers.push({
      name: "local-llm-server-2",
      url: process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_2,
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
// timeout parameter allows longer waits for explicitly preferred servers
// preferredModel parameter allows selecting a specific model instead of using the first one
export async function checkServerStatus(server: LLMServer, verifyModel = false, timeout = 5000, preferredModel?: string): Promise<LLMServer> {
  try {
    const modelsUrl = server.type === "ollama"
      ? `${server.url}/api/tags`
      : `${server.url}/v1/models`

    console.log(`[LLM] checkServerStatus: ${server.name} at ${modelsUrl} (timeout: ${timeout}ms, verifyModel: ${verifyModel})`)

    const response = await fetch(modelsUrl, {
      method: "GET",
      signal: AbortSignal.timeout(timeout)
    })

    if (!response.ok) {
      return { ...server, status: "offline" }
    }

    const data = await response.json()

    // LM Studio returns { data: [{ id: "model-name", ... }] }
    // Ollama returns { models: [{ name: "model-name", ... }] }
    // IMPORTANT: Filter out embedding models - they cannot be used for chat/generation
    let currentModel: string | undefined
    let availableModels: string[] = []

    if (server.type === "lmstudio" && data.data) {
      // Filter out embedding models
      const llmModels = data.data.filter((m: { id: string; type?: string }) => {
        const id = m.id.toLowerCase()
        return !id.includes('embed') && !id.includes('embedding') && m.type !== 'embedding'
      })
      availableModels = llmModels.map((m: { id: string }) => m.id)

      // Use preferred model if specified and available, otherwise use first available
      if (preferredModel && availableModels.includes(preferredModel)) {
        currentModel = preferredModel
        console.log(`[LLM] checkServerStatus: Using preferred model: ${preferredModel}`)
      } else if (preferredModel) {
        // Preferred model specified but not available - log warning and use first
        console.warn(`[LLM] checkServerStatus: Preferred model "${preferredModel}" not available on ${server.name}. Available: ${availableModels.join(', ')}`)
        currentModel = llmModels[0]?.id
      } else {
        currentModel = llmModels[0]?.id
      }
    } else if (server.type === "ollama" && data.models) {
      // Filter out embedding models
      const llmModels = data.models.filter((m: { name: string }) => {
        const name = m.name.toLowerCase()
        return !name.includes('embed') && !name.includes('embedding')
      })
      availableModels = llmModels.map((m: { name: string }) => m.name)

      // Use preferred model if specified and available, otherwise use first available
      if (preferredModel && availableModels.includes(preferredModel)) {
        currentModel = preferredModel
        console.log(`[LLM] checkServerStatus: Using preferred model: ${preferredModel}`)
      } else if (preferredModel) {
        // Preferred model specified but not available - log warning and use first
        console.warn(`[LLM] checkServerStatus: Preferred model "${preferredModel}" not available on ${server.name}. Available: ${availableModels.join(', ')}`)
        currentModel = llmModels[0]?.name
      } else {
        currentModel = llmModels[0]?.name
      }
    }

    // Optionally verify the model is actually loaded and ready
    if (verifyModel && currentModel) {
      const verified = await verifyModelLoaded(server, currentModel)
      if (!verified) {
        return { ...server, status: "busy", currentModel, availableModels }
      }
    }

    console.log(`[LLM] checkServerStatus: ${server.name} online with model: ${currentModel}`)
    return {
      ...server,
      status: "online",
      currentModel,
      availableModels
    }
  } catch (error) {
    console.error(`[LLM] checkServerStatus: ${server.name} failed:`, error instanceof Error ? error.message : error)
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
      // Filter out embedding models
      const llmModels = data.data?.filter((m: { id: string; type?: string }) => {
        const id = m.id.toLowerCase()
        return !id.includes('embed') && !id.includes('embedding') && m.type !== 'embedding'
      })
      return {
        ...status,
        modelInfo: llmModels?.map((m: { id: string; owned_by?: string }) => ({
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

    console.log(`[LLM] chatCompletion: Sending request to ${server.name} at ${endpoint}`)

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
      // Explicitly specify the model to ensure we use the code-capable model
      // and not an embedding model that might be loaded
      body = {
        model: server.currentModel,
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
      console.error(`[LLM] chatCompletion: ${server.name} returned error ${response.status}: ${errorText}`)
      return { content: "", error: `Server error: ${response.status} - ${errorText}` }
    }

    const data = await response.json()
    console.log(`[LLM] chatCompletion: ${server.name} returned successfully, model: ${data.model}`)

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
// Default preferred server is "local-llm-server" with gpt-oss-20b model
// compared to local-llm-server-2 which only has the 3B model (ministral-3-3b)
export async function generateWithLocalLLM(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    temperature?: number
    max_tokens?: number
    preferredServer?: string  // Defaults to "local-llm-server" for code tasks
    preferredModel?: string   // Specific model ID to use (e.g., "gpt-oss-20b")
  }
): Promise<{ content: string; server?: string; model?: string; error?: string }> {
  const servers = getConfiguredServers()

  // Default to local-llm-server which has the better code model
  const preferredServer = options?.preferredServer ?? "local-llm-server"

  // Default to gpt-oss-20b when using local-llm-server (unless explicitly overridden)
  const preferredModel = options?.preferredModel ??
    (preferredServer.toLowerCase() === "local-llm-server" ? "gpt-oss-20b" : undefined)

  // Track if we've explicitly requested a server (not using default)
  const hasExplicitPreference = options?.preferredServer !== undefined

  console.log(`[LLM] generateWithLocalLLM called with preferredServer: "${options?.preferredServer}", preferredModel: "${preferredModel}" (raw: "${options?.preferredModel}"), hasExplicitPreference: ${hasExplicitPreference}`)

  // Case-insensitive comparison (API uses lowercase, servers use capitalized)
  const preferredLower = preferredServer.toLowerCase()
  const preferredServerObj = servers.find(s => s.name.toLowerCase() === preferredLower)

  // CRITICAL FIX: If user explicitly selected a server, ONLY try that server
  // Do NOT silently fall back to another server - that's confusing!
  if (hasExplicitPreference) {
    if (!preferredServerObj) {
      console.error(`[LLM] ERROR: User explicitly requested server "${preferredServer}" but it's not configured`)
      return {
        content: "",
        error: `Server "${preferredServer}" is not configured. Check environment variables.`
      }
    }

    console.log(`[LLM] User explicitly selected: ${preferredServerObj.name} (${preferredServerObj.url})`)

    // Use longer timeout for explicitly preferred servers (20s)
    // This gives the larger model time to respond
    // Pass preferredModel to use specific model instead of first available
    const status = await checkServerStatus(preferredServerObj, false, 20000, preferredModel)

    console.log(`[LLM] Explicitly selected server ${preferredServerObj.name} status: ${status.status}, model: ${status.currentModel}`)

    if (status.status !== "online" && status.status !== "busy") {
      console.error(`[LLM] ERROR: User selected server ${preferredServerObj.name} is ${status.status}`)
      return {
        content: "",
        error: `Selected server "${preferredServerObj.name}" (${preferredServerObj.url}) is ${status.status}. Please check if LM Studio is running.`
      }
    }

    console.log(`[LLM] Using explicitly selected server: ${preferredServerObj.name}`)

    const response = await chatCompletion(status, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: options?.temperature,
      max_tokens: options?.max_tokens
    })

    if (response.error) {
      console.error(`[LLM] ERROR: Chat completion failed on ${preferredServerObj.name}:`, response.error)
      return {
        content: "",
        server: preferredServerObj.name,
        error: `Server "${preferredServerObj.name}" failed: ${response.error}`
      }
    }

    return {
      content: response.content,
      server: preferredServerObj.name,
      model: response.model
    }
  }

  // No explicit preference - try servers in order (local-llm-server first, then local-llm-server-2)
  let serversToTry = servers
  if (preferredServerObj) {
    serversToTry = [preferredServerObj, ...servers.filter(s => s.name.toLowerCase() !== preferredLower)]
  }

  console.log(`[LLM] No explicit preference, trying servers in order: ${serversToTry.map(s => s.name).join(", ")}`)

  for (const server of serversToTry) {
    console.log(`[LLM] Trying server: ${server.name} (url: ${server.url})`)

    // Pass preferredModel if specified (though typically used with explicit server selection)
    const status = await checkServerStatus(server, true, 5000, preferredModel)

    console.log(`[LLM] Server ${server.name} status: ${status.status}, model: ${status.currentModel}`)

    if (status.status !== "online") {
      console.log(`[LLM] Skipping ${server.name} - status: ${status.status}`)
      continue
    }

    console.log(`[LLM] Using server: ${server.name}`)

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

    console.warn(`[LLM] Error on ${server.name}:`, response.error)
  }

  return {
    content: "",
    error: "No local LLM servers available"
  }
}
