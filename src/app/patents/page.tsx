"use client"

// Force dynamic rendering to prevent SSR issues with auth context
export const dynamic = "force-dynamic"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  ArrowUpRight,
  Trash2,
  FileCheck,
  Clock,
  FileText,
  Eye,
  Send,
  CheckCircle,
  XCircle,
  Scale,
  Lightbulb,
  FolderOpen,
  AlertCircle
} from "lucide-react"
import type { PatentResearch, PatentResearchStatus } from "@/lib/data/types"

const statusConfig: Record<PatentResearchStatus, {
  label: string
  color: string
  icon: typeof FileCheck
}> = {
  research: { label: "Research", color: "text-blue-400", icon: Search },
  drafting: { label: "Drafting", color: "text-purple-400", icon: FileText },
  review: { label: "Review", color: "text-yellow-400", icon: Eye },
  filed: { label: "Filed", color: "text-orange-400", icon: Send },
  approved: { label: "Approved", color: "text-green-400", icon: CheckCircle },
  rejected: { label: "Rejected", color: "text-red-400", icon: XCircle }
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

interface PatentStats {
  total: number
  byStatus: Record<PatentResearchStatus, number>
}

const defaultStats: PatentStats = {
  total: 0,
  byStatus: {
    research: 0,
    drafting: 0,
    review: 0,
    filed: 0,
    approved: 0,
    rejected: 0
  }
}

export default function PatentsPage() {
  const router = useRouter()
  const [patents, setPatents] = useState<PatentResearch[]>([])
  const [stats, setStats] = useState<PatentStats>(defaultStats)
  const [statusFilter, setStatusFilter] = useState<PatentResearchStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Load patents from API
  const loadPatents = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (statusFilter !== "all") {
        params.set("status", statusFilter)
      }
      params.set("includeStats", "true")

      const response = await fetch(`/api/patents?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch patents")
      }

      setPatents(data.patents || [])
      if (data.stats) {
        setStats(data.stats)
      }
    } catch (err) {
      console.error("[Patents Page] Load error:", err)
      setError(err instanceof Error ? err.message : "Failed to load patents")
      setPatents([])
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  // Load patents on mount and when filter changes
  useEffect(() => {
    loadPatents()
  }, [loadPatents])

  // Filter patents by search (already filtered by status on server)
  const filteredPatents = useMemo(() => {
    if (!search) return patents

    const lower = search.toLowerCase()
    return patents.filter(p =>
      p.title.toLowerCase().includes(lower) ||
      p.inventionDescription?.summary?.toLowerCase().includes(lower) ||
      p.tags?.some(t => t.toLowerCase().includes(lower)) ||
      p.inventionDescription?.technicalField?.toLowerCase().includes(lower)
    )
  }, [patents, search])

  // Sort by updated date
  const sortedPatents = useMemo(() => {
    return [...filteredPatents].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }, [filteredPatents])

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Permanently delete "${title}"? This cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/patents/${id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete patent")
      }

      // Reload patents
      loadPatents()
    } catch (err) {
      console.error("[Patents Page] Delete error:", err)
      alert(err instanceof Error ? err.message : "Failed to delete patent")
    }
  }

  const handleNewPatent = async () => {
    setIsCreating(true)
    try {
      const response = await fetch("/api/patents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Patent Research",
          status: "research",
          inventionDescription: { summary: "" }
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create patent")
      }

      // Navigate to the new patent
      router.push(`/patents/${data.patent.id}`)
    } catch (err) {
      console.error("[Patents Page] Create error:", err)
      alert(err instanceof Error ? err.message : "Failed to create patent")
      setIsCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-emerald-400" />
            Patent Research
          </h1>

          {/* Inline stats */}
          <div className="hidden xl:flex items-center gap-1">
            {[
              { label: "Total", value: stats.total, color: "text-foreground" },
              { label: "Research", value: stats.byStatus.research, color: "text-blue-400" },
              { label: "Drafting", value: stats.byStatus.drafting, color: "text-purple-400" },
              { label: "Review", value: stats.byStatus.review, color: "text-yellow-400" },
              { label: "Filed", value: stats.byStatus.filed, color: "text-orange-400" },
              { label: "Approved", value: stats.byStatus.approved, color: "text-green-400" }
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
          <Button
            variant="outline"
            size="sm"
            onClick={loadPatents}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={handleNewPatent}
            disabled={isCreating}
          >
            {isCreating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">New Patent Research</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards - visible on smaller screens */}
      <div className="grid grid-cols-6 gap-2 xl:hidden">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Research", value: stats.byStatus.research, color: "text-blue-400" },
          { label: "Drafting", value: stats.byStatus.drafting, color: "text-purple-400" },
          { label: "Review", value: stats.byStatus.review, color: "text-yellow-400" },
          { label: "Filed", value: stats.byStatus.filed, color: "text-orange-400" },
          { label: "Approved", value: stats.byStatus.approved, color: "text-green-400" }
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
            placeholder="Search patents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent pl-10 pr-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground mr-2" />
          {(["all", "research", "drafting", "review", "filed", "approved"] as const).map(status => (
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

      {/* Error State */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="text-sm text-destructive">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadPatents}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Patents Grid */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sortedPatents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileCheck className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No patent research projects yet</p>
            <p className="text-sm">Start researching your next invention</p>
            <Button className="mt-4 gap-2" onClick={handleNewPatent} disabled={isCreating}>
              {isCreating ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              New Patent Research
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedPatents.map(patent => {
              const statusConf = statusConfig[patent.status]
              const StatusIcon = statusConf.icon

              return (
                <Card key={patent.id} className="group hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <Link
                          href={`/patents/${patent.id}`}
                          className="font-semibold hover:text-primary truncate block"
                        >
                          {patent.title}
                        </Link>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {patent.inventionDescription?.summary || "No description yet"}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Status & Technical Field */}
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={cn("gap-1", statusConf.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConf.label}
                      </Badge>
                      {patent.inventionDescription?.technicalField && (
                        <Badge variant="outline" className="text-muted-foreground">
                          {patent.inventionDescription.technicalField}
                        </Badge>
                      )}
                    </div>

                    {/* Progress Indicators */}
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1" title="Prior Art References">
                        <Scale className="h-4 w-4" />
                        <span>{patent.priorArt?.length || 0} prior art</span>
                      </div>
                      <div className="flex items-center gap-1" title="Claims">
                        <FileText className="h-4 w-4" />
                        <span>{patent.claims?.length || 0} claims</span>
                      </div>
                    </div>

                    {/* Links */}
                    <div className="flex items-center gap-2 text-xs">
                      {patent.projectId && (
                        <div className="flex items-center gap-1 text-blue-400">
                          <FolderOpen className="h-3 w-3" />
                          <Link
                            href={`/projects/${patent.projectId}`}
                            className="hover:underline"
                          >
                            Linked Project
                          </Link>
                        </div>
                      )}
                      {patent.businessIdeaId && (
                        <div className="flex items-center gap-1 text-yellow-400">
                          <Lightbulb className="h-3 w-3" />
                          <Link
                            href={`/business-ideas/${patent.businessIdeaId}`}
                            className="hover:underline"
                          >
                            Business Idea
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Tags */}
                    {patent.tags && patent.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {patent.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {patent.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{patent.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Patentability Assessment */}
                    {patent.patentabilityAnalysis && (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            patent.patentabilityAnalysis.overallAssessment === "strong" && "text-green-400 border-green-400/30",
                            patent.patentabilityAnalysis.overallAssessment === "moderate" && "text-yellow-400 border-yellow-400/30",
                            patent.patentabilityAnalysis.overallAssessment === "weak" && "text-orange-400 border-orange-400/30",
                            patent.patentabilityAnalysis.overallAssessment === "not-patentable" && "text-red-400 border-red-400/30"
                          )}
                        >
                          Patentability: {patent.patentabilityAnalysis.overallAssessment}
                        </Badge>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(patent.updatedAt)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <Link href={`/patents/${patent.id}`}>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-400 hover:bg-red-400/10"
                          onClick={() => handleDelete(patent.id, patent.title)}
                          title="Delete"
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

      {/* Empty State CTA */}
      {!isLoading && patents.length === 0 && !error && (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <FileCheck className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
              <h3 className="font-medium mb-1">Start Your Patent Research</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Document your invention, research prior art, and prepare patent claims
              </p>
              <Button className="gap-2" onClick={handleNewPatent} disabled={isCreating}>
                {isCreating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                New Patent Research
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
