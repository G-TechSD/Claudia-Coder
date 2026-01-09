"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Clock,
  Users,
  Shield,
  Swords,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Lightbulb,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Zap,
  Info
} from "lucide-react"
import type {
  ViabilityAnalysis,
  ViabilityFactor,
  FactorCategory,
  ImpactLevel,
  ViabilityRecommendation,
  PivotSuggestion,
  RevenueEstimate
} from "@/lib/business/viability"
import {
  getScoreColor,
  getScoreBgColor,
  getScoreClassification,
  formatImpactPoints,
  FACTOR_CONFIGS
} from "@/lib/business/viability"

// ============ Helper Components ============

const factorIcons: Record<FactorCategory, React.ReactNode> = {
  market_size: <Users className="h-4 w-4" />,
  competition: <Swords className="h-4 w-4" />,
  resources_needed: <DollarSign className="h-4 w-4" />,
  time_to_market: <Clock className="h-4 w-4" />,
  revenue_potential: <TrendingUp className="h-4 w-4" />,
  risks: <Shield className="h-4 w-4" />
}

function ScoreGauge({ score, size = "large" }: { score: number; size?: "small" | "large" }) {
  const radius = size === "large" ? 80 : 40
  const strokeWidth = size === "large" ? 12 : 8
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const offset = circumference - progress

  const colorClass = getScoreBgColor(score)
  const classification = getScoreClassification(score)

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        className={cn("transform -rotate-90", size === "large" ? "w-48 h-48" : "w-24 h-24")}
        viewBox={`0 0 ${(radius + strokeWidth) * 2} ${(radius + strokeWidth) * 2}`}
      >
        {/* Background circle */}
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        {/* Progress circle */}
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            "transition-all duration-1000 ease-out",
            score >= 80 ? "text-green-500" :
            score >= 60 ? "text-emerald-500" :
            score >= 40 ? "text-yellow-500" :
            score >= 20 ? "text-orange-500" :
            "text-red-500"
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn(
          "font-bold",
          size === "large" ? "text-4xl" : "text-xl",
          getScoreColor(score)
        )}>
          {score}
        </span>
        {size === "large" && (
          <span className="text-sm text-muted-foreground capitalize">{classification}</span>
        )}
      </div>
    </div>
  )
}

function ImpactBadge({ level, direction }: { level: ImpactLevel; direction: "positive" | "negative" }) {
  const colorClasses = direction === "positive"
    ? {
        critical: "bg-green-500/20 text-green-400 border-green-500/30",
        significant: "bg-green-400/20 text-green-400 border-green-400/30",
        moderate: "bg-emerald-400/20 text-emerald-400 border-emerald-400/30",
        minor: "bg-emerald-300/20 text-emerald-300 border-emerald-300/30"
      }
    : {
        critical: "bg-red-500/20 text-red-400 border-red-500/30",
        significant: "bg-red-400/20 text-red-400 border-red-400/30",
        moderate: "bg-orange-400/20 text-orange-400 border-orange-400/30",
        minor: "bg-orange-300/20 text-orange-300 border-orange-300/30"
      }

  return (
    <Badge className={cn("text-xs", colorClasses[level])}>
      {level}
    </Badge>
  )
}

// ============ Factor Breakdown Card ============

function FactorCard({ factor, expanded, onToggle }: {
  factor: ViabilityFactor
  expanded: boolean
  onToggle: () => void
}) {
  const config = FACTOR_CONFIGS[factor.category]
  const hasNegatives = factor.negativeImpacts.length > 0
  const hasPositives = factor.positiveImpacts.length > 0

  return (
    <Card className={cn(
      "transition-all",
      factor.score < 40 && "border-red-500/30",
      factor.score >= 70 && "border-green-500/30"
    )}>
      <CardHeader className="pb-2 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              factor.score >= 70 ? "bg-green-500/20 text-green-400" :
              factor.score >= 40 ? "bg-yellow-500/20 text-yellow-400" :
              "bg-red-500/20 text-red-400"
            )}>
              {factorIcons[factor.category]}
            </div>
            <div>
              <CardTitle className="text-sm font-medium">{factor.name}</CardTitle>
              <CardDescription className="text-xs">{config.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className={cn("text-lg font-bold", getScoreColor(factor.score))}>
                {factor.score}
              </div>
              <div className="text-xs text-muted-foreground">
                {factor.netContribution >= 0 ? "+" : ""}{factor.netContribution} net
              </div>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
        <Progress
          value={factor.score}
          className={cn("h-1.5 mt-2", factor.score < 40 && "bg-red-500/20")}
        />
      </CardHeader>

      {expanded && (
        <CardContent className="pt-2 space-y-4">
          {/* Positive Impacts */}
          {hasPositives && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-green-400">
                <TrendingUp className="h-3 w-3" />
                Positive Factors
              </div>
              <div className="space-y-1.5 pl-5">
                {factor.positiveImpacts.map((impact, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-2 text-sm">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{impact.description}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <ImpactBadge level={impact.impact} direction="positive" />
                      <span className="text-green-400 font-medium text-xs">
                        {formatImpactPoints(impact.points)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Negative Impacts */}
          {hasNegatives && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-red-400">
                <TrendingDown className="h-3 w-3" />
                Negative Factors
              </div>
              <div className="space-y-1.5 pl-5">
                {factor.negativeImpacts.map((impact, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-2 text-sm">
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{impact.description}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <ImpactBadge level={impact.impact} direction="negative" />
                      <span className="text-red-400 font-medium text-xs">
                        {formatImpactPoints(impact.points)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ============ Critical Issues Panel ============

function CriticalIssuesPanel({ issues }: {
  issues: ViabilityAnalysis["criticalIssues"]
}) {
  if (issues.length === 0) return null

  return (
    <Card className="border-red-500/50 bg-red-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <CardTitle className="text-base text-red-400">Critical Issues Hurting Your Score</CardTitle>
        </div>
        <CardDescription>
          These factors are significantly reducing your viability score
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {issues.map((issue, idx) => (
          <div
            key={idx}
            className={cn(
              "p-3 rounded-lg border",
              issue.severity === "critical"
                ? "bg-red-500/10 border-red-500/30"
                : "bg-orange-500/10 border-orange-500/30"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <div className={cn(
                  "p-1.5 rounded",
                  issue.severity === "critical" ? "bg-red-500/20" : "bg-orange-500/20"
                )}>
                  {factorIcons[issue.factor]}
                </div>
                <div>
                  <div className="font-medium text-sm">{issue.issue}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {FACTOR_CONFIGS[issue.factor].name}
                  </div>
                </div>
              </div>
              <Badge
                className={cn(
                  "flex-shrink-0",
                  issue.severity === "critical"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-orange-500/20 text-orange-400"
                )}
              >
                -{issue.pointsLost} pts
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ============ Recommendations Panel ============

function RecommendationsPanel({ recommendations }: {
  recommendations: ViabilityRecommendation[]
}) {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? recommendations : recommendations.slice(0, 3)

  const priorityColors = {
    high: "bg-red-500/20 text-red-400 border-red-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-blue-500/20 text-blue-400 border-blue-500/30"
  }

  const effortColors = {
    low: "text-green-400",
    medium: "text-yellow-400",
    high: "text-red-400"
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Recommendations to Improve Score</CardTitle>
        </div>
        <CardDescription>
          Actionable steps to increase your viability score
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayed.map((rec) => (
          <div key={rec.id} className="p-3 rounded-lg border bg-card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={priorityColors[rec.priority]}>
                    {rec.priority} priority
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {FACTOR_CONFIGS[rec.category].name}
                  </Badge>
                </div>
                <div className="font-medium text-sm">{rec.title}</div>
                <div className="text-sm text-muted-foreground mt-1">{rec.description}</div>
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-green-400" />
                    <span className="text-green-400 font-medium">{rec.expectedImpact}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{rec.timeframe}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    <span className={effortColors[rec.effort]}>{rec.effort} effort</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
      {recommendations.length > 3 && (
        <CardFooter>
          <Button variant="ghost" className="w-full" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Show Less" : `Show ${recommendations.length - 3} More`}
            {showAll ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

// ============ Pivot Suggestions Panel ============

function PivotSuggestionsPanel({ suggestions }: {
  suggestions: PivotSuggestion[]
}) {
  if (!suggestions || suggestions.length === 0) return null

  return (
    <Card className="border-purple-500/50 bg-purple-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <ArrowRight className="h-5 w-5 text-purple-400" />
          <CardTitle className="text-base text-purple-400">Consider Pivoting</CardTitle>
        </div>
        <CardDescription>
          Your score is low. These pivots could significantly improve viability.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((pivot, idx) => (
          <div key={idx} className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="font-medium">{pivot.title}</div>
              <Badge className="bg-purple-500/20 text-purple-400">
                +{pivot.potentialScoreIncrease} pts
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{pivot.description}</p>
            <div className="text-sm">
              <span className="text-purple-400 font-medium">Rationale: </span>
              <span className="text-muted-foreground">{pivot.rationale}</span>
            </div>
            {pivot.risks.length > 0 && (
              <div className="mt-2">
                <span className="text-xs text-muted-foreground">Risks: </span>
                <span className="text-xs text-orange-400">{pivot.risks.join(", ")}</span>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ============ Revenue Estimates Panel ============

function RevenueEstimatesPanel({ estimates, successProbability }: {
  estimates: RevenueEstimate[]
  successProbability: ViabilityAnalysis["successProbability"]
}) {
  const scenarioColors = {
    conservative: "border-blue-500/30 bg-blue-500/5",
    moderate: "border-green-500/30 bg-green-500/5",
    optimistic: "border-purple-500/30 bg-purple-500/5"
  }

  const scenarioLabels = {
    conservative: { label: "Conservative", color: "text-blue-400" },
    moderate: { label: "Moderate", color: "text-green-400" },
    optimistic: { label: "Optimistic", color: "text-purple-400" }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-400" />
          <CardTitle className="text-base">Revenue & Success Estimates</CardTitle>
        </div>
        <CardDescription>
          Projected revenue based on different growth scenarios
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {estimates.map((estimate) => (
            <div
              key={estimate.scenario}
              className={cn("p-3 rounded-lg border", scenarioColors[estimate.scenario])}
            >
              <div className={cn("font-medium text-sm mb-2", scenarioLabels[estimate.scenario].color)}>
                {scenarioLabels[estimate.scenario].label}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly:</span>
                  <span className="font-medium">{estimate.monthlyRevenue}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Year 1:</span>
                  <span className="font-medium">{estimate.yearOneRevenue}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Year 3:</span>
                  <span className="font-medium">{estimate.yearThreeRevenue}</span>
                </div>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground cursor-help">
                      <Info className="h-3 w-3" />
                      <span>View assumptions</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <ul className="list-disc pl-4 space-y-1">
                      {estimate.assumptions.map((a, i) => (
                        <li key={i} className="text-xs">{a}</li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ))}
        </div>

        {/* Success Probability */}
        <div className="p-3 rounded-lg border bg-muted/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Success Probability</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Based on factor analysis
              </div>
            </div>
            <div className="text-2xl font-bold text-primary">{successProbability.range}</div>
          </div>
          {successProbability.factors.length > 0 && (
            <div className="mt-2 pt-2 border-t">
              <div className="text-xs text-muted-foreground">Key factors:</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {successProbability.factors.map((factor, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {factor}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ============ Main Component ============

export interface ViabilityScoreProps {
  analysis: ViabilityAnalysis
  onRefresh?: () => void
  isRefreshing?: boolean
  className?: string
}

export function ViabilityScore({
  analysis,
  onRefresh,
  isRefreshing = false,
  className
}: ViabilityScoreProps) {
  const [expandedFactors, setExpandedFactors] = useState<Set<FactorCategory>>(new Set())
  const [showAllFactors, setShowAllFactors] = useState(false)

  const toggleFactor = (category: FactorCategory) => {
    const newExpanded = new Set(expandedFactors)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedFactors(newExpanded)
  }

  // Sort factors by score (lowest first to highlight problem areas)
  const sortedFactors = [...analysis.factors].sort((a, b) => a.score - b.score)
  const displayedFactors = showAllFactors ? sortedFactors : sortedFactors.slice(0, 4)

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Score Gauge */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <ScoreGauge score={analysis.overallScore} />

            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl font-bold mb-2">Viability Analysis</h2>
              <p className="text-muted-foreground">{analysis.summary}</p>

              <div className="flex flex-wrap gap-2 mt-4 justify-center md:justify-start">
                {analysis.strengths.slice(0, 2).map((s, i) => (
                  <Badge key={i} variant="success" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {s.strength.substring(0, 30)}...
                  </Badge>
                ))}
                {analysis.criticalIssues.slice(0, 2).map((issue, i) => (
                  <Badge key={i} variant="error" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {issue.issue.substring(0, 30)}...
                  </Badge>
                ))}
              </div>

              {onRefresh && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
                  {isRefreshing ? "Analyzing..." : "Re-analyze"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Issues (always show if present) */}
      <CriticalIssuesPanel issues={analysis.criticalIssues} />

      {/* Pivot Suggestions (only for low scores) */}
      {analysis.pivotSuggestions && analysis.pivotSuggestions.length > 0 && (
        <PivotSuggestionsPanel suggestions={analysis.pivotSuggestions} />
      )}

      {/* Factor Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Factor Breakdown</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllFactors(!showAllFactors)}
          >
            {showAllFactors ? "Show Less" : "Show All"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {displayedFactors.map((factor) => (
            <FactorCard
              key={factor.category}
              factor={factor}
              expanded={expandedFactors.has(factor.category)}
              onToggle={() => toggleFactor(factor.category)}
            />
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <RecommendationsPanel recommendations={analysis.recommendations} />

      {/* Revenue Estimates */}
      <RevenueEstimatesPanel
        estimates={analysis.revenueEstimates}
        successProbability={analysis.successProbability}
      />

      {/* Metadata Footer */}
      <div className="text-xs text-muted-foreground text-center">
        Analyzed on {new Date(analysis.analyzedAt).toLocaleString()}
        {analysis.modelUsed && ` using ${analysis.modelUsed}`}
      </div>
    </div>
  )
}

// ============ Loading State ============

export function ViabilityScoreLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-48 h-48 rounded-full bg-muted" />
            <div className="flex-1 space-y-3">
              <div className="h-6 bg-muted rounded w-48" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="flex gap-2">
                <div className="h-6 bg-muted rounded w-24" />
                <div className="h-6 bg-muted rounded w-24" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="h-5 bg-muted rounded w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-20 bg-muted rounded" />
          <div className="h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    </div>
  )
}

// ============ Compact Score Display ============

export function ViabilityScoreBadge({ score, showLabel = true }: {
  score: number
  showLabel?: boolean
}) {
  const classification = getScoreClassification(score)

  return (
    <div className="flex items-center gap-2">
      <ScoreGauge score={score} size="small" />
      {showLabel && (
        <div className="text-sm">
          <div className={cn("font-medium capitalize", getScoreColor(score))}>
            {classification}
          </div>
          <div className="text-xs text-muted-foreground">Viability</div>
        </div>
      )}
    </div>
  )
}
