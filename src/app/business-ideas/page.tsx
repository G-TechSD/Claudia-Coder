"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Trash2,
  TrendingUp,
  Sparkles,
  Target,
  Clock,
  CheckCircle,
  Archive,
  MessageSquare,
  Rocket
} from "lucide-react"
import {
  getAllBusinessIdeas,
  getBusinessIdeaStats,
  archiveBusinessIdea,
  deleteBusinessIdea,
  createBusinessIdea,
  type BusinessIdea,
  type BusinessIdeaStatus,
  type BusinessIdeaPotential
} from "@/lib/data/business-ideas"

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
  const [ideas, setIdeas] = useState<BusinessIdea[]>([])
  const [statusFilter, setStatusFilter] = useState<BusinessIdeaStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)

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

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Permanently delete "${title}"? This cannot be undone.`)) {
      deleteBusinessIdea(id)
      loadIdeas()
    }
  }

  const handleNewIdea = () => {
    const newIdea = createBusinessIdea({
      title: "New Business Idea",
      summary: "A new idea to explore...",
      potential: "medium",
      status: "brainstorming",
      messages: [],
      tags: []
    })
    // Navigate to the new idea
    window.location.href = `/business-ideas/${newIdea.id}`
  }

  return (
    <div className="flex flex-col gap-4 p-6 h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-yellow-400" />
            Business Ideas
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
          <Button size="sm" className="gap-2" onClick={handleNewIdea}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Idea</span>
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
            <p className="text-sm">Start brainstorming your next big idea</p>
            <Button className="mt-4 gap-2" onClick={handleNewIdea}>
              <Plus className="h-4 w-4" />
              New Idea
            </Button>
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

      {/* Empty State CTA */}
      {ideas.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Lightbulb className="h-10 w-10 mx-auto mb-3 text-yellow-400" />
              <h3 className="font-medium mb-1">Start Brainstorming</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first business idea and explore it with AI
              </p>
              <Button className="gap-2" onClick={handleNewIdea}>
                <Plus className="h-4 w-4" />
                New Idea
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
