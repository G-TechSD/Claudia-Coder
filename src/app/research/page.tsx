"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  ArrowUpRight,
  Trash2,
  Clock,
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
  Zap,
  FolderPlus,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import {
  getAllResearch,
  getResearch,
  createResearch,
  updateResearch,
  deleteResearch,
  updateResearchFindings,
  markResearchConverted,
  getResearchStats,
  type ResearchEntry,
  type ResearchStatus,
  type ResearchRecommendation
} from "@/lib/data/research"
import { createProject } from "@/lib/data/projects"
import type { PriorArtResearch, CompetitorAnalysis } from "@/lib/data/types"

// ============ Configuration ============

const statusConfig: Record<ResearchStatus, {
  label: string
  color: string
  icon: typeof Search
}> = {
  pending: { label: "Pending", color: "text-gray-400", icon: Clock },
  researching: { label: "Researching", color: "text-blue-400", icon: Loader2 },
  completed: { label: "Completed", color: "text-green-400", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-red-400", icon: XCircle }
}

const recommendationConfig: Record<ResearchRecommendation, {
  label: string
  color: string
  bg: string
  border: string
  icon: typeof ThumbsUp
}> = {
  pursue: {
    label: "Pursue",
    color: "text-green-500",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    icon: ThumbsUp
  },
  pivot: {
    label: "Consider Pivoting",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    icon: ArrowRight
  },
  abandon: {
    label: "Consider Abandoning",
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    icon: ThumbsDown
  },
  undetermined: {
    label: "More Research Needed",
    color: "text-gray-500",
    bg: "bg-gray-500/10",
    border: "border-gray-500/30",
    icon: HelpCircle
  }
}

// ============ Helper Functions ============

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

function getCategoryBadge(category: CompetitorAnalysis["category"]) {
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

function getSaturationConfig(saturation: string) {
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

// ============ Main Component ============

export default function ResearchPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<ResearchEntry[]>([])
  const [statusFilter, setStatusFilter] = useState<ResearchStatus | "all">("all")
  const [recommendationFilter, setRecommendationFilter] = useState<ResearchRecommendation | "all">("all")
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // New research dialog
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newTopic, setNewTopic] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  // Selected entry for detail view
  const [selectedEntry, setSelectedEntry] = useState<ResearchEntry | null>(null)
  const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null)

  // Research in progress
  const [researchingId, setResearchingId] = useState<string | null>(null)
  const [researchStatus, setResearchStatus] = useState("")

  // Load entries
  useEffect(() => {
    loadEntries()
  }, [])

  const loadEntries = () => {
    setIsLoading(true)
    const allEntries = getAllResearch({ includeConverted: true })
    setEntries(allEntries)
    setIsLoading(false)
  }

  // Filter entries
  const filteredEntries = useMemo(() => {
    let result = entries

    if (statusFilter !== "all") {
      result = result.filter(e => e.status === statusFilter)
    }

    if (recommendationFilter !== "all") {
      result = result.filter(e => e.recommendation === recommendationFilter)
    }

    if (search) {
      const lower = search.toLowerCase()
      result = result.filter(e =>
        e.topic.toLowerCase().includes(lower) ||
        e.description.toLowerCase().includes(lower) ||
        e.tags.some(t => t.toLowerCase().includes(lower))
      )
    }

    return result.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }, [entries, statusFilter, recommendationFilter, search])

  // Stats
  const stats = useMemo(() => getResearchStats(), [entries])

  // Create new research entry
  const handleCreate = async () => {
    if (!newTopic.trim()) return

    setIsCreating(true)
    const entry = createResearch({
      topic: newTopic.trim(),
      description: newDescription.trim(),
      status: "pending",
      tags: []
    })

    setNewTopic("")
    setNewDescription("")
    setShowNewDialog(false)
    setIsCreating(false)
    loadEntries()

    // Optionally start research immediately
    if (newDescription.trim()) {
      await performResearch(entry.id)
    }
  }

  // Delete entry
  const handleDelete = (id: string, topic: string) => {
    if (confirm(`Permanently delete research for "${topic}"? This cannot be undone.`)) {
      deleteResearch(id)
      if (selectedEntry?.id === id) {
        setSelectedEntry(null)
      }
      loadEntries()
    }
  }

  // Perform research
  const performResearch = async (id: string) => {
    const entry = getResearch(id)
    if (!entry) return

    setResearchingId(id)
    setResearchStatus("Starting research...")

    // Update status to researching
    updateResearch(id, { status: "researching" })
    loadEntries()

    try {
      setResearchStatus("Searching for existing solutions...")

      const response = await fetch("/api/projects/prior-art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: `research-${id}`,
          projectName: entry.topic,
          projectDescription: entry.description,
          allowPaidFallback: true
        })
      })

      setResearchStatus("Analyzing competition...")

      const data = await response.json()

      if (data.error) {
        updateResearch(id, {
          status: "failed",
          notes: `Research failed: ${data.error}`
        })
      } else if (data.research) {
        updateResearchFindings(id, data.research)
        setResearchStatus("Research complete!")
        setTimeout(() => setResearchStatus(""), 2000)
      }

    } catch (err) {
      updateResearch(id, {
        status: "failed",
        notes: `Research failed: ${err instanceof Error ? err.message : "Unknown error"}`
      })
    } finally {
      setResearchingId(null)
      loadEntries()
      // Refresh selected entry if it was the one being researched
      if (selectedEntry?.id === id) {
        setSelectedEntry(getResearch(id))
      }
    }
  }

  // Create project from research
  const handleCreateProject = async (entry: ResearchEntry) => {
    if (!entry.findings) return

    const project = createProject({
      name: entry.topic,
      description: entry.description,
      status: "planning",
      priority: entry.recommendation === "pursue" ? "high" : "medium",
      repos: [],
      packetIds: [],
      tags: entry.tags
    })

    // Mark research as converted
    markResearchConverted(entry.id, project.id)
    loadEntries()

    // Navigate to the new project
    router.push(`/projects/${project.id}`)
  }

  return (
    <div className="flex flex-col gap-4 p-6 h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Search className="h-6 w-6 text-cyan-400" />
            Has This Been Done Before?
          </h1>

          {/* Inline stats */}
          <div className="hidden xl:flex items-center gap-1">
            {[
              { label: "Total", value: stats.total, color: "text-foreground" },
              { label: "Pursue", value: stats.byRecommendation.pursue, color: "text-green-400" },
              { label: "Pivot", value: stats.byRecommendation.pivot, color: "text-yellow-400" },
              { label: "Abandon", value: stats.byRecommendation.abandon, color: "text-red-400" },
              { label: "Converted", value: stats.converted, color: "text-blue-400" }
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
          <Button variant="outline" size="sm" onClick={loadEntries} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Research New Idea</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Research New Idea</DialogTitle>
                <DialogDescription>
                  Enter an idea or concept to research if it's been done before.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="topic">Topic / Idea Name</Label>
                  <Input
                    id="topic"
                    placeholder="e.g., AI-powered recipe generator"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your idea in detail. What problem does it solve? Who is it for? What makes it unique?"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!newTopic.trim() || isCreating}
                  className="gap-2"
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Create & Research
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards - visible on smaller screens */}
      <div className="grid grid-cols-5 gap-2 xl:hidden">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Pursue", value: stats.byRecommendation.pursue, color: "text-green-400" },
          { label: "Pivot", value: stats.byRecommendation.pivot, color: "text-yellow-400" },
          { label: "Abandon", value: stats.byRecommendation.abandon, color: "text-red-400" },
          { label: "Converted", value: stats.converted, color: "text-blue-400" }
        ].map(stat => (
          <div key={stat.label} className="p-2 rounded-md border bg-card text-center">
            <div className={cn("text-lg font-semibold", stat.color)}>{stat.value}</div>
            <div className="text-xs text-muted-foreground truncate">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filter & Search */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search research..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent pl-10 pr-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground mr-2" />
          {(["all", "pursue", "pivot", "abandon"] as const).map(rec => (
            <Button
              key={rec}
              variant={recommendationFilter === rec ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setRecommendationFilter(rec)}
              className="capitalize"
            >
              {rec}
            </Button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Research List */}
        <div className={cn(
          "flex-1 overflow-auto",
          selectedEntry && "hidden lg:block lg:w-1/3"
        )}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No research yet</p>
              <p className="text-sm">Start by researching your first idea</p>
              <Button className="mt-4 gap-2" onClick={() => setShowNewDialog(true)}>
                <Plus className="h-4 w-4" />
                Research New Idea
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEntries.map(entry => {
                const statusConf = statusConfig[entry.status]
                const StatusIcon = statusConf.icon
                const recConfig = entry.recommendation ? recommendationConfig[entry.recommendation] : null
                const isResearching = researchingId === entry.id

                return (
                  <Card
                    key={entry.id}
                    className={cn(
                      "group hover:border-primary/50 transition-colors cursor-pointer",
                      selectedEntry?.id === entry.id && "border-primary"
                    )}
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium truncate">{entry.topic}</h3>
                            {entry.convertedToProjectId && (
                              <Badge variant="outline" className="text-xs text-blue-400 border-blue-400/30">
                                Converted
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {entry.description || "No description"}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <Badge
                            variant="secondary"
                            className={cn("gap-1", statusConf.color)}
                          >
                            <StatusIcon className={cn(
                              "h-3 w-3",
                              isResearching && "animate-spin"
                            )} />
                            {statusConf.label}
                          </Badge>
                          {recConfig && (
                            <Badge
                              variant="outline"
                              className={cn("text-xs", recConfig.color, recConfig.border)}
                            >
                              {recConfig.label}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(entry.updatedAt)}
                        </span>
                        <div className="flex items-center gap-1">
                          {entry.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1"
                              onClick={(e) => {
                                e.stopPropagation()
                                performResearch(entry.id)
                              }}
                              disabled={isResearching}
                            >
                              {isResearching ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3" />
                              )}
                              Research
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-400 hover:bg-red-400/10"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(entry.id, entry.topic)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Detail View */}
        {selectedEntry && (
          <Card className={cn(
            "flex-1 lg:w-2/3 overflow-hidden flex flex-col",
            !selectedEntry && "hidden"
          )}>
            <CardHeader className="border-b shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {selectedEntry.topic}
                    {selectedEntry.recommendation && (
                      <Badge
                        variant="outline"
                        className={cn(
                          recommendationConfig[selectedEntry.recommendation].color,
                          recommendationConfig[selectedEntry.recommendation].border
                        )}
                      >
                        {recommendationConfig[selectedEntry.recommendation].label}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {selectedEntry.description || "No description provided"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {selectedEntry.status === "completed" &&
                   selectedEntry.recommendation === "pursue" &&
                   !selectedEntry.convertedToProjectId && (
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => handleCreateProject(selectedEntry)}
                    >
                      <FolderPlus className="h-4 w-4" />
                      Create Project
                    </Button>
                  )}
                  {selectedEntry.status === "pending" && (
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => performResearch(selectedEntry.id)}
                      disabled={researchingId === selectedEntry.id}
                    >
                      {researchingId === selectedEntry.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Start Research
                    </Button>
                  )}
                  {selectedEntry.status === "completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => performResearch(selectedEntry.id)}
                      disabled={researchingId === selectedEntry.id}
                    >
                      {researchingId === selectedEntry.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Re-Research
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={() => setSelectedEntry(null)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">
                {/* Research Status */}
                {researchingId === selectedEntry.id && (
                  <div className="text-center py-8">
                    <Loader2 className="h-12 w-12 mx-auto animate-spin text-cyan-500 mb-4" />
                    <p className="text-muted-foreground">{researchStatus}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      This may take 30-60 seconds...
                    </p>
                  </div>
                )}

                {/* Pending State */}
                {selectedEntry.status === "pending" && researchingId !== selectedEntry.id && (
                  <div className="text-center py-12">
                    <Search className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Click "Start Research" to analyze this idea
                    </p>
                  </div>
                )}

                {/* Failed State */}
                {selectedEntry.status === "failed" && (
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-medium">Research Failed</span>
                    </div>
                    <p className="text-sm">{selectedEntry.notes || "Unknown error occurred"}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-2"
                      onClick={() => performResearch(selectedEntry.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Try Again
                    </Button>
                  </div>
                )}

                {/* Research Results */}
                {selectedEntry.status === "completed" && selectedEntry.findings && (
                  <ResearchResults
                    research={selectedEntry.findings}
                    expandedCompetitor={expandedCompetitor}
                    setExpandedCompetitor={setExpandedCompetitor}
                  />
                )}
              </div>
            </ScrollArea>
          </Card>
        )}
      </div>
    </div>
  )
}

// ============ Research Results Component ============

interface ResearchResultsProps {
  research: PriorArtResearch
  expandedCompetitor: string | null
  setExpandedCompetitor: (id: string | null) => void
}

function ResearchResults({
  research,
  expandedCompetitor,
  setExpandedCompetitor
}: ResearchResultsProps) {
  const recConfig = recommendationConfig[research.recommendation]
  const saturationConfig = getSaturationConfig(research.marketSaturation)

  return (
    <div className="space-y-6">
      {/* Recommendation Banner */}
      <Card className={cn(recConfig.bg, recConfig.border)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className={cn("p-3 rounded-full", recConfig.bg)}>
              <recConfig.icon className={cn("h-6 w-6", recConfig.color)} />
            </div>
            <div className="flex-1">
              <h3 className={cn("font-semibold text-lg", recConfig.color)}>
                Recommendation: {recConfig.label}
              </h3>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span>Confidence: {research.confidenceLevel}</span>
                <span>{saturationConfig.label}</span>
                <span>{research.totalCompetitorsFound} competitors found</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
                            Your Advantage
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
  )
}
