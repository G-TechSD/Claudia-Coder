/**
 * Business Development Generator
 *
 * Generates comprehensive business analysis including:
 * - Executive Summary
 * - Feature Analysis
 * - Market Analysis
 * - Monetization Strategy
 * - ProForma Financial Projections
 */

import type { BusinessDev } from "@/lib/data/types"

/**
 * System prompt for business development generation
 */
export const BUSINESS_DEV_SYSTEM_PROMPT = `You are an expert business analyst and startup advisor. You create comprehensive business analysis documents that help entrepreneurs understand the commercial potential of their software projects.

Your analysis should be:
1. REALISTIC - Based on market data and industry standards
2. ACTIONABLE - Provide specific, implementable strategies
3. COMPREHENSIVE - Cover all aspects of commercial viability
4. PROFESSIONAL - Suitable for investor presentations

Focus on practical monetization strategies and realistic financial projections. Be honest about challenges and risks.

Respond with valid JSON only, no markdown.`

/**
 * Generate user prompt for business development
 */
export function generateBusinessDevPrompt(
  projectName: string,
  projectDescription: string,
  buildPlanSpec?: {
    name?: string
    description?: string
    objectives?: string[]
    techStack?: string[]
  }
): string {
  const objectives = buildPlanSpec?.objectives?.join("\n- ") || "Not specified"
  const techStack = buildPlanSpec?.techStack?.join(", ") || "Not specified"

  return `Generate a comprehensive business development analysis for:

PROJECT: ${projectName}
DESCRIPTION: ${projectDescription}

OBJECTIVES:
- ${objectives}

TECH STACK: ${techStack}

Generate the business analysis as JSON with this structure:
{
  "executiveSummary": {
    "overview": "A 2-3 sentence high-level overview of the project and its commercial potential",
    "problem": "The specific problem this project solves (1-2 sentences)",
    "solution": "How this project solves the problem (1-2 sentences)",
    "targetMarket": "Who would pay for this and why (1-2 sentences)",
    "uniqueValue": "What makes this different from alternatives (1-2 sentences)"
  },
  "features": [
    {
      "name": "Feature name",
      "description": "What the feature does",
      "userBenefit": "Why users care about this feature"
    }
  ],
  "marketAnalysis": {
    "marketSize": "Estimated market size (e.g., '$5B global market for X')",
    "targetAudience": "Specific description of ideal customers",
    "competitors": ["Competitor 1", "Competitor 2", "Competitor 3"],
    "differentiators": ["Key differentiator 1", "Key differentiator 2"]
  },
  "monetization": {
    "model": "Primary monetization model (freemium, subscription, one-time, SaaS, etc.)",
    "pricing": "Suggested pricing strategy (e.g., '$29/month for Pro, $99/month for Enterprise')",
    "revenueStreams": ["Primary revenue stream", "Secondary revenue stream"]
  },
  "proForma": {
    "yearOneRevenue": "Projected first year revenue with assumptions",
    "yearTwoRevenue": "Projected second year revenue with growth assumptions",
    "yearThreeRevenue": "Projected third year revenue",
    "expenses": ["Development costs", "Marketing", "Infrastructure", "Support"],
    "profitMargin": "Expected profit margin percentage",
    "breakEvenPoint": "When the project is expected to break even"
  }
}

Be realistic and practical. If this is a developer tool or internal project, acknowledge that and suggest appropriate monetization (open source + consulting, enterprise licensing, etc.). For consumer apps, suggest freemium or subscription models with realistic conversion rates.

Provide specific numbers where possible, with clear assumptions stated.`
}

/**
 * Extract JSON from LLM response
 */
function extractJSON(text: string): string | null {
  const jsonPatterns = [
    /```(?:json)?\s*(\{[\s\S]*?\})\s*```/,
    /(\{[\s\S]*\})/,
  ]

  for (const pattern of jsonPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * Clean and fix common JSON issues from LLM output
 */
function cleanJSON(jsonStr: string): string {
  let cleaned = jsonStr
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')
  cleaned = cleaned.replace(/\/\/[^\n]*/g, '')
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')
  cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  return cleaned
}

/**
 * Try multiple parsing strategies to extract valid business dev data
 */
function tryParseJSON(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content)
  } catch {
    // Continue
  }

  const extracted = extractJSON(content)
  if (extracted) {
    try {
      return JSON.parse(extracted)
    } catch {
      // Continue
    }

    try {
      const cleaned = cleanJSON(extracted)
      return JSON.parse(cleaned)
    } catch {
      // Continue
    }
  }

  return null
}

/**
 * Parse LLM response into BusinessDev
 */
export function parseBusinessDevResponse(
  response: string,
  projectId: string
): BusinessDev | null {
  try {
    let content = response.trim()
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "")
    }

    const parsed = tryParseJSON(content)

    if (!parsed) {
      console.error("Failed to extract valid JSON from business dev response")
      return null
    }

    const execSummary = parsed.executiveSummary as Record<string, unknown> || {}
    const features = (parsed.features as unknown[]) || []
    const marketAnalysis = parsed.marketAnalysis as Record<string, unknown> || {}
    const monetization = parsed.monetization as Record<string, unknown> || {}
    const proForma = parsed.proForma as Record<string, unknown> || {}

    const now = new Date().toISOString()

    const businessDev: BusinessDev = {
      id: crypto.randomUUID(),
      projectId,
      executiveSummary: {
        overview: (execSummary.overview as string) || "",
        problem: (execSummary.problem as string) || "",
        solution: (execSummary.solution as string) || "",
        targetMarket: (execSummary.targetMarket as string) || "",
        uniqueValue: (execSummary.uniqueValue as string) || ""
      },
      features: features.map((f: unknown, index: number) => {
        const feature = f as Record<string, unknown>
        return {
          id: `feature-${index}`,
          name: (feature.name as string) || "",
          description: (feature.description as string) || "",
          userBenefit: (feature.userBenefit as string) || "",
          priority: "should-have" as const
        }
      }),
      marketAnalysis: {
        marketSize: (marketAnalysis.marketSize as string) || "",
        targetAudience: (marketAnalysis.targetAudience as string) || "",
        competitors: Array.isArray(marketAnalysis.competitors)
          ? (marketAnalysis.competitors as unknown[]).map((c) => {
              if (typeof c === "string") {
                return { name: c, description: "", strengths: [], weaknesses: [] }
              }
              const comp = c as Record<string, unknown>
              return {
                name: (comp.name as string) || "",
                description: (comp.description as string) || "",
                strengths: Array.isArray(comp.strengths) ? (comp.strengths as string[]) : [],
                weaknesses: Array.isArray(comp.weaknesses) ? (comp.weaknesses as string[]) : []
              }
            })
          : [],
        differentiators: Array.isArray(marketAnalysis.differentiators)
          ? (marketAnalysis.differentiators as string[])
          : [],
        marketTrends: Array.isArray(marketAnalysis.marketTrends)
          ? (marketAnalysis.marketTrends as string[])
          : []
      },
      monetization: {
        model: (monetization.model as string) || "",
        pricing: (monetization.pricing as string) || "",
        revenueStreams: Array.isArray(monetization.revenueStreams)
          ? (monetization.revenueStreams as string[])
          : []
      },
      proForma: {
        yearOneRevenue: (proForma.yearOneRevenue as string) || "",
        yearTwoRevenue: (proForma.yearTwoRevenue as string) || "",
        yearThreeRevenue: (proForma.yearThreeRevenue as string) || "",
        expenses: Array.isArray(proForma.expenses)
          ? (proForma.expenses as unknown[]).map((e) => {
              if (typeof e === "string") {
                return { category: e, amount: "", frequency: "monthly" as const }
              }
              const exp = e as Record<string, unknown>
              return {
                category: (exp.category as string) || "",
                amount: (exp.amount as string) || "",
                frequency: ((exp.frequency as string) || "monthly") as "one-time" | "monthly" | "annually"
              }
            })
          : [],
        profitMargin: (proForma.profitMargin as string) || "",
        breakEvenPoint: (proForma.breakEvenPoint as string) || "",
        assumptions: Array.isArray(proForma.assumptions)
          ? (proForma.assumptions as string[])
          : []
      },
      status: "draft",
      generatedBy: {
        server: "local",
        model: "unknown"
      },
      createdAt: now,
      updatedAt: now
    }

    return businessDev
  } catch (error) {
    console.error("Failed to parse business dev response:", error)
    return null
  }
}

/**
 * Storage key for business dev data
 */
const BUSINESS_DEV_STORAGE_KEY = "claudia_business_dev"

/**
 * Get stored business dev data for all projects
 */
function getStoredBusinessDev(): Record<string, BusinessDev> {
  if (typeof window === "undefined") return {}
  const stored = localStorage.getItem(BUSINESS_DEV_STORAGE_KEY)
  return stored ? JSON.parse(stored) : {}
}

/**
 * Save all business dev data
 */
function saveAllBusinessDev(data: Record<string, BusinessDev>): void {
  if (typeof window === "undefined") return
  localStorage.setItem(BUSINESS_DEV_STORAGE_KEY, JSON.stringify(data))
}

/**
 * Save business dev for a project
 */
export function saveBusinessDev(projectId: string, businessDev: BusinessDev): void {
  const allData = getStoredBusinessDev()
  allData[projectId] = businessDev
  saveAllBusinessDev(allData)
}

/**
 * Get business dev for a project
 */
export function getBusinessDevForProject(projectId: string): BusinessDev | null {
  const allData = getStoredBusinessDev()
  return allData[projectId] || null
}

/**
 * Delete business dev for a project
 */
export function deleteBusinessDev(projectId: string): boolean {
  const allData = getStoredBusinessDev()
  if (allData[projectId]) {
    delete allData[projectId]
    saveAllBusinessDev(allData)
    return true
  }
  return false
}

/**
 * Generate executive summary document as markdown
 */
export function generateExecutiveSummaryMarkdown(
  projectName: string,
  businessDev: BusinessDev
): string {
  const { executiveSummary, features, marketAnalysis, monetization, proForma } = businessDev

  return `# ${projectName} - Executive Summary

## Overview
${executiveSummary.overview}

## Problem Statement
${executiveSummary.problem}

## Our Solution
${executiveSummary.solution}

## Target Market
${executiveSummary.targetMarket}

## Unique Value Proposition
${executiveSummary.uniqueValue}

---

## Key Features

${features.map(f => `### ${f.name}
${f.description}

**User Benefit:** ${f.userBenefit}
`).join('\n')}

---

## Market Analysis

**Market Size:** ${marketAnalysis.marketSize}

**Target Audience:** ${marketAnalysis.targetAudience}

### Competitive Landscape
${marketAnalysis.competitors.map(c => `- ${c.name}${c.description ? `: ${c.description}` : ''}`).join('\n')}

### Our Differentiators
${marketAnalysis.differentiators.map(d => `- ${d}`).join('\n')}

---

## Monetization Strategy

**Business Model:** ${monetization.model}

**Pricing:** ${monetization.pricing}

### Revenue Streams
${monetization.revenueStreams.map(r => `- ${r}`).join('\n')}

---

## Financial Projections (Pro Forma)

| Metric | Projection |
|--------|------------|
| Year 1 Revenue | ${proForma.yearOneRevenue} |
| Year 2 Revenue | ${proForma.yearTwoRevenue} |
| Year 3 Revenue | ${proForma.yearThreeRevenue} |
| Profit Margin | ${proForma.profitMargin} |
| Break-Even | ${proForma.breakEvenPoint} |

### Key Expenses
${proForma.expenses.map(e => `- ${e.category}: ${e.amount} (${e.frequency})`).join('\n')}

---

*Generated by Claudia on ${new Date(businessDev.createdAt).toLocaleDateString()}*
`
}
