import { NextRequest, NextResponse } from "next/server"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"
import {
  BUILD_PLAN_SYSTEM_PROMPT,
  generateBuildPlanPrompt,
  parseBuildPlanResponse,
  validateBuildPlan
} from "@/lib/ai/build-plan"

/**
 * Build Plan Generation API
 * Uses local LLM first, falls back to paid only if explicitly allowed
 */
export async function POST(request: NextRequest) {
  try {
    const {
      projectId,
      projectName,
      projectDescription,
      availableModels = [],
      constraints = {},
      allowPaidFallback = false
    } = await request.json()

    if (!projectName || !projectDescription) {
      return NextResponse.json(
        { error: "Project name and description required" },
        { status: 400 }
      )
    }

    const userPrompt = generateBuildPlanPrompt(
      projectName,
      projectDescription,
      availableModels,
      constraints
    )

    // Try local LLM first
    const localResponse = await generateWithLocalLLM(
      BUILD_PLAN_SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.7, max_tokens: 4096 }
    )

    if (!localResponse.error) {
      const plan = parseBuildPlanResponse(
        localResponse.content,
        projectId,
        `local:${localResponse.server}:${localResponse.model}`
      )

      if (plan) {
        const validation = validateBuildPlan(plan)
        return NextResponse.json({
          plan,
          validation,
          source: "local",
          server: localResponse.server,
          model: localResponse.model
        })
      }
    }

    // Local failed or returned invalid plan - try Anthropic if allowed
    if (allowPaidFallback && process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        })

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: BUILD_PLAN_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }]
        })

        const content = response.content[0].type === "text"
          ? response.content[0].text
          : ""

        const plan = parseBuildPlanResponse(
          content,
          projectId,
          "anthropic:claude-sonnet-4"
        )

        if (plan) {
          const validation = validateBuildPlan(plan)
          return NextResponse.json({
            plan,
            validation,
            source: "anthropic",
            model: "claude-sonnet-4",
            warning: "Using paid API - local LLM unavailable"
          })
        }
      } catch (error) {
        console.error("Anthropic build plan failed:", error)
      }
    }

    // All failed
    return NextResponse.json({
      error: localResponse.error || "Failed to generate build plan",
      suggestion: "Start LM Studio or Ollama to enable AI features",
      source: "none"
    }, { status: 503 })

  } catch (error) {
    console.error("Build plan generation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate build plan" },
      { status: 500 }
    )
  }
}
