/**
 * Business Development Brain Dump API
 * Process voice/text brain dumps into structured business development analysis
 *
 * POST /api/business-dev/brain-dump
 *
 * Key principle: NOTHING GETS LOST
 * - All brain dumps are saved with transcriptions
 * - Links maintained between brain dump and generated business dev
 * - Original content always accessible
 */

import { NextRequest, NextResponse } from "next/server"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"
import { verifyApiAuth, unauthorizedResponse } from "@/lib/auth/api-helpers"

const SYSTEM_PROMPT = `You are an expert business analyst helping entrepreneurs transform their raw ideas into structured business development plans.

Your task is to analyze a brain dump (stream-of-consciousness thoughts about a business idea) and extract a comprehensive business development analysis.

Be thorough but realistic. Extract specific insights from what the user said, and fill in reasonable assumptions where needed. Always provide concrete, actionable information.

Return ONLY valid JSON matching the exact structure requested. No markdown, no explanation.`

function buildUserPrompt(
  brainDumpContent: string,
  projectName: string,
  projectDescription: string
): string {
  return `Analyze this brain dump for the project "${projectName}" and generate a complete business development analysis.

PROJECT CONTEXT:
${projectDescription}

BRAIN DUMP CONTENT:
${brainDumpContent}

Generate a comprehensive business development analysis in this exact JSON format:
{
  "executiveSummary": "A 2-3 paragraph executive summary of the business opportunity based on the brain dump",
  "valueProposition": "Clear statement of the unique value this provides",
  "targetMarket": "Description of the target audience and market size",
  "competitiveAdvantage": "What makes this different from competitors",
  "features": [
    {
      "id": "feat-1",
      "name": "Feature name",
      "description": "Feature description",
      "priority": "high|medium|low",
      "status": "planned",
      "estimatedValue": "$X/month or similar"
    }
  ],
  "marketSegments": [
    {
      "name": "Segment name",
      "percentage": 25,
      "color": "#hexcolor",
      "description": "Segment description"
    }
  ],
  "revenueStreams": [
    {
      "name": "Revenue stream name",
      "description": "How this generates revenue",
      "estimatedRevenue": "$X/month",
      "timeframe": "Year 1",
      "confidence": "high|medium|low"
    }
  ],
  "proForma": {
    "revenue": [
      {"category": "Revenue category", "year1": 10000, "year2": 50000, "year3": 150000}
    ],
    "expenses": [
      {"category": "Expense category", "year1": 5000, "year2": 20000, "year3": 50000}
    ],
    "summary": {
      "year1Profit": 5000,
      "year2Profit": 30000,
      "year3Profit": 100000,
      "breakEvenMonth": 8
    }
  },
  "risks": ["Risk 1", "Risk 2", "Risk 3"],
  "opportunities": ["Opportunity 1", "Opportunity 2", "Opportunity 3"]
}

IMPORTANT:
- Extract real insights from the brain dump - don't just generate generic content
- If they mentioned specific markets, features, or concerns, include those
- Be realistic with financial projections based on the project scope
- Include 4-6 features, 3-4 market segments, 2-4 revenue streams
- Include 3-5 risks and opportunities based on what was mentioned
- Use realistic market segment colors like #3b82f6, #10b981, #f59e0b, #ef4444

Return ONLY valid JSON.`
}

function parseJsonResponse(content: string): unknown | null {
  try {
    let jsonStr = content.trim()

    // Remove markdown code blocks if present
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }

    // Try to extract JSON from text
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }

    return JSON.parse(jsonStr)
  } catch (error) {
    console.error("Failed to parse JSON response:", error)
    return null
  }
}

function generatePlaceholderAnalysis(
  projectName: string,
  brainDumpContent: string
): Record<string, unknown> {
  // Extract some keywords from the brain dump for more relevant placeholders
  const words = brainDumpContent.toLowerCase()
  const mentionsApp = words.includes("app") || words.includes("application")
  const mentionsSaaS = words.includes("saas") || words.includes("subscription")
  const mentionsB2B = words.includes("business") || words.includes("enterprise") || words.includes("b2b")

  return {
    executiveSummary: `${projectName} represents a business opportunity identified through the brain dump session. The analysis below captures the key insights and potential paths forward based on the ideas expressed.`,
    valueProposition: `${projectName} provides value to its target users by addressing the needs identified in the brain dump.`,
    targetMarket: mentionsB2B
      ? "Small to medium businesses and enterprise customers seeking improved solutions."
      : "Consumers and professionals looking for better tools and experiences.",
    competitiveAdvantage: "First-mover advantage combined with user-centric design based on direct user feedback.",
    features: [
      {
        id: "feat-1",
        name: "Core Functionality",
        description: "Primary feature set derived from brain dump insights",
        priority: "high",
        status: "planned",
        estimatedValue: "$5K-10K/month"
      },
      {
        id: "feat-2",
        name: "User Dashboard",
        description: "Management and monitoring interface",
        priority: "high",
        status: "planned",
        estimatedValue: "$2K-5K/month"
      },
      {
        id: "feat-3",
        name: "Integration Capabilities",
        description: "Connect with existing tools and workflows",
        priority: "medium",
        status: "planned",
        estimatedValue: "$3K-8K/month"
      }
    ],
    marketSegments: [
      { name: "Primary Users", percentage: 45, color: "#3b82f6", description: "Main target demographic" },
      { name: "Secondary Market", percentage: 30, color: "#10b981", description: "Adjacent market opportunity" },
      { name: "Enterprise", percentage: 25, color: "#f59e0b", description: "Larger organization potential" }
    ],
    revenueStreams: [
      {
        name: mentionsSaaS ? "Subscription Revenue" : "Primary Revenue",
        description: mentionsSaaS ? "Monthly/annual subscription fees" : "Main revenue generation",
        estimatedRevenue: "$15K-50K/month",
        timeframe: "Year 1-3",
        confidence: "medium"
      },
      {
        name: "Premium Features",
        description: "Advanced functionality for power users",
        estimatedRevenue: "$5K-20K/month",
        timeframe: "Year 2-3",
        confidence: "medium"
      }
    ],
    proForma: {
      revenue: [
        { category: "Subscriptions", year1: 60000, year2: 180000, year3: 450000 },
        { category: "Premium/Enterprise", year1: 20000, year2: 120000, year3: 300000 }
      ],
      expenses: [
        { category: "Development", year1: 80000, year2: 120000, year3: 180000 },
        { category: "Marketing", year1: 20000, year2: 60000, year3: 100000 },
        { category: "Operations", year1: 15000, year2: 40000, year3: 80000 }
      ],
      summary: {
        year1Profit: -35000,
        year2Profit: 80000,
        year3Profit: 390000,
        breakEvenMonth: 16
      }
    },
    risks: [
      "Market competition from established players",
      "Technology adoption barriers",
      "Resource constraints during initial development",
      "Pricing pressure from alternatives"
    ],
    opportunities: [
      "Growing market demand for solutions in this space",
      "Partnership opportunities with complementary services",
      "International expansion potential",
      "Platform ecosystem development"
    ]
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyApiAuth()
    if (!authResult) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const {
      projectId,
      projectName,
      projectDescription,
      brainDumpContent,
      brainDumpEntryId,
      preferredProvider,
      preferredModel,
      allowPaidFallback = false
    } = body

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    if (!brainDumpContent) {
      return NextResponse.json({ error: "brainDumpContent is required" }, { status: 400 })
    }

    const userPrompt = buildUserPrompt(
      brainDumpContent,
      projectName || "Project",
      projectDescription || ""
    )

    // Try local LLM first
    const localResponse = await generateWithLocalLLM(
      SYSTEM_PROMPT,
      userPrompt,
      {
        temperature: 0.7,
        max_tokens: 8192,
        preferredServer: preferredProvider,
        preferredModel: preferredModel
      }
    )

    if (!localResponse.error) {
      const parsed = parseJsonResponse(localResponse.content)
      if (parsed) {
        return NextResponse.json({
          success: true,
          businessDev: {
            id: `bd-${Date.now()}`,
            ...parsed,
            generatedAt: new Date().toISOString(),
            generatedBy: `${localResponse.server}:${localResponse.model}`,
            brainDumpEntryId
          },
          source: "local",
          server: localResponse.server,
          model: localResponse.model
        })
      }
    }

    // Try Anthropic fallback if allowed
    if (allowPaidFallback && process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }]
        })

        const content = response.content[0].type === "text" ? response.content[0].text : ""
        const parsed = parseJsonResponse(content)

        if (parsed) {
          return NextResponse.json({
            success: true,
            businessDev: {
              id: `bd-${Date.now()}`,
              ...parsed,
              generatedAt: new Date().toISOString(),
              generatedBy: "Anthropic Claude Sonnet 4",
              brainDumpEntryId
            },
            source: "anthropic",
            server: "Anthropic",
            model: "claude-sonnet-4"
          })
        }
      } catch (error) {
        console.error("Anthropic brain dump processing failed:", error)
      }
    }

    // Return placeholder analysis if no LLM available
    const placeholder = generatePlaceholderAnalysis(projectName || "Project", brainDumpContent)

    return NextResponse.json({
      success: true,
      businessDev: {
        id: `bd-${Date.now()}`,
        ...placeholder,
        generatedAt: new Date().toISOString(),
        generatedBy: "Placeholder (No LLM Available)",
        brainDumpEntryId
      },
      source: "placeholder",
      server: "local",
      model: "template"
    })

  } catch (error) {
    console.error("[business-dev/brain-dump] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process brain dump" },
      { status: 500 }
    )
  }
}
