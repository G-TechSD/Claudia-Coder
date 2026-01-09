"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Plus,
  Search,
  Filter,
  Lightbulb,
  RefreshCw,
  ArrowUpRight,
  ArrowLeft,
  Trash2,
  TrendingUp,
  Sparkles,
  Target,
  Clock,
  CheckCircle,
  Archive,
  MessageSquare,
  Rocket,
  Building2,
  Code2,
  Link2,
  Loader2,
  Check,
  X,
  Edit2
} from "lucide-react"
import {
  getAllBusinessIdeas,
  getBusinessIdeaStats,
  archiveBusinessIdea,
  deleteBusinessIdea,
  createBusinessIdea,
  updateBusinessIdea,
  type BusinessIdea,
  type BusinessIdeaStatus,
  type BusinessIdeaPotential
} from "@/lib/data/business-ideas"
import { BrainDumpInput } from "@/components/business-ideas/brain-dump-input"
import { BusinessIdeaInterview, type BusinessIdeaSummary } from "@/components/business-ideas/business-idea-interview"
import { ConvertToProjectDialog } from "@/components/business-ideas/convert-to-project-dialog"
import { VoiceChatPanel } from "@/components/business-ideas/voice-chat-panel"

type PageMode = "list" | "braindump" | "interview" | "review"

const statusConfig: Record<BusinessIdeaStatus, {
  label: string
  color: string
  icon: typeof Lightbulb
}> = {
  brainstorming: { label: "Brainstorming", color: "text-blue-400", icon: Lightbulb },
  exploring: { label: "Exploring", color: "text-purple-400", icon: Sparkles },
  validating: { label: "Validating", color: "text-yellow-400", icon: Target },
  ready: { label: "Ready", color: "text-green-400", icon: CheckCircle },
  converted: { label: "Converted", color: "text-emerald-400", icon: Rocket },
  archived: { label: "Archived", color: "text-gray-400", icon: Archive }
}

const potentialConfig: Record<BusinessIdeaPotential, {
  label: string
  color: string
  bg: string
}> = {
  low: { label: "Low", color: "text-gray-400", bg: "bg-gray-400/10" },
  medium: { label: "Medium", color: "text-blue-400", bg: "bg-blue-400/10" },
  high: { label: "High", color: "text-orange-400", bg: "bg-orange-400/10" },
  "very-high": { label: "Very High", color: "text-green-400", bg: "bg-green-400/10" }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const diff = Date.now() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return date.toLocaleDateString()
}

export default function BusinessIdeasPage() {
  const router = useRouter()
  const [ideas, setIdeas] = useState<BusinessIdea[]>([])
  const [statusFilter, setStatusFilter] = useState<BusinessIdeaStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // Mode state
  const [mode, setMode] = useState<PageMode>("list")
  const [brainDumpContent, setBrainDumpContent] = useState("")
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [generatedSummary, setGeneratedSummary] = useState<BusinessIdeaSummary | null>(null)
  const [newlyCreatedIdea, setNewlyCreatedIdea] = useState<BusinessIdea | null>(null)

  // Convert dialog
  const [showConvertDialog, setShowConvertDialog] = useState(false)
  const [ideaToConvert, setIdeaToConvert] = useState<BusinessIdea | null>(null)

  // Load ideas
  useEffect(() => {
    loadIdeas()
  }, [])

  const loadIdeas = () => {
    setIsLoading(true)
    const allIdeas = getAllBusinessIdeas()
    setIdeas(allIdeas)
    setIsLoading(false)
  }

  // Filter ideas
  const filteredIdeas = useMemo(() => {
    let result = ideas

    if (statusFilter !== "all") {
      result = result.filter(i => i.status === statusFilter)
    }

    if (search) {
      const lower = search.toLowerCase()
      result = result.filter(i =>
        i.title.toLowerCase().includes(lower) ||
        i.summary.toLowerCase().includes(lower) ||
        i.tags.some(t => t.toLowerCase().includes(lower))
      )
    }

    // Sort by updated date
    return result.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }, [ideas, statusFilter, search])

  // Stats
  const stats = useMemo(() => getBusinessIdeaStats(), [ideas])

  const handleArchive = (id: string, title: string) => {
    if (confirm(`Archive "${title}"?`)) {
      archiveBusinessIdea(id)
      loadIdeas()
    }
  }

  const handleStartInterview = (content: string) => {
    setBrainDumpContent(content)
    setMode("interview")
  }

  const handleGenerateSummary = async (content: string) => {
    setBrainDumpContent(content)
    setIsGeneratingSummary(true)

    try {
      const response = await fetch("/api/business-ideas/executive-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initialDescription: content
        })
      })

      if (!response.ok) {
        throw new Error("Failed to generate summary")
      }

      const summary: BusinessIdeaSummary = await response.json()
      summary.messages = []
      setGeneratedSummary(summary)
      setMode("review")
    } catch (error) {
      console.error("Summary generation error:", error)
      alert("Failed to generate summary. Please try again.")
    } finally {
      setIsGeneratingSummary(false)
    }
  }

  const handleInterviewComplete = (summary: BusinessIdeaSummary) => {
    setGeneratedSummary(summary)
    setMode("review")
  }

  const handleSaveIdea = () => {
    if (!generatedSummary) return

    const newIdea = createBusinessIdea({
      title: generatedSummary.title,
      summary: generatedSummary.summary,
      potential: generatedSummary.potential,
      status: "exploring",
      messages: generatedSummary.messages.map((m, i) => ({
        id: `msg-${i}`,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp
      })),
      tags: [],
      executiveSummary: generatedSummary.summary,
      problemStatement: generatedSummary.problemStatement,
      targetAudience: generatedSummary.targetAudience,
      valueProposition: generatedSummary.valueProposition,
      revenueModel: generatedSummary.revenueModel,
      competitiveAdvantage: generatedSummary.competitiveAdvantage,
      keyRisks: generatedSummary.keyRisks,
      nextSteps: generatedSummary.nextSteps
    })

    setNewlyCreatedIdea(newIdea)
    loadIdeas()
  }

  const handleConvertToProject = (idea: BusinessIdea) => {
    setIdeaToConvert(idea)
    setShowConvertDialog(true)
  }

  const handleProjectCreated = (projects: { businessProject?: { id: string; name: string }; devProject?: { id: string; name: string } }) => {
    loadIdeas()

    // Navigate to the appropriate project
    if (projects.businessProject) {
      router.push(`/projects/${projects.businessProject.id}`)
    } else if (projects.devProject) {
      router.push(`/projects/${projects.devProject.id}`)
    }
  }

  const handleBackToList = () => {
    setMode("list")
    setBrainDumpContent("")
    setGeneratedSummary(null)
    setNewlyCreatedIdea(null)
  }

  // Interview mode
  if (mode === "interview") {
    return (
      <div className="h-[calc(100vh-4rem)]">
        <BusinessIdeaInterview
          initialDescription={brainDumpContent}
          onComplete={handleInterviewComplete}
          onCancel={handleBackToList}
        />
      </div>
    )
  }

  // Review mode - show generated summary
  if (mode === "review" && generatedSummary) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBackToList}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Lightbulb className="h-6 w-6 text-yellow-400" />
              {newlyCreatedIdea ? "Idea Saved!" : "Review Your Idea"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {newlyCreatedIdea
                ? "Your business idea has been saved. Continue exploring or convert to a project."
                : "Review the generated executive summary and save your idea"}
            </p>
          </div>
          {!newlyCreatedIdea ? (
            <Button onClick={handleSaveIdea} className="gap-2">
              <Check className="h-4 w-4" />
              Save Idea
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/business-ideas/${newlyCreatedIdea.id}`)}
              >
                View Details
              </Button>
              <Button
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleConvertToProject(newlyCreatedIdea)}
              >
                <Rocket className="h-4 w-4" />
                Convert to Project
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title and Summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    {generatedSummary.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge className={cn(potentialConfig[generatedSummary.potential].color)}>
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {potentialConfig[generatedSummary.potential].label} Potential
                    </Badge>
                    {generatedSummary.projectType && (
                      <Badge variant="outline">
                        {generatedSummary.projectType === "dev" && (
                          <>
                            <Code2 className="h-3 w-3 mr-1" />
                            Software
                          </>
                        )}
                        {generatedSummary.projectType === "business" && (
                          <>
                            <Building2 className="h-3 w-3 mr-1" />
                            Business
                          </>
                        )}
                        {generatedSummary.projectType === "both" && (
                          <>
                            <Link2 className="h-3 w-3 mr-1" />
                            Both
                          </>
                        )}
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription className="text-base">
                  {generatedSummary.summary}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Key Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Business Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {generatedSummary.problemStatement && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Problem Statement</label>
                    <p className="text-sm mt-1">{generatedSummary.problemStatement}</p>
                  </div>
                )}
                {generatedSummary.targetAudience && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Target Audience</label>
                    <p className="text-sm mt-1">{generatedSummary.targetAudience}</p>
                  </div>
                )}
                {generatedSummary.valueProposition && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Value Proposition</label>
                    <p className="text-sm mt-1">{generatedSummary.valueProposition}</p>
                  </div>
                )}
                {generatedSummary.revenueModel && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Revenue Model</label>
                    <p className="text-sm mt-1">{generatedSummary.revenueModel}</p>
                  </div>
                )}
                {generatedSummary.competitiveAdvantage && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Competitive Advantage</label>
                    <p className="text-sm mt-1">{generatedSummary.competitiveAdvantage}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Risks and Next Steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-yellow-400" />
                    Key Risks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {generatedSummary.keyRisks.length > 0 ? (
                    <ul className="space-y-2">
                      {generatedSummary.keyRisks.map((risk, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-yellow-400 mt-1">-</span>
                          {risk}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No risks identified</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    Next Steps
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {generatedSummary.nextSteps.length > 0 ? (
                    <ul className="space-y-2">
                      {generatedSummary.nextSteps.map((step, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-green-400 font-medium">{i + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No next steps defined</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Voice Chat Panel */}
          <div className="lg:col-span-1">
            {newlyCreatedIdea ? (
              <VoiceChatPanel
                idea={newlyCreatedIdea}
                onMessageSent={(msg, resp) => {
                  // Optionally save messages to the idea
                }}
                className="h-[600px]"
              />
            ) : (
              <Card className="h-[600px]">
                <CardContent className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-center">Save your idea to enable voice chat</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Convert Dialog */}
        {ideaToConvert && (
          <ConvertToProjectDialog
            open={showConvertDialog}
            onOpenChange={setShowConvertDialog}
            idea={ideaToConvert}
            suggestedType={generatedSummary.projectType}
            onSuccess={handleProjectCreated}
          />
        )}
      </div>
    )
  }

  // Brain dump / new idea mode
  if (mode === "braindump") {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBackToList}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Lightbulb className="h-6 w-6 text-yellow-400" />
              New Business Idea
            </h1>
            <p className="text-sm text-muted-foreground">
              Capture your thoughts freely, then explore or generate a summary
            </p>
          </div>
        </div>

        <BrainDumpInput
          onStartInterview={handleStartInterview}
          onGenerateSummary={handleGenerateSummary}
          isGenerating={isGeneratingSummary}
        />

        <div className="text-center">
          <Button variant="ghost" onClick={handleBackToList}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // Default: List mode
  return (
    <div className="flex flex-col gap-4 p-6 h-full">
      {/* Brain Dump Section - Prominent at top */}
      <BrainDumpInput
        onStartInterview={handleStartInterview}
        onGenerateSummary={handleGenerateSummary}
        isGenerating={isGeneratingSummary}
      />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-yellow-400" />
            Your Ideas
          </h1>

          {/* Inline stats */}
          <div className="hidden xl:flex items-center gap-1">
            {[
              { label: "Total", value: stats.total, color: "text-foreground" },
              { label: "Brainstorming", value: stats.byStatus.brainstorming, color: "text-blue-400" },
              { label: "Exploring", value: stats.byStatus.exploring, color: "text-purple-400" },
              { label: "Ready", value: stats.byStatus.ready, color: "text-green-400" },
              { label: "Converted", value: stats.byStatus.converted, color: "text-emerald-400" }
            ].map(stat => (
              <div
                key={stat.label}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-xs"
              >
                <span className="text-muted-foreground">{stat.label}</span>
                <span className={cn("font-semibold", stat.color)}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadIdeas} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards - visible on smaller screens */}
      <div className="grid grid-cols-5 gap-2 xl:hidden">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Brainstorming", value: stats.byStatus.brainstorming, color: "text-blue-400" },
          { label: "Exploring", value: stats.byStatus.exploring, color: "text-purple-400" },
          { label: "Ready", value: stats.byStatus.ready, color: "text-green-400" },
          { label: "Converted", value: stats.byStatus.converted, color: "text-emerald-400" }
        ].map(stat => (
          <div key={stat.label} className="p-2 rounded-md border bg-card text-center">
            <div className={cn("text-lg font-semibold", stat.color)}>{stat.value}</div>
            <div className="text-xs text-muted-foreground truncate">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filter & Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search ideas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent pl-10 pr-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground mr-2" />
          {(["all", "brainstorming", "exploring", "validating", "ready"] as const).map(status => (
            <Button
              key={status}
              variant={statusFilter === status ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      {/* Ideas Grid */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredIdeas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Lightbulb className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No business ideas yet</p>
            <p className="text-sm">Use the brain dump above to capture your first idea</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredIdeas.map(idea => {
              const statusConf = statusConfig[idea.status]
              const StatusIcon = statusConf.icon
              const potentialConf = potentialConfig[idea.potential]

              return (
                <Card key={idea.id} className="group hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <Link
                          href={`/business-ideas/${idea.id}`}
                          className="font-semibold hover:text-primary truncate block"
                        >
                          {idea.title}
                        </Link>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {idea.summary}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Status & Potential */}
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={cn("gap-1", statusConf.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConf.label}
                      </Badge>
                      <Badge variant="outline" className={cn(potentialConf.color)}>
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {potentialConf.label}
                      </Badge>
                    </div>

                    {/* Tags */}
                    {idea.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {idea.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {idea.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{idea.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Stats Row */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        <span>{idea.messages.length} messages</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{formatDate(idea.updatedAt)}</span>
                      </div>
                    </div>

                    {/* Converted Link */}
                    {idea.convertedProjectId && (
                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex items-center gap-1 text-emerald-400">
                          <Rocket className="h-3 w-3" />
                          <Link
                            href={`/projects/${idea.convertedProjectId}`}
                            className="hover:underline"
                          >
                            View Project
                          </Link>
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-muted-foreground">
                        Created {formatDate(idea.createdAt)}
                      </span>
                      <div className="flex items-center gap-1">
                        {idea.status === "ready" && !idea.convertedProjectId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-emerald-400 hover:text-emerald-400"
                            onClick={() => handleConvertToProject(idea)}
                          >
                            <Rocket className="h-3.5 w-3.5 mr-1" />
                            Convert
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <Link href={`/business-ideas/${idea.id}`}>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        {idea.status !== "converted" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-400 hover:bg-red-400/10"
                            onClick={() => handleArchive(idea.id, idea.title)}
                            title="Archive"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Convert Dialog */}
      {ideaToConvert && (
        <ConvertToProjectDialog
          open={showConvertDialog}
          onOpenChange={setShowConvertDialog}
          idea={ideaToConvert}
          suggestedType={null}
          onSuccess={handleProjectCreated}
        />
      )}
    </div>
  )
}
