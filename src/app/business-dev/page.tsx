"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Briefcase,
  Search,
  Filter,
  RefreshCw,
  ArrowUpRight,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Target,
  DollarSign,
  TrendingUp,
  Building2,
  Archive,
  Send,
  Eye
} from "lucide-react"
import {
  getAllBusinessDevs
} from "@/lib/data/business-dev"
import { getProject } from "@/lib/data/projects"
import type { BusinessDev, BusinessDevStatus } from "@/lib/data/types"

// Status configuration
const statusConfig: Record<BusinessDevStatus, {
  label: string
  color: string
  icon: typeof FileText
  bg: string
}> = {
  draft: { label: "Draft", color: "text-yellow-500", icon: FileText, bg: "bg-yellow-500/10" },
  review: { label: "In Review", color: "text-blue-500", icon: Send, bg: "bg-blue-500/10" },
  approved: { label: "Approved", color: "text-green-500", icon: CheckCircle2, bg: "bg-green-500/10" },
  archived: { label: "Archived", color: "text-gray-400", icon: Archive, bg: "bg-gray-500/10" }
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

interface BusinessDevWithProject extends BusinessDev {
  projectName: string
}

export default function BusinessDevPage() {
  const [businessDevs, setBusinessDevs] = useState<BusinessDevWithProject[]>([])
  const [statusFilter, setStatusFilter] = useState<BusinessDevStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // Load business devs with project names
  useEffect(() => {
    loadBusinessDevs()
  }, [])

  const loadBusinessDevs = () => {
    setIsLoading(true)
    const allDevs = getAllBusinessDevs()

    // Enrich with project names
    const enrichedDevs: BusinessDevWithProject[] = allDevs.map(dev => {
      const project = getProject(dev.projectId)
      return {
        ...dev,
        projectName: project?.name || "Unknown Project"
      }
    }).sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )

    setBusinessDevs(enrichedDevs)
    setIsLoading(false)
  }

  // Filter business devs
  const filteredDevs = useMemo(() => {
    let result = businessDevs

    if (statusFilter !== "all") {
      result = result.filter(d => d.status === statusFilter)
    }

    if (search) {
      const lower = search.toLowerCase()
      result = result.filter(d =>
        d.projectName.toLowerCase().includes(lower) ||
        d.executiveSummary.overview.toLowerCase().includes(lower) ||
        d.executiveSummary.problem.toLowerCase().includes(lower)
      )
    }

    return result
  }, [businessDevs, statusFilter, search])

  // Stats
  const stats = useMemo(() => {
    const total = businessDevs.length
    const byStatus = {
      draft: businessDevs.filter(d => d.status === "draft").length,
      review: businessDevs.filter(d => d.status === "review").length,
      approved: businessDevs.filter(d => d.status === "approved").length,
      archived: businessDevs.filter(d => d.status === "archived").length
    }
    return { total, byStatus }
  }, [businessDevs])

  return (
    <div className="flex flex-col gap-4 p-6 h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-purple-500" />
            Business Development
          </h1>

          {/* Inline stats */}
          <div className="hidden xl:flex items-center gap-1">
            {[
              { label: "Total", value: stats.total, color: "text-foreground" },
              { label: "Draft", value: stats.byStatus.draft, color: "text-yellow-500" },
              { label: "Review", value: stats.byStatus.review, color: "text-blue-500" },
              { label: "Approved", value: stats.byStatus.approved, color: "text-green-500" }
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
          <Button variant="outline" size="sm" onClick={loadBusinessDevs} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards - visible on smaller screens */}
      <div className="grid grid-cols-4 gap-2 xl:hidden">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Draft", value: stats.byStatus.draft, color: "text-yellow-500" },
          { label: "Review", value: stats.byStatus.review, color: "text-blue-500" },
          { label: "Approved", value: stats.byStatus.approved, color: "text-green-500" }
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
            placeholder="Search business plans..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent pl-10 pr-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground mr-2" />
          {(["all", "draft", "review", "approved"] as const).map(status => (
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

      {/* Business Dev Grid */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredDevs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No business development plans yet</p>
            <p className="text-sm">Create a business dev plan from a project&apos;s Business Development tab</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredDevs.map(dev => {
              const statusConf = statusConfig[dev.status]
              const StatusIcon = statusConf.icon

              return (
                <Card key={dev.id} className="group hover:border-purple-500/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <Link
                          href={`/projects/${dev.projectId}`}
                          className="font-semibold hover:text-purple-500 truncate block"
                        >
                          {dev.projectName}
                        </Link>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {dev.executiveSummary.overview || "No overview available"}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Status */}
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={cn("gap-1", statusConf.color, statusConf.bg)}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConf.label}
                      </Badge>
                      {dev.approvedAt && (
                        <Badge variant="outline" className="text-green-500 border-green-500/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Approved
                        </Badge>
                      )}
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 p-2 rounded bg-muted/50">
                        <Target className="h-3.5 w-3.5 text-blue-500" />
                        <span>{dev.features.length} Features</span>
                      </div>
                      <div className="flex items-center gap-1.5 p-2 rounded bg-muted/50">
                        <DollarSign className="h-3.5 w-3.5 text-green-500" />
                        <span className="truncate">{dev.monetization.model}</span>
                      </div>
                    </div>

                    {/* Value Proposition Preview */}
                    {dev.executiveSummary.uniqueValue && !dev.executiveSummary.uniqueValue.includes("[") && (
                      <div className="text-xs text-muted-foreground border-l-2 border-purple-500/50 pl-2 line-clamp-2">
                        {dev.executiveSummary.uniqueValue}
                      </div>
                    )}

                    {/* Risks indicator */}
                    {dev.risks && dev.risks.risks.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                        <span>{dev.risks.risks.length} risks identified</span>
                      </div>
                    )}

                    {/* Stats Row */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{formatDate(dev.updatedAt)}</span>
                      </div>
                      {dev.generatedBy && (
                        <div className="flex items-center gap-1 text-xs">
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span className="truncate">{dev.generatedBy.model}</span>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-muted-foreground">
                        Created {formatDate(dev.createdAt)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1" asChild>
                          <Link href={`/projects/${dev.projectId}`}>
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <Link href={`/projects/${dev.projectId}`}>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
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
    </div>
  )
}
