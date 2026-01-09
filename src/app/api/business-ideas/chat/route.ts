import { NextRequest } from "next/server"
import {
  getConfiguredServers,
  checkServerStatus,
  type LLMServer
} from "@/lib/llm/local-llm"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface ProjectProposal {
  name: string
  description: string
  type: "web_app" | "mobile_app" | "api" | "saas" | "marketplace" | "tool" | "other"
  keyFeatures: string[]
  targetAudience?: string
  monetizationStrategy?: string
  estimatedComplexity?: "low" | "medium" | "high"
  suggestedTechStack?: string[]
}

const SYSTEM_PROMPT = `You are an expert business strategist and startup advisor. Your role is to help entrepreneurs brainstorm, refine, and validate business ideas through thoughtful conversation.

Your capabilities:
1. Help explore and expand on initial business concepts
2. Provide market insights and identify potential opportunities
3. Suggest monetization strategies (subscription, freemium, marketplace fees, advertising, etc.)
4. Identify target audiences and customer segments
5. Highlight potential challenges and competitive advantages
6. Recommend appropriate technology stacks when relevant

Conversation style:
- Be encouraging but realistic
- Ask clarifying questions to understand the idea better
- Provide specific, actionable insights
- Share relevant examples from successful businesses
- Help refine vague ideas into concrete concepts

IMPORTANT: When you believe the conversation has progressed to a point where:
- The core idea is well-defined
- There's a clear value proposition
- The target audience is identified
- Key features are outlined
- A monetization approach is suggested

Then include a JSON project proposal at the END of your message in this exact format:

---PROJECT_PROPOSAL---
{
  "name": "Project Name",
  "description": "Clear, compelling description of the project",
  "type": "web_app|mobile_app|api|saas|marketplace|tool|other",
  "keyFeatures": ["Feature 1", "Feature 2", "Feature 3"],
  "targetAudience": "Description of target users",
  "monetizationStrategy": "How the project will generate revenue",
  "estimatedComplexity": "low|medium|high",
  "suggestedTechStack": ["Next.js", "PostgreSQL", "etc"]
}
---END_PROPOSAL---

Only include this proposal when the idea is truly ready to become a project. Continue brainstorming if more refinement is needed.`

/**
 * Find an available LLM server
 */
async function findAvailableServer(): Promise<LLMServer | null> {
  const servers = getConfiguredServers()

  for (const server of servers) {
    const status = await checkServerStatus(server, false, 5000)
    if (status.status === "online") {
      return status
    }
  }

  return null
}

/**
 * Stream chat completion from LM Studio or Ollama
 */
async function* streamChatCompletion(
  server: LLMServer,
  messages: { role: string; content: string }[]
): AsyncGenerator<string> {
  const endpoint = server.type === "ollama"
    ? `${server.url}/api/chat`
    : `${server.url}/v1/chat/completions`

  const body = server.type === "ollama"
    ? {
        model: server.currentModel || "llama2",
        messages,
        stream: true,
        options: {
          temperature: 0.7,
          num_predict: 2048
        }
      }
    : {
        model: server.currentModel,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
        stream: true
      }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw new Error(`LLM server error: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error("No response body")

  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split("\n")

    for (const line of lines) {
      if (!line.trim()) continue

      // Handle Ollama format
      if (server.type === "ollama") {
        try {
          const parsed = JSON.parse(line)
          if (parsed.message?.content) {
            yield parsed.message.content
          }
        } catch {
          // Ignore parse errors
        }
      } else {
        // Handle OpenAI/LM Studio format
        if (line.startsWith("data: ")) {
          const data = line.slice(6)
          if (data === "[DONE]") continue

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              yield content
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }
}

/**
 * Fallback to Anthropic API if local LLM is not available
 */
async function* streamAnthropicCompletion(
  messages: { role: string; content: string }[]
): AsyncGenerator<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("No LLM available: local servers offline and no Anthropic API key configured")
  }

  const Anthropic = (await import("@anthropic-ai/sdk")).default
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  })

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: messages.filter(m => m.role !== "system").map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content
    }))
  })

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text
    }
  }
}

/**
 * Extract project proposal from response content
 */
function extractProjectProposal(content: string): ProjectProposal | null {
  const proposalMatch = content.match(/---PROJECT_PROPOSAL---\s*([\s\S]*?)\s*---END_PROPOSAL---/)

  if (!proposalMatch) return null

  try {
    const proposal = JSON.parse(proposalMatch[1])

    // Validate required fields
    if (!proposal.name || !proposal.description || !proposal.type || !proposal.keyFeatures) {
      return null
    }

    return {
      name: proposal.name,
      description: proposal.description,
      type: proposal.type,
      keyFeatures: Array.isArray(proposal.keyFeatures) ? proposal.keyFeatures : [],
      targetAudience: proposal.targetAudience,
      monetizationStrategy: proposal.monetizationStrategy,
      estimatedComplexity: proposal.estimatedComplexity,
      suggestedTechStack: proposal.suggestedTechStack
    }
  } catch {
    console.error("Failed to parse project proposal JSON")
    return null
  }
}

/**
 * Remove proposal block from content for display
 */
function cleanContentForDisplay(content: string): string {
  return content.replace(/---PROJECT_PROPOSAL---[\s\S]*?---END_PROPOSAL---/, "").trim()
}

/**
 * POST: Send message and get streaming AI response
 */
export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json() as { sessionId: string; messages: ChatMessage[] }

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Find available LLM server
    const server = await findAvailableServer()

    // Prepare messages with system prompt
    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ]

    // Create streaming response
    const encoder = new TextEncoder()
    let fullContent = ""

    const stream = new ReadableStream({
      async start(controller) {
        const sendSSE = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        try {
          // Stream from LLM
          const generator = server
            ? streamChatCompletion(server, fullMessages)
            : streamAnthropicCompletion(fullMessages)

          for await (const chunk of generator) {
            fullContent += chunk
            sendSSE({ type: "content", content: chunk })
          }

          // Check for project proposal in completed response
          const proposal = extractProjectProposal(fullContent)

          if (proposal) {
            // Send cleaned content (without proposal block)
            const cleanedContent = cleanContentForDisplay(fullContent)

            // Send a special event to replace content with cleaned version
            if (cleanedContent !== fullContent) {
              sendSSE({ type: "content_replace", content: cleanedContent })
            }

            // Send proposal
            sendSSE({ type: "proposal", proposal })
          }

          sendSSE({ type: "done" })
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))

        } catch (error) {
          console.error("Streaming error:", error)
          sendSSE({
            type: "error",
            error: error instanceof Error ? error.message : "Stream failed"
          })
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      }
    })

  } catch (error) {
    console.error("Business ideas chat error:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Chat failed"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
