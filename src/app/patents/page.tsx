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
  FolderOpen
} from "lucide-react"
import {
  getAllPatents,
  getPatentStats,
  deletePatent,
  createEmptyPatent,
  type PatentResearch
} from "@/lib/data/patents"
import type { PatentResearchStatus } from "@/lib/data/types"

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

export default function PatentsPage() {
  const [patents, setPatents] = useState<PatentResearch[]>([])
  const [statusFilter, setStatusFilter] = useState<PatentResearchStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // Load patents
  useEffect(() => {
    loadPatents()
  }, [])

  const loadPatents = () => {
    setIsLoading(true)
    const allPatents = getAllPatents()
    setPatents(allPatents)
    setIsLoading(false)
  }

  // Filter patents
  const filteredPatents = useMemo(() => {
    let result = patents

    if (statusFilter !== "all") {
      result = result.filter(p => p.status === statusFilter)
    }

    if (search) {
      const lower = search.toLowerCase()
      result = result.filter(p =>
        p.title.toLowerCase().includes(lower) ||
        p.inventionDescription.summary.toLowerCase().includes(lower) ||
        p.tags.some(t => t.toLowerCase().includes(lower)) ||
        p.inventionDescription.technicalField?.toLowerCase().includes(lower)
      )
    }

    // Sort by updated date
    return result.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }, [patents, statusFilter, search])

  // Stats
  const stats = useMemo(() => getPatentStats(), [patents])

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Permanently delete "${title}"? This cannot be undone.`)) {
      deletePatent(id)
      loadPatents()
    }
  }

  const handleNewPatent = () => {
    const newPatent = createEmptyPatent("New Patent Research")
    // Navigate to the new patent
    window.location.href = `/patents/${newPatent.id}`
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
          <Button variant="outline" size="sm" onClick={loadPatents} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button size="sm" className="gap-2" onClick={handleNewPatent}>
            <Plus className="h-4 w-4" />
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

      {/* Patents Grid */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPatents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileCheck className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No patent research projects yet</p>
            <p className="text-sm">Start researching your next invention</p>
            <Button className="mt-4 gap-2" onClick={handleNewPatent}>
              <Plus className="h-4 w-4" />
              New Patent Research
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPatents.map(patent => {
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
                          {patent.inventionDescription.summary || "No description yet"}
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
                      {patent.inventionDescription.technicalField && (
                        <Badge variant="outline" className="text-muted-foreground">
                          {patent.inventionDescription.technicalField}
                        </Badge>
                      )}
                    </div>

                    {/* Progress Indicators */}
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1" title="Prior Art References">
                        <Scale className="h-4 w-4" />
                        <span>{patent.priorArt.length} prior art</span>
                      </div>
                      <div className="flex items-center gap-1" title="Claims">
                        <FileText className="h-4 w-4" />
                        <span>{patent.claims.length} claims</span>
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
                    {patent.tags.length > 0 && (
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
      {patents.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <FileCheck className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
              <h3 className="font-medium mb-1">Start Your Patent Research</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Document your invention, research prior art, and prepare patent claims
              </p>
              <Button className="gap-2" onClick={handleNewPatent}>
                <Plus className="h-4 w-4" />
                New Patent Research
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
