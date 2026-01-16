import { NextRequest, NextResponse } from "next/server"
import { getSessionWithBypass } from "@/lib/auth/api-helpers"
import {
  getConfiguredServers,
  checkServerStatus,
  type LLMServer
} from "@/lib/llm/local-llm"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface ResearchContext {
  projectName: string
  projectDescription: string
  recommendation: "pursue" | "pivot" | "abandon" | "undetermined"
  confidenceLevel: "low" | "medium" | "high"
  marketSaturation: "low" | "medium" | "high" | "oversaturated"
  totalCompetitors: number
  competitors: Array<{
    name: string
    category: "direct" | "indirect" | "potential"
    description: string
    strengths: string[]
    weaknesses: string[]
    ourAdvantage?: string
  }>
  keyInsights: string[]
  whyPursue: string[]
  whyNotPursue: string[]
  differentiators: string[]
  risks: string[]
  opportunities: string[]
}

function buildSystemPrompt(context: ResearchContext): string {
  const competitorSummary = context.competitors
    .map(c => `- ${c.name} (${c.category}): ${c.description}
    Strengths: ${c.strengths.join(", ")}
    Weaknesses: ${c.weaknesses.join(", ")}
    ${c.ourAdvantage ? `Our Advantage: ${c.ourAdvantage}` : ""}`)
    .join("\n\n")

  return `You are an expert business strategist and competitive analyst. You're helping a user understand and discuss a prior art research report for their business idea.

RESEARCH REPORT CONTEXT:

Project: ${context.projectName}
Description: ${context.projectDescription}

RECOMMENDATION: ${context.recommendation.toUpperCase()}
Confidence Level: ${context.confidenceLevel}
Market Saturation: ${context.marketSaturation}
Total Competitors Found: ${context.totalCompetitors}

KEY INSIGHTS:
${context.keyInsights.map(i => `- ${i}`).join("\n")}

WHY PURSUE:
${context.whyPursue.map(r => `+ ${r}`).join("\n") || "No strong reasons identified"}

WHY NOT PURSUE:
${context.whyNotPursue.map(r => `- ${r}`).join("\n") || "No significant concerns identified"}

DIFFERENTIATORS:
${context.differentiators.map(d => `* ${d}`).join("\n") || "None identified"}

RISKS:
${context.risks.map(r => `! ${r}`).join("\n") || "None identified"}

OPPORTUNITIES:
${context.opportunities.map(o => `+ ${o}`).join("\n") || "None identified"}

COMPETITORS:
${competitorSummary}

---

Your role is to:
1. Answer questions about the research findings
2. Provide deeper analysis on specific competitors when asked
3. Suggest strategies for differentiation
4. Discuss market opportunities and risks
5. Help brainstorm ways to improve or pivot the idea
6. Provide actionable advice based on the research

Be conversational, helpful, and provide specific, actionable insights. When discussing competitors, reference the actual data from the research. When asked about strategies, be concrete and practical.

Keep responses focused and concise - aim for 2-3 paragraphs unless a longer response is clearly needed.`
}

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
          num_predict: 1500
        }
      }
    : {
        model: server.currentModel,
        messages,
        temperature: 0.7,
        max_tokens: 1500,
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
  systemPrompt: string,
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
    max_tokens: 1500,
    system: systemPrompt,
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
 * POST: Send message and get streaming AI response
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getSessionWithBypass()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { messages, researchContext } = await request.json() as {
      messages: ChatMessage[]
      researchContext: ResearchContext
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    if (!researchContext) {
      return new Response(
        JSON.stringify({ error: "researchContext is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Build context-aware system prompt
    const systemPrompt = buildSystemPrompt(researchContext)

    // Find available LLM server
    const server = await findAvailableServer()

    // Prepare messages with system prompt
    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ]

    // Create streaming response
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const sendSSE = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        try {
          // Stream from LLM
          const generator = server
            ? streamChatCompletion(server, fullMessages)
            : streamAnthropicCompletion(systemPrompt, fullMessages)

          for await (const chunk of generator) {
            sendSSE({ type: "content", content: chunk })
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
    console.error("Research chat error:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Chat failed"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
