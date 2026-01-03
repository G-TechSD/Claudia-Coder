import { NextRequest, NextResponse } from "next/server"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"

/**
 * Plan generation endpoint - LOCAL LLM FIRST
 */
export async function POST(request: NextRequest) {
  try {
    const { description, allowPaidFallback = false } = await request.json()

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      )
    }

    const systemPrompt = `You are a project planning assistant. Given a brief project description, generate a comprehensive project plan.

Your response must be valid JSON with exactly this structure:
{
  "name": "Short project name (2-4 words, no special characters)",
  "description": "A clear, expanded description of the project (2-3 sentences)",
  "features": ["Feature 1", "Feature 2", "Feature 3", "..."],
  "techStack": ["Technology 1", "Technology 2", "..."],
  "priority": "low" | "medium" | "high" | "critical"
}

Guidelines:
- Name should be concise and memorable
- Description should expand on the user's input with clarity
- Features should be specific and actionable (aim for 4-8 features)
- Tech stack should be practical and modern, based on the project needs
- Priority should be inferred from urgency words or default to "medium"

Respond with ONLY the JSON, no markdown code blocks or explanation.`

    const userPrompt = `Generate a project plan for: ${description}`

    // Try local LLM first
    const localResponse = await generateWithLocalLLM(systemPrompt, userPrompt, {
      temperature: 0.7,
      max_tokens: 1024
    })

    if (!localResponse.error) {
      return parseAndReturnPlan(localResponse.content, description, {
        source: "local",
        server: localResponse.server,
        model: localResponse.model
      })
    }

    // Local failed - try Anthropic only if allowed
    if (allowPaidFallback && process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        })

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }]
        })

        const content = response.content[0].type === "text"
          ? response.content[0].text.trim()
          : "{}"

        return parseAndReturnPlan(content, description, {
          source: "anthropic",
          model: "claude-sonnet-4-20250514",
          warning: "Using paid API - local LLM unavailable"
        })
      } catch (error) {
        console.error("Anthropic fallback failed:", error)
      }
    }

    // All failed - return error with helpful message
    return NextResponse.json({
      error: localResponse.error || "No LLM servers available",
      suggestion: "Start LM Studio or Ollama to enable AI features",
      source: "none"
    }, { status: 503 })

  } catch (error) {
    console.error("LLM plan generation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate plan" },
      { status: 500 }
    )
  }
}

function parseAndReturnPlan(
  content: string,
  originalDescription: string,
  meta: { source: string; server?: string; model?: string; warning?: string }
) {
  // Clean up response - remove markdown code blocks if present
  let cleanedResponse = content.trim()
  if (cleanedResponse.startsWith("```json")) {
    cleanedResponse = cleanedResponse.slice(7)
  } else if (cleanedResponse.startsWith("```")) {
    cleanedResponse = cleanedResponse.slice(3)
  }
  if (cleanedResponse.endsWith("```")) {
    cleanedResponse = cleanedResponse.slice(0, -3)
  }
  cleanedResponse = cleanedResponse.trim()

  try {
    const plan = JSON.parse(cleanedResponse)

    return NextResponse.json({
      name: plan.name || "New Project",
      description: plan.description || originalDescription,
      features: Array.isArray(plan.features) ? plan.features : [],
      techStack: Array.isArray(plan.techStack) ? plan.techStack : [],
      priority: ["low", "medium", "high", "critical"].includes(plan.priority)
        ? plan.priority
        : "medium",
      ...meta
    })
  } catch {
    // If JSON parsing fails, create a basic plan
    return NextResponse.json({
      name: "New Project",
      description: originalDescription,
      features: ["Core functionality"],
      techStack: ["To be determined"],
      priority: "medium",
      parseError: "LLM response was not valid JSON",
      ...meta
    })
  }
}
