"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import {
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lightbulb,
  Target,
  TrendingUp,
  TrendingDown,
  Scale,
  Building2,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  Sparkles,
  Globe,
  Users,
  DollarSign,
  Zap
} from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  PriorArtResearch,
  CompetitorAnalysis,
  PriorArtRecommendation
} from "@/lib/data/types"

interface PriorArtSectionProps {
  projectId: string
  projectName: string
  projectDescription: string
  buildPlanObjectives?: string[]
  techStack?: string[]
  className?: string
  embedded?: boolean  // When embedded in BusinessDev section
  onResearchComplete?: (research: PriorArtResearch) => void
}

// Storage key for prior art research
const getStorageKey = (projectId: string) => `claudia_prior_art_${projectId}`

// Load prior art research from localStorage
const loadPriorArtResearch = (projectId: string): PriorArtResearch | null => {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem(getStorageKey(projectId))
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  }
  return null
}

// Save prior art research to localStorage
const savePriorArtResearch = (projectId: string, research: PriorArtResearch) => {
  if (typeof window === "undefined") return
  localStorage.setItem(getStorageKey(projectId), JSON.stringify(research))
}

// Get recommendation styling
const getRecommendationConfig = (recommendation: PriorArtRecommendation) => {
  switch (recommendation) {
    case "pursue":
      return {
        icon: ThumbsUp,
        color: "text-green-500",
        bg: "bg-green-500/10",
        border: "border-green-500/30",
        label: "Pursue"
      }
    case "pivot":
      return {
        icon: ArrowRight,
        color: "text-yellow-500",
        bg: "bg-yellow-500/10",
        border: "border-yellow-500/30",
        label: "Consider Pivoting"
      }
    case "abandon":
      return {
        icon: ThumbsDown,
        color: "text-red-500",
        bg: "bg-red-500/10",
        border: "border-red-500/30",
        label: "Consider Abandoning"
      }
    default:
      return {
        icon: HelpCircle,
        color: "text-gray-500",
        bg: "bg-gray-500/10",
        border: "border-gray-500/30",
        label: "More Research Needed"
      }
  }
}

// Get market saturation styling
const getSaturationConfig = (saturation: string) => {
  switch (saturation) {
    case "low":
      return { color: "text-green-500", label: "Low Competition" }
    case "medium":
      return { color: "text-yellow-500", label: "Moderate Competition" }
    case "high":
      return { color: "text-orange-500", label: "High Competition" }
    case "oversaturated":
      return { color: "text-red-500", label: "Oversaturated Market" }
    default:
      return { color: "text-gray-500", label: "Unknown" }
  }
}

// Get category badge styling
const getCategoryBadge = (category: CompetitorAnalysis["category"]) => {
  switch (category) {
    case "direct":
      return "bg-red-500/10 text-red-500 border-red-500/30"
    case "indirect":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
    case "potential":
      return "bg-blue-500/10 text-blue-500 border-blue-500/30"
    default:
      return "bg-gray-500/10 text-gray-500 border-gray-500/30"
  }
}

export function PriorArtSection({
  projectId,
  projectName,
  projectDescription,
  buildPlanObjectives,
  techStack,
  className,
  embedded = false,
  onResearchComplete
}: PriorArtSectionProps) {
  const [isExpanded, setIsExpanded] = useState(!embedded)
  const [research, setResearch] = useState<PriorArtResearch | null>(null)
  const [isResearching, setIsResearching] = useState(false)
  const [researchStatus, setResearchStatus] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null)

  // Load existing research on mount
  useEffect(() => {
    const existing = loadPriorArtResearch(projectId)
    if (existing) {
      setResearch(existing)
    }
  }, [projectId])

  // Perform research
  const performResearch = async () => {
    setIsResearching(true)
    setError(null)
    setResearchStatus("Searching for existing solutions...")

    try {
      const response = await fetch("/api/projects/prior-art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName,
          projectDescription,
          buildPlanObjectives,
          techStack,
          allowPaidFallback: true
        })
      })

      setResearchStatus("Analyzing competition...")

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else if (data.research) {
        setResearch(data.research)
        savePriorArtResearch(projectId, data.research)
        onResearchComplete?.(data.research)
        setResearchStatus("Research complete!")
        setTimeout(() => setResearchStatus(""), 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to perform research")
    } finally {
      setIsResearching(false)
    }
  }

  const recommendationConfig = research ? getRecommendationConfig(research.recommendation) : null
  const saturationConfig = research ? getSaturationConfig(research.marketSaturation) : null

  return (
    <Card className={cn("border-cyan-500/20", className)}>
      {/* Collapsible Header */}
      <CardHeader
        className="cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Search className="h-5 w-5 text-cyan-500" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Has This Been Done Before?
                {research && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      recommendationConfig?.color,
                      recommendationConfig?.border
                    )}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Researched
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Prior art research, competitor analysis, and market assessment
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon">
            {isExpanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </Button>
        </div>
      </CardHeader>

      {/* Collapsible Content */}
      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Actions Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={performResearch}
                disabled={isResearching}
                className="gap-2"
              >
                {isResearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {research ? "Re-Research" : "Research Now"}
              </Button>
              {researchStatus && (
                <span className="text-sm text-muted-foreground">{researchStatus}</span>
              )}
            </div>
            {research && (
              <div className="text-xs text-muted-foreground">
                Researched: {new Date(research.researchedAt).toLocaleString()}
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {error}
              <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
                Dismiss
              </Button>
            </div>
          )}

          {/* No Research State */}
          {!research && !isResearching && !error && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground mb-4">
                Research existing solutions and competition for {projectName}
              </p>
              <Button onClick={performResearch} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Start Research
              </Button>
            </div>
          )}

          {/* Loading State */}
          {isResearching && (
            <div className="py-12 text-center">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-cyan-500 mb-4" />
              <p className="text-muted-foreground">{researchStatus}</p>
              <p className="text-sm text-muted-foreground mt-2">
                This may take 30-60 seconds...
              </p>
            </div>
          )}

          {/* Research Results */}
          {research && !isResearching && (
            <div className="space-y-6">
              {/* Recommendation Banner */}
              {recommendationConfig && (
                <Card className={cn(recommendationConfig.bg, recommendationConfig.border)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={cn("p-3 rounded-full", recommendationConfig.bg)}>
                        <recommendationConfig.icon className={cn("h-6 w-6", recommendationConfig.color)} />
                      </div>
                      <div className="flex-1">
                        <h3 className={cn("font-semibold text-lg", recommendationConfig.color)}>
                          Recommendation: {recommendationConfig.label}
                        </h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>Confidence: {research.confidenceLevel}</span>
                          <span>{saturationConfig?.label}</span>
                          <span>{research.totalCompetitorsFound} competitors found</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Key Insights */}
              {research.keyInsights.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    Key Insights
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {research.keyInsights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
                        <Zap className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Why Pursue / Why Not Pursue */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Why Pursue */}
                <Card className="border-green-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4 text-green-500" />
                      Why Pursue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {research.whyPursue.map((reason, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-green-500 mt-1">+</span>
                          <span className="text-muted-foreground">{reason}</span>
                        </li>
                      ))}
                      {research.whyPursue.length === 0 && (
                        <li className="text-sm text-muted-foreground italic">
                          No strong reasons to pursue identified
                        </li>
                      )}
                    </ul>
                  </CardContent>
                </Card>

                {/* Why Not Pursue */}
                <Card className="border-red-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ThumbsDown className="h-4 w-4 text-red-500" />
                      Why Not Pursue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {research.whyNotPursue.map((reason, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-red-500 mt-1">-</span>
                          <span className="text-muted-foreground">{reason}</span>
                        </li>
                      ))}
                      {research.whyNotPursue.length === 0 && (
                        <li className="text-sm text-muted-foreground italic">
                          No significant concerns identified
                        </li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* What Would Change Assessment */}
              {research.whatWouldChange.length > 0 && (
                <Card className="border-blue-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Scale className="h-4 w-4 text-blue-500" />
                      What Would Change the Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {research.whatWouldChange.map((condition, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <ArrowRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{condition}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Comparison Table */}
              {research.comparisonTable && research.comparisonTable.features.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-500" />
                    Feature Comparison
                  </h3>
                  <Card>
                    <CardContent className="p-0">
                      <ScrollArea className="w-full">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[200px]">Solution</TableHead>
                              {research.comparisonTable.features.map((feature, i) => (
                                <TableHead key={i} className="text-center min-w-[100px]">
                                  {feature}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {research.comparisonTable.rows.map((row, rowIndex) => (
                              <TableRow
                                key={rowIndex}
                                className={row.name === "Your Project" ? "bg-primary/5" : ""}
                              >
                                <TableCell className="font-medium">
                                  {row.name === "Your Project" ? (
                                    <span className="text-primary flex items-center gap-1">
                                      <Sparkles className="h-3 w-3" />
                                      {row.name}
                                    </span>
                                  ) : (
                                    row.name
                                  )}
                                </TableCell>
                                {research.comparisonTable!.features.map((feature, featureIndex) => {
                                  const value = row.values[feature]
                                  return (
                                    <TableCell key={featureIndex} className="text-center">
                                      {value === true ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                                      ) : value === false ? (
                                        <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                                      ) : (
                                        <span className="text-xs text-muted-foreground">{value}</span>
                                      )}
                                    </TableCell>
                                  )
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Competitors List */}
              {research.competitors.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-orange-500" />
                    Competitors ({research.competitors.length})
                  </h3>
                  <div className="space-y-2">
                    {research.competitors.map((competitor) => (
                      <Card
                        key={competitor.id}
                        className="hover:border-orange-500/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedCompetitor(
                          expandedCompetitor === competitor.id ? null : competitor.id
                        )}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{competitor.name}</h4>
                                <Badge
                                  variant="outline"
                                  className={cn("text-xs", getCategoryBadge(competitor.category))}
                                >
                                  {competitor.category}
                                </Badge>
                                {competitor.pricingModel && (
                                  <Badge variant="outline" className="text-xs">
                                    <DollarSign className="h-3 w-3 mr-1" />
                                    {competitor.pricingModel}
                                  </Badge>
                                )}
                                {competitor.estimatedUsers && (
                                  <Badge variant="outline" className="text-xs">
                                    <Users className="h-3 w-3 mr-1" />
                                    {competitor.estimatedUsers}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {competitor.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {competitor.url && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    window.open(competitor.url, "_blank")
                                  }}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                              {expandedCompetitor === competitor.id ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {expandedCompetitor === competitor.id && (
                            <div className="mt-4 pt-4 border-t space-y-4">
                              {/* Features */}
                              {competitor.features.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-2">
                                    Features
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {competitor.features.map((feature, i) => (
                                      <Badge key={i} variant="secondary" className="text-xs">
                                        {feature}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Strengths & Weaknesses */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs font-medium text-green-500 mb-2 flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3" />
                                    Strengths
                                  </p>
                                  <ul className="space-y-1">
                                    {competitor.strengths.map((s, i) => (
                                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                                        <span className="text-green-500">+</span>
                                        {s}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1">
                                    <TrendingDown className="h-3 w-3" />
                                    Weaknesses
                                  </p>
                                  <ul className="space-y-1">
                                    {competitor.weaknesses.map((w, i) => (
                                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                                        <span className="text-red-400">-</span>
                                        {w}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>

                              {/* Our Advantage */}
                              {competitor.ourAdvantage && (
                                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                                  <p className="text-xs font-medium text-primary mb-1 flex items-center gap-1">
                                    <Sparkles className="h-3 w-3" />
                                    Our Advantage
                                  </p>
                                  <p className="text-sm">{competitor.ourAdvantage}</p>
                                </div>
                              )}

                              {/* Pricing */}
                              {competitor.pricing && (
                                <div className="flex items-center gap-2 text-sm">
                                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">Pricing:</span>
                                  <span>{competitor.pricing}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Market Gaps & Opportunities */}
              {research.marketGapAnalysis && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Market Gaps */}
                  <Card className="border-purple-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Target className="h-4 w-4 text-purple-500" />
                        Market Gaps
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {research.marketGapAnalysis.gaps.map((gap) => (
                          <li key={gap.id} className="flex items-start gap-2 text-sm">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs mt-0.5",
                                gap.opportunity === "high" && "border-green-500 text-green-500",
                                gap.opportunity === "medium" && "border-yellow-500 text-yellow-500",
                                gap.opportunity === "low" && "border-gray-500 text-gray-500"
                              )}
                            >
                              {gap.opportunity}
                            </Badge>
                            <span className={cn(
                              "text-muted-foreground",
                              gap.addressedByOurProject && "text-foreground"
                            )}>
                              {gap.description}
                              {gap.addressedByOurProject && (
                                <CheckCircle2 className="h-3 w-3 text-green-500 inline ml-1" />
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Opportunities */}
                  <Card className="border-green-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        Opportunities
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {research.opportunities.map((opportunity, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-green-500 mt-1">+</span>
                            <span className="text-muted-foreground">{opportunity}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Risks & Differentiators */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Risks */}
                {research.risks.length > 0 && (
                  <Card className="border-red-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        Competitive Risks
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {research.risks.map((risk, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-red-500 mt-1">!</span>
                            <span className="text-muted-foreground">{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Differentiators */}
                {research.differentiators.length > 0 && (
                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Your Differentiators
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {research.differentiators.map((diff, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-primary mt-1">*</span>
                            <span className="text-muted-foreground">{diff}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Sources */}
              {research.sources.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500" />
                    Sources ({research.sources.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {research.sources.slice(0, 10).map((source, i) => (
                      <a
                        key={i}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {source.title.slice(0, 40)}...
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Generation Info */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t">
                <span>
                  Researched: {new Date(research.researchedAt).toLocaleString()}
                </span>
                <span>
                  Model: {research.generatedBy.server}:{research.generatedBy.model}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
