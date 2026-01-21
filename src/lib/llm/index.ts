/**
 * Unified LLM Service
 *
 * PRIORITY ORDER:
 * 1. Local LLMs (LM Studio, Ollama) - FREE, always preferred
 * 2. Anthropic Claude API - Only if configured and local unavailable
 *
 * Base functionality NEVER requires paid API subscriptions.
 */

import { generateWithLocalLLM, getConfiguredServers, checkServerStatus, type LLMServer } from "./local-llm"

export interface LLMRequest {
  systemPrompt: string
  userPrompt: string
  temperature?: number
  max_tokens?: number
  preferredServer?: string
  allowPaidFallback?: boolean // Default false - must explicitly opt in
}

export interface LLMResponse {
  content: string
  source: "local" | "anthropic" | "fallback"
  server?: string
  model?: string
  error?: string
  warning?: string
}

// Re-export types
export type { LLMServer }
export { getConfiguredServers, checkServerStatus }

/**
 * Clean LLM response content to prepare for JSON parsing
 * Removes special tokens and control characters that can break parsing
 */
export function cleanLLMResponse(content: string): string {
  let cleaned = content.trim()

  // Remove markdown code blocks if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
  }

  // Remove special tokens that some models insert
  cleaned = cleaned.replace(/<s>/g, "")
  cleaned = cleaned.replace(/<\/s>/g, "")
  cleaned = cleaned.replace(/<\|endoftext\|>/g, "")
  cleaned = cleaned.replace(/<\|im_end\|>/g, "")
  cleaned = cleaned.replace(/<\|im_start\|>/g, "")
  cleaned = cleaned.replace(/<\|pad\|>/g, "")
  cleaned = cleaned.replace(/<\|eos\|>/g, "")
  cleaned = cleaned.replace(/<\|eot_id\|>/g, "")
  cleaned = cleaned.replace(/<\|start_header_id\|>/g, "")
  cleaned = cleaned.replace(/<\|end_header_id\|>/g, "")

  // Remove any control characters except newlines and tabs
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")

  return cleaned
}

/**
 * Parse JSON from LLM response with cleanup
 */
export function parseLLMJson<T>(content: string): T | null {
  try {
    const cleaned = cleanLLMResponse(content)

    // Try to extract JSON from text (in case there's text before/after)
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    // Try parsing the cleaned content directly
    return JSON.parse(cleaned)
  } catch (error) {
    console.error("[LLM] Failed to parse JSON:", error)
    console.error("[LLM] Raw content (first 500 chars):", content.substring(0, 500))
    return null
  }
}

/**
 * Generate text using available LLM
 * Tries local first, only uses paid API if explicitly allowed and local fails
 */
export async function generate(request: LLMRequest): Promise<LLMResponse> {
  // Try local LLM first (always)
  const localResponse = await generateWithLocalLLM(
    request.systemPrompt,
    request.userPrompt,
    {
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      preferredServer: request.preferredServer
    }
  )

  if (!localResponse.error) {
    return {
      content: localResponse.content,
      source: "local",
      server: localResponse.server,
      model: localResponse.model
    }
  }

  // Local failed - try Anthropic directly if explicitly allowed
  if (request.allowPaidFallback && process.env.ANTHROPIC_API_KEY) {
    try {
      // Import Anthropic SDK directly for server-side fallback
      const Anthropic = (await import("@anthropic-ai/sdk")).default
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      })

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: request.max_tokens || 1024,
        system: request.systemPrompt,
        messages: [{ role: "user", content: request.userPrompt }]
      })

      const content = response.content[0].type === "text"
        ? response.content[0].text
        : ""

      return {
        content,
        source: "anthropic",
        model: "claude-sonnet-4-20250514",
        warning: "Using paid Anthropic API - local LLM was unavailable"
      }
    } catch (error) {
      console.error("Anthropic fallback failed:", error)
    }
  }

  // Everything failed - return error with helpful message
  return {
    content: "",
    source: "fallback",
    error: localResponse.error || "No LLM servers available",
    warning: request.allowPaidFallback
      ? "All LLM backends failed"
      : "Local LLM unavailable. Start LM Studio or Ollama, or enable paid fallback."
  }
}

/**
 * Check status of all configured LLM servers
 */
export async function getLLMStatus(): Promise<{
  servers: LLMServer[]
  hasLocalAvailable: boolean
  hasPaidConfigured: boolean
}> {
  const servers = getConfiguredServers()
  const statusChecks = await Promise.all(servers.map(server => checkServerStatus(server)))

  return {
    servers: statusChecks,
    hasLocalAvailable: statusChecks.some(s => s.status === "online"),
    hasPaidConfigured: !!process.env.ANTHROPIC_API_KEY
  }
}

/**
 * Generate interview question
 */
export async function generateQuestion(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  context?: Record<string, unknown>
): Promise<{ question: string; source: string; error?: string }> {
  // Build conversation context
  const conversationHistory = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n")

  const userPrompt = `Based on this interview conversation, generate the next thoughtful follow-up question:

${conversationHistory}

${context ? `\nContext: ${JSON.stringify(context)}` : ""}

Generate a single, natural follow-up question that:
1. Builds on what the user has shared
2. Explores areas not yet discussed
3. Helps gather more project details
4. Is conversational and friendly

Respond with ONLY the question, no prefix or explanation.`

  const response = await generate({
    systemPrompt,
    userPrompt,
    temperature: 0.7,
    max_tokens: 256
  })

  if (response.error) {
    return { question: "", source: response.source, error: response.error }
  }

  return {
    question: response.content.trim(),
    source: `${response.source}${response.server ? ` (${response.server})` : ""}`
  }
}

/**
 * Generate project plan from description
 */
export async function generatePlan(description: string): Promise<{
  name: string
  description: string
  features: string[]
  techStack: string[]
  priority: "low" | "medium" | "high" | "critical"
  source: string
  error?: string
}> {
  const systemPrompt = `You are a project planning assistant. Given a brief project description, generate a comprehensive project plan.

Your response must be valid JSON with exactly this structure:
{
  "name": "Short project name (2-4 words)",
  "description": "A clear, expanded description (2-3 sentences)",
  "features": ["Feature 1", "Feature 2", ...],
  "techStack": ["Technology 1", "Technology 2", ...],
  "priority": "low" | "medium" | "high" | "critical"
}

Respond with ONLY the JSON, no markdown or explanation.`

  const response = await generate({
    systemPrompt,
    userPrompt: `Generate a project plan for: ${description}`,
    temperature: 0.7,
    max_tokens: 1024
  })

  if (response.error) {
    return {
      name: "New Project",
      description,
      features: [],
      techStack: [],
      priority: "medium",
      source: response.source,
      error: response.error
    }
  }

  try {
    const plan = parseLLMJson<{
      name?: string
      description?: string
      features?: string[]
      techStack?: string[]
      priority?: string
    }>(response.content)

    if (!plan) {
      throw new Error("Failed to parse JSON")
    }

    return {
      name: plan.name || "New Project",
      description: plan.description || description,
      features: Array.isArray(plan.features) ? plan.features : [],
      techStack: Array.isArray(plan.techStack) ? plan.techStack : [],
      priority: ["low", "medium", "high", "critical"].includes(plan.priority || "") ? plan.priority as "low" | "medium" | "high" | "critical" : "medium",
      source: `${response.source}${response.server ? ` (${response.server})` : ""}`
    }
  } catch {
    return {
      name: "New Project",
      description,
      features: [],
      techStack: [],
      priority: "medium",
      source: response.source,
      error: "Failed to parse plan"
    }
  }
}

/**
 * Extract insights from interview
 */
export async function extractInsights(
  content: string,
  type: string
): Promise<{
  summary: string
  keyPoints: string[]
  suggestedActions: string[]
  extractedData: Record<string, unknown>
  source: string
  error?: string
}> {
  const systemPrompt = "You are an expert at analyzing conversations and extracting structured insights."

  const userPrompt = `Analyze this ${type} interview and extract structured insights.

Interview content:
${content}

Respond in this exact JSON format:
{
  "summary": "2-3 sentence summary",
  "keyPoints": ["key point 1", "key point 2", "key point 3"],
  "suggestedActions": ["action 1", "action 2"],
  "extractedData": {
    "name": "project name if mentioned",
    "description": "brief description if clear",
    "techStack": ["technologies mentioned"],
    "priority": "low|medium|high",
    "targetUsers": "who the users are if mentioned"
  }
}

Only include fields in extractedData that were actually discussed. Respond with ONLY the JSON.`

  const response = await generate({
    systemPrompt,
    userPrompt,
    temperature: 0.5,
    max_tokens: 1024
  })

  if (response.error) {
    return {
      summary: "",
      keyPoints: [],
      suggestedActions: [],
      extractedData: {},
      source: response.source,
      error: response.error
    }
  }

  try {
    const parsed = parseLLMJson<{
      summary?: string
      keyPoints?: string[]
      suggestedActions?: string[]
      extractedData?: Record<string, unknown>
    }>(response.content)

    if (!parsed) {
      throw new Error("Failed to parse JSON")
    }

    return {
      summary: parsed.summary || "",
      keyPoints: parsed.keyPoints || [],
      suggestedActions: parsed.suggestedActions || [],
      extractedData: parsed.extractedData || {},
      source: `${response.source}${response.server ? ` (${response.server})` : ""}`
    }
  } catch {
    return {
      summary: "",
      keyPoints: [],
      suggestedActions: [],
      extractedData: {},
      source: response.source,
      error: "Failed to parse insights"
    }
  }
}
