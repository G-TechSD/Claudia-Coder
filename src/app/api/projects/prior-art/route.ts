/**
 * Prior Art Research API
 * Research existing solutions, competitors, and market landscape
 *
 * POST /api/projects/prior-art
 *
 * Performs web search to find similar projects/apps/solutions,
 * analyzes competition, and provides recommendations on whether to pursue.
 */

import { NextRequest, NextResponse } from "next/server"
import { getSessionWithBypass } from "@/lib/auth/api-helpers"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"
import { parseLLMJson } from "@/lib/llm"
import type { PriorArtResearch } from "@/lib/data/types"

// ============ Types ============

interface PriorArtRequest {
  projectId: string
  projectName: string
  projectDescription: string
  buildPlanObjectives?: string[]
  techStack?: string[]
  preferredProvider?: string
  preferredModel?: string
  allowPaidFallback?: boolean
}

interface WebSearchResult {
  title: string
  url: string
  snippet: string
}

// ============ System Prompts ============

const RESEARCH_SYSTEM_PROMPT = `You are an expert market researcher and competitive analyst. Your task is to analyze a project idea and identify existing solutions, competitors, and market opportunities.

You will be provided with:
1. A project name and description
2. Web search results about similar products/services
3. Optional build plan objectives and tech stack

Your analysis should be:
- Thorough and well-researched
- Honest about competition (don't downplay existing solutions)
- Objective about the project's viability
- Actionable with clear recommendations

Always return valid JSON matching the exact structure requested.`

const RESEARCH_USER_PROMPT = `Analyze this project idea and provide a comprehensive prior art research report.

PROJECT NAME: {projectName}
PROJECT DESCRIPTION: {projectDescription}
{objectives}
{techStack}

WEB SEARCH RESULTS:
{searchResults}

Based on this information, provide a detailed analysis in the following JSON format:

{
  "competitors": [
    {
      "id": "comp-1",
      "name": "Competitor Name",
      "url": "https://example.com",
      "description": "What they do and how they compare",
      "category": "direct" | "indirect" | "potential",
      "features": ["feature1", "feature2"],
      "pricing": "$X/month or Free",
      "pricingModel": "free" | "freemium" | "subscription" | "one-time" | "usage-based" | "enterprise",
      "estimatedUsers": "10K-50K",
      "targetAudience": "Who they target",
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1", "weakness2"],
      "ourAdvantage": "What our project does better"
    }
  ],
  "totalCompetitorsFound": 5,
  "marketSaturation": "low" | "medium" | "high" | "oversaturated",
  "marketGapAnalysis": {
    "gaps": [
      {
        "id": "gap-1",
        "description": "Description of market gap",
        "opportunity": "high" | "medium" | "low",
        "addressedByOurProject": true | false
      }
    ],
    "underservedSegments": ["segment1", "segment2"],
    "emergingTrends": ["trend1", "trend2"]
  },
  "comparisonTable": {
    "features": ["Feature 1", "Feature 2", "Feature 3", "Feature 4"],
    "rows": [
      {
        "name": "Your Project",
        "values": {"Feature 1": true, "Feature 2": "Planned", "Feature 3": true, "Feature 4": false}
      },
      {
        "name": "Competitor A",
        "values": {"Feature 1": true, "Feature 2": true, "Feature 3": false, "Feature 4": true}
      }
    ]
  },
  "recommendation": "pursue" | "pivot" | "abandon" | "undetermined",
  "confidenceLevel": "low" | "medium" | "high",
  "whyPursue": ["reason1", "reason2"],
  "whyNotPursue": ["concern1", "concern2"],
  "whatWouldChange": ["condition1", "condition2"],
  "keyInsights": ["insight1", "insight2"],
  "differentiators": ["differentiator1", "differentiator2"],
  "risks": ["risk1", "risk2"],
  "opportunities": ["opportunity1", "opportunity2"]
}

Be thorough and honest. If there are strong existing solutions, acknowledge them. If the market is oversaturated, say so. If there's a genuine opportunity, explain why.

Return ONLY valid JSON.`

// ============ Mock Web Search (to be replaced with actual search) ============

async function performWebSearch(query: string): Promise<WebSearchResult[]> {
  // Try to use a real search API if available
  try {
    // Check if we have a search API configured
    const searchApiKey = process.env.SERPER_API_KEY || process.env.GOOGLE_SEARCH_API_KEY

    if (searchApiKey && process.env.SERPER_API_KEY) {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": searchApiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          q: query,
          num: 10
        })
      })

      if (response.ok) {
        const data = await response.json()
        const results: WebSearchResult[] = []

        // Process organic results
        if (data.organic) {
          for (const item of data.organic.slice(0, 10)) {
            results.push({
              title: item.title || "",
              url: item.link || "",
              snippet: item.snippet || ""
            })
          }
        }

        return results
      }
    }

    // If no search API, use LLM to generate hypothetical results based on its knowledge
    console.log("[prior-art] No search API configured, using LLM knowledge")
    return []
  } catch (error) {
    console.error("[prior-art] Web search failed:", error)
    return []
  }
}

// ============ POST Handler ============

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getSessionWithBypass()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body: PriorArtRequest = await request.json()
    const {
      projectId,
      projectName,
      projectDescription,
      buildPlanObjectives,
      techStack,
      preferredProvider,
      preferredModel,
      allowPaidFallback = false
    } = body

    if (!projectId || !projectName || !projectDescription) {
      return NextResponse.json(
        { error: "projectId, projectName, and projectDescription are required" },
        { status: 400 }
      )
    }

    // Generate search queries
    const searchQueries = generateSearchQueries(projectName, projectDescription)

    // Perform web searches
    let allSearchResults: WebSearchResult[] = []
    for (const query of searchQueries.slice(0, 3)) {
      const results = await performWebSearch(query)
      allSearchResults = [...allSearchResults, ...results]
    }

    // Deduplicate by URL
    const seenUrls = new Set<string>()
    allSearchResults = allSearchResults.filter(r => {
      if (seenUrls.has(r.url)) return false
      seenUrls.add(r.url)
      return true
    })

    // Build the prompt
    const objectivesSection = buildPlanObjectives?.length
      ? `BUILD PLAN OBJECTIVES:\n${buildPlanObjectives.map(o => `- ${o}`).join("\n")}`
      : ""

    const techStackSection = techStack?.length
      ? `TECH STACK: ${techStack.join(", ")}`
      : ""

    const searchResultsSection = allSearchResults.length > 0
      ? allSearchResults.map(r => `- ${r.title}\n  URL: ${r.url}\n  ${r.snippet}`).join("\n\n")
      : "No web search results available. Please analyze based on your knowledge of existing solutions in this space."

    const userPrompt = RESEARCH_USER_PROMPT
      .replace("{projectName}", projectName)
      .replace("{projectDescription}", projectDescription)
      .replace("{objectives}", objectivesSection)
      .replace("{techStack}", techStackSection)
      .replace("{searchResults}", searchResultsSection)

    // Generate analysis using LLM
    const llmResponse = await generateWithLocalLLM(
      RESEARCH_SYSTEM_PROMPT,
      userPrompt,
      {
        temperature: 0.7,
        max_tokens: 8192,
        preferredServer: preferredProvider,
        preferredModel: preferredModel
      }
    )

    let researchData: Partial<PriorArtResearch> | null = null

    if (!llmResponse.error) {
      researchData = parseJsonResponse(llmResponse.content)
    }

    // Try Anthropic fallback if needed
    if (!researchData && allowPaidFallback && process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          system: RESEARCH_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }]
        })

        const content = response.content[0].type === "text" ? response.content[0].text : ""
        researchData = parseJsonResponse(content)

        if (researchData) {
          researchData.generatedBy = {
            server: "Anthropic",
            model: "claude-sonnet-4"
          }
        }
      } catch (error) {
        console.error("[prior-art] Anthropic fallback failed:", error)
      }
    }

    // If still no data, generate placeholder
    if (!researchData) {
      researchData = generatePlaceholderResearch(projectName, projectDescription)
    }

    // Build the full research object
    const research: PriorArtResearch = {
      id: `prior-art-${Date.now()}`,
      projectId,
      status: "completed",
      projectName,
      projectDescription,
      searchQueries,
      competitors: researchData.competitors || [],
      totalCompetitorsFound: researchData.totalCompetitorsFound || researchData.competitors?.length || 0,
      marketGapAnalysis: researchData.marketGapAnalysis,
      marketSaturation: researchData.marketSaturation || "medium",
      comparisonTable: researchData.comparisonTable,
      recommendation: researchData.recommendation || "undetermined",
      confidenceLevel: researchData.confidenceLevel || "low",
      whyPursue: researchData.whyPursue || [],
      whyNotPursue: researchData.whyNotPursue || [],
      whatWouldChange: researchData.whatWouldChange || [],
      keyInsights: researchData.keyInsights || [],
      differentiators: researchData.differentiators || [],
      risks: researchData.risks || [],
      opportunities: researchData.opportunities || [],
      generatedBy: researchData.generatedBy || {
        server: llmResponse.server || "local",
        model: llmResponse.model || "unknown"
      },
      researchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sources: allSearchResults.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet
      }))
    }

    return NextResponse.json({
      success: true,
      research,
      searchQueriesUsed: searchQueries,
      sourcesFound: allSearchResults.length
    })

  } catch (error) {
    console.error("[prior-art] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to research prior art" },
      { status: 500 }
    )
  }
}

// ============ Helper Functions ============

function generateSearchQueries(projectName: string, projectDescription: string): string[] {
  const queries: string[] = []

  // Main concept search
  queries.push(`${projectName} alternatives`)
  queries.push(`${projectName} competitors`)

  // Extract key concepts from description
  const keywords = extractKeywords(projectDescription)
  if (keywords.length > 0) {
    queries.push(`${keywords.slice(0, 3).join(" ")} software`)
    queries.push(`${keywords.slice(0, 3).join(" ")} app`)
  }

  // Generic industry search
  queries.push(`best ${keywords[0] || projectName.toLowerCase()} tools 2024`)

  return queries
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction - remove common words
  const stopWords = new Set([
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
    "be", "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "that", "this", "these", "those",
    "it", "its", "they", "them", "their", "we", "our", "you", "your",
    "i", "me", "my", "he", "she", "him", "her", "his", "hers"
  ])

  const words = text.toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))

  // Get unique words
  return [...new Set(words)].slice(0, 10)
}

function parseJsonResponse(content: string): Partial<PriorArtResearch> | null {
  // Use the shared LLM JSON parser that handles special tokens
  return parseLLMJson<Partial<PriorArtResearch>>(content)
}

function generatePlaceholderResearch(
  projectName: string,
  projectDescription: string
): Partial<PriorArtResearch> {
  return {
    competitors: [
      {
        id: "comp-placeholder-1",
        name: "[Research pending - similar solution]",
        description: "Unable to complete automated research. Manual research recommended.",
        category: "potential",
        features: ["Feature research needed"],
        strengths: ["Market presence"],
        weaknesses: ["Unknown without research"]
      }
    ],
    totalCompetitorsFound: 1,
    marketSaturation: "medium",
    marketGapAnalysis: {
      gaps: [
        {
          id: "gap-1",
          description: "Market gap analysis requires web search access",
          opportunity: "medium",
          addressedByOurProject: false
        }
      ],
      underservedSegments: ["Research needed"],
      emergingTrends: ["Research needed"]
    },
    recommendation: "undetermined",
    confidenceLevel: "low",
    whyPursue: [
      "Unable to complete automated research - manual research recommended"
    ],
    whyNotPursue: [
      "Cannot assess competition without search access"
    ],
    whatWouldChange: [
      "Complete competitive research",
      "Validate market size",
      "Interview potential users"
    ],
    keyInsights: [
      "Automated research could not be completed",
      "Manual competitive analysis recommended"
    ],
    differentiators: [],
    risks: [
      "Unknown competitive landscape"
    ],
    opportunities: [
      "Research needed to identify opportunities"
    ],
    generatedBy: {
      server: "placeholder",
      model: "template"
    }
  }
}
