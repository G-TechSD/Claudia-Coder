/**
 * Patent Prior Art Search API
 * Searches for existing patents and analyzes similarity to user's invention
 * Uses web search to find prior art and LLM to analyze relevance
 */

import { NextRequest, NextResponse } from "next/server"
import { getSessionWithBypass } from "@/lib/auth/api-helpers"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"
import type { PatentSearch, PriorArt } from "@/lib/data/types"

const PRIOR_ART_SEARCH_SYSTEM_PROMPT = `You are an expert patent researcher and intellectual property analyst. Your task is to analyze potential prior art for a new invention.

When analyzing prior art, consider:
1. NOVELTY: Does the prior art teach all elements of the claimed invention?
2. OBVIOUSNESS: Would a person skilled in the art combine prior art to reach the invention?
3. CLAIM SCOPE: What aspects of the invention are potentially patentable?
4. TECHNICAL FIELD: Are the prior art references in the same technical area?

For each prior art reference, provide:
- A similarity score (0-100) based on technical overlap
- Specific areas of overlap with the invention
- Key differentiators that distinguish the invention
- Risk assessment (low/medium/high) for patentability

Return your analysis as valid JSON only, no markdown formatting.`

function generateSearchPrompt(
  inventionTitle: string,
  inventionDescription: string,
  technicalField: string,
  keywords: string[],
  searchResults: string
): string {
  return `PRIOR ART SEARCH ANALYSIS

INVENTION TO ANALYZE:
Title: ${inventionTitle}
Technical Field: ${technicalField}
Description: ${inventionDescription}

Search Keywords: ${keywords.join(", ")}

SEARCH RESULTS TO ANALYZE:
${searchResults}

TASK: Analyze these search results as potential prior art for the invention described above.

For each relevant prior art reference found, extract:
1. Title and patent number (if available)
2. Publication date
3. Abstract/summary
4. Relevant claims
5. Source (USPTO, Google Patents, EPO, WIPO, or Other)
6. Similarity score (0-100)
7. Areas of overlap
8. Differentiators from the invention
9. Risk level (low/medium/high)

Also provide:
- Overall patentability score (0-100, where higher means more likely patentable)
- Patentability assessment summary
- Recommendations for strengthening patent claims

Return ONLY valid JSON in this structure:
{
  "priorArt": [
    {
      "id": "pa-1",
      "title": "Patent title",
      "patentNumber": "US1234567",
      "publicationDate": "2020-01-15",
      "inventors": ["Inventor Name"],
      "assignee": "Company Name",
      "abstract": "Brief description of the patent",
      "claims": ["Key claim 1", "Key claim 2"],
      "url": "https://...",
      "source": "USPTO",
      "similarityScore": 65,
      "overlapAreas": ["Feature A", "Method B"],
      "differentiators": ["Our approach uses X instead of Y"],
      "riskLevel": "medium"
    }
  ],
  "overallPatentabilityScore": 75,
  "patentabilityAssessment": "The invention appears to have good patentability prospects because...",
  "recommendations": ["Focus claims on specific aspect X", "Emphasize the novel use of Y"]
}`
}

function generateId(): string {
  return `patent-search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function generatePriorArtId(): string {
  return `pa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Simulated web search for patents (in production, would use actual patent APIs)
async function searchPatentDatabases(
  inventionTitle: string,
  keywords: string[],
  technicalField: string
): Promise<string> {
  // Build search query
  const searchTerms = [inventionTitle, ...keywords, technicalField].join(" ")

  // In production, this would call actual patent database APIs:
  // - USPTO API: https://developer.uspto.gov/
  // - Google Patents: https://patents.google.com/
  // - EPO Open Patent Services: https://ops.epo.org/
  // - WIPO PATENTSCOPE: https://patentscope.wipo.int/

  // For now, we'll generate a simulated search result structure
  // that the LLM can analyze based on the invention description
  const simulatedResults = `
Patent Database Search Results for: "${searchTerms}"

Note: This is a simulated search. In production, results would come from:
- USPTO Patent Full-Text and Image Database
- Google Patents
- European Patent Office (EPO)
- World Intellectual Property Organization (WIPO)

Based on the search terms, analyze what types of prior art might exist in the following areas:
1. Similar technologies in ${technicalField}
2. Patents containing keywords: ${keywords.join(", ")}
3. Inventions with similar titles or descriptions to: ${inventionTitle}

Consider common patent categories that might overlap:
- Method/process patents
- Apparatus/system patents
- Composition of matter patents
- Improvement patents

Analyze potential prior art based on your knowledge of patents and technologies in this field.
`

  return simulatedResults
}

interface ParsedSearchResult {
  priorArt: Partial<PriorArt>[]
  overallPatentabilityScore: number
  patentabilityAssessment: string
  recommendations: string[]
}

function parseSearchResults(content: string): ParsedSearchResult {
  let jsonStr = content.trim()

  // Remove markdown code blocks if present
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
  }

  try {
    const parsed = JSON.parse(jsonStr)

    return {
      priorArt: (parsed.priorArt || []).map((pa: Partial<PriorArt>) => ({
        id: pa.id || generatePriorArtId(),
        title: pa.title || "Untitled",
        patentNumber: pa.patentNumber,
        publicationDate: pa.publicationDate,
        inventors: pa.inventors || [],
        assignee: pa.assignee,
        abstract: pa.abstract || "",
        claims: pa.claims || [],
        url: pa.url,
        source: pa.source || "Other",
        similarityScore: typeof pa.similarityScore === "number" ? pa.similarityScore : 50,
        overlapAreas: pa.overlapAreas || [],
        differentiators: pa.differentiators || [],
        riskLevel: pa.riskLevel || "medium"
      })),
      overallPatentabilityScore: typeof parsed.overallPatentabilityScore === "number"
        ? parsed.overallPatentabilityScore
        : 50,
      patentabilityAssessment: parsed.patentabilityAssessment || "Analysis unavailable",
      recommendations: parsed.recommendations || []
    }
  } catch (error) {
    console.error("Failed to parse patent search results:", error)
    console.error("Raw content:", content)
    return {
      priorArt: [],
      overallPatentabilityScore: 0,
      patentabilityAssessment: "Failed to parse search results",
      recommendations: []
    }
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify authentication
    const session = await getSessionWithBypass()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      inventionTitle,
      inventionDescription,
      technicalField,
      keywords = [],
      preferredProvider
    } = body

    // Validate required fields
    if (!inventionTitle || !inventionDescription) {
      return NextResponse.json(
        { error: "Invention title and description are required" },
        { status: 400 }
      )
    }

    // Extract keywords if not provided
    const searchKeywords = keywords.length > 0
      ? keywords
      : extractKeywords(inventionTitle, inventionDescription)

    // Search patent databases
    const searchResults = await searchPatentDatabases(
      inventionTitle,
      searchKeywords,
      technicalField || "General Technology"
    )

    // Generate analysis prompt
    const userPrompt = generateSearchPrompt(
      inventionTitle,
      inventionDescription,
      technicalField || "General Technology",
      searchKeywords,
      searchResults
    )

    // Call LLM for analysis
    const llmResponse = await generateWithLocalLLM(
      PRIOR_ART_SEARCH_SYSTEM_PROMPT,
      userPrompt,
      {
        temperature: 0.3,
        max_tokens: 8192,
        preferredServer: preferredProvider
      }
    )

    if (llmResponse.error) {
      return NextResponse.json({
        error: llmResponse.error,
        suggestion: "Ensure LM Studio or Ollama is running with a capable model"
      }, { status: 503 })
    }

    // Parse results
    const results = parseSearchResults(llmResponse.content)

    // Build search result object
    const searchResult: PatentSearch = {
      id: generateId(),
      inventionTitle,
      inventionDescription,
      technicalField: technicalField || "General Technology",
      keywords: searchKeywords,
      searchedAt: new Date().toISOString(),
      status: "completed",
      priorArt: results.priorArt as PriorArt[],
      overallPatentabilityScore: results.overallPatentabilityScore,
      patentabilityAssessment: results.patentabilityAssessment,
      recommendations: results.recommendations,
      generatedBy: {
        server: llmResponse.server || "unknown",
        model: llmResponse.model || "unknown"
      }
    }

    return NextResponse.json({
      success: true,
      search: searchResult,
      searchDuration: (Date.now() - startTime) / 1000,
      source: llmResponse.server,
      model: llmResponse.model
    })

  } catch (error) {
    console.error("Patent search error:", error)

    return NextResponse.json({
      error: error instanceof Error ? error.message : "Patent search failed"
    }, { status: 500 })
  }
}

// Helper to extract keywords from title and description
function extractKeywords(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase()

  // Common stop words to filter out
  const stopWords = new Set([
    "a", "an", "the", "and", "or", "but", "is", "are", "was", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "must", "shall",
    "can", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "under", "again", "further", "then", "once", "here", "there",
    "when", "where", "why", "how", "all", "each", "few", "more", "most",
    "other", "some", "such", "no", "nor", "not", "only", "own", "same",
    "so", "than", "too", "very", "just", "also", "now", "this", "that",
    "these", "those", "it", "its", "which", "who", "whom", "what"
  ])

  // Extract words, filter stop words, get unique terms
  const words = text
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))

  // Count frequency and return top keywords
  const frequency = new Map<string, number>()
  for (const word of words) {
    frequency.set(word, (frequency.get(word) || 0) + 1)
  }

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)
}

// GET endpoint to retrieve search by ID (placeholder for future persistence)
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getSessionWithBypass()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const searchId = searchParams.get("id")

    if (!searchId) {
      return NextResponse.json(
        { error: "Search ID required" },
        { status: 400 }
      )
    }

    // TODO: Implement persistence and retrieval
    return NextResponse.json({
      error: "Search retrieval not yet implemented",
      suggestion: "Searches are currently session-based only"
    }, { status: 501 })
  } catch (error) {
    console.error("[Patent Search API] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to retrieve search" },
      { status: 500 }
    )
  }
}
