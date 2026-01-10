/**
 * Business Development API
 * CRUD operations for business development documents
 *
 * GET: Get business dev for a project
 * POST: Generate business dev from build plan (uses LLM)
 * PUT: Update business dev
 * DELETE: Remove business dev
 */

import { NextRequest, NextResponse } from "next/server"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"
import {
  getBusinessDev,
  getBusinessDevById,
  updateBusinessDev,
  deleteBusinessDev,
  generateBusinessDev,
  type GenerateBusinessDevInput
} from "@/lib/data/business-dev"
import { getProject } from "@/lib/data/projects"
import { getBuildPlanForProject } from "@/lib/data/build-plans"
import { verifyApiAuth, unauthorizedResponse } from "@/lib/auth/api-helpers"
import type {
  BusinessDev,
  BusinessDevExecutiveSummary,
  BusinessDevFeature,
  BusinessDevMarketAnalysis,
  BusinessDevMonetization,
  BusinessDevProForma,
  BusinessDevGoToMarket,
  BusinessDevRisks
} from "@/lib/data/types"

// ============ System Prompts ============

const BUSINESS_DEV_SYSTEM_PROMPT = `You are an expert business analyst and strategist creating comprehensive business development plans for software products.

Your task is to analyze project information and generate a complete business development document with:
1. Executive Summary - Overview, problem, solution, target market, unique value proposition
2. Feature Analysis - Key features with user benefits and priority levels
3. Market Analysis - Market size, target audience, competitors, differentiators, trends
4. Monetization Strategy - Business model, pricing tiers, revenue streams
5. Financial Projections (Pro Forma) - 3-year revenue projections, expenses, profit margin, break-even
6. Go-to-Market Strategy - Launch strategy, marketing channels, partnerships, milestones
7. Risk Assessment - Market, technical, financial, operational risks with mitigations

Be specific, actionable, and realistic. Provide concrete numbers where possible (even estimates).
Focus on creating a document that could be presented to stakeholders or investors.

Return ONLY valid JSON matching the exact structure requested. No markdown, no additional text.`

// ============ GET Handler ============

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyApiAuth()
    if (!authResult) {
      return unauthorizedResponse()
    }
    const userId = authResult.user.id

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")
    const id = searchParams.get("id")

    // Get by ID if provided
    if (id) {
      const businessDev = getBusinessDevById(id, userId)
      if (!businessDev) {
        return NextResponse.json(
          { error: "Business dev document not found" },
          { status: 404 }
        )
      }
      return NextResponse.json({ businessDev })
    }

    // Get by project ID
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId or id is required" },
        { status: 400 }
      )
    }

    const project = getProject(projectId, userId)
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    const businessDev = getBusinessDev(projectId, userId)

    return NextResponse.json({
      businessDev,
      hasBusinessDev: businessDev !== null
    })
  } catch (error) {
    console.error("Error getting business dev:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get business dev" },
      { status: 500 }
    )
  }
}

// ============ POST Handler (Generate) ============

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyApiAuth()
    if (!authResult) {
      return unauthorizedResponse()
    }
    const userId = authResult.user.id

    const body = await request.json()
    const {
      projectId,
      useAI = true,
      preferredProvider,
      preferredModel,
      allowPaidFallback = false
    } = body

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      )
    }

    const project = getProject(projectId, userId)
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    const buildPlan = getBuildPlanForProject(projectId, userId)

    // If not using AI, generate template-based business dev
    if (!useAI) {
      const businessDev = generateBusinessDev({
        projectId,
        buildPlan: buildPlan || undefined,
        generatedBy: { server: "template", model: "none" },
        userId
      })

      return NextResponse.json({
        businessDev,
        source: "template",
        message: "Generated template-based business dev document"
      })
    }

    // Generate user prompt with project context
    const userPrompt = generateBusinessDevPrompt(project, buildPlan)

    // Try local LLM first
    const localResponse = await generateWithLocalLLM(
      BUSINESS_DEV_SYSTEM_PROMPT,
      userPrompt,
      {
        temperature: 0.7,
        max_tokens: 8192,
        preferredServer: preferredProvider,
        preferredModel: preferredModel
      }
    )

    if (!localResponse.error) {
      const parsed = parseBusinessDevResponse(localResponse.content)
      if (parsed) {
        const businessDev = createBusinessDevFromParsed(
          projectId,
          parsed,
          { server: localResponse.server || "local", model: localResponse.model || "unknown" },
          buildPlan?.id
        )

        return NextResponse.json({
          businessDev,
          source: "local",
          server: localResponse.server,
          model: localResponse.model
        })
      }
    }

    // Try Anthropic if allowed and local failed
    if (allowPaidFallback && process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        })

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          system: BUSINESS_DEV_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }]
        })

        const content = response.content[0].type === "text"
          ? response.content[0].text
          : ""

        const parsed = parseBusinessDevResponse(content)
        if (parsed) {
          const businessDev = createBusinessDevFromParsed(
            projectId,
            parsed,
            { server: "Anthropic", model: "claude-sonnet-4" },
            buildPlan?.id
          )

          return NextResponse.json({
            businessDev,
            source: "anthropic",
            server: "Anthropic",
            model: "claude-sonnet-4",
            warning: "Using paid Anthropic API - local LLM was unavailable"
          })
        }
      } catch (error) {
        console.error("Anthropic business dev generation failed:", error)
      }
    }

    // Fall back to template if AI failed
    const businessDev = generateBusinessDev({
      projectId,
      buildPlan: buildPlan || undefined,
      generatedBy: { server: "template", model: "fallback" },
      userId
    })

    return NextResponse.json({
      businessDev,
      source: "template",
      warning: localResponse.error || "AI generation failed, using template",
      suggestion: "Start LM Studio or Ollama to enable AI features"
    })

  } catch (error) {
    console.error("Error generating business dev:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate business dev" },
      { status: 500 }
    )
  }
}

// ============ PUT Handler (Update) ============

export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyApiAuth()
    if (!authResult) {
      return unauthorizedResponse()
    }
    const userId = authResult.user.id

    const body = await request.json()
    const { projectId, updates } = body

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      )
    }

    const existing = getBusinessDev(projectId, userId)
    if (!existing) {
      return NextResponse.json(
        { error: "Business dev document not found for this project" },
        { status: 404 }
      )
    }

    const updated = updateBusinessDev(projectId, updates, userId)
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update business dev" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      businessDev: updated,
      message: "Business dev updated successfully"
    })
  } catch (error) {
    console.error("Error updating business dev:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update business dev" },
      { status: 500 }
    )
  }
}

// ============ DELETE Handler ============

export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyApiAuth()
    if (!authResult) {
      return unauthorizedResponse()
    }
    const userId = authResult.user.id

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const projectId = searchParams.get("projectId")

    let targetId = id

    // If projectId provided, get the business dev ID for that project
    if (!targetId && projectId) {
      const businessDev = getBusinessDev(projectId, userId)
      if (!businessDev) {
        return NextResponse.json(
          { error: "No business dev found for this project" },
          { status: 404 }
        )
      }
      targetId = businessDev.id
    }

    if (!targetId) {
      return NextResponse.json(
        { error: "id or projectId is required" },
        { status: 400 }
      )
    }

    const deleted = deleteBusinessDev(targetId, userId)
    if (!deleted) {
      return NextResponse.json(
        { error: "Business dev not found or already deleted" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Business dev deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting business dev:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete business dev" },
      { status: 500 }
    )
  }
}

// ============ Helper Functions ============

function generateBusinessDevPrompt(
  project: { name: string; description: string; tags: string[] },
  buildPlan: { originalPlan: { spec: { name: string; description: string; objectives: string[]; nonGoals?: string[]; assumptions?: string[]; risks?: string[]; techStack?: string[] }; packets: Array<{ title: string; description: string; type: string; priority: string; acceptanceCriteria: string[] }> } } | null
): string {
  let prompt = `Generate a comprehensive business development plan for the following software project:

PROJECT NAME: ${project.name}
PROJECT DESCRIPTION: ${project.description}
TAGS: ${project.tags.join(", ")}

`

  if (buildPlan) {
    const spec = buildPlan.originalPlan.spec
    const packets = buildPlan.originalPlan.packets

    prompt += `BUILD PLAN INFORMATION:
Objectives:
${spec.objectives.map(o => `- ${o}`).join("\n")}

${spec.assumptions && spec.assumptions.length > 0 ? `Assumptions:
${spec.assumptions.map(a => `- ${a}`).join("\n")}` : ""}

${spec.risks && spec.risks.length > 0 ? `Identified Risks:
${spec.risks.map(r => `- ${r}`).join("\n")}` : ""}

${spec.techStack && spec.techStack.length > 0 ? `Tech Stack: ${spec.techStack.join(", ")}` : ""}

Key Features (from work packets):
${packets.filter(p => p.type === "feature" || p.type === "enhancement").slice(0, 10).map(p => `- ${p.title}: ${p.description}`).join("\n")}

`
  }

  prompt += `Return a JSON object with this EXACT structure:
{
  "executiveSummary": {
    "overview": "2-3 sentence overview of the product",
    "problem": "Clear problem statement",
    "solution": "How this product solves the problem",
    "targetMarket": "Specific target market description",
    "uniqueValue": "Key differentiating value proposition"
  },
  "features": [
    {
      "id": "feature-0",
      "name": "Feature name",
      "description": "Feature description",
      "userBenefit": "How this benefits users",
      "priority": "must-have" | "should-have" | "nice-to-have"
    }
  ],
  "marketAnalysis": {
    "marketSize": "Total addressable market with numbers",
    "targetAudience": "Specific user personas and demographics",
    "competitors": [
      {
        "name": "Competitor name",
        "description": "What they do",
        "strengths": ["strength1", "strength2"],
        "weaknesses": ["weakness1", "weakness2"]
      }
    ],
    "differentiators": ["key differentiator 1", "key differentiator 2"],
    "marketTrends": ["trend1", "trend2", "trend3"]
  },
  "monetization": {
    "model": "subscription/freemium/one-time/etc",
    "pricing": "Pricing strategy description",
    "pricingTiers": [
      { "name": "Free", "price": "$0/month", "features": ["feature1"] },
      { "name": "Pro", "price": "$X/month", "features": ["all features"] }
    ],
    "revenueStreams": ["primary revenue", "secondary revenue"]
  },
  "proForma": {
    "yearOneRevenue": "$XXX,XXX",
    "yearTwoRevenue": "$X,XXX,XXX",
    "yearThreeRevenue": "$X,XXX,XXX",
    "expenses": [
      { "category": "Development", "amount": "$XX,XXX", "frequency": "monthly" },
      { "category": "Infrastructure", "amount": "$X,XXX", "frequency": "monthly" }
    ],
    "profitMargin": "XX%",
    "breakEvenPoint": "Month XX",
    "assumptions": ["assumption1", "assumption2", "assumption3"]
  },
  "goToMarket": {
    "launchStrategy": "Launch approach description",
    "marketingChannels": ["channel1", "channel2", "channel3"],
    "partnerships": ["potential partner 1", "potential partner 2"],
    "milestones": [
      { "name": "MVP Launch", "date": "Q1 2025", "description": "Initial release" }
    ]
  },
  "risks": {
    "risks": [
      {
        "id": "risk-0",
        "category": "market" | "technical" | "financial" | "operational" | "regulatory",
        "description": "Risk description",
        "likelihood": "low" | "medium" | "high",
        "impact": "low" | "medium" | "high",
        "mitigation": "Mitigation strategy"
      }
    ]
  }
}

Be specific with numbers and actionable with strategies. Return ONLY the JSON, no other text.`

  return prompt
}

interface ParsedBusinessDev {
  executiveSummary: BusinessDevExecutiveSummary
  features: BusinessDevFeature[]
  marketAnalysis: BusinessDevMarketAnalysis
  monetization: BusinessDevMonetization
  proForma: BusinessDevProForma
  goToMarket?: BusinessDevGoToMarket
  risks?: BusinessDevRisks
}

function parseBusinessDevResponse(content: string): ParsedBusinessDev | null {
  try {
    let jsonStr = content.trim()

    // Remove markdown code blocks if present
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }

    const parsed = JSON.parse(jsonStr)

    // Validate required fields
    if (!parsed.executiveSummary || !parsed.features || !parsed.marketAnalysis ||
        !parsed.monetization || !parsed.proForma) {
      console.error("Missing required fields in business dev response")
      return null
    }

    return parsed as ParsedBusinessDev
  } catch (error) {
    console.error("Failed to parse business dev response:", error)
    console.error("Raw content:", content.substring(0, 500))
    return null
  }
}

function createBusinessDevFromParsed(
  projectId: string,
  parsed: ParsedBusinessDev,
  generatedBy: { server: string; model: string },
  buildPlanId?: string
): BusinessDev {
  // Import the createBusinessDev function from data store - but we need to use the one
  // that accepts the full parsed data, not the template generator
  // For now, we'll construct it directly and save

  const now = new Date().toISOString()

  // Generate a UUID
  const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === "x" ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })

  const businessDev: BusinessDev = {
    id,
    projectId,
    status: "draft",
    executiveSummary: parsed.executiveSummary,
    features: parsed.features.map((f, i) => ({
      ...f,
      id: f.id || `feature-${i}`
    })),
    marketAnalysis: parsed.marketAnalysis,
    monetization: parsed.monetization,
    proForma: parsed.proForma,
    goToMarket: parsed.goToMarket,
    risks: parsed.risks,
    generatedBy,
    generatedFromBuildPlanId: buildPlanId,
    createdAt: now,
    updatedAt: now
  }

  // Save to localStorage via the data store
  // We need to access localStorage directly since we're in an API route
  if (typeof window !== "undefined") {
    const STORAGE_KEY = "claudia_business_dev"
    const stored = localStorage.getItem(STORAGE_KEY)
    const docs: BusinessDev[] = stored ? JSON.parse(stored) : []
    docs.push(businessDev)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs))
  }

  return businessDev
}
