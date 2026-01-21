/**
 * Business Dev Chat API
 *
 * A business coach chat experience for the business development section.
 * Unlike the business ideas chat which extracts proposals, this is more
 * advisory and strategic - helping refine plans and provide feedback.
 */

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

interface BusinessDevContext {
  projectName: string
  projectDescription: string
  executiveSummary?: string
  valueProposition?: string
  targetMarket?: string
  competitiveAdvantage?: string
  features?: Array<{ name: string; description: string; priority: string }>
  marketSegments?: Array<{ name: string; percentage: number }>
  revenueStreams?: Array<{ name: string; description: string; estimatedRevenue: string }>
  proFormaSummary?: {
    year1Profit: number
    year2Profit: number
    year3Profit: number
    breakEvenMonth: number
  }
  risks?: string[]
  opportunities?: string[]
}

const BUSINESS_COACH_SYSTEM_PROMPT = `You are a seasoned business coach and strategic advisor with decades of experience helping entrepreneurs and businesses succeed. Your role is to have a collaborative, strategic conversation about their business development plans.

Your personality:
- Warm but direct - you give honest feedback because you genuinely want them to succeed
- Ask probing questions to understand their thinking and challenge assumptions
- Share relevant experience and examples from successful businesses
- Balance optimism with realism - celebrate good ideas while pointing out potential blind spots
- Help them think through problems rather than just giving answers

Your expertise:
1. Business strategy and positioning
2. Market analysis and competitive dynamics
3. Financial planning and projections
4. Revenue model optimization
5. Risk assessment and mitigation
6. Growth strategies and scaling
7. Go-to-market planning

Conversation style:
- Have a natural back-and-forth dialogue, not an interview
- Share your perspective and opinions, not just ask questions
- When something looks good, say so specifically and why
- When you see potential issues, raise them constructively
- Connect different parts of their business plan to show how they relate
- Offer concrete suggestions, not just vague advice
- Use analogies from other businesses to illustrate points

IMPORTANT - Report Updates:
When the user discusses changes to their business plan, new insights, or asks you to update their report, you should include a structured update block at the END of your message. This will automatically update their business development report.

Format for report updates:
---REPORT_UPDATE---
{
  "updateType": "minor" | "major",
  "changes": {
    "executiveSummary": "New or updated text (optional)",
    "valueProposition": "New or updated text (optional)",
    "targetMarket": "New or updated text (optional)",
    "competitiveAdvantage": "New or updated text (optional)",
    "addFeatures": [{"name": "Feature Name", "description": "Description", "priority": "high|medium|low"}],
    "addRisks": ["New risk to add"],
    "addOpportunities": ["New opportunity to add"],
    "addRevenueStream": {"name": "Stream Name", "description": "How it works", "estimatedRevenue": "$X/month", "timeframe": "Year 1", "confidence": "high|medium|low"}
  },
  "reason": "Brief explanation of why this update was made"
}
---END_UPDATE---

IMPORTANT - Work Packets:
When the conversation turns to specific development work, features to build, or technical tasks, you can suggest creating a work packet. Only do this when the user seems ready to take action or explicitly asks about implementation.

Format for work packets:
---WORK_PACKET---
{
  "title": "Short descriptive title",
  "description": "What needs to be built or done",
  "type": "feature" | "bugfix" | "research" | "docs" | "config",
  "priority": "low" | "medium" | "high" | "critical",
  "tasks": [
    {"description": "First task to complete"},
    {"description": "Second task to complete"}
  ],
  "acceptanceCriteria": [
    "Criterion 1",
    "Criterion 2"
  ]
}
---END_PACKET---

Only include these blocks when appropriate - don't force them. Your conversational response should always come first, then any structured blocks at the end.

Remember: You're a coach having a conversation, not a consultant delivering a report. Be personable, engaged, and genuinely helpful.`

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
    system: BUSINESS_COACH_SYSTEM_PROMPT,
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
 * Build context string from business dev data
 */
function buildContextString(context: BusinessDevContext): string {
  const parts: string[] = []

  parts.push(`Project: ${context.projectName}`)
  parts.push(`Description: ${context.projectDescription}`)

  if (context.executiveSummary) {
    parts.push(`\nExecutive Summary:\n${context.executiveSummary}`)
  }

  if (context.valueProposition) {
    parts.push(`\nValue Proposition: ${context.valueProposition}`)
  }

  if (context.targetMarket) {
    parts.push(`Target Market: ${context.targetMarket}`)
  }

  if (context.competitiveAdvantage) {
    parts.push(`Competitive Advantage: ${context.competitiveAdvantage}`)
  }

  if (context.features && context.features.length > 0) {
    const featuresStr = context.features
      .slice(0, 5)
      .map(f => `- ${f.name} (${f.priority}): ${f.description}`)
      .join("\n")
    parts.push(`\nKey Features:\n${featuresStr}`)
  }

  if (context.marketSegments && context.marketSegments.length > 0) {
    const segmentsStr = context.marketSegments
      .map(s => `- ${s.name}: ${s.percentage}%`)
      .join("\n")
    parts.push(`\nMarket Segments:\n${segmentsStr}`)
  }

  if (context.revenueStreams && context.revenueStreams.length > 0) {
    const revenueStr = context.revenueStreams
      .map(r => `- ${r.name}: ${r.estimatedRevenue} - ${r.description}`)
      .join("\n")
    parts.push(`\nRevenue Streams:\n${revenueStr}`)
  }

  if (context.proFormaSummary) {
    const pf = context.proFormaSummary
    parts.push(`\nFinancial Projections:`)
    parts.push(`- Year 1 Profit: $${pf.year1Profit.toLocaleString()}`)
    parts.push(`- Year 2 Profit: $${pf.year2Profit.toLocaleString()}`)
    parts.push(`- Year 3 Profit: $${pf.year3Profit.toLocaleString()}`)
    parts.push(`- Break-even: Month ${pf.breakEvenMonth}`)
  }

  if (context.risks && context.risks.length > 0) {
    parts.push(`\nIdentified Risks:\n${context.risks.map(r => `- ${r}`).join("\n")}`)
  }

  if (context.opportunities && context.opportunities.length > 0) {
    parts.push(`\nOpportunities:\n${context.opportunities.map(o => `- ${o}`).join("\n")}`)
  }

  return parts.join("\n")
}

/**
 * Extract report update from response content
 */
interface ReportUpdate {
  updateType: "minor" | "major"
  changes: {
    executiveSummary?: string
    valueProposition?: string
    targetMarket?: string
    competitiveAdvantage?: string
    addFeatures?: Array<{ name: string; description: string; priority: string }>
    addRisks?: string[]
    addOpportunities?: string[]
    addRevenueStream?: {
      name: string
      description: string
      estimatedRevenue: string
      timeframe: string
      confidence: string
    }
  }
  reason: string
}

function extractReportUpdate(content: string): ReportUpdate | null {
  const match = content.match(/---REPORT_UPDATE---\s*([\s\S]*?)\s*---END_UPDATE---/)
  if (!match) return null

  try {
    return JSON.parse(match[1])
  } catch {
    console.error("[BusinessDevChat] Failed to parse report update JSON")
    return null
  }
}

/**
 * Extract work packet from response content
 */
interface WorkPacketProposal {
  title: string
  description: string
  type: "feature" | "bugfix" | "research" | "docs" | "config"
  priority: "low" | "medium" | "high" | "critical"
  tasks: Array<{ description: string }>
  acceptanceCriteria: string[]
}

function extractWorkPacket(content: string): WorkPacketProposal | null {
  const match = content.match(/---WORK_PACKET---\s*([\s\S]*?)\s*---END_PACKET---/)
  if (!match) return null

  try {
    return JSON.parse(match[1])
  } catch {
    console.error("[BusinessDevChat] Failed to parse work packet JSON")
    return null
  }
}

/**
 * Clean content for display (remove structured blocks)
 */
function cleanContentForDisplay(content: string): string {
  return content
    .replace(/---REPORT_UPDATE---[\s\S]*?---END_UPDATE---/g, "")
    .replace(/---WORK_PACKET---[\s\S]*?---END_PACKET---/g, "")
    .trim()
}

/**
 * POST: Send message and get streaming AI response
 */
export async function POST(request: NextRequest) {
  try {
    const { messages, businessDevContext } = await request.json() as {
      messages: ChatMessage[]
      businessDevContext?: BusinessDevContext
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Find available LLM server
    const server = await findAvailableServer()

    // Build context-aware system prompt
    let contextualSystemPrompt = BUSINESS_COACH_SYSTEM_PROMPT
    if (businessDevContext) {
      const contextStr = buildContextString(businessDevContext)
      contextualSystemPrompt += `\n\n--- THEIR BUSINESS DEVELOPMENT PLAN ---\n${contextStr}\n\nUse this context to provide specific, relevant advice. Reference details from their plan when appropriate. Help them strengthen weak areas and build on their strengths.`
    }

    // Prepare messages with system prompt
    const fullMessages = [
      { role: "system", content: contextualSystemPrompt },
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

          // Check for report update in completed response
          const reportUpdate = extractReportUpdate(fullContent)
          if (reportUpdate) {
            const cleanedContent = cleanContentForDisplay(fullContent)
            if (cleanedContent !== fullContent) {
              sendSSE({ type: "content_replace", content: cleanedContent })
            }
            sendSSE({ type: "report_update", update: reportUpdate })
          }

          // Check for work packet in completed response
          const workPacket = extractWorkPacket(fullContent)
          if (workPacket) {
            // If we didn't already clean for report update, clean now
            if (!reportUpdate) {
              const cleanedContent = cleanContentForDisplay(fullContent)
              if (cleanedContent !== fullContent) {
                sendSSE({ type: "content_replace", content: cleanedContent })
              }
            }
            sendSSE({ type: "work_packet", packet: workPacket })
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
    console.error("Business dev chat error:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Chat failed"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
