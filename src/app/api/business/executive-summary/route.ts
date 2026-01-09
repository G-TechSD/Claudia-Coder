/**
 * Executive Summary Generation API
 *
 * POST endpoint that takes business idea details and generates
 * a comprehensive executive summary using LLM.
 */

import { NextRequest } from "next/server"
import {
  getConfiguredServers,
  checkServerStatus,
  type LLMServer
} from "@/lib/llm/local-llm"

// Types for the executive summary structure
export interface ExecutiveSummaryInput {
  ideaId: string
  title: string
  summary: string
  problemStatement?: string
  targetAudience?: string
  valueProposition?: string
  revenueModel?: string
  competitiveAdvantage?: string
  tags?: string[]
  // Additional context from chat messages
  chatContext?: string
}

export interface ExecutiveSummaryOutput {
  overview: string
  marketAnalysis: {
    marketSize: string
    targetMarket: string
    marketTrends: string[]
    competitorLandscape: string
  }
  revenueModel: {
    primaryModel: string
    pricingStrategy: string
    revenueStreams: string[]
    projectedMetrics: string
  }
  competitiveLandscape: {
    directCompetitors: string[]
    indirectCompetitors: string[]
    competitiveAdvantages: string[]
    barriers: string[]
  }
  risks: {
    marketRisks: string[]
    technicalRisks: string[]
    financialRisks: string[]
    mitigationStrategies: string[]
  }
  opportunities: {
    shortTerm: string[]
    longTerm: string[]
    partnerships: string[]
    expansion: string[]
  }
  nextSteps: string[]
  viabilityScore: number // 1-10
  viabilityRationale: string
}

const EXECUTIVE_SUMMARY_SYSTEM_PROMPT = `You are an expert business strategist and startup advisor with deep experience in market analysis, business development, and venture assessment.

Your task is to generate a comprehensive executive summary for a business idea. Be thorough, realistic, and actionable.

Guidelines:
1. Be REALISTIC - avoid hyperbole, base assessments on market realities
2. Be SPECIFIC - provide concrete examples, numbers where possible
3. Be ACTIONABLE - every section should inform decision-making
4. Be HONEST - if there are significant risks or challenges, highlight them
5. Consider the STAGE - this is an early idea, so focus on validation steps

Your response MUST be valid JSON matching this exact structure:
{
  "overview": "A comprehensive 3-4 paragraph executive overview of the business idea, its potential, and key value propositions",
  "marketAnalysis": {
    "marketSize": "Estimated market size with sources/reasoning (e.g., 'The global X market is valued at $Y billion...')",
    "targetMarket": "Detailed description of the ideal customer segments",
    "marketTrends": ["Trend 1 with explanation", "Trend 2", "Trend 3"],
    "competitorLandscape": "Overview of the competitive environment"
  },
  "revenueModel": {
    "primaryModel": "Recommended primary revenue model (subscription, freemium, transaction, etc.)",
    "pricingStrategy": "Specific pricing recommendations with rationale",
    "revenueStreams": ["Stream 1", "Stream 2", "Stream 3"],
    "projectedMetrics": "Key metrics to track (CAC, LTV, churn targets, etc.)"
  },
  "competitiveLandscape": {
    "directCompetitors": ["Competitor 1 - brief description", "Competitor 2"],
    "indirectCompetitors": ["Alternative 1", "Alternative 2"],
    "competitiveAdvantages": ["Advantage 1", "Advantage 2"],
    "barriers": ["Barrier to entry 1", "Barrier 2"]
  },
  "risks": {
    "marketRisks": ["Risk 1", "Risk 2"],
    "technicalRisks": ["Risk 1", "Risk 2"],
    "financialRisks": ["Risk 1", "Risk 2"],
    "mitigationStrategies": ["Strategy 1", "Strategy 2"]
  },
  "opportunities": {
    "shortTerm": ["Opportunity 1", "Opportunity 2"],
    "longTerm": ["Opportunity 1", "Opportunity 2"],
    "partnerships": ["Potential partner 1", "Partner 2"],
    "expansion": ["Expansion path 1", "Path 2"]
  },
  "nextSteps": ["Immediate action 1", "Action 2", "Action 3", "Action 4", "Action 5"],
  "viabilityScore": 7,
  "viabilityRationale": "Explanation of the viability score considering market, team, timing, and execution factors"
}

Respond with ONLY valid JSON. No markdown formatting, no code blocks, just the raw JSON object.`

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
          num_predict: 4096
        }
      }
    : {
        model: server.currentModel,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
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
    max_tokens: 4096,
    system: EXECUTIVE_SUMMARY_SYSTEM_PROMPT,
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
 * Build the user prompt from the input
 */
function buildUserPrompt(input: ExecutiveSummaryInput): string {
  const sections = [
    `# Business Idea: ${input.title}`,
    "",
    `## Summary`,
    input.summary,
    ""
  ]

  if (input.problemStatement) {
    sections.push(`## Problem Statement`, input.problemStatement, "")
  }

  if (input.targetAudience) {
    sections.push(`## Target Audience`, input.targetAudience, "")
  }

  if (input.valueProposition) {
    sections.push(`## Value Proposition`, input.valueProposition, "")
  }

  if (input.revenueModel) {
    sections.push(`## Revenue Model Ideas`, input.revenueModel, "")
  }

  if (input.competitiveAdvantage) {
    sections.push(`## Competitive Advantage`, input.competitiveAdvantage, "")
  }

  if (input.tags && input.tags.length > 0) {
    sections.push(`## Tags/Categories`, input.tags.join(", "), "")
  }

  if (input.chatContext) {
    sections.push(`## Additional Context from Discussion`, input.chatContext, "")
  }

  sections.push(
    "",
    "Please generate a comprehensive executive summary analyzing this business idea.",
    "Be thorough and realistic. Consider market conditions, competition, and execution challenges.",
    "Respond with ONLY the JSON object, no additional text or formatting."
  )

  return sections.join("\n")
}

/**
 * Parse the JSON response, handling common LLM output issues
 */
function parseExecutiveSummary(content: string): ExecutiveSummaryOutput | null {
  try {
    // Try direct parse first
    return JSON.parse(content)
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1])
      } catch {
        // Continue to next attempt
      }
    }

    // Try to find JSON object in content
    const objectMatch = content.match(/\{[\s\S]*\}/)
    if (objectMatch) {
      try {
        // Clean common issues
        let cleaned = objectMatch[0]
        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        cleaned = cleaned.replace(/\/\/[^\n]*/g, '') // Remove comments
        return JSON.parse(cleaned)
      } catch {
        console.error("Failed to parse executive summary JSON")
      }
    }

    return null
  }
}

/**
 * POST: Generate executive summary
 */
export async function POST(request: NextRequest) {
  try {
    const input = await request.json() as ExecutiveSummaryInput

    if (!input.title || !input.summary) {
      return new Response(
        JSON.stringify({ error: "title and summary are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Find available LLM server
    const server = await findAvailableServer()

    // Build messages
    const userPrompt = buildUserPrompt(input)
    const fullMessages = [
      { role: "system", content: EXECUTIVE_SUMMARY_SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
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
          // Send start event
          sendSSE({ type: "start", ideaId: input.ideaId })

          // Stream from LLM
          const generator = server
            ? streamChatCompletion(server, fullMessages)
            : streamAnthropicCompletion(fullMessages)

          for await (const chunk of generator) {
            fullContent += chunk
            sendSSE({ type: "content", content: chunk })
          }

          // Parse the complete response
          const executiveSummary = parseExecutiveSummary(fullContent)

          if (executiveSummary) {
            sendSSE({ type: "complete", summary: executiveSummary })
          } else {
            sendSSE({
              type: "error",
              error: "Failed to parse executive summary. Raw response may need manual review.",
              rawContent: fullContent
            })
          }

          sendSSE({ type: "done" })
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))

        } catch (error) {
          console.error("Executive summary generation error:", error)
          sendSSE({
            type: "error",
            error: error instanceof Error ? error.message : "Generation failed"
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
    console.error("Executive summary error:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to generate executive summary"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
