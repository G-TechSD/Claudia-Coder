"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Search,
  FileSearch,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Scale,
  Server,
  Cloud
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PatentSearch, PriorArt } from "@/lib/data/types"

interface ProviderOption {
  name: string
  displayName: string
  status: "online" | "offline" | "checking" | "not-configured"
  model?: string
  type: "local" | "cloud"
}

interface PatentSearchProps {
  providers: ProviderOption[]
  selectedProvider: string | null
  onProviderChange: (provider: string) => void
  onSearchComplete?: (search: PatentSearch) => void
  className?: string
}

const riskConfig = {
  low: { color: "bg-green-500/10 text-green-700 border-green-500/30", label: "Low Risk" },
  medium: { color: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30", label: "Medium Risk" },
  high: { color: "bg-red-500/10 text-red-700 border-red-500/30", label: "High Risk" }
}

export function PatentSearchComponent({
  providers,
  selectedProvider,
  onProviderChange,
  onSearchComplete,
  className
}: PatentSearchProps) {
  const [inventionTitle, setInventionTitle] = useState("")
  const [inventionDescription, setInventionDescription] = useState("")
  const [technicalField, setTechnicalField] = useState("")
  const [keywords, setKeywords] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<PatentSearch | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedPriorArt, setExpandedPriorArt] = useState<Set<string>>(new Set())

  const togglePriorArt = useCallback((id: string) => {
    setExpandedPriorArt(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const runSearch = async () => {
    if (!inventionTitle.trim() || !inventionDescription.trim()) {
      setError("Please provide both an invention title and description")
      return
    }

    setIsSearching(true)
    setError(null)
    setSearchResult(null)

    try {
      const response = await fetch("/api/patents/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventionTitle: inventionTitle.trim(),
          inventionDescription: inventionDescription.trim(),
          technicalField: technicalField.trim() || undefined,
          keywords: keywords.trim()
            ? keywords.split(",").map(k => k.trim()).filter(Boolean)
            : [],
          preferredProvider: selectedProvider
        })
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else if (data.search) {
        setSearchResult(data.search)
        onSearchComplete?.(data.search)

        // Auto-expand high-risk prior art
        const highRisk = data.search.priorArt
          .filter((pa: PriorArt) => pa.riskLevel === "high")
          .map((pa: PriorArt) => pa.id)
        setExpandedPriorArt(new Set(highRisk))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed")
    } finally {
      setIsSearching(false)
    }
  }

  const getPatentabilityColor = (score: number) => {
    if (score >= 70) return "text-green-600"
    if (score >= 40) return "text-yellow-600"
    return "text-red-600"
  }

  const getPatentabilityLabel = (score: number) => {
    if (score >= 70) return "Good Prospects"
    if (score >= 40) return "Moderate Prospects"
    return "Challenging"
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <Card className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-blue-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-blue-500" />
                Prior Art Search
              </CardTitle>
              <CardDescription>
                Search for existing patents and assess patentability
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedProvider || ""} onValueChange={onProviderChange}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Select AI..." />
                </SelectTrigger>
                <SelectContent>
                  {providers.filter(p => p.type === "local").length > 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Local</div>
                  )}
                  {providers.filter(p => p.type === "local").map(p => (
                    <SelectItem key={p.name} value={p.name} disabled={p.status !== "online"}>
                      <div className="flex items-center gap-2">
                        <Server className="h-3 w-3 text-muted-foreground" />
                        <span className={cn(
                          "h-2 w-2 rounded-full",
                          p.status === "online" && "bg-green-500",
                          p.status === "offline" && "bg-red-500"
                        )} />
                        {p.displayName}
                      </div>
                    </SelectItem>
                  ))}
                  {providers.filter(p => p.type === "cloud").length > 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground font-medium mt-1 border-t">Cloud</div>
                  )}
                  {providers.filter(p => p.type === "cloud").map(p => (
                    <SelectItem key={p.name} value={p.name} disabled={p.status !== "online"}>
                      <div className="flex items-center gap-2">
                        <Cloud className="h-3 w-3 text-blue-500" />
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        {p.displayName}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Describe Your Invention
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invention-title">Invention Title</Label>
            <Input
              id="invention-title"
              value={inventionTitle}
              onChange={(e) => setInventionTitle(e.target.value)}
              placeholder="e.g., Automated Code Review System Using AI"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="technical-field">Technical Field</Label>
            <Input
              id="technical-field"
              value={technicalField}
              onChange={(e) => setTechnicalField(e.target.value)}
              placeholder="e.g., Software Development, Machine Learning"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invention-description">Invention Description</Label>
            <Textarea
              id="invention-description"
              value={inventionDescription}
              onChange={(e) => setInventionDescription(e.target.value)}
              placeholder="Describe your invention in detail. Include the problem it solves, how it works, and what makes it novel..."
              className="min-h-[150px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="keywords">Keywords (comma-separated)</Label>
            <Input
              id="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g., machine learning, code analysis, automated review"
            />
          </div>

          <Button
            onClick={runSearch}
            disabled={isSearching || !selectedProvider || !inventionTitle.trim() || !inventionDescription.trim()}
            className="w-full"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching Patent Databases...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search for Prior Art
              </>
            )}
          </Button>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResult && (
        <>
          {/* Patentability Assessment */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Patentability Assessment
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-2xl font-bold",
                    getPatentabilityColor(searchResult.overallPatentabilityScore)
                  )}>
                    {searchResult.overallPatentabilityScore}%
                  </span>
                  <Badge variant="outline" className={getPatentabilityColor(searchResult.overallPatentabilityScore)}>
                    {getPatentabilityLabel(searchResult.overallPatentabilityScore)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {searchResult.patentabilityAssessment}
              </p>

              {searchResult.recommendations.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Recommendations</h4>
                  <ul className="space-y-1">
                    {searchResult.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prior Art Results */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  Prior Art Found ({searchResult.priorArt.length})
                </CardTitle>
                <div className="flex gap-2">
                  {searchResult.priorArt.filter(pa => pa.riskLevel === "high").length > 0 && (
                    <Badge className="bg-red-500">
                      {searchResult.priorArt.filter(pa => pa.riskLevel === "high").length} High Risk
                    </Badge>
                  )}
                  {searchResult.priorArt.filter(pa => pa.riskLevel === "medium").length > 0 && (
                    <Badge className="bg-yellow-500">
                      {searchResult.priorArt.filter(pa => pa.riskLevel === "medium").length} Medium Risk
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {searchResult.priorArt.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>No significant prior art found</p>
                  <p className="text-sm">Your invention may have good patentability prospects</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {searchResult.priorArt.map((pa) => {
                      const risk = riskConfig[pa.riskLevel]
                      const isExpanded = expandedPriorArt.has(pa.id)

                      return (
                        <div
                          key={pa.id}
                          className={cn("border rounded-lg overflow-hidden", risk.color)}
                        >
                          <button
                            onClick={() => togglePriorArt(pa.id)}
                            className="w-full p-3 flex items-center gap-3 text-left hover:bg-black/5"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">{pa.title}</p>
                                {pa.patentNumber && (
                                  <Badge variant="outline" className="text-xs">
                                    {pa.patentNumber}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {pa.source} {pa.publicationDate && `| ${pa.publicationDate}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-lg font-bold">{pa.similarityScore}%</p>
                                <p className="text-xs text-muted-foreground">Similarity</p>
                              </div>
                              <Badge className={risk.color}>{risk.label}</Badge>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="px-3 pb-3 space-y-3 border-t bg-background/50">
                              {pa.abstract && (
                                <div className="pt-3">
                                  <p className="text-xs font-medium mb-1 text-muted-foreground">Abstract</p>
                                  <p className="text-sm">{pa.abstract}</p>
                                </div>
                              )}

                              {pa.overlapAreas.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium mb-1 text-muted-foreground flex items-center gap-1">
                                    <XCircle className="h-3 w-3 text-red-500" />
                                    Areas of Overlap
                                  </p>
                                  <ul className="text-sm space-y-1">
                                    {pa.overlapAreas.map((area, i) => (
                                      <li key={i} className="flex items-start gap-2">
                                        <span className="text-red-500">-</span>
                                        {area}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {pa.differentiators.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium mb-1 text-muted-foreground flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    Your Differentiators
                                  </p>
                                  <ul className="text-sm space-y-1">
                                    {pa.differentiators.map((diff, i) => (
                                      <li key={i} className="flex items-start gap-2">
                                        <span className="text-green-500">+</span>
                                        {diff}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {pa.url && (
                                <a
                                  href={pa.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  View Full Patent <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
