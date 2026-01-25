import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import { generateWithLocalLLM, getAllServersWithStatus } from "@/lib/llm/local-llm"
import { verifyApiAuth } from "@/lib/auth/api-helpers"
import { getUserApiKeysFromDb } from "@/lib/settings/settings-db"
import {
  BUILD_PLAN_SYSTEM_PROMPT,
  BUILD_PLAN_SIMPLE_SYSTEM_PROMPT,
  generateBuildPlanPrompt,
  generateSimplifiedBuildPlanPrompt,
  parseBuildPlanResponse,
  validateBuildPlan,
  generateBuildPlanWithRetry,
  mergePacketsWithExisting,
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
 * Helper function to run Claude Code CLI for generation tasks
 * Uses the -p flag for non-interactive mode and --output-format json for structured output
 */
async function generateWithClaudeCodeCLI(
  systemPrompt: string,
  userPrompt: string,
  options?: { timeout?: number }
): Promise<{ content: string; model?: string; error?: string }> {
  const timeout = options?.timeout ?? 120000 // 2 minute default

  return new Promise((resolve) => {
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`

    // Spawn claude CLI with -p flag for non-interactive mode
    // IMPORTANT: --dangerously-skip-permissions is required to prevent permission prompts
    // that would cause the CLI to hang waiting for input
    const claude = spawn("claude", [
      "-p", fullPrompt,
      "--output-format", "json",
      "--dangerously-skip-permissions", // Required for non-interactive mode
      "--allowedTools", "Read,Glob,Grep" // Allow read-only tools for context
    ], {
      timeout,
      env: { ...process.env }
    })

    let stdout = ""
    let stderr = ""

    claude.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    claude.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    claude.on("close", (code) => {
      if (code !== 0) {
        console.error(`[build-plan] Claude Code CLI exited with code ${code}:`, stderr)
        resolve({ content: "", error: `Claude Code CLI failed: ${stderr || `exit code ${code}`}` })
        return
      }

      try {
        // Parse JSON output from Claude Code CLI
        // Format: {"type":"result","subtype":"success","result":"...actual content...","modelUsage":{...}}
        const jsonOutput = JSON.parse(stdout)

        if (jsonOutput.is_error) {
          resolve({ content: "", error: `Claude Code error: ${jsonOutput.result || "Unknown error"}` })
          return
        }

        // Extract the actual result content
        const result = jsonOutput.result || ""

        // Get model info from modelUsage
        const modelUsed = Object.keys(jsonOutput.modelUsage || {})[0] || "claude-code"

        console.log(`[build-plan] Claude Code CLI success - model: ${modelUsed}, result length: ${result.length}`)
        resolve({ content: result, model: modelUsed })
      } catch (parseError) {
        // If not valid JSON, use raw output
        console.warn("[build-plan] Claude Code CLI output not JSON, using raw:", parseError)
        resolve({ content: stdout })
      }
    })

    claude.on("error", (err) => {
      console.error("[build-plan] Claude Code CLI spawn error:", err)
      resolve({ content: "", error: `Failed to spawn Claude Code CLI: ${err.message}` })
    })
  })
}

/**
 * Helper function to parse build plan response AND merge with existing packets
 * CRITICAL: This ensures existing packets are NEVER lost during regeneration
 */
function parseAndMergeBuildPlan(
  response: string,
  projectId: string,
  generatedBy: string,
  existingPackets: ExistingPacketInfo[]
): ReturnType<typeof parseBuildPlanResponse> & { mergeStats?: { preserved: number; updated: number; added: number; missing: number } } | null {
  const result = parseBuildPlanResponse(response, projectId, generatedBy)

  if (!result) return null

  // If there are existing packets, merge to ensure none are lost
  if (existingPackets && existingPackets.length > 0) {
    const defaultPhaseId = result.plan.phases[0]?.id || "phase-1"
    const { packets: mergedPackets, mergeStats } = mergePacketsWithExisting(
      result.plan.packets,
      existingPackets,
      defaultPhaseId
    )

    // Update the plan with merged packets
    result.plan.packets = mergedPackets

    // Update packet summary
    const existingCount = mergedPackets.filter(p => p.existing).length
    const newCount = mergedPackets.filter(p => !p.existing).length
    result.packetSummary = {
      existingCount,
      newCount,
      summary: `${existingCount} existing packets preserved, ${newCount} new packets added`
    }

    console.log(`[build-plan] Merged packets: ${mergeStats.missing} were missing from LLM output and preserved`)

    return { ...result, mergeStats }
  }

  return result
}

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
  allowPaidFallback: boolean,
  cloudProviders: Array<{ provider: string; apiKey: string }> = []
): Promise<BusinessDev | null> {
  // Helper to get API key (user-provided takes priority over environment)
  const getApiKey = (providerName: string): string | undefined => {
    const userKey = cloudProviders.find(p => p.provider === providerName)?.apiKey
    if (userKey) return userKey
    switch (providerName) {
      case "anthropic": return process.env.ANTHROPIC_API_KEY
      case "openai": return process.env.OPENAI_API_KEY
      case "google": return process.env.GOOGLE_AI_API_KEY
      default: return undefined
    }
  }

  const businessDevPrompt = generateBusinessDevPrompt(
    projectName,
    projectDescription,
    buildPlanSpec
  )

  // Try OpenAI
  const openaiKey = getApiKey("openai")
  if (preferredProvider === "chatgpt" && openaiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`
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

  // Try Gemini (provider name can be "google" or "gemini")
  const geminiKey = getApiKey("google")
  if ((preferredProvider === "gemini" || preferredProvider === "google") && geminiKey) {
    // Use the requested model if provided, otherwise default to gemini-2.5-pro
    const geminiModel = preferredModel || "gemini-2.5-pro"
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`,
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
              maxOutputTokens: 16384
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
  const anthropicKey = getApiKey("anthropic")
  if ((preferredProvider === "anthropic" || preferredProvider === "paid_claudecode") && anthropicKey) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default
      const anthropic = new Anthropic({
        apiKey: anthropicKey
      })

      const response = await anthropic.messages.create({
        model: preferredProvider === "paid_claudecode" ? "claude-opus-4-5-20251101" : "claude-sonnet-4-20250514",
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
    !["anthropic", "chatgpt", "gemini", "google", "paid_claudecode", "claude-code"].includes(preferredProvider)
      ? preferredProvider
      : undefined

  // Use larger max_tokens for local LLM (local-llm-server has 131072 context, free to use)
  // Paid APIs keep 4096 to minimize costs
  const localResponse = await generateWithLocalLLM(
    BUSINESS_DEV_SYSTEM_PROMPT,
    businessDevPrompt,
    {
      temperature: 0.7,
      max_tokens: 16384,
      preferredServer: localPreferredServer,
      preferredModel: preferredModel || undefined
    }
  )

  if (!localResponse.error) {
    return parseBusinessDevResponse(localResponse.content, projectId)
  }

  // Fallback to Anthropic if allowed
  if (allowPaidFallback && anthropicKey) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default
      const anthropic = new Anthropic({
        apiKey: anthropicKey
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
 * - Local: "local-llm-server", "local-llm-server-2" (LM Studio servers)
 * - Paid: "anthropic", "chatgpt", "gemini", "paid_claudecode", "claude-code"
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
      preferredProvider = null,  // e.g., "local-llm-server", "local-llm-server-2", "anthropic", "chatgpt", "gemini", "paid_claudecode"
      existingPackets = [] as ExistingPacketInfo[],  // Existing packets to integrate with (avoid duplicates)
      monetization = false,  // When true, also generate business dev analysis
      nuanceContext = null as NuanceContext | null,  // Extracted context from comments/discussions
      useRetryLogic = false,  // When true, uses retry with simplified prompts for smaller models
      planType = null as string | null,  // Override project type: "game", "vr", "creative", "web", etc.
      // Source selection parameters
      includeSources = {
        existingPackets: true,
        userUploads: true,
        interviewData: true
      } as { existingPackets?: boolean; userUploads?: boolean; interviewData?: boolean },
      userUploads = [] as Array<{ filename: string; content?: string }>,
      interviewSessions = [] as Array<{ sessionId: string; title?: string; summary?: string }>,
      // Cloud provider API keys from user settings (backwards compatibility)
      cloudProviders = [] as Array<{ provider: string; apiKey: string }>
    } = body

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

    // Build sourcesUsed tracking object
    const sourcesUsed = {
      existingPackets: {
        count: includeSources.existingPackets !== false ? existingPackets.length : 0,
        analyzed: includeSources.existingPackets !== false && existingPackets.length > 0
      },
      userUploads: {
        count: includeSources.userUploads !== false ? userUploads.length : 0,
        files: includeSources.userUploads !== false ? userUploads.map((u: { filename: string }) => u.filename) : []
      },
      interviewData: {
        count: includeSources.interviewData !== false ? interviewSessions.length : 0,
        sessions: includeSources.interviewData !== false ? interviewSessions.map((s: { sessionId: string; title?: string }) => s.title || s.sessionId) : []
      }
    }

    // Build sources context section for prompts
    const sourcesContextParts: string[] = []

    if (sourcesUsed.existingPackets.analyzed) {
      if (existingPackets.length >= 50) {
        // Batch summarization for large packet counts
        const batchSize = 10
        const batches = Math.ceil(existingPackets.length / batchSize)
        sourcesContextParts.push(`EXISTING WORK PACKETS: Analyzed ${existingPackets.length} work packets across ${batches} batches.`)

        // Add summary by status/priority
        const byStatus: Record<string, number> = {}
        const byPriority: Record<string, number> = {}
        existingPackets.forEach((p: ExistingPacketInfo) => {
          byStatus[p.status || 'unknown'] = (byStatus[p.status || 'unknown'] || 0) + 1
          const priority = (p as ExistingPacketInfo & { priority?: string }).priority || 'medium'
          byPriority[priority] = (byPriority[priority] || 0) + 1
        })
        sourcesContextParts.push(`  - By status: ${Object.entries(byStatus).map(([s, c]) => `${s}: ${c}`).join(', ')}`)
        sourcesContextParts.push(`  - By priority: ${Object.entries(byPriority).map(([p, c]) => `${p}: ${c}`).join(', ')}`)
      } else {
        sourcesContextParts.push(`EXISTING WORK PACKETS: ${existingPackets.length} packets analyzed.`)
        existingPackets.forEach((p: ExistingPacketInfo, i: number) => {
          const priority = (p as ExistingPacketInfo & { priority?: string }).priority || 'medium'
          sourcesContextParts.push(`  ${i + 1}. [${p.id}] ${p.title} (${p.status || 'unknown'}, ${priority})`)
        })
      }
    }

    if (sourcesUsed.userUploads.count > 0) {
      sourcesContextParts.push(`USER UPLOADS: ${sourcesUsed.userUploads.count} documents included.`)
      sourcesUsed.userUploads.files.forEach((f: string, i: number) => {
        sourcesContextParts.push(`  ${i + 1}. ${f}`)
      })
    }

    if (sourcesUsed.interviewData.count > 0) {
      sourcesContextParts.push(`INTERVIEW DATA: ${sourcesUsed.interviewData.count} sessions included.`)
      sourcesUsed.interviewData.sessions.forEach((s: string, i: number) => {
        sourcesContextParts.push(`  ${i + 1}. ${s}`)
      })
    }

    const sourcesContextSection = sourcesContextParts.length > 0
      ? `\n\n## SOURCES CONTEXT\nThe following sources were used to inform this build plan:\n${sourcesContextParts.join('\n')}\n`
      : ''

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

    // Generate the base build plan prompt
    let userPrompt = generateBuildPlanPrompt(
      projectName,
      projectDescription,
      availableModels,
      constraints,
      includeSources.existingPackets !== false ? existingPackets : [],
      nuanceContext || undefined,
      planType  // Override project type if specified
    )

    // Append sources context section to the prompt
    if (sourcesContextSection) {
      userPrompt = sourcesContextSection + userPrompt
    }

    // Handle ChatGPT / OpenAI
    const openaiApiKey = getApiKey("openai")
    if (preferredProvider === "chatgpt" && openaiApiKey) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiApiKey}`
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

          const result = parseAndMergeBuildPlan(content, projectId, "openai:gpt-4o", existingPackets)

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
                allowPaidFallback,
                cloudProviders
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
              sourcesUsed,
              mergeStats: result.mergeStats,
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

    // Handle Google Gemini (provider name can be "google" or "gemini")
    const googleApiKey = getApiKey("google")
    if ((preferredProvider === "gemini" || preferredProvider === "google") && googleApiKey) {
      // Use the requested model if provided, otherwise default to gemini-2.5-pro
      const geminiModel = preferredModel || "gemini-2.5-pro"
      console.log(`[build-plan] Using Gemini model: ${geminiModel} (requested: ${requestedModel})`)

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${googleApiKey}`,
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
                maxOutputTokens: 16384
              }
            })
          }
        )

        if (response.ok) {
          const data = await response.json()
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ""
          console.log(`[build-plan] Gemini ${geminiModel} response length: ${content.length}`)

          // Debug: Check if "packets" appears in the raw response and what's there
          const packetsMatch = content.match(/"packets"\s*:\s*\[/)
          console.log(`[build-plan] Raw response has "packets": array: ${!!packetsMatch}`)
          if (packetsMatch) {
            // Find the packets section
            const packetsStart = content.indexOf('"packets"')
            const packetsPreview = content.substring(packetsStart, packetsStart + 500)
            console.log(`[build-plan] Packets section preview: ${packetsPreview}`)
          }

          const result = parseAndMergeBuildPlan(content, projectId, `google:${geminiModel}`, existingPackets)
          console.log(`[build-plan] Parse result: ${result ? `phases=${result.plan.phases.length}, packets=${result.plan.packets.length}` : 'null'}`)

          if (result) {
            const validation = validateBuildPlan(result.plan)

            // Check if model failed to generate packets - warn user
            const noPacketsWarning = result.plan.packets.length === 0
              ? `${geminiModel} did not generate work packets. Try a more capable model like gemini-2.5-pro or a local model.`
              : undefined

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
                allowPaidFallback,
                cloudProviders
              )
            }

            return NextResponse.json({
              plan: result.plan,
              validation,
              source: "google",
              server: "Google Gemini",
              model: geminiModel,
              requestedModel: requestedModel || geminiModel,
              availableModels: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"],
              packetSummary: result.packetSummary,
              sourcesUsed,
              mergeStats: result.mergeStats,
              ...(noPacketsWarning && { warning: noPacketsWarning }),
              ...(businessDev && { businessDev })
            })
          } else {
            // Parse returned content but couldn't extract plan
            console.error("[build-plan] Google API returned content but parsing failed")
            return NextResponse.json({
              error: "Failed to parse build plan from Google response",
              source: "google"
            }, { status: 500 })
          }
        } else {
          const errorText = await response.text()
          console.error(`[build-plan] Google API error response: ${response.status} - ${errorText.slice(0, 500)}`)
          return NextResponse.json({
            error: `Google Gemini API error: ${response.status}`,
            source: "google"
          }, { status: 503 })
        }
      } catch (error) {
        console.error("Gemini build plan failed:", error)
        return NextResponse.json({
          error: "Google Gemini API error",
          source: "google"
        }, { status: 503 })
      }
    }

    // Handle Claude Code CLI (claude-code) - uses the `claude` CLI tool
    if (preferredProvider === "claude-code") {
      console.log("[build-plan] Using Claude Code CLI for generation")

      const cliResponse = await generateWithClaudeCodeCLI(
        BUILD_PLAN_SYSTEM_PROMPT + "\n\nYou are running as Claude Code - generate extremely detailed and comprehensive build plans suitable for autonomous coding agents.",
        userPrompt,
        { timeout: 180000 } // 3 minute timeout for complex plans
      )

      if (cliResponse.error) {
        console.error("Claude Code CLI build plan failed:", cliResponse.error)
        return NextResponse.json({
          error: cliResponse.error,
          source: "claude-code"
        }, { status: 503 })
      }

      const cliModel = cliResponse.model || "claude-code"
      const result = parseAndMergeBuildPlan(cliResponse.content, projectId, `claude-code:${cliModel}`, existingPackets)

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
          source: "claude-code",
          server: "Claude Code CLI",
          model: cliModel,
          requestedModel: requestedModel || "claude-code",
          availableModels: ["claude-code"],
          packetSummary: result.packetSummary,
          sourcesUsed,
          mergeStats: result.mergeStats,
          ...(businessDev && { businessDev })
        })
      } else {
        return NextResponse.json({
          error: "Claude Code CLI returned invalid build plan format",
          source: "claude-code"
        }, { status: 503 })
      }
    }

    // Handle paid_claudecode - uses Anthropic Claude Opus API
    const anthropicApiKey = getApiKey("anthropic")
    if (preferredProvider === "paid_claudecode" && anthropicApiKey) {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default
        const anthropic = new Anthropic({
          apiKey: anthropicApiKey
        })

        const response = await anthropic.messages.create({
          model: "claude-opus-4-5-20251101",
          max_tokens: 8192,
          system: BUILD_PLAN_SYSTEM_PROMPT + "\n\nYou are running as Claude Code - generate extremely detailed and comprehensive build plans suitable for autonomous coding agents.",
          messages: [{ role: "user", content: userPrompt }]
        })

        const content = response.content[0].type === "text"
          ? response.content[0].text
          : ""

        const result = parseAndMergeBuildPlan(content, projectId, "anthropic:claude-opus-4.5", existingPackets)

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
            server: "Claude Code API",
            model: "claude-opus-4.5",
            requestedModel: requestedModel || "claude-opus-4.5",
            availableModels: ["claude-opus-4.5", "claude-sonnet-4", "claude-haiku-3"],
            packetSummary: result.packetSummary,
            sourcesUsed,
            mergeStats: result.mergeStats,
            ...(businessDev && { businessDev })
          })
        }
      } catch (error) {
        console.error("Claude Code API build plan failed:", error)
        return NextResponse.json({
          error: "Claude Code API error",
          source: "anthropic"
        }, { status: 503 })
      }
    }

    // If Anthropic is explicitly requested and available
    if (preferredProvider === "anthropic" && anthropicApiKey) {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default
        const anthropic = new Anthropic({
          apiKey: anthropicApiKey
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

        const result = parseAndMergeBuildPlan(
          content,
          projectId,
          "anthropic:claude-sonnet-4",
          existingPackets
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
            availableModels: ["claude-sonnet-4", "claude-opus-4.5", "claude-haiku-3"],
            packetSummary: result.packetSummary,
            sourcesUsed,
            mergeStats: result.mergeStats,
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
    // Only pass preferredServer for local providers (local-llm-server, local-llm-server-2, etc.)
    // Paid providers are handled above and return early
    const localPreferredServer = preferredProvider &&
      !["anthropic", "chatgpt", "gemini", "google", "paid_claudecode", "claude-code"].includes(preferredProvider)
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

    // Use larger max_tokens for local LLM (local-llm-server has 131072 context, free to use)
    // Paid APIs above keep 4096 to minimize costs
    const localResponse = await generateWithLocalLLM(
      BUILD_PLAN_SYSTEM_PROMPT,
      userPrompt,
      {
        temperature: 0.7,
        max_tokens: 16384,
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
      const result = parseAndMergeBuildPlan(
        localResponse.content,
        projectId,
        `local:${localResponse.server}:${localResponse.model}`,
        existingPackets
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
          sourcesUsed,
          nuanceContextProvided: !!nuanceContext,
          mergeStats: result.mergeStats,
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
        const retryResult = parseAndMergeBuildPlan(
          retryResponse.content,
          projectId,
          `local:${retryResponse.server}:${retryResponse.model}:simplified`,
          existingPackets
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
            sourcesUsed,
            usedSimplifiedPrompt: true,
            nuanceContextProvided: !!nuanceContext,
            mergeStats: retryResult.mergeStats,
            ...(businessDev && { businessDev })
          })
        }
      }

      console.log(`[build-plan] Simplified prompt also failed: ${retryResponse.error || "parse error"}`)
    }

    // Local failed or returned invalid plan - try Anthropic if allowed
    if (allowPaidFallback && anthropicApiKey) {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default
        const anthropic = new Anthropic({
          apiKey: anthropicApiKey
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

        const result = parseAndMergeBuildPlan(
          content,
          projectId,
          "anthropic:claude-sonnet-4",
          existingPackets
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
            availableModels: ["claude-sonnet-4", "claude-opus-4.5", "claude-haiku-3"],
            warning: "Using paid API - local LLM unavailable",
            packetSummary: result.packetSummary,
            sourcesUsed,
            mergeStats: result.mergeStats,
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
