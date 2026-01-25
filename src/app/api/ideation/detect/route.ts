import { NextRequest, NextResponse } from "next/server"
import { generate, parseLLMJson } from "@/lib/llm"

const DETECTION_SYSTEM_PROMPT = `You analyze user input to understand what they're exploring and extract key insights.
Return structured JSON with a proper understanding of their input - not just word extraction.
Be intelligent about parsing conversational context, chat logs, and free-form descriptions.

IMPORTANT: Generate contextual, specific content based on what the user actually wrote.
Do NOT use generic or hardcoded responses. Every field should directly relate to the user's input.

Return JSON only, no markdown.`

interface DetectionRequest {
  input: string
  projectName?: string
  allowPaidFallback?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body: DetectionRequest = await request.json()
    const { input, projectName, allowPaidFallback = true } = body

    if (!input) {
      return NextResponse.json(
        { error: "Input is required" },
        { status: 400 }
      )
    }

    const prompt = `Analyze this user input and create a comprehensive understanding report.

INPUT:
"""
${input}
"""

${projectName ? `Project Name: ${projectName}` : ""}

CRITICAL INSTRUCTIONS:
1. Read the user's input carefully and ACTUALLY understand what they're describing
2. Generate a summary that INTERPRETS their input, not just truncates it
3. Extract KEY POINTS that are SPECIFIC to what they mentioned (not generic)
4. Generate QUESTIONS that are SPECIFIC to their context (e.g., if they mention LEDs, ask about their specific LED use case; if they mention collaboration, ask about the collaboration details)
5. Do NOT use hardcoded or generic questions - every question must relate to what the user actually wrote

Return a JSON object with:
{
  "title": "A clear, descriptive title for this exploration based on what they described (5-10 words)",
  "summary": "A 2-3 sentence summary that captures what the user is exploring. Interpret and synthesize their input - what are they really trying to accomplish?",
  "keyPoints": [
    "Specific insight extracted from their input",
    "Another specific detail or concept they mentioned",
    "3-6 total points that capture the essence of their description"
  ],
  "entities": {
    "people": ["Names of specific people mentioned, if any"],
    "places": ["Specific locations mentioned, if any"],
    "technologies": ["Technologies or technical concepts they mentioned"],
    "businesses": ["Companies or business concepts mentioned"],
    "products": ["Products or product types mentioned"]
  },
  "questions": [
    "A clarifying question SPECIFIC to what they described - reference their actual input",
    "Another SPECIFIC question based on gaps in their description",
    "2-4 total questions that would help narrow down THEIR specific concept"
  ],
  "type": "ideation",
  "confidence": 0.6,
  "suggestedApproach": "Brief description of recommended next steps based on their input"
}

Remember: Every field must be generated based on the actual user input, not generic templates.`

    console.log("[ideation/detect] Calling unified LLM service...")
    const llmResponse = await generate({
      systemPrompt: DETECTION_SYSTEM_PROMPT,
      userPrompt: prompt,
      temperature: 0.4,
      max_tokens: 2000,
      allowPaidFallback
    })

    if (llmResponse.content && !llmResponse.error) {
      console.log(`[ideation/detect] LLM responded via ${llmResponse.source}`)
      const parsed = parseLLMJson<{
        title?: string
        summary?: string
        keyPoints?: string[]
        entities?: {
          people?: string[]
          places?: string[]
          technologies?: string[]
          businesses?: string[]
          products?: string[]
        }
        questions?: string[]
        type?: string
        confidence?: number
        suggestedApproach?: string
      }>(llmResponse.content)

      if (parsed && parsed.summary) {
        return NextResponse.json({
          ...formatResponse(parsed, input),
          llmSource: llmResponse.source,
          llmServer: llmResponse.server,
          llmModel: llmResponse.model
        })
      } else {
        console.warn("[ideation/detect] LLM response missing required fields")
      }
    } else {
      console.log("[ideation/detect] LLM failed:", llmResponse.error || "No content")
    }

    // Minimal fallback - only used when ALL LLM backends fail
    // This should be rare - mostly just returns what the user typed with minimal processing
    console.log("[ideation/detect] Using minimal fallback")
    return NextResponse.json(generateMinimalFallback(input))

  } catch (error) {
    console.error("[ideation/detect] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze input" },
      { status: 500 }
    )
  }
}

// Format LLM response into expected structure
function formatResponse(parsed: Record<string, unknown>, input: string) {
  return {
    title: parsed.title || "Exploration",
    summary: parsed.summary || input.slice(0, 300),
    keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
    entities: parsed.entities || {},
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    type: parsed.type === "build" ? "build" : "ideation",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    suggestedApproach: parsed.suggestedApproach || "Explore options",
    suggestedPackets: generateSuggestedPackets(input)
  }
}

// Generate suggested research packets based on context
function generateSuggestedPackets(input: string) {
  // Just one generic packet - the actual content will come from the fractal ideation flow
  return [{
    id: `ideation-${Date.now()}-1`,
    title: "Explore Ideas",
    description: "Use the fractal ideation flow to narrow down what you want to build",
    type: "brainstorm",
    outputFormat: "list",
    prompt: `Based on the following context, help the user explore and narrow down their project idea:\n\n${input}`
  }]
}

// Minimal fallback - only used when ALL LLM backends fail
// This intentionally does NOT have hardcoded questions or suggestions
// It just presents what the user wrote and directs them to the explore flow
function generateMinimalFallback(input: string) {
  // Extract first few words for a basic title
  const words = input.trim().split(/\s+/).slice(0, 6)
  const title = words.length > 0 ? words.join(" ") + "..." : "New Project"

  // Use input as summary (truncated if needed)
  const summary = input.length > 300
    ? input.slice(0, 297) + "..."
    : input

  // Extract any capitalized terms as potential key points
  const capitalizedTerms = input.match(/\b[A-Z][a-zA-Z]+\b/g) || []
  const uniqueTerms = [...new Set(capitalizedTerms)]
    .filter(t => !["I", "The", "This", "That", "What", "How", "Can", "We", "You", "It", "And", "Or", "But", "For"].includes(t))
    .slice(0, 5)

  return {
    title,
    summary,
    keyPoints: uniqueTerms.length > 0 ? uniqueTerms : ["Your project idea"],
    entities: {
      people: [],
      places: [],
      technologies: [],
      businesses: [],
      products: []
    },
    // No hardcoded questions - the fractal ideation flow will generate them dynamically
    questions: [],
    type: "ideation" as const,
    confidence: 0.5,
    suggestedApproach: "Use the Explore & Narrow Down option to discover what you want to build",
    suggestedPackets: generateSuggestedPackets(input),
    llmSource: "fallback"
  }
}
