/**
 * Business Idea Viability Scoring System
 *
 * Comprehensive assessment of business idea viability with actionable insights
 * for what's hurting the score and how to improve it.
 */

// ============ Core Types ============

/** Viability score from 0-100 */
export type ViabilityScore = number

/** Impact level for factors */
export type ImpactLevel = "critical" | "significant" | "moderate" | "minor"

/** Factor category */
export type FactorCategory =
  | "market_size"
  | "competition"
  | "resources_needed"
  | "time_to_market"
  | "revenue_potential"
  | "risks"

/** Score range classification */
export type ScoreClassification =
  | "excellent"     // 80-100
  | "good"          // 60-79
  | "moderate"      // 40-59
  | "challenging"   // 20-39
  | "poor"          // 0-19

// ============ Factor Definitions ============

export interface FactorImpact {
  description: string
  impact: ImpactLevel
  /** Positive impact adds to score, negative subtracts */
  direction: "positive" | "negative"
  /** Points this factor adds or subtracts (-20 to +20) */
  points: number
}

export interface ViabilityFactor {
  category: FactorCategory
  name: string
  score: number  // 0-100 for this specific factor
  weight: number // How much this factor contributes to overall (0-1)
  positiveImpacts: FactorImpact[]
  negativeImpacts: FactorImpact[]
  /** Net contribution to overall score */
  netContribution: number
}

export interface ViabilityRecommendation {
  id: string
  priority: "high" | "medium" | "low"
  category: FactorCategory
  title: string
  description: string
  expectedImpact: string  // e.g., "+10-15 points"
  effort: "low" | "medium" | "high"
  timeframe: string  // e.g., "1-2 weeks"
}

export interface PivotSuggestion {
  title: string
  description: string
  rationale: string
  potentialScoreIncrease: number
  risks: string[]
}

export interface RevenueEstimate {
  scenario: "conservative" | "moderate" | "optimistic"
  monthlyRevenue: string
  yearOneRevenue: string
  yearThreeRevenue: string
  assumptions: string[]
}

// ============ Main Analysis Result ============

export interface ViabilityAnalysis {
  id: string
  businessIdeaId: string

  // Overall Assessment
  overallScore: ViabilityScore
  classification: ScoreClassification
  summary: string

  // Factor Breakdown
  factors: ViabilityFactor[]

  // What's Hurting the Score (highlighted concerns)
  criticalIssues: {
    factor: FactorCategory
    issue: string
    severity: ImpactLevel
    pointsLost: number
  }[]

  // Positive factors boosting the score
  strengths: {
    factor: FactorCategory
    strength: string
    impact: ImpactLevel
    pointsGained: number
  }[]

  // Actionable Recommendations
  recommendations: ViabilityRecommendation[]

  // Pivot Suggestions (if score is very low)
  pivotSuggestions?: PivotSuggestion[]

  // Revenue & Success Estimates
  revenueEstimates: RevenueEstimate[]
  successProbability: {
    range: string  // e.g., "30-45%"
    factors: string[]
  }

  // Metadata
  analyzedAt: string
  modelUsed?: string
}

// ============ Factor Configuration ============

export const FACTOR_CONFIGS: Record<FactorCategory, {
  name: string
  description: string
  weight: number
  positiveIndicators: string[]
  negativeIndicators: string[]
}> = {
  market_size: {
    name: "Market Size",
    description: "Total addressable market and growth potential",
    weight: 0.20,
    positiveIndicators: [
      "Large TAM (>$1B)",
      "Growing market (>10% YoY)",
      "Clear market need",
      "Multiple customer segments",
      "Global expansion potential"
    ],
    negativeIndicators: [
      "Small niche market",
      "Declining market",
      "Unclear target audience",
      "Limited geographic reach",
      "Saturated market"
    ]
  },
  competition: {
    name: "Competitive Landscape",
    description: "Existing competitors and barriers to entry",
    weight: 0.15,
    positiveIndicators: [
      "Few direct competitors",
      "Clear differentiation",
      "Unique technology/approach",
      "First-mover advantage",
      "Strong moat potential"
    ],
    negativeIndicators: [
      "Many well-funded competitors",
      "Big tech in the space",
      "Low switching costs for users",
      "Commoditized market",
      "Easy to replicate"
    ]
  },
  resources_needed: {
    name: "Resources Required",
    description: "Capital, team, and infrastructure needs",
    weight: 0.15,
    positiveIndicators: [
      "Low initial capital needed",
      "Solo founder viable",
      "Existing skills sufficient",
      "Minimal infrastructure",
      "Can bootstrap"
    ],
    negativeIndicators: [
      "High capital requirements",
      "Specialized team needed",
      "Expensive infrastructure",
      "Regulatory compliance costs",
      "Long runway needed"
    ]
  },
  time_to_market: {
    name: "Time to Market",
    description: "Speed to launch and iterate",
    weight: 0.15,
    positiveIndicators: [
      "MVP in weeks",
      "Simple tech stack",
      "No regulatory approval",
      "Fast iteration possible",
      "Can launch incrementally"
    ],
    negativeIndicators: [
      "Months to MVP",
      "Complex development",
      "Regulatory delays",
      "Hardware dependencies",
      "Network effects needed first"
    ]
  },
  revenue_potential: {
    name: "Revenue Potential",
    description: "Monetization clarity and scalability",
    weight: 0.20,
    positiveIndicators: [
      "Clear monetization model",
      "High willingness to pay",
      "Recurring revenue potential",
      "Multiple revenue streams",
      "High margins possible"
    ],
    negativeIndicators: [
      "Unclear monetization",
      "Price sensitivity",
      "One-time purchases only",
      "High customer acquisition cost",
      "Low lifetime value"
    ]
  },
  risks: {
    name: "Risk Assessment",
    description: "Technical, market, and execution risks",
    weight: 0.15,
    positiveIndicators: [
      "Proven technology",
      "Validated demand",
      "Clear path to profitability",
      "Low regulatory risk",
      "Resilient business model"
    ],
    negativeIndicators: [
      "Unproven technology",
      "Market timing uncertainty",
      "Dependent on single channel",
      "High regulatory risk",
      "External dependencies"
    ]
  }
}

// ============ Utility Functions ============

export function getScoreClassification(score: ViabilityScore): ScoreClassification {
  if (score >= 80) return "excellent"
  if (score >= 60) return "good"
  if (score >= 40) return "moderate"
  if (score >= 20) return "challenging"
  return "poor"
}

export function getScoreColor(score: ViabilityScore): string {
  if (score >= 80) return "text-green-500"
  if (score >= 60) return "text-emerald-500"
  if (score >= 40) return "text-yellow-500"
  if (score >= 20) return "text-orange-500"
  return "text-red-500"
}

export function getScoreBgColor(score: ViabilityScore): string {
  if (score >= 80) return "bg-green-500"
  if (score >= 60) return "bg-emerald-500"
  if (score >= 40) return "bg-yellow-500"
  if (score >= 20) return "bg-orange-500"
  return "bg-red-500"
}

export function getImpactColor(impact: ImpactLevel, direction: "positive" | "negative"): string {
  if (direction === "positive") {
    switch (impact) {
      case "critical": return "text-green-600"
      case "significant": return "text-green-500"
      case "moderate": return "text-green-400"
      case "minor": return "text-green-300"
    }
  } else {
    switch (impact) {
      case "critical": return "text-red-600"
      case "significant": return "text-red-500"
      case "moderate": return "text-orange-500"
      case "minor": return "text-orange-400"
    }
  }
}

export function formatImpactPoints(points: number): string {
  if (points > 0) return `+${points}`
  return `${points}`
}

export function shouldSuggestPivot(analysis: ViabilityAnalysis): boolean {
  return analysis.overallScore < 35 ||
    analysis.criticalIssues.some(i => i.severity === "critical" && i.pointsLost >= 15)
}

// ============ LLM Prompt Generation ============

export const VIABILITY_SYSTEM_PROMPT = `You are an expert startup advisor and business analyst specializing in evaluating the viability of business ideas. Your role is to provide honest, actionable assessments.

Your analysis must be:
1. BRUTALLY HONEST - Don't sugarcoat challenges. Founders need to know real obstacles.
2. ACTIONABLE - Every weakness should come with concrete steps to improve.
3. DATA-DRIVEN - Reference market data, industry benchmarks when possible.
4. BALANCED - Acknowledge both strengths and weaknesses fairly.

When scoring, use this scale:
- 80-100: Excellent - Strong potential, proceed with confidence
- 60-79: Good - Viable with some improvements needed
- 40-59: Moderate - Significant challenges to address
- 20-39: Challenging - Major pivots or changes required
- 0-19: Poor - Consider different approach entirely

Be specific about what's hurting the score and exactly how to fix it.

IMPORTANT: Respond with valid JSON only. No markdown, no explanation outside JSON.`

export function generateViabilityPrompt(
  ideaTitle: string,
  executiveSummary: string,
  additionalContext?: {
    targetAudience?: string
    revenueModel?: string
    competitiveAdvantage?: string
    keyRisks?: string[]
  }
): string {
  const context = additionalContext ? `

ADDITIONAL CONTEXT:
- Target Audience: ${additionalContext.targetAudience || "Not specified"}
- Revenue Model: ${additionalContext.revenueModel || "Not specified"}
- Competitive Advantage: ${additionalContext.competitiveAdvantage || "Not specified"}
- Known Risks: ${additionalContext.keyRisks?.join(", ") || "Not specified"}` : ""

  return `Analyze the viability of this business idea and provide a comprehensive assessment.

BUSINESS IDEA: ${ideaTitle}

EXECUTIVE SUMMARY:
${executiveSummary}
${context}

Provide your analysis as JSON with this exact structure:
{
  "overallScore": <number 0-100>,
  "summary": "<2-3 sentence overall assessment>",

  "factors": [
    {
      "category": "market_size",
      "score": <number 0-100>,
      "positiveImpacts": [
        {
          "description": "<specific positive factor>",
          "impact": "critical|significant|moderate|minor",
          "points": <positive number 1-20>
        }
      ],
      "negativeImpacts": [
        {
          "description": "<specific negative factor>",
          "impact": "critical|significant|moderate|minor",
          "points": <negative number -1 to -20>
        }
      ]
    },
    // Repeat for: competition, resources_needed, time_to_market, revenue_potential, risks
  ],

  "criticalIssues": [
    {
      "factor": "<category>",
      "issue": "<specific problem hurting the score>",
      "severity": "critical|significant|moderate|minor",
      "pointsLost": <number>
    }
  ],

  "strengths": [
    {
      "factor": "<category>",
      "strength": "<specific strength boosting score>",
      "impact": "critical|significant|moderate|minor",
      "pointsGained": <number>
    }
  ],

  "recommendations": [
    {
      "priority": "high|medium|low",
      "category": "<factor category>",
      "title": "<action title>",
      "description": "<detailed recommendation>",
      "expectedImpact": "+X-Y points",
      "effort": "low|medium|high",
      "timeframe": "<e.g., 1-2 weeks>"
    }
  ],

  "pivotSuggestions": [
    {
      "title": "<pivot idea>",
      "description": "<how to pivot>",
      "rationale": "<why this would be better>",
      "potentialScoreIncrease": <number>,
      "risks": ["<risk 1>", "<risk 2>"]
    }
  ],

  "revenueEstimates": [
    {
      "scenario": "conservative",
      "monthlyRevenue": "$X,XXX",
      "yearOneRevenue": "$XX,XXX",
      "yearThreeRevenue": "$XXX,XXX",
      "assumptions": ["<assumption 1>", "<assumption 2>"]
    },
    {
      "scenario": "moderate",
      "monthlyRevenue": "$XX,XXX",
      "yearOneRevenue": "$XXX,XXX",
      "yearThreeRevenue": "$X,XXX,XXX",
      "assumptions": ["<assumption 1>", "<assumption 2>"]
    },
    {
      "scenario": "optimistic",
      "monthlyRevenue": "$XXX,XXX",
      "yearOneRevenue": "$X,XXX,XXX",
      "yearThreeRevenue": "$XX,XXX,XXX",
      "assumptions": ["<assumption 1>", "<assumption 2>"]
    }
  ],

  "successProbability": {
    "range": "XX-YY%",
    "factors": ["<key success factor 1>", "<key success factor 2>"]
  }
}

Be specific and actionable. If the score is below 40, include pivot suggestions.
Focus on what's actually HURTING the score and provide concrete steps to improve.`
}

// ============ Response Parsing ============

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

function cleanJSON(jsonStr: string): string {
  let cleaned = jsonStr
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')
  cleaned = cleaned.replace(/\/\/[^\n]*/g, '')
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  return cleaned
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function parseViabilityResponse(
  response: string,
  businessIdeaId: string
): ViabilityAnalysis | null {
  try {
    let content = response.trim()

    // Remove markdown code blocks if present
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "")
    }

    // Try to extract and parse JSON
    let parsed: Record<string, unknown> | null = null

    try {
      parsed = JSON.parse(content)
    } catch {
      const extracted = extractJSON(content)
      if (extracted) {
        try {
          parsed = JSON.parse(extracted)
        } catch {
          parsed = JSON.parse(cleanJSON(extracted))
        }
      }
    }

    if (!parsed) {
      console.error("Failed to extract valid JSON from viability response")
      return null
    }

    const overallScore = (parsed.overallScore as number) || 50
    const factors = (parsed.factors as unknown[]) || []
    const criticalIssues = (parsed.criticalIssues as unknown[]) || []
    const strengths = (parsed.strengths as unknown[]) || []
    const recommendations = (parsed.recommendations as unknown[]) || []
    const pivotSuggestions = (parsed.pivotSuggestions as unknown[]) || []
    const revenueEstimates = (parsed.revenueEstimates as unknown[]) || []
    const successProbability = parsed.successProbability as Record<string, unknown> || {}

    const analysis: ViabilityAnalysis = {
      id: generateUUID(),
      businessIdeaId,
      overallScore,
      classification: getScoreClassification(overallScore),
      summary: (parsed.summary as string) || "",

      factors: factors.map((f: unknown) => {
        const factor = f as Record<string, unknown>
        const category = factor.category as FactorCategory
        const config = FACTOR_CONFIGS[category]
        const positiveImpacts = ((factor.positiveImpacts as unknown[]) || []).map((p: unknown) => {
          const impact = p as Record<string, unknown>
          return {
            description: (impact.description as string) || "",
            impact: (impact.impact as ImpactLevel) || "moderate",
            direction: "positive" as const,
            points: Math.abs((impact.points as number) || 0)
          }
        })
        const negativeImpacts = ((factor.negativeImpacts as unknown[]) || []).map((n: unknown) => {
          const impact = n as Record<string, unknown>
          return {
            description: (impact.description as string) || "",
            impact: (impact.impact as ImpactLevel) || "moderate",
            direction: "negative" as const,
            points: -Math.abs((impact.points as number) || 0)
          }
        })

        const netContribution =
          positiveImpacts.reduce((sum, p) => sum + p.points, 0) +
          negativeImpacts.reduce((sum, n) => sum + n.points, 0)

        return {
          category,
          name: config?.name || category,
          score: (factor.score as number) || 50,
          weight: config?.weight || 0.15,
          positiveImpacts,
          negativeImpacts,
          netContribution
        }
      }),

      criticalIssues: criticalIssues.map((i: unknown) => {
        const issue = i as Record<string, unknown>
        return {
          factor: (issue.factor as FactorCategory) || "risks",
          issue: (issue.issue as string) || "",
          severity: (issue.severity as ImpactLevel) || "moderate",
          pointsLost: Math.abs((issue.pointsLost as number) || 0)
        }
      }),

      strengths: strengths.map((s: unknown) => {
        const strength = s as Record<string, unknown>
        return {
          factor: (strength.factor as FactorCategory) || "market_size",
          strength: (strength.strength as string) || "",
          impact: (strength.impact as ImpactLevel) || "moderate",
          pointsGained: Math.abs((strength.pointsGained as number) || 0)
        }
      }),

      recommendations: recommendations.map((r: unknown) => {
        const rec = r as Record<string, unknown>
        return {
          id: generateUUID(),
          priority: (rec.priority as "high" | "medium" | "low") || "medium",
          category: (rec.category as FactorCategory) || "market_size",
          title: (rec.title as string) || "",
          description: (rec.description as string) || "",
          expectedImpact: (rec.expectedImpact as string) || "",
          effort: (rec.effort as "low" | "medium" | "high") || "medium",
          timeframe: (rec.timeframe as string) || ""
        }
      }),

      pivotSuggestions: overallScore < 40 ? pivotSuggestions.map((p: unknown) => {
        const pivot = p as Record<string, unknown>
        return {
          title: (pivot.title as string) || "",
          description: (pivot.description as string) || "",
          rationale: (pivot.rationale as string) || "",
          potentialScoreIncrease: (pivot.potentialScoreIncrease as number) || 0,
          risks: Array.isArray(pivot.risks) ? (pivot.risks as string[]) : []
        }
      }) : undefined,

      revenueEstimates: revenueEstimates.map((e: unknown) => {
        const estimate = e as Record<string, unknown>
        return {
          scenario: (estimate.scenario as "conservative" | "moderate" | "optimistic") || "moderate",
          monthlyRevenue: (estimate.monthlyRevenue as string) || "$0",
          yearOneRevenue: (estimate.yearOneRevenue as string) || "$0",
          yearThreeRevenue: (estimate.yearThreeRevenue as string) || "$0",
          assumptions: Array.isArray(estimate.assumptions) ? (estimate.assumptions as string[]) : []
        }
      }),

      successProbability: {
        range: (successProbability.range as string) || "0-100%",
        factors: Array.isArray(successProbability.factors)
          ? (successProbability.factors as string[])
          : []
      },

      analyzedAt: new Date().toISOString()
    }

    return analysis
  } catch (error) {
    console.error("Failed to parse viability response:", error)
    return null
  }
}

// ============ Storage ============

const VIABILITY_STORAGE_KEY = "claudia_viability_analyses"

function getStoredAnalyses(): Record<string, ViabilityAnalysis> {
  if (typeof window === "undefined") return {}
  const stored = localStorage.getItem(VIABILITY_STORAGE_KEY)
  return stored ? JSON.parse(stored) : {}
}

function saveAllAnalyses(data: Record<string, ViabilityAnalysis>): void {
  if (typeof window === "undefined") return
  localStorage.setItem(VIABILITY_STORAGE_KEY, JSON.stringify(data))
}

export function saveViabilityAnalysis(analysis: ViabilityAnalysis): void {
  const allData = getStoredAnalyses()
  allData[analysis.businessIdeaId] = analysis
  saveAllAnalyses(allData)
}

export function getViabilityAnalysis(businessIdeaId: string): ViabilityAnalysis | null {
  const allData = getStoredAnalyses()
  return allData[businessIdeaId] || null
}

export function deleteViabilityAnalysis(businessIdeaId: string): boolean {
  const allData = getStoredAnalyses()
  if (allData[businessIdeaId]) {
    delete allData[businessIdeaId]
    saveAllAnalyses(allData)
    return true
  }
  return false
}

export function getAllViabilityAnalyses(): ViabilityAnalysis[] {
  const allData = getStoredAnalyses()
  return Object.values(allData)
}
