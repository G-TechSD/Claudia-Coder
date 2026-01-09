import { NextRequest, NextResponse } from "next/server"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"
import {
  BUILD_PLAN_SYSTEM_PROMPT,
  generateBuildPlanPrompt,
  parseBuildPlanResponse,
  validateBuildPlan,
  type ExistingPacketInfo,
  type PacketSummary
} from "@/lib/ai/build-plan"

/**
 * Build Plan Generation API
 * Uses local LLM first, falls back to paid only if explicitly allowed
 *
 * Supported providers:
 * - Local: "Beast", "Bedroom" (LM Studio servers)
 * - Paid: "anthropic", "chatgpt", "gemini", "paid_claudecode"
 */
export async function POST(request: NextRequest) {
  try {
    const {
      projectId,
      projectName,
      projectDescription,
      availableModels = [],
      constraints = {},
      allowPaidFallback = false,
      preferredProvider = null,  // e.g., "Beast", "Bedroom", "anthropic", "chatgpt", "gemini", "paid_claudecode"
      preferredModel = null,     // Specific model ID to use (e.g., "gpt-oss-20b") - fixes random model selection bug
      existingPackets = [] as ExistingPacketInfo[]  // Existing packets to integrate with (avoid duplicates)
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
      constraints,
      existingPackets
    )

    // Handle ChatGPT / OpenAI
    if (preferredProvider === "chatgpt" && process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              { role: "system", content: BUILD_PLAN_SYSTEM_PROMPT },
              { role: "user", content: userPrompt }
            ],
            max_tokens: 4096,
            temperature: 0.7
          })
        })

        if (response.ok) {
          const data = await response.json()
          const content = data.choices?.[0]?.message?.content || ""

          const result = parseBuildPlanResponse(content, projectId, "openai:gpt-4o")

          if (result) {
            const validation = validateBuildPlan(result.plan)
            return NextResponse.json({
              plan: result.plan,
              validation,
              source: "openai",
              server: "OpenAI",
              model: "gpt-4o",
              packetSummary: result.packetSummary
            })
          }
        }
      } catch (error) {
        console.error("OpenAI build plan failed:", error)
        return NextResponse.json({
          error: "OpenAI API error",
          source: "openai"
        }, { status: 503 })
      }
    }

    // Handle Google Gemini
    if (preferredProvider === "gemini" && process.env.GOOGLE_AI_API_KEY) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `${BUILD_PLAN_SYSTEM_PROMPT}\n\n${userPrompt}`
                }]
              }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4096
              }
            })
          }
        )

        if (response.ok) {
          const data = await response.json()
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ""

          const result = parseBuildPlanResponse(content, projectId, "google:gemini-1.5-pro")

          if (result) {
            const validation = validateBuildPlan(result.plan)
            return NextResponse.json({
              plan: result.plan,
              validation,
              source: "google",
              server: "Google Gemini",
              model: "gemini-1.5-pro",
              packetSummary: result.packetSummary
            })
          }
        }
      } catch (error) {
        console.error("Gemini build plan failed:", error)
        return NextResponse.json({
          error: "Google Gemini API error",
          source: "google"
        }, { status: 503 })
      }
    }

    // Handle Claude Code (paid_claudecode) - uses Anthropic Claude Opus
    if (preferredProvider === "paid_claudecode" && process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        })

        const response = await anthropic.messages.create({
          model: "claude-opus-4-20250514",
          max_tokens: 8192,
          system: BUILD_PLAN_SYSTEM_PROMPT + "\n\nYou are running as Claude Code - generate extremely detailed and comprehensive build plans suitable for autonomous coding agents.",
          messages: [{ role: "user", content: userPrompt }]
        })

        const content = response.content[0].type === "text"
          ? response.content[0].text
          : ""

        const result = parseBuildPlanResponse(content, projectId, "anthropic:claude-opus-4")

        if (result) {
          const validation = validateBuildPlan(result.plan)
          return NextResponse.json({
            plan: result.plan,
            validation,
            source: "anthropic",
            server: "Claude Code",
            model: "claude-opus-4",
            packetSummary: result.packetSummary
          })
        }
      } catch (error) {
        console.error("Claude Code build plan failed:", error)
        return NextResponse.json({
          error: "Claude Code API error",
          source: "anthropic"
        }, { status: 503 })
      }
    }

    // If Anthropic is explicitly requested and available
    if (preferredProvider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
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

        const result = parseBuildPlanResponse(
          content,
          projectId,
          "anthropic:claude-sonnet-4"
        )

        if (result) {
          const validation = validateBuildPlan(result.plan)
          return NextResponse.json({
            plan: result.plan,
            validation,
            source: "anthropic",
            server: "Anthropic",
            model: "claude-sonnet-4",
            packetSummary: result.packetSummary
          })
        }
      } catch (error) {
        console.error("Anthropic build plan failed:", error)
        return NextResponse.json({
          error: "Anthropic API error",
          source: "anthropic"
        }, { status: 503 })
      }
    }

    // Try local LLM (with preferred server if specified)
    // Only pass preferredServer for local providers (Beast, Bedroom, etc.)
    // Paid providers are handled above and return early
    const localPreferredServer = preferredProvider &&
      !["anthropic", "chatgpt", "gemini", "paid_claudecode"].includes(preferredProvider)
        ? preferredProvider
        : undefined

    console.log(`[build-plan] ========================================`)
    console.log(`[build-plan] REGENERATION REQUEST:`)
    console.log(`[build-plan]   preferredProvider from request: "${preferredProvider}"`)
    console.log(`[build-plan]   preferredModel from request: "${preferredModel}"`)
    console.log(`[build-plan]   localPreferredServer to use: "${localPreferredServer}"`)
    console.log(`[build-plan]   Is explicit local server: ${localPreferredServer !== undefined}`)
    console.log(`[build-plan] ========================================`)

    const localResponse = await generateWithLocalLLM(
      BUILD_PLAN_SYSTEM_PROMPT,
      userPrompt,
      {
        temperature: 0.7,
        max_tokens: 4096,
        preferredServer: localPreferredServer,
        preferredModel: preferredModel || undefined  // Pass specific model ID to use
      }
    )

    console.log(`[build-plan] ========================================`)
    console.log(`[build-plan] RESPONSE:`)
    console.log(`[build-plan]   server: ${localResponse.server}`)
    console.log(`[build-plan]   model: ${localResponse.model}`)
    console.log(`[build-plan]   error: ${localResponse.error || 'none'}`)
    console.log(`[build-plan]   content length: ${localResponse.content?.length || 0}`)
    console.log(`[build-plan] ========================================`)

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
          validation,
          source: "local",
          server: localResponse.server,
          model: localResponse.model,
          packetSummary: result.packetSummary
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

        const result = parseBuildPlanResponse(
          content,
          projectId,
          "anthropic:claude-sonnet-4"
        )

        if (result) {
          const validation = validateBuildPlan(result.plan)
          return NextResponse.json({
            plan: result.plan,
            validation,
            source: "anthropic",
            model: "claude-sonnet-4",
            warning: "Using paid API - local LLM unavailable",
            packetSummary: result.packetSummary
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
