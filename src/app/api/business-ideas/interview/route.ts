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

const INTERVIEW_SYSTEM_PROMPT = `You are an expert business strategist conducting a structured interview to help develop a business idea.

Your goal is to gather comprehensive information to create an executive summary. Ask one focused question at a time and adapt based on answers.

Key areas to explore (in order of priority):
1. The core problem being solved
2. The proposed solution
3. Target audience/customers
4. Unique value proposition
5. Revenue model / monetization strategy
6. Competitive landscape
7. Key risks and challenges
8. Whether this requires software development (app/SaaS) or is a traditional business

Interview guidelines:
- Keep responses concise (2-3 sentences max)
- Be encouraging but ask probing follow-up questions
- After 8-12 quality exchanges, indicate readiness to generate summary
- If user says "skip", move to the next topic
- If user seems to have covered a topic well, move on

When you have gathered enough information (usually 8-12 questions), end your response with:
[INTERVIEW_COMPLETE]

Do NOT include [INTERVIEW_COMPLETE] until you have sufficient information about at least:
- Problem/solution
- Target audience
- Value proposition
- Revenue model`

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
 * Get chat completion from local LLM
 */
async function getChatCompletion(
  server: LLMServer,
  messages: { role: string; content: string }[]
): Promise<string> {
  const endpoint = server.type === "ollama"
    ? `${server.url}/api/chat`
    : `${server.url}/v1/chat/completions`

  const body = server.type === "ollama"
    ? {
        model: server.currentModel || "llama2",
        messages,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 512
        }
      }
    : {
        model: server.currentModel,
        messages,
        temperature: 0.7,
        max_tokens: 512,
        stream: false
      }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw new Error(`LLM server error: ${response.status}`)
  }

  const data = await response.json()

  if (server.type === "ollama") {
    return data.message?.content || ""
  } else {
    return data.choices?.[0]?.message?.content || ""
  }
}

/**
 * Fallback to Anthropic API
 */
async function getAnthropicCompletion(
  messages: { role: string; content: string }[]
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("No LLM available: local servers offline and no Anthropic API key")
  }

  const Anthropic = (await import("@anthropic-ai/sdk")).default
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  })

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: INTERVIEW_SYSTEM_PROMPT,
    messages: messages.filter(m => m.role !== "system").map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content
    }))
  })

  const textBlock = response.content.find(block => block.type === "text")
  return textBlock?.type === "text" ? textBlock.text : ""
}

/**
 * POST: Get next interview question
 */
export async function POST(request: NextRequest) {
  try {
    const { messages, initialDescription, questionCount } = await request.json() as {
      messages: ChatMessage[]
      initialDescription: string
      questionCount: number
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Find available LLM server
    const server = await findAvailableServer()

    // Prepare messages with system prompt and context
    const contextMessage = `Initial idea description: "${initialDescription}"\n\nThis is question ${questionCount} of the interview.`

    const fullMessages = [
      { role: "system", content: INTERVIEW_SYSTEM_PROMPT },
      { role: "system", content: contextMessage },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ]

    // Get response
    let content: string
    if (server) {
      content = await getChatCompletion(server, fullMessages)
    } else {
      content = await getAnthropicCompletion(fullMessages)
    }

    // Check if interview is complete
    const isComplete = content.includes("[INTERVIEW_COMPLETE]")
    const cleanContent = content.replace("[INTERVIEW_COMPLETE]", "").trim()

    return new Response(
      JSON.stringify({
        content: cleanContent,
        isComplete,
        questionCount
      }),
      { headers: { "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("Business idea interview error:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Interview failed"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
