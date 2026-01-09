/**
 * Business Development Generation API
 * Generate specific sections or full business dev using AI
 *
 * POST /api/business-dev/generate
 *
 * Supports:
 * - Full document generation
 * - Individual section regeneration
 * - Uses local LLM infrastructure with cloud fallback
 */

import { NextRequest, NextResponse } from "next/server"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"
import {
  getBusinessDev,
  updateBusinessDev
} from "@/lib/data/business-dev"
import { getProject } from "@/lib/data/projects"
import { getBuildPlanForProject } from "@/lib/data/build-plans"
import type {
  BusinessDevSectionType,
  BusinessDevExecutiveSummary,
  BusinessDevFeature,
  BusinessDevMarketAnalysis,
  BusinessDevMonetization,
  BusinessDevProForma,
  BusinessDevGoToMarket,
  BusinessDevRisks
} from "@/lib/data/types"

// ============ Section Generation Prompts ============

const SECTION_PROMPTS: Record<BusinessDevSectionType, string> = {
  executiveSummary: `Generate an executive summary for a software product business plan.

The executive summary should include:
1. Overview - A compelling 2-3 sentence description of what the product does
2. Problem - Clear statement of the problem being solved
3. Solution - How this product solves the problem
4. Target Market - Who the ideal customers are
5. Unique Value - What makes this different from alternatives

Return JSON:
{
  "overview": "string",
  "problem": "string",
  "solution": "string",
  "targetMarket": "string",
  "uniqueValue": "string"
}`,

  features: `Generate a list of key features for a software product business plan.

For each feature, include:
- id: Unique identifier (e.g., "feature-0", "feature-1")
- name: Feature name
- description: Detailed feature description
- userBenefit: How this benefits the user
- priority: "must-have", "should-have", or "nice-to-have"

Generate 5-8 compelling features based on the project context.

Return JSON array:
[
  {
    "id": "feature-0",
    "name": "string",
    "description": "string",
    "userBenefit": "string",
    "priority": "must-have" | "should-have" | "nice-to-have"
  }
]`,

  marketAnalysis: `Generate a market analysis for a software product business plan.

Include:
1. marketSize - Total addressable market with specific numbers/estimates
2. targetAudience - Detailed user personas and demographics
3. competitors - Array of 3-5 competitors with:
   - name, description, strengths[], weaknesses[]
4. differentiators - Array of 4-6 key differentiators
5. marketTrends - Array of 4-6 relevant market trends

Return JSON:
{
  "marketSize": "string",
  "targetAudience": "string",
  "competitors": [{"name": "string", "description": "string", "strengths": [], "weaknesses": []}],
  "differentiators": ["string"],
  "marketTrends": ["string"]
}`,

  monetization: `Generate a monetization strategy for a software product business plan.

Include:
1. model - Business model type (e.g., "subscription", "freemium", "one-time", "usage-based")
2. pricing - Overall pricing strategy description
3. pricingTiers - Array of 3-4 pricing tiers with:
   - name, price (e.g., "$29/month"), features[]
4. revenueStreams - Array of 3-5 revenue stream descriptions

Return JSON:
{
  "model": "string",
  "pricing": "string",
  "pricingTiers": [{"name": "string", "price": "string", "features": ["string"]}],
  "revenueStreams": ["string"]
}`,

  proForma: `Generate financial projections (pro forma) for a software product business plan.

Include:
1. yearOneRevenue - Projected year 1 revenue (e.g., "$120,000")
2. yearTwoRevenue - Projected year 2 revenue
3. yearThreeRevenue - Projected year 3 revenue
4. expenses - Array of expense categories with:
   - category, amount (e.g., "$5,000"), frequency ("one-time" | "monthly" | "annually")
5. profitMargin - Expected profit margin percentage
6. breakEvenPoint - When break-even is expected (e.g., "Month 14")
7. assumptions - Array of 4-6 key assumptions

Be realistic with numbers based on the project scope.

Return JSON:
{
  "yearOneRevenue": "string",
  "yearTwoRevenue": "string",
  "yearThreeRevenue": "string",
  "expenses": [{"category": "string", "amount": "string", "frequency": "one-time" | "monthly" | "annually"}],
  "profitMargin": "string",
  "breakEvenPoint": "string",
  "assumptions": ["string"]
}`,

  goToMarket: `Generate a go-to-market strategy for a software product business plan.

Include:
1. launchStrategy - Detailed launch approach (2-3 paragraphs)
2. marketingChannels - Array of 5-7 marketing channels
3. partnerships - Array of 3-5 potential partnership opportunities
4. milestones - Array of 4-6 key milestones with:
   - name, date (e.g., "Q2 2025"), description

Return JSON:
{
  "launchStrategy": "string",
  "marketingChannels": ["string"],
  "partnerships": ["string"],
  "milestones": [{"name": "string", "date": "string", "description": "string"}]
}`,

  risks: `Generate a risk assessment for a software product business plan.

Include risks array with 5-8 risks, each containing:
- id: Unique identifier (e.g., "risk-0")
- category: "market" | "technical" | "financial" | "operational" | "regulatory"
- description: Clear description of the risk
- likelihood: "low" | "medium" | "high"
- impact: "low" | "medium" | "high"
- mitigation: Strategy to mitigate this risk

Return JSON:
{
  "risks": [
    {
      "id": "risk-0",
      "category": "market" | "technical" | "financial" | "operational" | "regulatory",
      "description": "string",
      "likelihood": "low" | "medium" | "high",
      "impact": "low" | "medium" | "high",
      "mitigation": "string"
    }
  ]
}`
}

const SYSTEM_PROMPT = `You are an expert business analyst creating comprehensive business development plans for software products. Be specific, actionable, and realistic. Provide concrete numbers where possible. Return ONLY valid JSON matching the exact structure requested. No markdown, no additional text.`

// ============ POST Handler ============

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      projectId,
      section,
      preferredProvider,
      preferredModel,
      allowPaidFallback = false
    } = body

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    const project = getProject(projectId)
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const buildPlan = getBuildPlanForProject(projectId)
    const existingBusinessDev = getBusinessDev(projectId)

    // Build context for generation
    const projectContext = buildProjectContext(project, buildPlan, existingBusinessDev)

    // If no specific section, do full generation (legacy behavior)
    if (!section) {
      return handleFullGeneration(
        projectId,
        projectContext,
        preferredProvider,
        preferredModel,
        allowPaidFallback
      )
    }

    // Validate section type
    const validSections: BusinessDevSectionType[] = [
      "executiveSummary", "features", "marketAnalysis",
      "monetization", "proForma", "goToMarket", "risks"
    ]

    if (!validSections.includes(section)) {
      return NextResponse.json(
        { error: `Invalid section: ${section}. Valid sections: ${validSections.join(", ")}` },
        { status: 400 }
      )
    }

    // Generate the specific section
    const result = await generateSection(
      section,
      projectContext,
      preferredProvider,
      preferredModel,
      allowPaidFallback
    )

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Update the business dev document if it exists
    if (existingBusinessDev && result.data) {
      const updateData: Record<string, unknown> = {}
      updateData[section] = result.data

      const updated = updateBusinessDev(projectId, updateData)

      return NextResponse.json({
        success: true,
        section,
        data: result.data,
        businessDev: updated,
        source: result.source,
        server: result.server,
        model: result.model
      })
    }

    return NextResponse.json({
      success: true,
      section,
      data: result.data,
      source: result.source,
      server: result.server,
      model: result.model
    })

  } catch (error) {
    console.error("[business-dev/generate] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate" },
      { status: 500 }
    )
  }
}

// ============ Helper Functions ============

function buildProjectContext(
  project: { name: string; description: string; tags: string[] },
  buildPlan: { originalPlan: { spec: { description: string; objectives: string[]; assumptions?: string[]; risks?: string[]; techStack?: string[] }; packets: Array<{ title: string; description: string; type: string }> } } | null,
  existingBusinessDev: { executiveSummary?: { overview: string }; features?: Array<{ name: string }> } | null
): string {
  let context = `PROJECT: ${project.name}
DESCRIPTION: ${project.description}
TAGS: ${project.tags.join(", ")}
`

  if (buildPlan) {
    const spec = buildPlan.originalPlan.spec
    const packets = buildPlan.originalPlan.packets

    context += `
BUILD PLAN OBJECTIVES:
${spec.objectives.map(o => `- ${o}`).join("\n")}

${spec.assumptions ? `ASSUMPTIONS:\n${spec.assumptions.map(a => `- ${a}`).join("\n")}` : ""}

${spec.risks ? `IDENTIFIED RISKS:\n${spec.risks.map(r => `- ${r}`).join("\n")}` : ""}

${spec.techStack ? `TECH STACK: ${spec.techStack.join(", ")}` : ""}

KEY FEATURES FROM WORK PACKETS:
${packets.filter(p => p.type === "feature").slice(0, 10).map(p => `- ${p.title}: ${p.description}`).join("\n")}
`
  }

  if (existingBusinessDev) {
    context += `
EXISTING BUSINESS DEV CONTEXT:
- Executive Summary: ${existingBusinessDev.executiveSummary?.overview || "Not yet defined"}
- Features: ${existingBusinessDev.features?.map(f => f.name).join(", ") || "Not yet defined"}
`
  }

  return context
}

async function generateSection(
  section: BusinessDevSectionType,
  projectContext: string,
  preferredProvider?: string,
  preferredModel?: string,
  allowPaidFallback = false
): Promise<{
  data: unknown
  error?: string
  source?: string
  server?: string
  model?: string
}> {
  const sectionPrompt = SECTION_PROMPTS[section]
  const userPrompt = `${projectContext}

${sectionPrompt}

Generate this section now. Return ONLY valid JSON.`

  // Try local LLM first
  const localResponse = await generateWithLocalLLM(
    SYSTEM_PROMPT,
    userPrompt,
    {
      temperature: 0.7,
      max_tokens: 4096,
      preferredServer: preferredProvider,
      preferredModel: preferredModel
    }
  )

  if (!localResponse.error) {
    const parsed = parseJsonResponse(localResponse.content)
    if (parsed) {
      return {
        data: parsed,
        source: "local",
        server: localResponse.server,
        model: localResponse.model
      }
    }
  }

  // Try Anthropic fallback if allowed
  if (allowPaidFallback && process.env.ANTHROPIC_API_KEY) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }]
      })

      const content = response.content[0].type === "text" ? response.content[0].text : ""
      const parsed = parseJsonResponse(content)

      if (parsed) {
        return {
          data: parsed,
          source: "anthropic",
          server: "Anthropic",
          model: "claude-sonnet-4"
        }
      }
    } catch (error) {
      console.error("Anthropic section generation failed:", error)
    }
  }

  // Return placeholder data
  const placeholder = getPlaceholderData(section)
  return {
    data: placeholder,
    source: "placeholder",
    server: "local",
    model: "template"
  }
}

async function handleFullGeneration(
  projectId: string,
  projectContext: string,
  preferredProvider?: string,
  preferredModel?: string,
  allowPaidFallback = false
): Promise<NextResponse> {
  // Full generation prompt for legacy compatibility
  const fullPrompt = `${projectContext}

Generate a comprehensive business development analysis in JSON format with the following structure:

{
  "executiveSummary": "A 2-3 paragraph executive summary of the business opportunity",
  "valueProposition": "Clear statement of the unique value this provides",
  "targetMarket": "Description of the target audience and market size",
  "competitiveAdvantage": "What makes this different from competitors",
  "features": [
    {
      "id": "unique-id",
      "name": "Feature name",
      "description": "Feature description",
      "priority": "high|medium|low",
      "status": "planned|in-progress|completed",
      "estimatedValue": "$X/month or similar"
    }
  ],
  "marketSegments": [
    { "name": "Segment name", "percentage": 25, "description": "Segment description" }
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
    "revenue": [{ "category": "Category name", "year1": 10000, "year2": 50000, "year3": 150000 }],
    "expenses": [{ "category": "Category name", "year1": 5000, "year2": 20000, "year3": 50000 }],
    "summary": { "year1Profit": 5000, "year2Profit": 30000, "year3Profit": 100000, "breakEvenMonth": 8 }
  },
  "risks": ["Risk 1", "Risk 2", "Risk 3"],
  "opportunities": ["Opportunity 1", "Opportunity 2", "Opportunity 3"]
}

Be realistic and thorough. Include 4-6 features, 3-4 market segments, 2-4 revenue streams, and 3-5 items each for risks and opportunities.
Return ONLY valid JSON.`

  // Try local LLM
  const localResponse = await generateWithLocalLLM(
    "You are a business analyst. Always respond with valid JSON only.",
    fullPrompt,
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
        analysis: parsed,
        model: `${localResponse.server}:${localResponse.model}`
      })
    }
  }

  // Try Anthropic fallback
  if (allowPaidFallback && process.env.ANTHROPIC_API_KEY) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: "You are a business analyst. Always respond with valid JSON only.",
        messages: [{ role: "user", content: fullPrompt }]
      })

      const content = response.content[0].type === "text" ? response.content[0].text : ""
      const parsed = parseJsonResponse(content)

      if (parsed) {
        return NextResponse.json({
          success: true,
          analysis: parsed,
          model: "Anthropic Claude Sonnet 4"
        })
      }
    } catch (error) {
      console.error("Anthropic full generation failed:", error)
    }
  }

  // Return placeholder analysis
  const project = getProject(projectId)
  const placeholder = generatePlaceholderAnalysis(
    project?.name || "Project",
    project?.description || ""
  )

  return NextResponse.json({
    success: true,
    analysis: placeholder,
    model: "Placeholder (No LLM Available)"
  })
}

function parseJsonResponse(content: string): unknown | null {
  try {
    let jsonStr = content.trim()

    // Remove markdown code blocks if present
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }

    // Try to extract JSON from text
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }

    return JSON.parse(jsonStr)
  } catch (error) {
    console.error("Failed to parse JSON response:", error)
    return null
  }
}

function getPlaceholderData(section: BusinessDevSectionType): unknown {
  const placeholders: Record<BusinessDevSectionType, unknown> = {
    executiveSummary: {
      overview: "[To be generated - provide a compelling overview]",
      problem: "[Define the problem being solved]",
      solution: "[Describe the solution]",
      targetMarket: "[Identify target customers]",
      uniqueValue: "[What makes this unique]"
    } as BusinessDevExecutiveSummary,

    features: [
      {
        id: "feature-0",
        name: "[Feature Name]",
        description: "[Feature description]",
        userBenefit: "[How this benefits users]",
        priority: "must-have"
      }
    ] as BusinessDevFeature[],

    marketAnalysis: {
      marketSize: "[Total addressable market]",
      targetAudience: "[Target user personas]",
      competitors: [{ name: "[Competitor]", description: "", strengths: [], weaknesses: [] }],
      differentiators: ["[Key differentiator]"],
      marketTrends: ["[Market trend]"]
    } as BusinessDevMarketAnalysis,

    monetization: {
      model: "subscription",
      pricing: "[Pricing strategy]",
      pricingTiers: [{ name: "Basic", price: "[TBD]", features: ["Feature 1"] }],
      revenueStreams: ["[Revenue stream]"]
    } as BusinessDevMonetization,

    proForma: {
      yearOneRevenue: "[TBD]",
      yearTwoRevenue: "[TBD]",
      yearThreeRevenue: "[TBD]",
      expenses: [{ category: "Development", amount: "[TBD]", frequency: "monthly" }],
      profitMargin: "[TBD]",
      breakEvenPoint: "[TBD]",
      assumptions: ["[Key assumption]"]
    } as BusinessDevProForma,

    goToMarket: {
      launchStrategy: "[Launch approach]",
      marketingChannels: ["[Channel]"],
      partnerships: ["[Partner]"],
      milestones: [{ name: "Launch", date: "[TBD]", description: "Initial release" }]
    } as BusinessDevGoToMarket,

    risks: {
      risks: [
        {
          id: "risk-0",
          category: "market",
          description: "[Risk description]",
          likelihood: "medium",
          impact: "medium",
          mitigation: "[Mitigation strategy]"
        }
      ]
    } as BusinessDevRisks
  }

  return placeholders[section]
}

function generatePlaceholderAnalysis(projectName: string, projectDescription: string) {
  return {
    executiveSummary: `${projectName} represents a significant business opportunity in the modern digital landscape. ${projectDescription}\n\nThis project has the potential to capture market share by addressing unmet needs in its target market.`,
    valueProposition: `${projectName} provides a unique solution that combines innovation with practical utility.`,
    targetMarket: "Small to medium businesses and individual professionals.",
    competitiveAdvantage: "First-mover advantage combined with user-centric design.",
    features: [
      { id: "feat-1", name: "Core Functionality", description: "Primary feature set", priority: "high", status: "planned", estimatedValue: "$5K-10K/month" },
      { id: "feat-2", name: "User Dashboard", description: "Management interface", priority: "high", status: "planned", estimatedValue: "$2K-5K/month" },
      { id: "feat-3", name: "Integration API", description: "Third-party integrations", priority: "medium", status: "planned", estimatedValue: "$3K-8K/month" }
    ],
    marketSegments: [
      { name: "Enterprise", percentage: 35, description: "Large organizations" },
      { name: "SMB", percentage: 40, description: "Small and medium businesses" },
      { name: "Startups", percentage: 25, description: "Early-stage companies" }
    ],
    revenueStreams: [
      { name: "Subscription Revenue", description: "Monthly/annual subscriptions", estimatedRevenue: "$15K-50K/month", timeframe: "Year 1-3", confidence: "high" },
      { name: "Enterprise Licenses", description: "Custom enterprise deals", estimatedRevenue: "$10K-30K/month", timeframe: "Year 2-3", confidence: "medium" }
    ],
    proForma: {
      revenue: [
        { category: "Subscriptions", year1: 60000, year2: 180000, year3: 450000 },
        { category: "Enterprise", year1: 20000, year2: 120000, year3: 300000 }
      ],
      expenses: [
        { category: "Development", year1: 80000, year2: 120000, year3: 180000 },
        { category: "Marketing", year1: 20000, year2: 60000, year3: 100000 }
      ],
      summary: { year1Profit: -20000, year2Profit: 120000, year3Profit: 470000, breakEvenMonth: 14 }
    },
    risks: [
      "Market competition from established players",
      "Technology adoption barriers",
      "Resource constraints",
      "Pricing pressure"
    ],
    opportunities: [
      "Growing market demand",
      "Partnership opportunities",
      "International expansion",
      "Platform ecosystem development"
    ]
  }
}
