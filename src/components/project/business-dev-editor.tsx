"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  X,
  Save,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  Lightbulb,
  AlertTriangle
} from "lucide-react"
import type {
  BusinessDevData,
  BusinessDevFeature,
  MarketSegment,
  RevenueStream,
  ProFormaItem
} from "./business-dev-section"

interface BusinessDevEditorProps {
  data: BusinessDevData
  section?: string | null
  onSave: (data: BusinessDevData) => void
  onCancel: () => void
}

export function BusinessDevEditor({
  data,
  section,
  onSave,
  onCancel
}: BusinessDevEditorProps) {
  const [editedData, setEditedData] = useState<BusinessDevData>(data)
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false)
  const [suggestionField, setSuggestionField] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reset edited data when original data changes
  useEffect(() => {
    setEditedData(data)
  }, [data])

  // Request AI suggestion for a field
  const requestSuggestion = async (field: string, context: string) => {
    setIsGeneratingSuggestion(true)
    setSuggestionField(field)
    setSuggestion(null)
    setError(null)

    try {
      const response = await fetch("/api/business-dev/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field,
          context,
          currentValue: getFieldValue(field),
          businessData: editedData
        })
      })

      const result = await response.json()

      if (result.error) {
        setError(result.error)
      } else if (result.suggestion) {
        setSuggestion(result.suggestion)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get suggestion")
    } finally {
      setIsGeneratingSuggestion(false)
    }
  }

  // Get field value for suggestion context
  const getFieldValue = (field: string): string => {
    switch (field) {
      case "executiveSummary":
        return editedData.executiveSummary
      case "valueProposition":
        return editedData.valueProposition
      case "targetMarket":
        return editedData.targetMarket
      case "competitiveAdvantage":
        return editedData.competitiveAdvantage
      default:
        return ""
    }
  }

  // Apply suggestion to field
  const applySuggestion = (field: string) => {
    if (!suggestion) return

    switch (field) {
      case "executiveSummary":
        setEditedData({ ...editedData, executiveSummary: suggestion })
        break
      case "valueProposition":
        setEditedData({ ...editedData, valueProposition: suggestion })
        break
      case "targetMarket":
        setEditedData({ ...editedData, targetMarket: suggestion })
        break
      case "competitiveAdvantage":
        setEditedData({ ...editedData, competitiveAdvantage: suggestion })
        break
    }
    setSuggestion(null)
    setSuggestionField(null)
  }

  // Add new feature
  const addFeature = () => {
    const newFeature: BusinessDevFeature = {
      id: `feature-${Date.now()}`,
      name: "",
      description: "",
      priority: "medium",
      status: "planned"
    }
    setEditedData({
      ...editedData,
      features: [...editedData.features, newFeature]
    })
  }

  // Update feature
  const updateFeature = (id: string, updates: Partial<BusinessDevFeature>) => {
    setEditedData({
      ...editedData,
      features: editedData.features.map(f =>
        f.id === id ? { ...f, ...updates } : f
      )
    })
  }

  // Remove feature
  const removeFeature = (id: string) => {
    setEditedData({
      ...editedData,
      features: editedData.features.filter(f => f.id !== id)
    })
  }

  // Add new market segment
  const addMarketSegment = () => {
    const colors = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#EC4899"]
    const newSegment: MarketSegment = {
      name: "",
      percentage: 10,
      color: colors[editedData.marketSegments.length % colors.length]
    }
    setEditedData({
      ...editedData,
      marketSegments: [...editedData.marketSegments, newSegment]
    })
  }

  // Update market segment
  const updateMarketSegment = (index: number, updates: Partial<MarketSegment>) => {
    const updated = [...editedData.marketSegments]
    updated[index] = { ...updated[index], ...updates }
    setEditedData({ ...editedData, marketSegments: updated })
  }

  // Remove market segment
  const removeMarketSegment = (index: number) => {
    setEditedData({
      ...editedData,
      marketSegments: editedData.marketSegments.filter((_, i) => i !== index)
    })
  }

  // Add new revenue stream
  const addRevenueStream = () => {
    const newStream: RevenueStream = {
      name: "",
      description: "",
      estimatedRevenue: "$0",
      timeframe: "Year 1",
      confidence: "medium"
    }
    setEditedData({
      ...editedData,
      revenueStreams: [...editedData.revenueStreams, newStream]
    })
  }

  // Update revenue stream
  const updateRevenueStream = (index: number, updates: Partial<RevenueStream>) => {
    const updated = [...editedData.revenueStreams]
    updated[index] = { ...updated[index], ...updates }
    setEditedData({ ...editedData, revenueStreams: updated })
  }

  // Remove revenue stream
  const removeRevenueStream = (index: number) => {
    setEditedData({
      ...editedData,
      revenueStreams: editedData.revenueStreams.filter((_, i) => i !== index)
    })
  }

  // Add ProForma item
  const addProFormaItem = (type: "revenue" | "expenses") => {
    const newItem: ProFormaItem = {
      category: "",
      year1: 0,
      year2: 0,
      year3: 0
    }
    setEditedData({
      ...editedData,
      proForma: {
        ...editedData.proForma,
        [type]: [...editedData.proForma[type], newItem]
      }
    })
  }

  // Update ProForma item
  const updateProFormaItem = (
    type: "revenue" | "expenses",
    index: number,
    updates: Partial<ProFormaItem>
  ) => {
    const updated = [...editedData.proForma[type]]
    updated[index] = { ...updated[index], ...updates }
    setEditedData({
      ...editedData,
      proForma: { ...editedData.proForma, [type]: updated }
    })
  }

  // Remove ProForma item
  const removeProFormaItem = (type: "revenue" | "expenses", index: number) => {
    setEditedData({
      ...editedData,
      proForma: {
        ...editedData.proForma,
        [type]: editedData.proForma[type].filter((_, i) => i !== index)
      }
    })
  }

  // Update risk
  const updateRisk = (index: number, value: string) => {
    const updated = [...editedData.risks]
    updated[index] = value
    setEditedData({ ...editedData, risks: updated })
  }

  // Add risk
  const addRisk = () => {
    setEditedData({ ...editedData, risks: [...editedData.risks, ""] })
  }

  // Remove risk
  const removeRisk = (index: number) => {
    setEditedData({
      ...editedData,
      risks: editedData.risks.filter((_, i) => i !== index)
    })
  }

  // Update opportunity
  const updateOpportunity = (index: number, value: string) => {
    const updated = [...editedData.opportunities]
    updated[index] = value
    setEditedData({ ...editedData, opportunities: updated })
  }

  // Add opportunity
  const addOpportunity = () => {
    setEditedData({ ...editedData, opportunities: [...editedData.opportunities, ""] })
  }

  // Remove opportunity
  const removeOpportunity = (index: number) => {
    setEditedData({
      ...editedData,
      opportunities: editedData.opportunities.filter((_, i) => i !== index)
    })
  }

  // Handle save
  const handleSave = () => {
    // Recalculate ProForma summary
    const totalRevenue = {
      year1: editedData.proForma.revenue.reduce((sum, r) => sum + r.year1, 0),
      year2: editedData.proForma.revenue.reduce((sum, r) => sum + r.year2, 0),
      year3: editedData.proForma.revenue.reduce((sum, r) => sum + r.year3, 0)
    }
    const totalExpenses = {
      year1: editedData.proForma.expenses.reduce((sum, e) => sum + e.year1, 0),
      year2: editedData.proForma.expenses.reduce((sum, e) => sum + e.year2, 0),
      year3: editedData.proForma.expenses.reduce((sum, e) => sum + e.year3, 0)
    }

    const updatedData = {
      ...editedData,
      proForma: {
        ...editedData.proForma,
        summary: {
          year1Profit: totalRevenue.year1 - totalExpenses.year1,
          year2Profit: totalRevenue.year2 - totalExpenses.year2,
          year3Profit: totalRevenue.year3 - totalExpenses.year3,
          breakEvenMonth: editedData.proForma.summary.breakEvenMonth // Keep existing or calculate
        }
      }
    }

    onSave(updatedData)
  }

  // Render suggestion box
  const renderSuggestionBox = (field: string) => (
    <div className="mt-2">
      {isGeneratingSuggestion && suggestionField === field ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating suggestion...
        </div>
      ) : suggestion && suggestionField === field ? (
        <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-purple-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm mb-2">{suggestion}</p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => applySuggestion(field)}
                  className="gap-1"
                >
                  Apply
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSuggestion(null)
                    setSuggestionField(null)
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 text-purple-500 hover:text-purple-400"
          onClick={() => requestSuggestion(field, "")}
        >
          <Sparkles className="h-3 w-3" />
          Get AI Suggestion
        </Button>
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Edit Business Development</CardTitle>
              <CardDescription>
                {section ? `Editing ${section} section` : "Edit all business development content"}
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full max-h-[calc(90vh-180px)] p-6">
            <div className="space-y-8">
              {/* Error Display */}
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {/* Executive Summary Section */}
              {(!section || section === "executive") && (
                <div className="space-y-4">
                  <h3 className="font-semibold border-b pb-2">Executive Summary</h3>

                  <div className="space-y-2">
                    <Label htmlFor="executiveSummary">Summary</Label>
                    <Textarea
                      id="executiveSummary"
                      value={editedData.executiveSummary}
                      onChange={(e) => setEditedData({ ...editedData, executiveSummary: e.target.value })}
                      className="min-h-[100px]"
                      placeholder="Brief overview of the business opportunity..."
                    />
                    {renderSuggestionBox("executiveSummary")}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="valueProposition">Value Proposition</Label>
                    <Textarea
                      id="valueProposition"
                      value={editedData.valueProposition}
                      onChange={(e) => setEditedData({ ...editedData, valueProposition: e.target.value })}
                      placeholder="What unique value does this provide?"
                    />
                    {renderSuggestionBox("valueProposition")}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="targetMarket">Target Market</Label>
                    <Textarea
                      id="targetMarket"
                      value={editedData.targetMarket}
                      onChange={(e) => setEditedData({ ...editedData, targetMarket: e.target.value })}
                      placeholder="Who is the target audience?"
                    />
                    {renderSuggestionBox("targetMarket")}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="competitiveAdvantage">Competitive Advantage</Label>
                    <Textarea
                      id="competitiveAdvantage"
                      value={editedData.competitiveAdvantage}
                      onChange={(e) => setEditedData({ ...editedData, competitiveAdvantage: e.target.value })}
                      placeholder="What makes this different from competitors?"
                    />
                    {renderSuggestionBox("competitiveAdvantage")}
                  </div>
                </div>
              )}

              {/* Features Section */}
              {(!section || section === "features") && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-semibold">Key Features</h3>
                    <Button type="button" size="sm" variant="outline" onClick={addFeature} className="gap-1">
                      <Plus className="h-4 w-4" />
                      Add Feature
                    </Button>
                  </div>

                  {editedData.features.map((feature) => (
                    <Card key={feature.id} className="p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={feature.name}
                            onChange={(e) => updateFeature(feature.id, { name: e.target.value })}
                            placeholder="Feature name"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label>Priority</Label>
                            <Select
                              value={feature.priority}
                              onValueChange={(v) => updateFeature(feature.id, { priority: v as "high" | "medium" | "low" })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                              value={feature.status}
                              onValueChange={(v) => updateFeature(feature.id, { status: v as "planned" | "in-progress" | "completed" })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="planned">Planned</SelectItem>
                                <SelectItem value="in-progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="col-span-2 space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            value={feature.description}
                            onChange={(e) => updateFeature(feature.id, { description: e.target.value })}
                            placeholder="Feature description..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Estimated Value</Label>
                          <Input
                            value={feature.estimatedValue || ""}
                            onChange={(e) => updateFeature(feature.id, { estimatedValue: e.target.value })}
                            placeholder="e.g., $10K/month"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeFeature(feature.id)}
                            className="gap-1"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Market Analysis Section */}
              {(!section || section === "market") && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-semibold">Market Segments</h3>
                    <Button type="button" size="sm" variant="outline" onClick={addMarketSegment} className="gap-1">
                      <Plus className="h-4 w-4" />
                      Add Segment
                    </Button>
                  </div>

                  {editedData.marketSegments.map((segment, index) => (
                    <Card key={index} className="p-4">
                      <div className="grid grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={segment.name}
                            onChange={(e) => updateMarketSegment(index, { name: e.target.value })}
                            placeholder="Segment name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Percentage</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={segment.percentage}
                            onChange={(e) => updateMarketSegment(index, { percentage: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Color</Label>
                          <Input
                            type="color"
                            value={segment.color}
                            onChange={(e) => updateMarketSegment(index, { color: e.target.value })}
                            className="h-9 p-1"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeMarketSegment(index)}
                            className="gap-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="col-span-4 space-y-2">
                          <Label>Description</Label>
                          <Input
                            value={segment.description || ""}
                            onChange={(e) => updateMarketSegment(index, { description: e.target.value })}
                            placeholder="Segment description..."
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Monetization Section */}
              {(!section || section === "monetization") && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-semibold">Revenue Streams</h3>
                    <Button type="button" size="sm" variant="outline" onClick={addRevenueStream} className="gap-1">
                      <Plus className="h-4 w-4" />
                      Add Stream
                    </Button>
                  </div>

                  {editedData.revenueStreams.map((stream, index) => (
                    <Card key={index} className="p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={stream.name}
                            onChange={(e) => updateRevenueStream(index, { name: e.target.value })}
                            placeholder="Revenue stream name"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label>Estimated Revenue</Label>
                            <Input
                              value={stream.estimatedRevenue}
                              onChange={(e) => updateRevenueStream(index, { estimatedRevenue: e.target.value })}
                              placeholder="$X/month"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Confidence</Label>
                            <Select
                              value={stream.confidence}
                              onValueChange={(v) => updateRevenueStream(index, { confidence: v as "high" | "medium" | "low" })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            value={stream.description}
                            onChange={(e) => updateRevenueStream(index, { description: e.target.value })}
                            placeholder="Revenue stream description..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Timeframe</Label>
                          <Input
                            value={stream.timeframe}
                            onChange={(e) => updateRevenueStream(index, { timeframe: e.target.value })}
                            placeholder="e.g., Year 1"
                          />
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeRevenueStream(index)}
                              className="gap-1"
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* ProForma Section */}
              {(!section || section === "proforma") && (
                <div className="space-y-4">
                  <h3 className="font-semibold border-b pb-2">ProForma Financials</h3>

                  {/* Revenue Items */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-green-500">Revenue Items</h4>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => addProFormaItem("revenue")}
                        className="gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </Button>
                    </div>

                    {editedData.proForma.revenue.map((item, index) => (
                      <div key={index} className="grid grid-cols-5 gap-2 items-end">
                        <div>
                          <Label className="text-xs">Category</Label>
                          <Input
                            value={item.category}
                            onChange={(e) => updateProFormaItem("revenue", index, { category: e.target.value })}
                            placeholder="Category"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Year 1</Label>
                          <Input
                            type="number"
                            value={item.year1}
                            onChange={(e) => updateProFormaItem("revenue", index, { year1: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Year 2</Label>
                          <Input
                            type="number"
                            value={item.year2}
                            onChange={(e) => updateProFormaItem("revenue", index, { year2: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Year 3</Label>
                          <Input
                            type="number"
                            value={item.year3}
                            onChange={(e) => updateProFormaItem("revenue", index, { year3: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeProFormaItem("revenue", index)}
                          className="text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Expense Items */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-red-400">Expense Items</h4>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => addProFormaItem("expenses")}
                        className="gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </Button>
                    </div>

                    {editedData.proForma.expenses.map((item, index) => (
                      <div key={index} className="grid grid-cols-5 gap-2 items-end">
                        <div>
                          <Label className="text-xs">Category</Label>
                          <Input
                            value={item.category}
                            onChange={(e) => updateProFormaItem("expenses", index, { category: e.target.value })}
                            placeholder="Category"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Year 1</Label>
                          <Input
                            type="number"
                            value={item.year1}
                            onChange={(e) => updateProFormaItem("expenses", index, { year1: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Year 2</Label>
                          <Input
                            type="number"
                            value={item.year2}
                            onChange={(e) => updateProFormaItem("expenses", index, { year2: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Year 3</Label>
                          <Input
                            type="number"
                            value={item.year3}
                            onChange={(e) => updateProFormaItem("expenses", index, { year3: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeProFormaItem("expenses", index)}
                          className="text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Break Even */}
                  <div className="space-y-2">
                    <Label>Break Even Month</Label>
                    <Input
                      type="number"
                      min="1"
                      max="36"
                      value={editedData.proForma.summary.breakEvenMonth}
                      onChange={(e) => setEditedData({
                        ...editedData,
                        proForma: {
                          ...editedData.proForma,
                          summary: {
                            ...editedData.proForma.summary,
                            breakEvenMonth: parseInt(e.target.value) || 12
                          }
                        }
                      })}
                      className="w-32"
                    />
                  </div>
                </div>
              )}

              {/* Risks & Opportunities Section */}
              {(!section || section === "risks") && (
                <div className="grid grid-cols-2 gap-6">
                  {/* Risks */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="font-semibold text-red-400">Risks</h3>
                      <Button type="button" size="sm" variant="outline" onClick={addRisk} className="gap-1">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {editedData.risks.map((risk, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={risk}
                          onChange={(e) => updateRisk(index, e.target.value)}
                          placeholder="Risk description..."
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRisk(index)}
                          className="text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Opportunities */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="font-semibold text-green-500">Opportunities</h3>
                      <Button type="button" size="sm" variant="outline" onClick={addOpportunity} className="gap-1">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {editedData.opportunities.map((opportunity, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={opportunity}
                          onChange={(e) => updateOpportunity(index, e.target.value)}
                          placeholder="Opportunity description..."
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOpportunity(index)}
                          className="text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="border-t flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
