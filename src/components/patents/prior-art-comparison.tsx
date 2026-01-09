"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  GitCompare,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Minus,
  TrendingUp,
  TrendingDown,
  Scale,
  ChevronDown,
  ChevronUp,
  Info,
  Lightbulb,
  Shield
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PriorArt, PatentSearch } from "@/lib/data/types"

interface PriorArtComparisonProps {
  inventionTitle: string
  inventionDescription: string
  keyFeatures: string[]
  searchResult: PatentSearch
  className?: string
}

interface FeatureComparison {
  feature: string
  inventionHas: boolean
  priorArtMatches: {
    priorArtId: string
    priorArtTitle: string
    hasFeature: boolean
    similarity: "none" | "partial" | "full"
  }[]
}

const similarityColors = {
  none: "bg-green-500",
  partial: "bg-yellow-500",
  full: "bg-red-500"
}

export function PriorArtComparison({
  inventionTitle,
  inventionDescription,
  keyFeatures,
  searchResult,
  className
}: PriorArtComparisonProps) {
  const [selectedPriorArt, setSelectedPriorArt] = useState<string | null>(
    searchResult.priorArt[0]?.id || null
  )
  const [expandedFeatures, setExpandedFeatures] = useState<Set<number>>(new Set())

  const toggleFeature = (index: number) => {
    setExpandedFeatures(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const selectedArt = useMemo(() =>
    searchResult.priorArt.find(pa => pa.id === selectedPriorArt),
    [searchResult.priorArt, selectedPriorArt]
  )

  // Generate comparison data based on prior art analysis
  const comparisonData = useMemo((): FeatureComparison[] => {
    return keyFeatures.map(feature => ({
      feature,
      inventionHas: true,
      priorArtMatches: searchResult.priorArt.map(pa => {
        // Determine if this prior art has overlap with this feature
        const hasOverlap = pa.overlapAreas.some(
          overlap => overlap.toLowerCase().includes(feature.toLowerCase().substring(0, 20))
        )
        const hasDifferentiator = pa.differentiators.some(
          diff => diff.toLowerCase().includes(feature.toLowerCase().substring(0, 20))
        )

        let similarity: "none" | "partial" | "full" = "none"
        if (hasOverlap && !hasDifferentiator) {
          similarity = "full"
        } else if (hasOverlap && hasDifferentiator) {
          similarity = "partial"
        }

        return {
          priorArtId: pa.id,
          priorArtTitle: pa.title,
          hasFeature: hasOverlap,
          similarity
        }
      })
    }))
  }, [keyFeatures, searchResult.priorArt])

  // Calculate overall novelty for each feature
  const featureNovelty = useMemo(() => {
    return comparisonData.map(comp => {
      const fullMatches = comp.priorArtMatches.filter(m => m.similarity === "full").length
      const partialMatches = comp.priorArtMatches.filter(m => m.similarity === "partial").length
      const totalPriorArt = searchResult.priorArt.length

      if (totalPriorArt === 0) return 100
      if (fullMatches > 0) return Math.max(0, 100 - (fullMatches * 40) - (partialMatches * 20))
      if (partialMatches > 0) return Math.max(30, 100 - (partialMatches * 25))
      return 100
    })
  }, [comparisonData, searchResult.priorArt.length])

  // Risk level for selected prior art
  const getRiskDetails = (priorArt: PriorArt) => {
    const config = {
      low: {
        color: "text-green-600",
        bgColor: "bg-green-500/10",
        borderColor: "border-green-500/30",
        icon: CheckCircle2,
        label: "Low Risk",
        description: "This prior art has minimal overlap with your invention"
      },
      medium: {
        color: "text-yellow-600",
        bgColor: "bg-yellow-500/10",
        borderColor: "border-yellow-500/30",
        icon: AlertTriangle,
        label: "Medium Risk",
        description: "Some overlap exists but differentiators are present"
      },
      high: {
        color: "text-red-600",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/30",
        icon: XCircle,
        label: "High Risk",
        description: "Significant overlap - may require claim modification"
      }
    }
    return config[priorArt.riskLevel]
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <Card className="bg-gradient-to-r from-green-500/5 to-blue-500/5 border-green-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-green-500" />
            Prior Art Comparison
          </CardTitle>
          <CardDescription>
            Compare your invention against similar patents to assess patentability
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Overall Assessment */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Patentability Assessment
            </CardTitle>
            <Badge
              className={cn(
                searchResult.overallPatentabilityScore >= 70 && "bg-green-500",
                searchResult.overallPatentabilityScore >= 40 && searchResult.overallPatentabilityScore < 70 && "bg-yellow-500",
                searchResult.overallPatentabilityScore < 40 && "bg-red-500"
              )}
            >
              {searchResult.overallPatentabilityScore}% Patentable
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={searchResult.overallPatentabilityScore} className="h-3" />

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-600" />
                <p className="text-2xl font-bold text-green-600">
                  {searchResult.priorArt.filter(pa => pa.riskLevel === "low").length}
                </p>
                <p className="text-xs text-muted-foreground">Low Risk</p>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <Minus className="h-5 w-5 mx-auto mb-1 text-yellow-600" />
                <p className="text-2xl font-bold text-yellow-600">
                  {searchResult.priorArt.filter(pa => pa.riskLevel === "medium").length}
                </p>
                <p className="text-xs text-muted-foreground">Medium Risk</p>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg">
                <TrendingDown className="h-5 w-5 mx-auto mb-1 text-red-600" />
                <p className="text-2xl font-bold text-red-600">
                  {searchResult.priorArt.filter(pa => pa.riskLevel === "high").length}
                </p>
                <p className="text-xs text-muted-foreground">High Risk</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {searchResult.patentabilityAssessment}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Side-by-Side Comparison */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Your Invention */}
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              Your Invention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <h3 className="font-medium mb-2">{inventionTitle}</h3>
            <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
              {inventionDescription}
            </p>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Key Features</p>
              {keyFeatures.map((feature, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-2 bg-primary/5 rounded border border-primary/20"
                >
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm">{feature}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={featureNovelty[i]} className="h-1.5 flex-1" />
                      <span className={cn(
                        "text-xs font-medium",
                        featureNovelty[i] >= 70 && "text-green-600",
                        featureNovelty[i] >= 40 && featureNovelty[i] < 70 && "text-yellow-600",
                        featureNovelty[i] < 40 && "text-red-600"
                      )}>
                        {featureNovelty[i]}% novel
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Selected Prior Art */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Prior Art
              </CardTitle>
              <Select value={selectedPriorArt || ""} onValueChange={setSelectedPriorArt}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Select prior art..." />
                </SelectTrigger>
                <SelectContent>
                  {searchResult.priorArt.map(pa => (
                    <SelectItem key={pa.id} value={pa.id}>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "h-2 w-2 rounded-full",
                          pa.riskLevel === "low" && "bg-green-500",
                          pa.riskLevel === "medium" && "bg-yellow-500",
                          pa.riskLevel === "high" && "bg-red-500"
                        )} />
                        <span className="truncate max-w-[140px]">{pa.title}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {selectedArt ? (
              <>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium">{selectedArt.title}</h3>
                  {(() => {
                    const risk = getRiskDetails(selectedArt)
                    const RiskIcon = risk.icon
                    return (
                      <Badge className={cn(risk.bgColor, risk.color, "border", risk.borderColor)}>
                        <RiskIcon className="h-3 w-3 mr-1" />
                        {risk.label}
                      </Badge>
                    )
                  })()}
                </div>

                {selectedArt.patentNumber && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {selectedArt.patentNumber} | {selectedArt.source}
                  </p>
                )}

                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  {selectedArt.abstract}
                </p>

                <div className="space-y-3">
                  {selectedArt.overlapAreas.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-600 mb-1 flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Areas of Overlap
                      </p>
                      <ul className="space-y-1">
                        {selectedArt.overlapAreas.map((area, i) => (
                          <li key={i} className="text-sm flex items-start gap-2 text-red-600">
                            <span className="text-red-500">-</span>
                            {area}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedArt.differentiators.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-600 mb-1 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Your Differentiators
                      </p>
                      <ul className="space-y-1">
                        {selectedArt.differentiators.map((diff, i) => (
                          <li key={i} className="text-sm flex items-start gap-2 text-green-600">
                            <span className="text-green-500">+</span>
                            {diff}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Similarity Score</span>
                    <span className={cn(
                      "font-bold",
                      selectedArt.similarityScore < 40 && "text-green-600",
                      selectedArt.similarityScore >= 40 && selectedArt.similarityScore < 70 && "text-yellow-600",
                      selectedArt.similarityScore >= 70 && "text-red-600"
                    )}>
                      {selectedArt.similarityScore}%
                    </span>
                  </div>
                  <Progress
                    value={selectedArt.similarityScore}
                    className={cn(
                      "h-2",
                      selectedArt.similarityScore < 40 && "[&>div]:bg-green-500",
                      selectedArt.similarityScore >= 40 && selectedArt.similarityScore < 70 && "[&>div]:bg-yellow-500",
                      selectedArt.similarityScore >= 70 && "[&>div]:bg-red-500"
                    )}
                  />
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Info className="h-8 w-8 mx-auto mb-2" />
                <p>Select a prior art reference to compare</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feature Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Feature Comparison Matrix</CardTitle>
          <CardDescription>
            See which features are unique and which overlap with prior art
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {comparisonData.map((comparison, i) => {
                const isExpanded = expandedFeatures.has(i)
                const novelty = featureNovelty[i]
                const fullMatches = comparison.priorArtMatches.filter(m => m.similarity === "full").length
                const partialMatches = comparison.priorArtMatches.filter(m => m.similarity === "partial").length

                return (
                  <div
                    key={i}
                    className={cn(
                      "border rounded-lg overflow-hidden",
                      novelty >= 70 && "border-green-500/30 bg-green-500/5",
                      novelty >= 40 && novelty < 70 && "border-yellow-500/30 bg-yellow-500/5",
                      novelty < 40 && "border-red-500/30 bg-red-500/5"
                    )}
                  >
                    <button
                      onClick={() => toggleFeature(i)}
                      className="w-full p-3 flex items-center gap-3 text-left hover:bg-black/5"
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-white font-medium text-sm",
                        novelty >= 70 && "bg-green-500",
                        novelty >= 40 && novelty < 70 && "bg-yellow-500",
                        novelty < 40 && "bg-red-500"
                      )}>
                        {novelty}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{comparison.feature}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {fullMatches > 0 && (
                            <span className="text-red-600">{fullMatches} full match</span>
                          )}
                          {partialMatches > 0 && (
                            <span className="text-yellow-600">{partialMatches} partial</span>
                          )}
                          {fullMatches === 0 && partialMatches === 0 && (
                            <span className="text-green-600">Unique feature</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {comparison.priorArtMatches.slice(0, 5).map(match => (
                          <span
                            key={match.priorArtId}
                            className={cn(
                              "h-2 w-2 rounded-full",
                              similarityColors[match.similarity]
                            )}
                            title={match.priorArtTitle}
                          />
                        ))}
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2 border-t bg-background/50">
                        <p className="text-xs text-muted-foreground pt-2">Prior Art Overlap:</p>
                        {comparison.priorArtMatches.map(match => (
                          <div
                            key={match.priorArtId}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span className={cn(
                              "h-3 w-3 rounded-full",
                              similarityColors[match.similarity]
                            )} />
                            <span className={cn(
                              "flex-1 truncate",
                              match.similarity === "full" && "text-red-600",
                              match.similarity === "partial" && "text-yellow-600",
                              match.similarity === "none" && "text-green-600"
                            )}>
                              {match.priorArtTitle}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {match.similarity === "none" ? "No match" :
                               match.similarity === "partial" ? "Partial" : "Full match"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {searchResult.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              Recommendations to Strengthen Patentability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {searchResult.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
