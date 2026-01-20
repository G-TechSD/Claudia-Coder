import { NextRequest, NextResponse } from "next/server"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"

/**
 * Interview insight extraction endpoint - LOCAL LLM FIRST
 */
export async function POST(request: NextRequest) {
  try {
    const { systemPrompt, content, type, allowPaidFallback = false } = await request.json()

    const extractionPrompt = `Analyze this ${type} interview and extract structured insights.

Interview content:
${content}

Respond in this exact JSON format:
{
  "summary": "2-3 sentence summary of what was discussed",
  "keyPoints": ["key point 1", "key point 2", "key point 3"],
  "suggestedActions": ["action 1", "action 2"],
  "extractedData": {
    "name": "project name if mentioned",
    "description": "brief description if clear",
    "techStack": ["technologies mentioned"],
    "priority": "low|medium|high based on urgency signals",
    "targetUsers": "who the users are if mentioned",
    "monetization": true|false,
    "monetizationIntent": "how they plan to monetize if mentioned",
    "needsUI": true|false,
    "uiType": "website|web_app|desktop|mobile|terminal|api_only|null",
    "uiAudience": "end_users|internal|developers|mixed",
    "suggestedFrameworks": ["framework1", "framework2"]
  }
}

UI Detection Guidelines:
- Set "needsUI" to true if project needs any visual interface users interact with
- "uiType" should be one of:
  * "website" - Marketing/content site, blog, portfolio
  * "web_app" - Interactive application (dashboard, SaaS, tool)
  * "desktop" - Native desktop application (Windows, Mac, Linux)
  * "mobile" - Phone/tablet app (iOS, Android, cross-platform)
  * "terminal" - CLI tool or TUI (Terminal UI)
  * "api_only" - Backend service, API, headless service
  * null if unclear
- "uiAudience" indicates who will use the interface:
  * "end_users" - General public or customers
  * "internal" - Company/team internal use
  * "developers" - Other developers integrating with it
  * "mixed" - Multiple audience types
- "suggestedFrameworks" should list 2-3 appropriate UI frameworks based on the uiType

Only include fields in extractedData that were actually discussed or can be reasonably inferred. Respond with ONLY the JSON, no markdown or explanation.`

    // Try local LLM first
    const localResponse = await generateWithLocalLLM(
      systemPrompt || "You are an expert at analyzing conversations and extracting structured insights.",
      extractionPrompt,
      { temperature: 0.5, max_tokens: 1024 }
    )

    if (!localResponse.error) {
      return parseAndReturnInsights(localResponse.content, {
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
          system: systemPrompt || "You are an expert at analyzing conversations and extracting structured insights.",
          messages: [{ role: "user", content: extractionPrompt }]
        })

        const responseText = response.content[0].type === "text"
          ? response.content[0].text.trim()
          : "{}"

        return parseAndReturnInsights(responseText, {
          source: "anthropic",
          model: "claude-sonnet-4-20250514",
          warning: "Using paid API - local LLM unavailable"
        })
      } catch (error) {
        console.error("Anthropic fallback failed:", error)
      }
    }

    // All failed
    return NextResponse.json({
      summary: "",
      keyPoints: [],
      suggestedActions: [],
      extractedData: {},
      error: localResponse.error || "No LLM servers available",
      suggestion: "Start LM Studio or Ollama to enable AI features",
      source: "none"
    })

  } catch (error) {
    console.error("LLM extraction error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to extract insights" },
      { status: 500 }
    )
  }
}

function parseAndReturnInsights(
  content: string,
  meta: { source: string; server?: string; model?: string; warning?: string }
) {
  // Clean up response
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
    const parsed = JSON.parse(cleanedResponse)
    return NextResponse.json({
      summary: parsed.summary || "",
      keyPoints: parsed.keyPoints || [],
      suggestedActions: parsed.suggestedActions || [],
      extractedData: parsed.extractedData || {},
      ...meta
    })
  } catch {
    // If JSON parsing fails, return basic structure with the raw text as summary
    return NextResponse.json({
      summary: content.slice(0, 200),
      keyPoints: [],
      suggestedActions: [],
      extractedData: {},
      parseError: "LLM response was not valid JSON",
      ...meta
    })
  }
}
