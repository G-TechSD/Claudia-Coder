import { NextRequest, NextResponse } from "next/server"
import {
  VIABILITY_SYSTEM_PROMPT,
  generateViabilityPrompt,
  parseViabilityResponse,
  saveViabilityAnalysis,
  getViabilityAnalysis,
  type ViabilityAnalysis
} from "@/lib/business/viability"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"

/**
 * POST /api/business/viability
 *
 * Analyzes a business idea and returns a comprehensive viability score
 * with factor breakdown, negative impacts, and recommendations.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      businessIdeaId,
      ideaTitle,
      executiveSummary,
      targetAudience,
      revenueModel,
      competitiveAdvantage,
      keyRisks,
      allowPaidFallback = false,
      forceRefresh = false
    } = body

    // Validate required fields
    if (!businessIdeaId) {
      return NextResponse.json(
        { error: "businessIdeaId is required" },
        { status: 400 }
      )
    }

    if (!ideaTitle || !executiveSummary) {
      return NextResponse.json(
        { error: "ideaTitle and executiveSummary are required" },
        { status: 400 }
      )
    }

    // Check for existing analysis unless force refresh
    if (!forceRefresh) {
      const existing = getViabilityAnalysis(businessIdeaId)
      if (existing) {
        return NextResponse.json({
          analysis: existing,
          source: "cached",
          message: "Retrieved existing analysis. Set forceRefresh=true to regenerate."
        })
      }
    }

    // Generate the prompt for LLM
    const userPrompt = generateViabilityPrompt(ideaTitle, executiveSummary, {
      targetAudience,
      revenueModel,
      competitiveAdvantage,
      keyRisks
    })

    // Try local LLM first
    const localResponse = await generateWithLocalLLM(
      VIABILITY_SYSTEM_PROMPT,
      userPrompt,
      {
        temperature: 0.7,
        max_tokens: 4096
      }
    )

    let content: string | null = null
    let source = "local"
    let model = localResponse.model

    if (!localResponse.error && localResponse.content) {
      content = localResponse.content
    } else if (allowPaidFallback && process.env.ANTHROPIC_API_KEY) {
      // Fallback to Anthropic
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        })

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: VIABILITY_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }]
        })

        if (response.content[0].type === "text") {
          content = response.content[0].text
          source = "anthropic"
          model = "claude-sonnet-4-20250514"
        }
      } catch (anthropicError) {
        console.error("Anthropic fallback failed:", anthropicError)
      }
    }

    if (!content) {
      return NextResponse.json({
        error: localResponse.error || "No LLM available to perform analysis",
        suggestion: "Start LM Studio or Ollama, or enable paid fallback"
      }, { status: 503 })
    }

    // Parse the response
    const analysis = parseViabilityResponse(content, businessIdeaId)

    if (!analysis) {
      return NextResponse.json({
        error: "Failed to parse viability analysis from LLM response",
        rawResponse: content.substring(0, 500)
      }, { status: 500 })
    }

    // Add model info
    analysis.modelUsed = model

    // Save to storage
    saveViabilityAnalysis(analysis)

    return NextResponse.json({
      analysis,
      source,
      model
    })

  } catch (error) {
    console.error("Viability analysis error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/business/viability?businessIdeaId=xxx
 *
 * Retrieves an existing viability analysis for a business idea.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessIdeaId = searchParams.get("businessIdeaId")

    if (!businessIdeaId) {
      return NextResponse.json(
        { error: "businessIdeaId query parameter is required" },
        { status: 400 }
      )
    }

    const analysis = getViabilityAnalysis(businessIdeaId)

    if (!analysis) {
      return NextResponse.json(
        { error: "No analysis found for this business idea" },
        { status: 404 }
      )
    }

    return NextResponse.json({ analysis })

  } catch (error) {
    console.error("Get viability analysis error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to retrieve analysis" },
      { status: 500 }
    )
  }
}
