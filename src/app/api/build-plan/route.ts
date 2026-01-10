import { NextRequest, NextResponse } from "next/server"
import { generateWithLocalLLM, getAllServersWithStatus } from "@/lib/llm/local-llm"
import {
  BUILD_PLAN_SYSTEM_PROMPT,
  BUILD_PLAN_SIMPLE_SYSTEM_PROMPT,
  generateBuildPlanPrompt,
  generateSimplifiedBuildPlanPrompt,
  parseBuildPlanResponse,
  validateBuildPlan,
  generateBuildPlanWithRetry,
  type ExistingPacketInfo,
  type PacketSummary,
  type NuanceContext
} from "@/lib/ai/build-plan"
import {
  BUSINESS_DEV_SYSTEM_PROMPT,
  generateBusinessDevPrompt,
  parseBusinessDevResponse
} from "@/lib/ai/business-dev"
import type { BusinessDev } from "@/lib/data/types"

/**
 * Helper function to generate business dev analysis
 */
async function generateBusinessDevAnalysis(
  projectId: string,
  projectName: string,
  projectDescription: string,
  buildPlanSpec: { name?: string; description?: string; objectives?: string[]; techStack?: string[] } | undefined,
  preferredProvider: string | null,
  preferredModel: string | null,
  allowPaidFallback: boolean
): Promise<BusinessDev | null> {
  const businessDevPrompt = generateBusinessDevPrompt(
    projectName,
    projectDescription,
    buildPlanSpec
  )

  // Try OpenAI
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
            { role: "system", content: BUSINESS_DEV_SYSTEM_PROMPT },
            { role: "user", content: businessDevPrompt }
          ],
          max_tokens: 4096,
          temperature: 0.7
        })
      })

      if (response.ok) {
        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || ""
        return parseBusinessDevResponse(content, projectId)
      }
    } catch (error) {
      console.error("OpenAI business dev generation failed:", error)
    }
  }

  // Try Gemini
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
                text: `${BUSINESS_DEV_SYSTEM_PROMPT}\n\n${businessDevPrompt}`
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
        return parseBusinessDevResponse(content, projectId)
      }
    } catch (error) {
      console.error("Gemini business dev generation failed:", error)
    }
  }

  // Try Anthropic
  if ((preferredProvider === "anthropic" || preferredProvider === "paid_claudecode") && process.env.ANTHROPIC_API_KEY) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      })

      const response = await anthropic.messages.create({
        model: preferredProvider === "paid_claudecode" ? "claude-opus-4-20250514" : "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: BUSINESS_DEV_SYSTEM_PROMPT,
        messages: [{ role: "user", content: businessDevPrompt }]
      })

      const content = response.content[0].type === "text"
        ? response.content[0].text
        : ""

      return parseBusinessDevResponse(content, projectId)
    } catch (error) {
      console.error("Anthropic business dev generation failed:", error)
    }
  }

  // Try local LLM
  const localPreferredServer = preferredProvider &&
    !["anthropic", "chatgpt", "gemini", "paid_claudecode"].includes(preferredProvider)
      ? preferredProvider
      : undefined

  const localResponse = await generateWithLocalLLM(
    BUSINESS_DEV_SYSTEM_PROMPT,
    businessDevPrompt,
    {
      temperature: 0.7,
      max_tokens: 4096,
      preferredServer: localPreferredServer,
      preferredModel: preferredModel || undefined
    }
  )

  if (!localResponse.error) {
    return parseBusinessDevResponse(localResponse.content, projectId)
  }

  // Fallback to Anthropic if allowed
  if (allowPaidFallback && process.env.ANTHROPIC_API_KEY) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      })

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: BUSINESS_DEV_SYSTEM_PROMPT,
        messages: [{ role: "user", content: businessDevPrompt }]
      })

      const content = response.content[0].type === "text"
        ? response.content[0].text
        : ""

      return parseBusinessDevResponse(content, projectId)
    } catch (error) {
      console.error("Anthropic fallback business dev generation failed:", error)
    }
  }

  return null
}

/**
 * Build Plan Generation API
 * Uses local LLM first, falls back to paid only if explicitly allowed
 *
 * Enhanced with nuance-aware generation:
 * - Accepts nuanceContext extracted from Linear comments or other sources
 * - Uses retry logic with simplified prompts for smaller models
 * - Preserves key decisions, requirements, and concerns in generated packets
 *
 * Model Selection:
 * - Accept `model` or `preferredModel` parameter to specify which model to use
 * - Response includes: requestedModel (what was asked for), model (what was used), availableModels
 *
 * Supported providers:
 * - Local: "Beast", "Bedroom" (LM Studio servers)
 * - Paid: "anthropic", "chatgpt", "gemini", "paid_claudecode"
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      projectId,
      projectName,
      projectDescription,
      availableModels = [],
      constraints = {},
      allowPaidFallback = false,
      preferredProvider = null,  // e.g., "Beast", "Bedroom", "anthropic", "chatgpt", "gemini", "paid_claudecode"
      existingPackets = [] as ExistingPacketInfo[],  // Existing packets to integrate with (avoid duplicates)
      monetization = false,  // When true, also generate business dev analysis
      nuanceContext = null as NuanceContext | null,  // Extracted context from comments/discussions
      useRetryLogic = false  // When true, uses retry with simplified prompts for smaller models
    } = body

    // Support both `model` and `preferredModel` parameters for model selection
    // `model` is the simpler API, `preferredModel` is kept for backwards compatibility
    const requestedModel: string | null = body.model || body.preferredModel || null
    const preferredModel = requestedModel  // Internal variable for backwards compatibility

    if (!projectName || !projectDescription) {
      return NextResponse.json(
        { error: "Project name and description required" },
        { status: 400 }
      )
    }

    // Log if nuance context is provided
    if (nuanceContext) {
      console.log(`[build-plan] Received nuance context: ${nuanceContext.decisions?.length || 0} decisions, ${nuanceContext.requirements?.length || 0} requirements, ${nuanceContext.concerns?.length || 0} concerns`)
    }

    const userPrompt = generateBuildPlanPrompt(
      projectName,
      projectDescription,
      availableModels,
      constraints,
      existingPackets,
      nuanceContext || undefined
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

            // Generate business dev if monetization is enabled
            let businessDev: BusinessDev | null = null
            if (monetization) {
              businessDev = await generateBusinessDevAnalysis(
                projectId,
                projectName,
                projectDescription,
                result.plan.spec,
                preferredProvider,
                preferredModel,
                allowPaidFallback
              )
            }

            return NextResponse.json({
              plan: result.plan,
              validation,
              source: "openai",
              server: "OpenAI",
              model: "gpt-4o",
              requestedModel: requestedModel || "gpt-4o",
              availableModels: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
              packetSummary: result.packetSummary,
              ...(businessDev && { businessDev })
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

            // Generate business dev if monetization is enabled
            let businessDev: BusinessDev | null = null
            if (monetization) {
              businessDev = await generateBusinessDevAnalysis(
                projectId,
                projectName,
                projectDescription,
                result.plan.spec,
                preferredProvider,
                preferredModel,
                allowPaidFallback
              )
            }

            return NextResponse.json({
              plan: result.plan,
              validation,
              source: "google",
              server: "Google Gemini",
              model: "gemini-1.5-pro",
              requestedModel: requestedModel || "gemini-1.5-pro",
              availableModels: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
              packetSummary: result.packetSummary,
              ...(businessDev && { businessDev })
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

          // Generate business dev if monetization is enabled
          let businessDev: BusinessDev | null = null
          if (monetization) {
            businessDev = await generateBusinessDevAnalysis(
              projectId,
              projectName,
              projectDescription,
              result.plan.spec,
              preferredProvider,
              preferredModel,
              allowPaidFallback
            )
          }

          return NextResponse.json({
            plan: result.plan,
            validation,
            source: "anthropic",
            server: "Claude Code",
            model: "claude-opus-4",
            requestedModel: requestedModel || "claude-opus-4",
            availableModels: ["claude-opus-4", "claude-sonnet-4", "claude-haiku-3"],
            packetSummary: result.packetSummary,
            ...(businessDev && { businessDev })
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

          // Generate business dev if monetization is enabled
          let businessDev: BusinessDev | null = null
          if (monetization) {
            businessDev = await generateBusinessDevAnalysis(
              projectId,
              projectName,
              projectDescription,
              result.plan.spec,
              preferredProvider,
              preferredModel,
              allowPaidFallback
            )
          }

          return NextResponse.json({
            plan: result.plan,
            validation,
            source: "anthropic",
            server: "Anthropic",
            model: "claude-sonnet-4",
            requestedModel: requestedModel || "claude-sonnet-4",
            availableModels: ["claude-sonnet-4", "claude-opus-4", "claude-haiku-3"],
            packetSummary: result.packetSummary,
            ...(businessDev && { businessDev })
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
    console.log(`[build-plan]   preferredModel (requestedModel) from request: "${requestedModel}"`)
    console.log(`[build-plan]   localPreferredServer to use: "${localPreferredServer}"`)
    console.log(`[build-plan]   Is explicit local server: ${localPreferredServer !== undefined}`)
    console.log(`[build-plan] ========================================`)

    // Fetch available models from local servers for the response
    const localServers = await getAllServersWithStatus()
    const localAvailableModels: string[] = []
    for (const server of localServers) {
      if (server.status === "online" && server.availableModels) {
        localAvailableModels.push(...server.availableModels.map(m => `${server.name}:${m}`))
      }
    }

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

        // Generate business dev if monetization is enabled
        let businessDev: BusinessDev | null = null
        if (monetization) {
          businessDev = await generateBusinessDevAnalysis(
            projectId,
            projectName,
            projectDescription,
            result.plan.spec,
            preferredProvider,
            preferredModel,
            allowPaidFallback
          )
        }

        return NextResponse.json({
          plan: result.plan,
          validation,
          source: "local",
          server: localResponse.server,
          model: localResponse.model,
          requestedModel: requestedModel || null,
          availableModels: localAvailableModels,
          packetSummary: result.packetSummary,
          nuanceContextProvided: !!nuanceContext,
          ...(businessDev && { businessDev })
        })
      }
    }

    // If useRetryLogic is enabled and first attempt failed, try with simplified prompt
    if (useRetryLogic && (localResponse.error || !parseBuildPlanResponse(localResponse.content, projectId, "test"))) {
      console.log(`[build-plan] First attempt failed, trying with simplified prompt...`)

      const simplifiedPrompt = generateSimplifiedBuildPlanPrompt(
        projectName,
        projectDescription,
        nuanceContext || undefined
      )

      const retryResponse = await generateWithLocalLLM(
        BUILD_PLAN_SIMPLE_SYSTEM_PROMPT,
        simplifiedPrompt,
        {
          temperature: 0.5, // Lower temperature for more consistent output
          max_tokens: 2048,
          preferredServer: localPreferredServer,
          preferredModel: preferredModel || undefined
        }
      )

      if (!retryResponse.error) {
        const retryResult = parseBuildPlanResponse(
          retryResponse.content,
          projectId,
          `local:${retryResponse.server}:${retryResponse.model}:simplified`
        )

        if (retryResult) {
          const validation = validateBuildPlan(retryResult.plan)

          // Generate business dev if monetization is enabled
          let businessDev: BusinessDev | null = null
          if (monetization) {
            businessDev = await generateBusinessDevAnalysis(
              projectId,
              projectName,
              projectDescription,
              retryResult.plan.spec,
              preferredProvider,
              preferredModel,
              allowPaidFallback
            )
          }

          return NextResponse.json({
            plan: retryResult.plan,
            validation,
            source: "local",
            server: retryResponse.server,
            model: retryResponse.model,
            requestedModel: requestedModel || null,
            availableModels: localAvailableModels,
            packetSummary: retryResult.packetSummary,
            usedSimplifiedPrompt: true,
            nuanceContextProvided: !!nuanceContext,
            ...(businessDev && { businessDev })
          })
        }
      }

      console.log(`[build-plan] Simplified prompt also failed: ${retryResponse.error || "parse error"}`)
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

          // Generate business dev if monetization is enabled
          let businessDev: BusinessDev | null = null
          if (monetization) {
            businessDev = await generateBusinessDevAnalysis(
              projectId,
              projectName,
              projectDescription,
              result.plan.spec,
              preferredProvider,
              preferredModel,
              allowPaidFallback
            )
          }

          return NextResponse.json({
            plan: result.plan,
            validation,
            source: "anthropic",
            server: "Anthropic (fallback)",
            model: "claude-sonnet-4",
            requestedModel: requestedModel || null,
            availableModels: ["claude-sonnet-4", "claude-opus-4", "claude-haiku-3"],
            warning: "Using paid API - local LLM unavailable",
            packetSummary: result.packetSummary,
            ...(businessDev && { businessDev })
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
