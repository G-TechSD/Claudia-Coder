/**
 * OpenAI-compatible Chat Completions API
 * POST /api/v1/chat/completions
 *
 * Routes requests to appropriate provider based on model ID:
 * - claude-* -> Anthropic
 * - gpt-*, o1*, o3*, o4* -> OpenAI
 * - google-* -> Google Gemini
 * - lmstudio-* -> LM Studio
 * - ollama-* -> Ollama
 *
 * Supports streaming (SSE) responses
 */

import { NextRequest, NextResponse } from "next/server"

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  stop?: string | string[]
}

interface ChatCompletionChoice {
  index: number
  message: {
    role: "assistant"
    content: string
  }
  finish_reason: "stop" | "length" | "content_filter" | null
}

interface ChatCompletionResponse {
  id: string
  object: "chat.completion"
  created: number
  model: string
  choices: ChatCompletionChoice[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface StreamChoice {
  index: number
  delta: {
    role?: "assistant"
    content?: string
  }
  finish_reason: "stop" | "length" | "content_filter" | null
}

interface ChatCompletionChunk {
  id: string
  object: "chat.completion.chunk"
  created: number
  model: string
  choices: StreamChoice[]
}

// Helper to generate unique IDs
function generateId(): string {
  return `chatcmpl-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// Route to appropriate provider
function getProviderFromModel(modelId: string): {
  provider: "anthropic" | "openai" | "google" | "lmstudio" | "ollama"
  actualModel: string
  serverName?: string
  baseUrl?: string
} {
  const id = modelId.toLowerCase()

  // Anthropic Claude models
  if (id.startsWith("claude")) {
    return { provider: "anthropic", actualModel: modelId }
  }

  // OpenAI models
  if (id.startsWith("gpt-") || id.startsWith("o1") || id.startsWith("o3") || id.startsWith("o4") || id.startsWith("chatgpt")) {
    return { provider: "openai", actualModel: modelId }
  }

  // Google Gemini models
  if (id.startsWith("google-") || id.startsWith("gemini")) {
    const actualModel = id.startsWith("google-") ? modelId.slice(7) : modelId
    return { provider: "google", actualModel }
  }

  // LM Studio models (format: lmstudio-{server}-{model})
  if (id.startsWith("lmstudio-")) {
    const parts = modelId.split("-")
    const serverName = parts[1]
    const actualModel = parts.slice(2).join("-")

    // Get base URL based on server name
    let baseUrl: string | undefined
    if (serverName === "local-llm-server") {
      baseUrl = process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_1
    } else if (serverName === "local-llm-server-2") {
      baseUrl = process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_2
    }

    return { provider: "lmstudio", actualModel, serverName, baseUrl }
  }

  // Ollama models (format: ollama-{model})
  if (id.startsWith("ollama-")) {
    return {
      provider: "ollama",
      actualModel: modelId.slice(7),
      baseUrl: process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434"
    }
  }

  // Default to LM Studio local-llm-server if no prefix
  return {
    provider: "lmstudio",
    actualModel: modelId,
    serverName: "local-llm-server",
    baseUrl: process.env.NEXT_PUBLIC_LMSTUDIO_SERVER_1
  }
}

// Call Anthropic API
async function callAnthropic(
  model: string,
  messages: ChatMessage[],
  options: { temperature?: number; max_tokens?: number; stream?: boolean }
): Promise<Response | ChatCompletionResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error("Anthropic API key not configured")
  }

  // Separate system message from other messages
  const systemMessage = messages.find(m => m.role === "system")
  const chatMessages = messages.filter(m => m.role !== "system")

  const body = {
    model,
    max_tokens: options.max_tokens || 4096,
    ...(systemMessage && { system: systemMessage.content }),
    messages: chatMessages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content
    })),
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    stream: options.stream
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic API error: ${response.status} - ${error}`)
  }

  if (options.stream) {
    return response
  }

  const data = await response.json()
  const content = data.content?.[0]?.text || ""

  return {
    id: generateId(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: { role: "assistant", content },
      finish_reason: data.stop_reason === "end_turn" ? "stop" : "length"
    }],
    usage: {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    }
  }
}

// Call OpenAI API
async function callOpenAI(
  model: string,
  messages: ChatMessage[],
  options: { temperature?: number; max_tokens?: number; stream?: boolean }
): Promise<Response | ChatCompletionResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OpenAI API key not configured")
  }

  const body = {
    model,
    messages,
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.max_tokens && { max_tokens: options.max_tokens }),
    stream: options.stream
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${error}`)
  }

  if (options.stream) {
    return response
  }

  return response.json()
}

// Call Google Gemini API
async function callGoogle(
  model: string,
  messages: ChatMessage[],
  options: { temperature?: number; max_tokens?: number; stream?: boolean }
): Promise<Response | ChatCompletionResponse> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("Google AI API key not configured")
  }

  // Convert to Gemini format
  const systemInstruction = messages.find(m => m.role === "system")?.content
  const contents = messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }))

  const body = {
    contents,
    ...(systemInstruction && { systemInstruction: { parts: [{ text: systemInstruction }] } }),
    generationConfig: {
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.max_tokens && { maxOutputTokens: options.max_tokens })
    }
  }

  const endpoint = options.stream ? "streamGenerateContent" : "generateContent"
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Google AI API error: ${response.status} - ${error}`)
  }

  if (options.stream) {
    return response
  }

  const data = await response.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ""

  return {
    id: generateId(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: { role: "assistant", content },
      finish_reason: data.candidates?.[0]?.finishReason === "STOP" ? "stop" : "length"
    }],
    usage: {
      prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata?.totalTokenCount || 0
    }
  }
}

// Call LM Studio API (OpenAI-compatible)
async function callLMStudio(
  model: string,
  messages: ChatMessage[],
  options: { temperature?: number; max_tokens?: number; stream?: boolean; baseUrl?: string }
): Promise<Response | ChatCompletionResponse> {
  const baseUrl = options.baseUrl
  if (!baseUrl) {
    throw new Error("LM Studio server not configured")
  }

  const body = {
    model,
    messages,
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.max_tokens && { max_tokens: options.max_tokens }),
    stream: options.stream
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000) // 3 minute timeout for local models
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LM Studio error: ${response.status} - ${error}`)
  }

  if (options.stream) {
    return response
  }

  return response.json()
}

// Call Ollama API
async function callOllama(
  model: string,
  messages: ChatMessage[],
  options: { temperature?: number; max_tokens?: number; stream?: boolean; baseUrl?: string }
): Promise<Response | ChatCompletionResponse> {
  const baseUrl = options.baseUrl || process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434"

  const body = {
    model,
    messages,
    stream: options.stream,
    options: {
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.max_tokens && { num_predict: options.max_tokens })
    }
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000) // 3 minute timeout for local models
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Ollama error: ${response.status} - ${error}`)
  }

  if (options.stream) {
    return response
  }

  const data = await response.json()

  return {
    id: generateId(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: { role: "assistant", content: data.message?.content || "" },
      finish_reason: "stop"
    }]
  }
}

// Transform streaming response to SSE format
function createSSEStream(
  providerStream: Response,
  provider: string,
  model: string
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const id = generateId()
  const created = Math.floor(Date.now() / 1000)

  return new ReadableStream({
    async start(controller) {
      const reader = providerStream.body?.getReader()
      if (!reader) {
        controller.close()
        return
      }

      const decoder = new TextDecoder()
      let buffer = ""

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process based on provider format
          if (provider === "anthropic") {
            // Anthropic uses SSE format: data: {...}
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6)
                if (data === "[DONE]") continue

                try {
                  const event = JSON.parse(data)
                  if (event.type === "content_block_delta" && event.delta?.text) {
                    const chunk: ChatCompletionChunk = {
                      id,
                      object: "chat.completion.chunk",
                      created,
                      model,
                      choices: [{
                        index: 0,
                        delta: { content: event.delta.text },
                        finish_reason: null
                      }]
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
                  } else if (event.type === "message_stop") {
                    const chunk: ChatCompletionChunk = {
                      id,
                      object: "chat.completion.chunk",
                      created,
                      model,
                      choices: [{
                        index: 0,
                        delta: {},
                        finish_reason: "stop"
                      }]
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          } else if (provider === "openai" || provider === "lmstudio") {
            // OpenAI/LM Studio already use SSE format
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6)
                if (data === "[DONE]") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"))
                  continue
                }

                try {
                  const event = JSON.parse(data)
                  // Pass through with our ID
                  const chunk: ChatCompletionChunk = {
                    id,
                    object: "chat.completion.chunk",
                    created,
                    model,
                    choices: event.choices?.map((c: StreamChoice, i: number) => ({
                      index: i,
                      delta: c.delta || {},
                      finish_reason: c.finish_reason
                    })) || []
                  }
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          } else if (provider === "google") {
            // Google uses JSON array streaming
            try {
              // Google streams JSON array elements
              const text = buffer
              buffer = ""

              // Extract text from response
              const matches = text.match(/"text":\s*"([^"\\]*(\\.[^"\\]*)*)"/g)
              if (matches) {
                for (const match of matches) {
                  const content = match.match(/"text":\s*"([^"\\]*(\\.[^"\\]*)*)"/)
                  if (content?.[1]) {
                    const chunk: ChatCompletionChunk = {
                      id,
                      object: "chat.completion.chunk",
                      created,
                      model,
                      choices: [{
                        index: 0,
                        delta: { content: JSON.parse(`"${content[1]}"`) },
                        finish_reason: null
                      }]
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
                  }
                }
              }
            } catch {
              // Skip errors in parsing
            }
          } else if (provider === "ollama") {
            // Ollama uses newline-delimited JSON
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (const line of lines) {
              if (!line.trim()) continue
              try {
                const event = JSON.parse(line)
                if (event.message?.content) {
                  const chunk: ChatCompletionChunk = {
                    id,
                    object: "chat.completion.chunk",
                    created,
                    model,
                    choices: [{
                      index: 0,
                      delta: { content: event.message.content },
                      finish_reason: event.done ? "stop" : null
                    }]
                  }
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }

        // Send final DONE message
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      } catch (error) {
        console.error("Stream error:", error)
      } finally {
        controller.close()
      }
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatCompletionRequest = await request.json()

    if (!body.model) {
      return NextResponse.json(
        { error: { message: "model is required", type: "invalid_request_error" } },
        { status: 400 }
      )
    }

    if (!body.messages || body.messages.length === 0) {
      return NextResponse.json(
        { error: { message: "messages array is required", type: "invalid_request_error" } },
        { status: 400 }
      )
    }

    const { provider, actualModel, baseUrl } = getProviderFromModel(body.model)
    const options = {
      temperature: body.temperature,
      max_tokens: body.max_tokens,
      stream: body.stream,
      baseUrl
    }

    let response: Response | ChatCompletionResponse

    switch (provider) {
      case "anthropic":
        response = await callAnthropic(actualModel, body.messages, options)
        break
      case "openai":
        response = await callOpenAI(actualModel, body.messages, options)
        break
      case "google":
        response = await callGoogle(actualModel, body.messages, options)
        break
      case "lmstudio":
        response = await callLMStudio(actualModel, body.messages, options)
        break
      case "ollama":
        response = await callOllama(actualModel, body.messages, options)
        break
      default:
        return NextResponse.json(
          { error: { message: `Unknown provider for model: ${body.model}`, type: "invalid_request_error" } },
          { status: 400 }
        )
    }

    // Handle streaming response
    if (body.stream && response instanceof Response) {
      const stream = createSSEStream(response, provider, body.model)
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      })
    }

    // Return non-streaming response
    return NextResponse.json(response)

  } catch (error) {
    console.error("Chat completion error:", error)
    return NextResponse.json(
      {
        error: {
          message: error instanceof Error ? error.message : "Internal server error",
          type: "api_error"
        }
      },
      { status: 500 }
    )
  }
}

// Support OPTIONS for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  })
}
