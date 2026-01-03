/**
 * Build Plan Revision API
 * Generates a revised build plan based on user feedback
 */

import { NextRequest, NextResponse } from "next/server"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"
import {
  BUILD_PLAN_SYSTEM_PROMPT,
  parseBuildPlanResponse,
  validateBuildPlan
} from "@/lib/ai/build-plan"

const REVISION_SYSTEM_PROMPT = `${BUILD_PLAN_SYSTEM_PROMPT}

You are REVISING a previously generated build plan based on user feedback.
The user has:
- Added, edited, or removed objectives
- Added, edited, or removed out-of-scope items
- Approved or rejected specific work packets
- Added comments on various sections

Your revised plan should:
1. INCORPORATE all user additions and respect all removals
2. REMOVE or substantially modify rejected work packets
3. ADJUST priorities and scope based on user feedback
4. Keep the same format but with updated content

Be responsive to user feedback - if they reject something, don't just rename it.`

export async function POST(request: NextRequest) {
  try {
    const {
      projectId,
      projectName,
      projectDescription,
      originalPlan,
      userFeedback,
      preferredProvider
    } = await request.json()

    if (!projectName || !projectDescription || !originalPlan) {
      return NextResponse.json(
        { error: "Project info and original plan required" },
        { status: 400 }
      )
    }

    const userPrompt = `REVISE THIS BUILD PLAN based on user feedback.

PROJECT: ${projectName}
DESCRIPTION: ${projectDescription}

ORIGINAL PLAN SUMMARY:
- Objectives: ${originalPlan.spec?.objectives?.join(", ") || "None"}
- Non-Goals: ${originalPlan.spec?.nonGoals?.join(", ") || "None"}
- Phases: ${originalPlan.phases?.length || 0}
- Work Packets: ${originalPlan.packets?.length || 0}

USER FEEDBACK AND CHANGES:
${userFeedback}

Generate a REVISED build plan that incorporates all user feedback.
The revised plan should address user concerns and remove rejected items.

Return the plan in the same JSON format as before.`

    // Try local LLM with preferred server
    const localResponse = await generateWithLocalLLM(
      REVISION_SYSTEM_PROMPT,
      userPrompt,
      {
        temperature: 0.5, // Slightly lower for more consistent revisions
        max_tokens: 4096,
        preferredServer: preferredProvider
      }
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
          model: localResponse.model,
          isRevision: true
        })
      }
    }

    // Try Anthropic as fallback
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        })

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: REVISION_SYSTEM_PROMPT,
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
            server: "Anthropic",
            model: "claude-sonnet-4",
            isRevision: true
          })
        }
      } catch (error) {
        console.error("Anthropic revision failed:", error)
      }
    }

    return NextResponse.json({
      error: localResponse.error || "Failed to generate revised plan",
      suggestion: "Try adjusting your feedback or using a different model"
    }, { status: 503 })

  } catch (error) {
    console.error("Build plan revision error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to revise build plan" },
      { status: 500 }
    )
  }
}
