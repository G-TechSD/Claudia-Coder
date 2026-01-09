"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  Edit2,
  FileText,
  DollarSign,
  Target,
  Sparkles,
  BarChart3,
  PieChart,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Building2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { BusinessDevEditor } from "./business-dev-editor"

// Types for Business Development data
export interface BusinessDevFeature {
  id: string
  name: string
  description: string
  priority: "high" | "medium" | "low"
  status: "planned" | "in-progress" | "completed"
  estimatedValue?: string
}

export interface MarketSegment {
  name: string
  percentage: number
  color: string
  description?: string
}

export interface RevenueStream {
  name: string
  description: string
  estimatedRevenue: string
  timeframe: string
  confidence: "high" | "medium" | "low"
}

export interface ProFormaItem {
  category: string
  year1: number
  year2: number
  year3: number
  notes?: string
}

export interface BusinessDevData {
  executiveSummary: string
  valueProposition: string
  targetMarket: string
  competitiveAdvantage: string
  features: BusinessDevFeature[]
  marketSegments: MarketSegment[]
  revenueStreams: RevenueStream[]
  proForma: {
    revenue: ProFormaItem[]
    expenses: ProFormaItem[]
    summary: {
      year1Profit: number
      year2Profit: number
      year3Profit: number
      breakEvenMonth: number
    }
  }
  risks: string[]
  opportunities: string[]
  generatedAt?: string
  generatedBy?: string
}

interface BusinessDevSectionProps {
  projectId: string
  projectName: string
  projectDescription: string
  className?: string
}

// Storage key for business dev data
const getStorageKey = (projectId: string) => `claudia_business_dev_${projectId}`

// Load business dev data from localStorage
const loadBusinessDevData = (projectId: string): BusinessDevData | null => {
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

// Save business dev data to localStorage
const saveBusinessDevData = (projectId: string, data: BusinessDevData) => {
  if (typeof window === "undefined") return
  localStorage.setItem(getStorageKey(projectId), JSON.stringify(data))
}

export function BusinessDevSection({
  projectId,
  projectName,
  projectDescription,
  className
}: BusinessDevSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [businessData, setBusinessData] = useState<BusinessDevData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [generationStatus, setGenerationStatus] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Load existing data on mount
  useEffect(() => {
    const existing = loadBusinessDevData(projectId)
    if (existing) {
      setBusinessData(existing)
    }
  }, [projectId])

  // Generate business development analysis
  const generateAnalysis = async () => {
    setIsGenerating(true)
    setError(null)
    setGenerationStatus("Analyzing project for business potential...")

    try {
      const response = await fetch("/api/business-dev/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName,
          projectDescription
        })
      })

      setGenerationStatus("Processing analysis...")

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else if (data.analysis) {
        const newData: BusinessDevData = {
          ...data.analysis,
          generatedAt: new Date().toISOString(),
          generatedBy: data.model || "AI Analysis"
        }
        setBusinessData(newData)
        saveBusinessDevData(projectId, newData)
        setGenerationStatus("Analysis complete!")
        setTimeout(() => setGenerationStatus(""), 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate analysis")
    } finally {
      setIsGenerating(false)
    }
  }

  // Download executive summary
  const downloadSummary = async (format: "pdf" | "md") => {
    if (!businessData) return

    setIsDownloading(true)
    try {
      const response = await fetch("/api/business-dev/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName,
          data: businessData,
          format
        })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${projectName.replace(/\s+/g, "-")}-executive-summary.${format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        const data = await response.json()
        setError(data.error || "Failed to export")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download")
    } finally {
      setIsDownloading(false)
    }
  }

  // Handle editor save
  const handleEditorSave = (updatedData: BusinessDevData) => {
    setBusinessData(updatedData)
    saveBusinessDevData(projectId, updatedData)
    setIsEditing(false)
    setEditingSection(null)
  }

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  // Get confidence color
  const getConfidenceColor = (confidence: "high" | "medium" | "low") => {
    switch (confidence) {
      case "high": return "text-green-500"
      case "medium": return "text-yellow-500"
      case "low": return "text-red-400"
    }
  }

  // Get priority badge color
  const getPriorityBadge = (priority: "high" | "medium" | "low") => {
    switch (priority) {
      case "high": return "bg-red-500/10 text-red-500 border-red-500/30"
      case "medium": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
      case "low": return "bg-gray-500/10 text-gray-400 border-gray-500/30"
    }
  }

  return (
    <Card className={cn("border-purple-500/20", className)}>
      {/* Collapsible Header */}
      <CardHeader
        className="cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Building2 className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Business Development
                {businessData && (
                  <Badge variant="outline" className="text-xs text-purple-500 border-purple-500/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Generated
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Executive summary, market analysis, and financial projections
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
                onClick={generateAnalysis}
                disabled={isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {businessData ? "Regenerate" : "Generate Analysis"}
              </Button>
              {generationStatus && (
                <span className="text-sm text-muted-foreground">{generationStatus}</span>
              )}
            </div>
            {businessData && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="gap-1"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadSummary("md")}
                  disabled={isDownloading}
                  className="gap-1"
                >
                  <Download className="h-4 w-4" />
                  MD
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadSummary("pdf")}
                  disabled={isDownloading}
                  className="gap-1"
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
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

          {/* No Data State */}
          {!businessData && !isGenerating && !error && (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground mb-4">
                Generate a comprehensive business development analysis for {projectName}
              </p>
              <Button onClick={generateAnalysis} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Generate Business Analysis
              </Button>
            </div>
          )}

          {/* Loading State */}
          {isGenerating && (
            <div className="py-12 text-center">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-purple-500 mb-4" />
              <p className="text-muted-foreground">{generationStatus}</p>
              <p className="text-sm text-muted-foreground mt-2">
                This may take 30-60 seconds...
              </p>
            </div>
          )}

          {/* Business Data Display */}
          {businessData && !isGenerating && (
            <div className="space-y-6">
              {/* Executive Summary */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-500" />
                    Executive Summary
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingSection("executive")}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
                <Card className="bg-gradient-to-br from-purple-500/5 to-blue-500/5 border-purple-500/20">
                  <CardContent className="p-4">
                    <p className="text-sm leading-relaxed">{businessData.executiveSummary}</p>

                    {/* Key Points */}
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-purple-500/20">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Value Proposition</p>
                        <p className="text-sm">{businessData.valueProposition}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Target Market</p>
                        <p className="text-sm">{businessData.targetMarket}</p>
                      </div>
                    </div>
                    {businessData.competitiveAdvantage && (
                      <div className="mt-4 pt-4 border-t border-purple-500/20">
                        <p className="text-xs text-muted-foreground mb-1">Competitive Advantage</p>
                        <p className="text-sm">{businessData.competitiveAdvantage}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Features Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    Key Features ({businessData.features.length})
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingSection("features")}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {businessData.features.map((feature) => (
                    <Card key={feature.id} className="hover:border-blue-500/30 transition-colors">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-sm">{feature.name}</h4>
                          <Badge className={cn("text-xs border", getPriorityBadge(feature.priority))}>
                            {feature.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{feature.description}</p>
                        <div className="flex items-center justify-between text-xs">
                          <Badge variant="outline" className="capitalize">
                            {feature.status}
                          </Badge>
                          {feature.estimatedValue && (
                            <span className="text-green-500">{feature.estimatedValue}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Market Analysis */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-green-500" />
                    Market Analysis
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingSection("market")}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      {businessData.marketSegments.map((segment, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: segment.color }}
                              />
                              <span className="text-sm font-medium">{segment.name}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {segment.percentage}%
                            </span>
                          </div>
                          <Progress value={segment.percentage} className="h-2" />
                          {segment.description && (
                            <p className="text-xs text-muted-foreground">{segment.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Monetization Strategy */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-yellow-500" />
                    Monetization Strategy
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingSection("monetization")}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {businessData.revenueStreams.map((stream, index) => (
                    <Card key={index} className="hover:border-yellow-500/30 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-sm">{stream.name}</h4>
                          <span className={cn("text-xs", getConfidenceColor(stream.confidence))}>
                            {stream.confidence} confidence
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{stream.description}</p>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-green-500 font-semibold">{stream.estimatedRevenue}</span>
                          <span className="text-xs text-muted-foreground">{stream.timeframe}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* ProForma Financial Summary */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-cyan-500" />
                    ProForma Financial Summary
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingSection("proforma")}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
                <Card>
                  <CardContent className="p-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Year 1</p>
                        <p className={cn(
                          "font-semibold",
                          businessData.proForma.summary.year1Profit >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                          {formatCurrency(businessData.proForma.summary.year1Profit)}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Year 2</p>
                        <p className={cn(
                          "font-semibold",
                          businessData.proForma.summary.year2Profit >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                          {formatCurrency(businessData.proForma.summary.year2Profit)}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Year 3</p>
                        <p className={cn(
                          "font-semibold",
                          businessData.proForma.summary.year3Profit >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                          {formatCurrency(businessData.proForma.summary.year3Profit)}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Break Even</p>
                        <p className="font-semibold text-cyan-500">
                          Month {businessData.proForma.summary.breakEvenMonth}
                        </p>
                      </div>
                    </div>

                    {/* Revenue & Expenses Table */}
                    <ScrollArea className="max-h-[300px]">
                      <table className="w-full text-sm">
                        <thead className="border-b">
                          <tr className="text-muted-foreground">
                            <th className="text-left py-2 font-medium">Category</th>
                            <th className="text-right py-2 font-medium">Year 1</th>
                            <th className="text-right py-2 font-medium">Year 2</th>
                            <th className="text-right py-2 font-medium">Year 3</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Revenue Section */}
                          <tr>
                            <td colSpan={4} className="pt-4 pb-2 text-xs font-semibold text-green-500">
                              Revenue
                            </td>
                          </tr>
                          {businessData.proForma.revenue.map((item, index) => (
                            <tr key={`rev-${index}`} className="border-b border-muted/30">
                              <td className="py-2">{item.category}</td>
                              <td className="text-right py-2 text-green-500">
                                {formatCurrency(item.year1)}
                              </td>
                              <td className="text-right py-2 text-green-500">
                                {formatCurrency(item.year2)}
                              </td>
                              <td className="text-right py-2 text-green-500">
                                {formatCurrency(item.year3)}
                              </td>
                            </tr>
                          ))}

                          {/* Expenses Section */}
                          <tr>
                            <td colSpan={4} className="pt-4 pb-2 text-xs font-semibold text-red-400">
                              Expenses
                            </td>
                          </tr>
                          {businessData.proForma.expenses.map((item, index) => (
                            <tr key={`exp-${index}`} className="border-b border-muted/30">
                              <td className="py-2">{item.category}</td>
                              <td className="text-right py-2 text-red-400">
                                ({formatCurrency(item.year1)})
                              </td>
                              <td className="text-right py-2 text-red-400">
                                ({formatCurrency(item.year2)})
                              </td>
                              <td className="text-right py-2 text-red-400">
                                ({formatCurrency(item.year3)})
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Risks & Opportunities */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Risks */}
                <Card className="border-red-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Risks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {businessData.risks.map((risk, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <span className="text-red-500 mt-1">-</span>
                          <span className="text-muted-foreground">{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Opportunities */}
                <Card className="border-green-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-green-500" />
                      Opportunities
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {businessData.opportunities.map((opportunity, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <span className="text-green-500 mt-1">+</span>
                          <span className="text-muted-foreground">{opportunity}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Generation Info */}
              {businessData.generatedAt && (
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t">
                  <span>
                    Generated: {new Date(businessData.generatedAt).toLocaleString()}
                  </span>
                  {businessData.generatedBy && (
                    <span>Model: {businessData.generatedBy}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Editor Modal */}
          {(isEditing || editingSection) && businessData && (
            <BusinessDevEditor
              data={businessData}
              section={editingSection}
              onSave={handleEditorSave}
              onCancel={() => {
                setIsEditing(false)
                setEditingSection(null)
              }}
            />
          )}
        </CardContent>
      )}
    </Card>
  )
}
