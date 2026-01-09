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

const SUMMARY_SYSTEM_PROMPT = `You are an expert business analyst creating an executive summary from a business idea discussion.

Based on the conversation provided, create a comprehensive executive summary in JSON format.

Return ONLY valid JSON with this exact structure:
{
  "title": "Short, catchy name for the business idea (3-5 words)",
  "summary": "2-3 sentence elevator pitch",
  "problemStatement": "Clear description of the problem being solved",
  "targetAudience": "Specific description of target customers",
  "valueProposition": "Unique value this solution provides",
  "revenueModel": "How this will make money (subscription, one-time, freemium, etc.)",
  "competitiveAdvantage": "What makes this different from alternatives",
  "keyRisks": ["Risk 1", "Risk 2", "Risk 3"],
  "nextSteps": ["Step 1", "Step 2", "Step 3", "Step 4"],
  "potential": "low|medium|high|very-high",
  "projectType": "business|dev|both|null"
}

For projectType:
- "dev" = This is primarily a software/app project
- "business" = This is primarily a business model/service (no significant coding)
- "both" = This needs both business planning AND software development
- null = Not enough information to determine

Be specific and actionable. If information is missing, make reasonable inferences based on context.`

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
          temperature: 0.5,
          num_predict: 2048
        }
      }
    : {
        model: server.currentModel,
        messages,
        temperature: 0.5,
        max_tokens: 2048,
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
    max_tokens: 2048,
    system: SUMMARY_SYSTEM_PROMPT,
    messages: messages.filter(m => m.role !== "system").map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content
    }))
  })

  const textBlock = response.content.find(block => block.type === "text")
  return textBlock?.type === "text" ? textBlock.text : ""
}

/**
 * Extract JSON from response (handles markdown code blocks)
 */
function extractJSON(content: string): string {
  // Try to extract from markdown code block
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    return jsonMatch[1].trim()
  }

  // Try to find JSON object directly
  const objectMatch = content.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    return objectMatch[0]
  }

  return content
}

/**
 * POST: Generate executive summary from conversation
 */
export async function POST(request: NextRequest) {
  try {
    const { messages, initialDescription } = await request.json() as {
      messages?: ChatMessage[]
      initialDescription: string
    }

    // Build the conversation context
    let conversationContext: string

    if (messages && messages.length > 0) {
      conversationContext = messages
        .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n")
    } else {
      conversationContext = `User's initial idea: ${initialDescription}`
    }

    // Find available LLM server
    const server = await findAvailableServer()

    // Prepare the prompt
    const userPrompt = `Please analyze this business idea discussion and create an executive summary:\n\n${conversationContext}`

    const fullMessages = [
      { role: "system", content: SUMMARY_SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ]

    // Get response
    let content: string
    if (server) {
      content = await getChatCompletion(server, fullMessages)
    } else {
      content = await getAnthropicCompletion(fullMessages)
    }

    // Parse the JSON response
    const jsonContent = extractJSON(content)
    let summary

    try {
      summary = JSON.parse(jsonContent)
    } catch {
      console.error("Failed to parse summary JSON:", jsonContent)
      // Return a fallback structure
      summary = {
        title: "Business Idea",
        summary: initialDescription,
        problemStatement: "",
        targetAudience: "",
        valueProposition: "",
        revenueModel: "",
        competitiveAdvantage: "",
        keyRisks: [],
        nextSteps: ["Define the problem more clearly", "Identify target customers", "Research competitors"],
        potential: "medium",
        projectType: null
      }
    }

    // Validate and fill in defaults
    const validatedSummary = {
      title: summary.title || "Untitled Idea",
      summary: summary.summary || initialDescription,
      problemStatement: summary.problemStatement || "",
      targetAudience: summary.targetAudience || "",
      valueProposition: summary.valueProposition || "",
      revenueModel: summary.revenueModel || "",
      competitiveAdvantage: summary.competitiveAdvantage || "",
      keyRisks: Array.isArray(summary.keyRisks) ? summary.keyRisks : [],
      nextSteps: Array.isArray(summary.nextSteps) ? summary.nextSteps : [],
      potential: ["low", "medium", "high", "very-high"].includes(summary.potential)
        ? summary.potential
        : "medium",
      projectType: ["business", "dev", "both", null].includes(summary.projectType)
        ? summary.projectType
        : null
    }

    return new Response(
      JSON.stringify(validatedSummary),
      { headers: { "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("Executive summary generation error:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Summary generation failed"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
