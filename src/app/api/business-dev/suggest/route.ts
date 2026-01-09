import { NextRequest, NextResponse } from "next/server"

/**
 * Get AI Suggestion for Business Dev Field
 *
 * POST /api/business-dev/suggest
 *
 * Generates an AI-powered suggestion for a specific business development field
 * based on the current context and existing data.
 */

const SUGGESTION_PROMPTS: Record<string, string> = {
  executiveSummary: `You are a business strategist. Based on the business context provided, write a compelling executive summary (2-3 paragraphs) that:
- Opens with a strong value statement
- Explains the market opportunity
- Summarizes the business model
- Ends with growth potential

Current value (if any): {currentValue}
Business context: {context}

Respond with ONLY the executive summary text, no JSON or formatting.`,

  valueProposition: `You are a marketing strategist. Based on the business context, craft a clear, compelling value proposition that:
- States the unique benefit clearly
- Addresses the target customer's main pain point
- Differentiates from competitors
- Is concise (1-2 sentences)

Current value (if any): {currentValue}
Business context: {context}

Respond with ONLY the value proposition text.`,

  targetMarket: `You are a market researcher. Based on the business context, describe the target market including:
- Primary customer segments
- Market size estimate
- Key demographics or firmographics
- Growth trends

Current value (if any): {currentValue}
Business context: {context}

Respond with ONLY the target market description (1-2 paragraphs).`,

  competitiveAdvantage: `You are a competitive analyst. Based on the business context, articulate the competitive advantage:
- What makes this solution unique
- Why competitors can't easily replicate it
- What sustainable moats exist
- Key differentiators

Current value (if any): {currentValue}
Business context: {context}

Respond with ONLY the competitive advantage description (1-2 paragraphs).`
}

export async function POST(request: NextRequest) {
  try {
    const { field, context, currentValue, businessData } = await request.json()

    if (!field) {
      return NextResponse.json(
        { error: "Field is required" },
        { status: 400 }
      )
    }

    const promptTemplate = SUGGESTION_PROMPTS[field]
    if (!promptTemplate) {
      return NextResponse.json(
        { error: `Unknown field: ${field}` },
        { status: 400 }
      )
    }

    // Build context from business data
    const businessContext = businessData ? `
Project: ${businessData.valueProposition || "Unknown"}
Target Market: ${businessData.targetMarket || "Unknown"}
Features: ${businessData.features?.map((f: { name: string }) => f.name).join(", ") || "None defined"}
Revenue Streams: ${businessData.revenueStreams?.map((r: { name: string }) => r.name).join(", ") || "None defined"}
` : context || "No context provided"

    const prompt = promptTemplate
      .replace("{currentValue}", currentValue || "None")
      .replace("{context}", businessContext)

    let suggestion = null

    // Try LM Studio Beast first
    try {
      const lmStudioUrl = process.env.LMSTUDIO_BEAST_URL || "http://192.168.245.155:1234"
      const response = await fetch(`${lmStudioUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "default",
          messages: [
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 1000
        }),
        signal: AbortSignal.timeout(60000)
      })

      if (response.ok) {
        const data = await response.json()
        suggestion = data.choices?.[0]?.message?.content?.trim()
      }
    } catch (lmError) {
      console.log("[business-dev/suggest] LM Studio Beast not available:", lmError)
    }

    // Try LM Studio Bedroom if Beast failed
    if (!suggestion) {
      try {
        const lmStudioUrl = process.env.LMSTUDIO_BEDROOM_URL || "http://192.168.27.182:1234"
        const response = await fetch(`${lmStudioUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "default",
            messages: [
              { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 1000
          }),
          signal: AbortSignal.timeout(60000)
        })

        if (response.ok) {
          const data = await response.json()
          suggestion = data.choices?.[0]?.message?.content?.trim()
        }
      } catch (lmError) {
        console.log("[business-dev/suggest] LM Studio Bedroom not available:", lmError)
      }
    }

    // Fall back to OpenAI if configured
    if (!suggestion && process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 1000
          })
        })

        if (response.ok) {
          const data = await response.json()
          suggestion = data.choices?.[0]?.message?.content?.trim()
        }
      } catch (openaiError) {
        console.log("[business-dev/suggest] OpenAI not available:", openaiError)
      }
    }

    // Generate a placeholder suggestion if no LLM available
    if (!suggestion) {
      suggestion = generatePlaceholderSuggestion(field, currentValue)
    }

    return NextResponse.json({
      success: true,
      suggestion
    })

  } catch (error) {
    console.error("[business-dev/suggest] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate suggestion" },
      { status: 500 }
    )
  }
}

function generatePlaceholderSuggestion(field: string, currentValue: string | null): string {
  const placeholders: Record<string, string> = {
    executiveSummary: "This project represents a compelling opportunity to address unmet needs in the modern digital marketplace. By combining innovative technology with user-centric design, we can capture significant market share while delivering measurable value to our customers.\n\nOur go-to-market strategy focuses on building a strong foundation with early adopters before expanding to broader market segments. With a subscription-based revenue model and multiple growth vectors, we project achieving profitability within 18 months.",
    valueProposition: "We deliver a streamlined solution that saves our customers time and money while improving their outcomes - all through an intuitive interface that requires no technical expertise.",
    targetMarket: "Our primary target market consists of small to medium businesses (10-500 employees) in the professional services sector, representing a $2B addressable market growing at 15% annually. Secondary targets include enterprise departments seeking agile solutions and tech-savvy individual professionals.",
    competitiveAdvantage: "Our competitive advantage stems from a unique combination of deep domain expertise, proprietary technology, and a user-first design philosophy. Unlike legacy solutions that require extensive implementation, our platform delivers value from day one with minimal onboarding."
  }

  return placeholders[field] || `Consider expanding on: ${currentValue || "the key aspects of your business"}`
}
