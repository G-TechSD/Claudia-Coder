/**
 * Build Plan Revision API
 * Generates a revised build plan based on user feedback
 */

import { NextRequest, NextResponse } from "next/server"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"
import { verifyApiAuth } from "@/lib/auth/api-helpers"
import { getUserApiKeysFromDb } from "@/lib/settings/settings-db"
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
      preferredProvider,
      preferredModel = null,  // Specific model ID to use (e.g., "gpt-oss-20b")
      // Cloud provider API keys from user settings (backwards compatibility)
      cloudProviders = [] as Array<{ provider: string; apiKey: string }>
    } = await request.json()

    // Try to get API keys from server-side database (for authenticated users)
    let serverApiKeys: { anthropic?: string; openai?: string; google?: string } | null = null
    try {
      const auth = await verifyApiAuth()
      if (auth?.user?.id) {
        serverApiKeys = getUserApiKeysFromDb(auth.user.id)
      }
    } catch {
      // Not authenticated or error - continue with other sources
    }

    // Helper to get API key: 1) server DB, 2) request body, 3) environment
    const getApiKey = (providerName: string): string | undefined => {
      // First priority: Server-side database (authenticated user)
      if (serverApiKeys) {
        switch (providerName) {
          case "anthropic":
            if (serverApiKeys.anthropic) return serverApiKeys.anthropic
            break
          case "openai":
            if (serverApiKeys.openai) return serverApiKeys.openai
            break
          case "google":
            if (serverApiKeys.google) return serverApiKeys.google
            break
        }
      }

      // Second priority: Request body (backwards compatibility)
      const userKey = cloudProviders.find((p: { provider: string }) => p.provider === providerName)?.apiKey
      if (userKey) return userKey

      // Fall back to environment variables
      switch (providerName) {
        case "anthropic": return process.env.ANTHROPIC_API_KEY
        case "openai": return process.env.OPENAI_API_KEY
        case "google": return process.env.GOOGLE_AI_API_KEY
        default: return undefined
      }
    }

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

    // Only pass preferredServer for local providers (local-llm-server, local-llm-server-2, etc.)
    // Paid providers need to be handled separately
    const localPreferredServer = preferredProvider &&
      !["anthropic", "chatgpt", "gemini", "google", "paid_claudecode", "claude-code"].includes(preferredProvider)
        ? preferredProvider
        : undefined

    console.log(`[build-plan/revise] preferredProvider: ${preferredProvider}, preferredModel: ${preferredModel}, localPreferredServer: ${localPreferredServer}`)

    // Try local LLM with preferred server and model
    const localResponse = await generateWithLocalLLM(
      REVISION_SYSTEM_PROMPT,
      userPrompt,
      {
        temperature: 0.5, // Slightly lower for more consistent revisions
        max_tokens: 4096,
        preferredServer: localPreferredServer,
        preferredModel: preferredModel || undefined  // Pass specific model ID to use
      }
    )

    console.log(`[build-plan/revise] response: server=${localResponse.server}, error=${localResponse.error || 'none'}`)

    if (!localResponse.error) {
      const result = parseBuildPlanResponse(
        localResponse.content,
        projectId,
        `local:${localResponse.server}:${localResponse.model}`
      )

      if (result) {
        const validation = validateBuildPlan(result.plan)
        return NextResponse.json({
          plan: result.plan,
          packetSummary: result.packetSummary,
          validation,
          source: "local",
          server: localResponse.server,
          model: localResponse.model,
          isRevision: true
        })
      }
    }

    // Try Anthropic as fallback
    const anthropicKey = getApiKey("anthropic")
    if (anthropicKey) {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default
        const anthropic = new Anthropic({
          apiKey: anthropicKey
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

        const result = parseBuildPlanResponse(
          content,
          projectId,
          "anthropic:claude-sonnet-4"
        )

        if (result) {
          const validation = validateBuildPlan(result.plan)
          return NextResponse.json({
            plan: result.plan,
            packetSummary: result.packetSummary,
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

    // Try Google Gemini as fallback
    const googleKey = getApiKey("google")
    if (googleKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${googleKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `${REVISION_SYSTEM_PROMPT}\n\n${userPrompt}`
                }]
              }],
              generationConfig: {
                temperature: 0.5,
                maxOutputTokens: 4096
              }
            })
          }
        )

        if (response.ok) {
          const data = await response.json()
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ""

          const result = parseBuildPlanResponse(
            content,
            projectId,
            "google:gemini-2.5-pro"
          )

          if (result) {
            const validation = validateBuildPlan(result.plan)
            return NextResponse.json({
              plan: result.plan,
              packetSummary: result.packetSummary,
              validation,
              source: "google",
              server: "Google Gemini",
              model: "gemini-2.5-pro",
              isRevision: true
            })
          }
        }
      } catch (error) {
        console.error("Google Gemini revision failed:", error)
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
