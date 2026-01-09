"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  Sparkles,
  RefreshCw,
  Edit2,
  Save,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Target,
  DollarSign,
  Shield,
  Lightbulb,
  AlertTriangle,
  MessageSquare,
  Send,
  Mic,
  MicOff,
  Loader2,
  Bot,
  User,
  Plus,
  Trash2,
  Copy,
  CheckCircle
} from "lucide-react"
import type { BusinessIdea } from "@/lib/data/business-ideas"

// Executive Summary Types
export interface ExecutiveSummaryData {
  overview: string
  marketAnalysis: {
    marketSize: string
    targetMarket: string
    marketTrends: string[]
    competitorLandscape: string
  }
  revenueModel: {
    primaryModel: string
    pricingStrategy: string
    revenueStreams: string[]
    projectedMetrics: string
  }
  competitiveLandscape: {
    directCompetitors: string[]
    indirectCompetitors: string[]
    competitiveAdvantages: string[]
    barriers: string[]
  }
  risks: {
    marketRisks: string[]
    technicalRisks: string[]
    financialRisks: string[]
    mitigationStrategies: string[]
  }
  opportunities: {
    shortTerm: string[]
    longTerm: string[]
    partnerships: string[]
    expansion: string[]
  }
  nextSteps: string[]
  viabilityScore: number
  viabilityRationale: string
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
}

interface ExecutiveSummaryProps {
  idea: BusinessIdea
  onUpdate: (field: string, value: unknown) => void
  initialData?: ExecutiveSummaryData | null
}

// Helper to get chat context from idea messages
function getChatContext(idea: BusinessIdea): string {
  if (!idea.messages || idea.messages.length === 0) return ""

  return idea.messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n")
}

export function ExecutiveSummary({ idea, onUpdate, initialData }: ExecutiveSummaryProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [rawContent, setRawContent] = useState("")
  const [summaryData, setSummaryData] = useState<ExecutiveSummaryData | null>(initialData || null)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    marketAnalysis: true,
    revenueModel: true,
    competitiveLandscape: true,
    risks: true,
    opportunities: true,
    nextSteps: true
  })

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [isChatting, setIsChatting] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Editing state
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>("")

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  // Generate executive summary
  const generateSummary = useCallback(async () => {
    setIsGenerating(true)
    setGenerationProgress(0)
    setError(null)
    setRawContent("")

    try {
      const response = await fetch("/api/business/executive-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideaId: idea.id,
          title: idea.title,
          summary: idea.summary,
          problemStatement: idea.problemStatement,
          targetAudience: idea.targetAudience,
          valueProposition: idea.valueProposition,
          revenueModel: idea.revenueModel,
          competitiveAdvantage: idea.competitiveAdvantage,
          tags: idea.tags,
          chatContext: getChatContext(idea)
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to generate: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6)
          if (data === "[DONE]") continue

          try {
            const event = JSON.parse(data)

            if (event.type === "content") {
              setRawContent(prev => prev + event.content)
              setGenerationProgress(prev => Math.min(prev + 1, 90))
            } else if (event.type === "complete" && event.summary) {
              setSummaryData(event.summary)
              setGenerationProgress(100)
              // Save to idea
              onUpdate("executiveSummaryData", event.summary)
            } else if (event.type === "error") {
              setError(event.error)
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setIsGenerating(false)
    }
  }, [idea, onUpdate])

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Start editing a section
  const startEditing = (section: string, currentValue: string) => {
    setEditingSection(section)
    setEditValue(currentValue)
  }

  // Save edit
  const saveEdit = (section: string, path?: string[]) => {
    if (!summaryData) return

    const newData = { ...summaryData }

    if (path && path.length > 0) {
      // Handle nested updates
      let target: Record<string, unknown> = newData as unknown as Record<string, unknown>
      for (let i = 0; i < path.length - 1; i++) {
        target = target[path[i]] as Record<string, unknown>
      }
      target[path[path.length - 1]] = editValue
    } else {
      // Handle direct updates
      (newData as unknown as Record<string, string>)[section] = editValue
    }

    setSummaryData(newData)
    onUpdate("executiveSummaryData", newData)
    setEditingSection(null)
    setEditValue("")
  }

  // Cancel edit
  const cancelEdit = () => {
    setEditingSection(null)
    setEditValue("")
  }

  // Handle list item updates
  const updateListItem = (
    section: keyof ExecutiveSummaryData,
    subsection: string,
    index: number,
    value: string
  ) => {
    if (!summaryData) return

    const newData = { ...summaryData }

    // Handle top-level arrays (like nextSteps)
    if (section === subsection && Array.isArray(newData[section])) {
      const list = [...(newData[section] as string[])]
      list[index] = value
      ;(newData as Record<string, unknown>)[section] = list
    } else {
      // Handle nested arrays (like marketAnalysis.marketTrends)
      const sectionData = newData[section] as Record<string, string[]>
      const list = [...sectionData[subsection]]
      list[index] = value
      sectionData[subsection] = list
    }

    setSummaryData(newData)
    onUpdate("executiveSummaryData", newData)
  }

  // Add list item
  const addListItem = (
    section: keyof ExecutiveSummaryData,
    subsection: string
  ) => {
    if (!summaryData) return

    const newData = { ...summaryData }

    // Handle top-level arrays (like nextSteps)
    if (section === subsection && Array.isArray(newData[section])) {
      ;(newData as Record<string, unknown>)[section] = [...(newData[section] as string[]), "New item"]
    } else {
      // Handle nested arrays
      const sectionData = newData[section] as Record<string, string[]>
      sectionData[subsection] = [...sectionData[subsection], "New item"]
    }

    setSummaryData(newData)
    onUpdate("executiveSummaryData", newData)
  }

  // Remove list item
  const removeListItem = (
    section: keyof ExecutiveSummaryData,
    subsection: string,
    index: number
  ) => {
    if (!summaryData) return

    const newData = { ...summaryData }

    // Handle top-level arrays (like nextSteps)
    if (section === subsection && Array.isArray(newData[section])) {
      ;(newData as Record<string, unknown>)[section] = (newData[section] as string[]).filter((_, i) => i !== index)
    } else {
      // Handle nested arrays
      const sectionData = newData[section] as Record<string, string[]>
      sectionData[subsection] = sectionData[subsection].filter((_, i) => i !== index)
    }

    setSummaryData(newData)
    onUpdate("executiveSummaryData", newData)
  }

  // Chat refinement
  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || isChatting || !summaryData) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: chatInput.trim(),
      timestamp: new Date().toISOString()
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput("")
    setIsChatting(true)

    try {
      // Call the chat endpoint with context about the executive summary
      const response = await fetch("/api/business-ideas/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...chatMessages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: userMessage.content }
          ],
          context: {
            type: "executive-summary-refinement",
            currentSummary: summaryData,
            ideaTitle: idea.title
          }
        })
      })

      if (!response.ok) throw new Error("Chat failed")

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response")

      const decoder = new TextDecoder()
      let assistantContent = ""

      const assistantId = crypto.randomUUID()
      setChatMessages(prev => [...prev, {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString()
      }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6)
          if (data === "[DONE]") continue

          try {
            const event = JSON.parse(data)
            if (event.type === "content") {
              assistantContent += event.content
              setChatMessages(prev =>
                prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: assistantContent }
                    : m
                )
              )
            }
          } catch {
            // Ignore
          }
        }
      }
    } catch (err) {
      setChatMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : "Unknown error"}`,
        timestamp: new Date().toISOString()
      }])
    } finally {
      setIsChatting(false)
    }
  }, [chatInput, isChatting, summaryData, chatMessages, idea.title])

  // Voice input toggle
  const toggleVoice = () => {
    setIsListening(!isListening)
    // Voice integration would connect here
  }

  // Copy summary to clipboard
  const copySummary = () => {
    if (!summaryData) return

    const text = `# Executive Summary: ${idea.title}

## Overview
${summaryData.overview}

## Market Analysis
- Market Size: ${summaryData.marketAnalysis.marketSize}
- Target Market: ${summaryData.marketAnalysis.targetMarket}
- Trends: ${summaryData.marketAnalysis.marketTrends.join(", ")}

## Revenue Model
- Model: ${summaryData.revenueModel.primaryModel}
- Pricing: ${summaryData.revenueModel.pricingStrategy}

## Viability Score: ${summaryData.viabilityScore}/10
${summaryData.viabilityRationale}
`
    navigator.clipboard.writeText(text)
  }

  // Get viability color
  const getViabilityColor = (score: number) => {
    if (score >= 8) return "text-green-400"
    if (score >= 6) return "text-yellow-400"
    if (score >= 4) return "text-orange-400"
    return "text-red-400"
  }

  // Editable field component
  const EditableField = ({
    label,
    value,
    sectionKey,
    path
  }: {
    label: string
    value: string
    sectionKey: string
    path?: string[]
  }) => {
    const isEditing = editingSection === `${sectionKey}-${path?.join("-") || ""}`
    const editKey = `${sectionKey}-${path?.join("-") || ""}`

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-muted-foreground">{label}</label>
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => {
                setEditingSection(editKey)
                setEditValue(value)
              }}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="min-h-[80px]"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveEdit(sectionKey, path)}>
                <Check className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={cancelEdit}>
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm">{value || <span className="italic text-muted-foreground">Not set</span>}</p>
        )}
      </div>
    )
  }

  // Editable list component
  const EditableList = ({
    items,
    sectionKey,
    subsection,
    placeholder
  }: {
    items: string[]
    sectionKey: keyof ExecutiveSummaryData
    subsection: string
    placeholder: string
  }) => {
    const [editingIndex, setEditingIndex] = useState<number | null>(null)
    const [editListValue, setEditListValue] = useState("")

    return (
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No items yet</p>
        ) : (
          <ul className="space-y-1">
            {items.map((item, index) => (
              <li key={index} className="flex items-start gap-2 group">
                {editingIndex === index ? (
                  <div className="flex-1 flex gap-2">
                    <Input
                      value={editListValue}
                      onChange={(e) => setEditListValue(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        updateListItem(sectionKey, subsection, index, editListValue)
                        setEditingIndex(null)
                      }}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => setEditingIndex(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-muted-foreground">-</span>
                    <span className="text-sm flex-1">{item}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100"
                      onClick={() => {
                        setEditingIndex(index)
                        setEditListValue(item)
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-400"
                      onClick={() => removeListItem(sectionKey, subsection, index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => addListItem(sectionKey, subsection)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add {placeholder}
        </Button>
      </div>
    )
  }

  // Collapsible section component
  const Section = ({
    id,
    title,
    icon: Icon,
    iconColor,
    children
  }: {
    id: string
    title: string
    icon: typeof Sparkles
    iconColor: string
    children: React.ReactNode
  }) => (
    <Card>
      <CardHeader
        className="cursor-pointer py-3"
        onClick={() => toggleSection(id)}
      >
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", iconColor)} />
            {title}
          </div>
          {expandedSections[id] ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </CardTitle>
      </CardHeader>
      {expandedSections[id] && (
        <CardContent className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  )

  // No data yet - show generate button
  if (!summaryData && !isGenerating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Executive Summary
          </CardTitle>
          <CardDescription>
            Generate a comprehensive analysis of your business idea
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Click below to generate an AI-powered executive summary including:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Market analysis and sizing</li>
                <li>- Revenue model recommendations</li>
                <li>- Competitive landscape analysis</li>
                <li>- Risk assessment and opportunities</li>
                <li>- Viability score and next steps</li>
              </ul>
            </div>
            <Button size="lg" onClick={generateSummary}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Executive Summary
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Generating state
  if (isGenerating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Generating Executive Summary
          </CardTitle>
          <CardDescription>
            Analyzing your business idea...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={generationProgress} className="h-2" />
          <div className="text-sm text-muted-foreground">
            {generationProgress < 30 && "Analyzing market potential..."}
            {generationProgress >= 30 && generationProgress < 60 && "Evaluating competitive landscape..."}
            {generationProgress >= 60 && generationProgress < 90 && "Assessing risks and opportunities..."}
            {generationProgress >= 90 && "Finalizing executive summary..."}
          </div>
          {rawContent && (
            <div className="mt-4 p-3 bg-muted rounded-lg max-h-[200px] overflow-auto">
              <pre className="text-xs whitespace-pre-wrap">{rawContent}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Show generated summary
  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Executive Summary</h2>
          {summaryData && (
            <Badge className={cn("ml-2", getViabilityColor(summaryData.viabilityScore))}>
              Viability: {summaryData.viabilityScore}/10
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copySummary}>
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowChat(!showChat)}>
            <MessageSquare className="h-4 w-4 mr-1" />
            Refine
          </Button>
          <Button variant="outline" size="sm" onClick={generateSummary}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Regenerate
          </Button>
        </div>
      </div>

      {/* Chat refinement panel */}
      {showChat && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-400" />
              Refine with AI
            </CardTitle>
            <CardDescription>
              Ask questions or request changes to the executive summary
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Chat messages */}
            <div className="max-h-[300px] overflow-auto space-y-3">
              {chatMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Ask the AI to modify specific sections or provide more detail
                </p>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-2",
                      msg.role === "user" && "flex-row-reverse"
                    )}
                  >
                    <div className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0",
                      msg.role === "user" ? "bg-primary" : "bg-muted"
                    )}>
                      {msg.role === "user" ? (
                        <User className="h-3 w-3 text-primary-foreground" />
                      ) : (
                        <Bot className="h-3 w-3" />
                      )}
                    </div>
                    <div className={cn(
                      "max-w-[80%] rounded-xl px-3 py-2",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleVoice}
                className={cn(isListening && "bg-red-500 text-white border-red-500")}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask to modify or expand on any section..."
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    sendChatMessage()
                  }
                }}
              />
              <Button onClick={sendChatMessage} disabled={isChatting || !chatInput.trim()}>
                {isChatting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Section */}
      {summaryData && (
        <>
          <Section id="overview" title="Overview" icon={Sparkles} iconColor="text-primary">
            <EditableField
              label="Executive Overview"
              value={summaryData.overview}
              sectionKey="overview"
            />
            <div className="mt-4 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className={cn("h-5 w-5", getViabilityColor(summaryData.viabilityScore))} />
                <span className="font-medium">Viability Assessment</span>
              </div>
              <p className="text-sm text-muted-foreground">{summaryData.viabilityRationale}</p>
            </div>
          </Section>

          <Section id="marketAnalysis" title="Market Analysis" icon={TrendingUp} iconColor="text-blue-400">
            <div className="space-y-4">
              <EditableField
                label="Market Size"
                value={summaryData.marketAnalysis.marketSize}
                sectionKey="marketAnalysis"
                path={["marketSize"]}
              />
              <EditableField
                label="Target Market"
                value={summaryData.marketAnalysis.targetMarket}
                sectionKey="marketAnalysis"
                path={["targetMarket"]}
              />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Market Trends</label>
                <EditableList
                  items={summaryData.marketAnalysis.marketTrends}
                  sectionKey="marketAnalysis"
                  subsection="marketTrends"
                  placeholder="trend"
                />
              </div>
              <EditableField
                label="Competitor Landscape"
                value={summaryData.marketAnalysis.competitorLandscape}
                sectionKey="marketAnalysis"
                path={["competitorLandscape"]}
              />
            </div>
          </Section>

          <Section id="revenueModel" title="Revenue Model" icon={DollarSign} iconColor="text-green-400">
            <div className="space-y-4">
              <EditableField
                label="Primary Model"
                value={summaryData.revenueModel.primaryModel}
                sectionKey="revenueModel"
                path={["primaryModel"]}
              />
              <EditableField
                label="Pricing Strategy"
                value={summaryData.revenueModel.pricingStrategy}
                sectionKey="revenueModel"
                path={["pricingStrategy"]}
              />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Revenue Streams</label>
                <EditableList
                  items={summaryData.revenueModel.revenueStreams}
                  sectionKey="revenueModel"
                  subsection="revenueStreams"
                  placeholder="stream"
                />
              </div>
              <EditableField
                label="Projected Metrics"
                value={summaryData.revenueModel.projectedMetrics}
                sectionKey="revenueModel"
                path={["projectedMetrics"]}
              />
            </div>
          </Section>

          <Section id="competitiveLandscape" title="Competitive Landscape" icon={Target} iconColor="text-purple-400">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Direct Competitors</label>
                <EditableList
                  items={summaryData.competitiveLandscape.directCompetitors}
                  sectionKey="competitiveLandscape"
                  subsection="directCompetitors"
                  placeholder="competitor"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Indirect Competitors</label>
                <EditableList
                  items={summaryData.competitiveLandscape.indirectCompetitors}
                  sectionKey="competitiveLandscape"
                  subsection="indirectCompetitors"
                  placeholder="competitor"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Competitive Advantages</label>
                <EditableList
                  items={summaryData.competitiveLandscape.competitiveAdvantages}
                  sectionKey="competitiveLandscape"
                  subsection="competitiveAdvantages"
                  placeholder="advantage"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Barriers to Entry</label>
                <EditableList
                  items={summaryData.competitiveLandscape.barriers}
                  sectionKey="competitiveLandscape"
                  subsection="barriers"
                  placeholder="barrier"
                />
              </div>
            </div>
          </Section>

          <Section id="risks" title="Risks" icon={AlertTriangle} iconColor="text-yellow-400">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Market Risks</label>
                <EditableList
                  items={summaryData.risks.marketRisks}
                  sectionKey="risks"
                  subsection="marketRisks"
                  placeholder="risk"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Technical Risks</label>
                <EditableList
                  items={summaryData.risks.technicalRisks}
                  sectionKey="risks"
                  subsection="technicalRisks"
                  placeholder="risk"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Financial Risks</label>
                <EditableList
                  items={summaryData.risks.financialRisks}
                  sectionKey="risks"
                  subsection="financialRisks"
                  placeholder="risk"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Mitigation Strategies</label>
                <EditableList
                  items={summaryData.risks.mitigationStrategies}
                  sectionKey="risks"
                  subsection="mitigationStrategies"
                  placeholder="strategy"
                />
              </div>
            </div>
          </Section>

          <Section id="opportunities" title="Opportunities" icon={Lightbulb} iconColor="text-emerald-400">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Short Term</label>
                <EditableList
                  items={summaryData.opportunities.shortTerm}
                  sectionKey="opportunities"
                  subsection="shortTerm"
                  placeholder="opportunity"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Long Term</label>
                <EditableList
                  items={summaryData.opportunities.longTerm}
                  sectionKey="opportunities"
                  subsection="longTerm"
                  placeholder="opportunity"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Partnerships</label>
                <EditableList
                  items={summaryData.opportunities.partnerships}
                  sectionKey="opportunities"
                  subsection="partnerships"
                  placeholder="partner"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Expansion</label>
                <EditableList
                  items={summaryData.opportunities.expansion}
                  sectionKey="opportunities"
                  subsection="expansion"
                  placeholder="expansion"
                />
              </div>
            </div>
          </Section>

          <Section id="nextSteps" title="Next Steps" icon={Shield} iconColor="text-cyan-400">
            <EditableList
              items={summaryData.nextSteps}
              sectionKey={"nextSteps" as keyof ExecutiveSummaryData}
              subsection="nextSteps"
              placeholder="step"
            />
          </Section>
        </>
      )}
    </div>
  )
}
