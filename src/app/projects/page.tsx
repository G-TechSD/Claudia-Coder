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
  Layers,
  GitBranch,
  Package,
  Clock,
  Mic,
  MoreVertical,
  Trash2,
  Edit,
  ExternalLink,
  RefreshCw,
  ArrowUpRight,
  CheckCircle,
  Pause,
  PlayCircle,
  Archive,
  AlertCircle
} from "lucide-react"
import {
  getAllProjects,
  getProjectStats,
  filterProjects,
  deleteProject,
  seedSampleProjects
} from "@/lib/data/projects"
import type { Project, ProjectStatus, ProjectFilter } from "@/lib/data/types"

const statusConfig: Record<ProjectStatus, {
  label: string
  color: string
  bg: string
  icon: typeof CheckCircle
}> = {
  planning: { label: "Planning", color: "text-blue-400", bg: "bg-blue-400", icon: Clock },
  active: { label: "Active", color: "text-green-400", bg: "bg-green-400", icon: PlayCircle },
  paused: { label: "Paused", color: "text-yellow-400", bg: "bg-yellow-400", icon: Pause },
  completed: { label: "Completed", color: "text-purple-400", bg: "bg-purple-400", icon: CheckCircle },
  archived: { label: "Archived", color: "text-gray-400", bg: "bg-gray-400", icon: Archive }
}

const priorityConfig = {
  low: { label: "Low", color: "text-gray-400" },
  medium: { label: "Medium", color: "text-blue-400" },
  high: { label: "High", color: "text-orange-400" },
  critical: { label: "Critical", color: "text-red-400" }
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

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState<ProjectFilter>({})
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // Load projects
  useEffect(() => {
    seedSampleProjects() // Seed sample data on first load
    loadProjects()
  }, [])

  const loadProjects = () => {
    setIsLoading(true)
    const allProjects = getAllProjects()
    setProjects(allProjects)
    setIsLoading(false)
  }

  // Filter projects
  const filteredProjects = useMemo(() => {
    let result = projects

    if (statusFilter !== "all") {
      result = result.filter(p => p.status === statusFilter)
    }

    if (search) {
      const lower = search.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(lower) ||
        p.description.toLowerCase().includes(lower) ||
        p.tags.some(t => t.toLowerCase().includes(lower))
      )
    }

    return result.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }, [projects, statusFilter, search])

  // Stats
  const stats = useMemo(() => getProjectStats(), [projects])

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete project "${name}"? This cannot be undone.`)) {
      deleteProject(id)
      loadProjects()
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            {stats.total} projects, {stats.byStatus.active} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadProjects} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" className="gap-2" asChild>
            <Link href="/projects/new">
              <Plus className="h-4 w-4" />
              New Project
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Active", value: stats.byStatus.active, color: "text-green-400" },
          { label: "Planning", value: stats.byStatus.planning, color: "text-blue-400" },
          { label: "Paused", value: stats.byStatus.paused, color: "text-yellow-400" },
          { label: "Completed", value: stats.byStatus.completed, color: "text-purple-400" }
        ].map(stat => (
          <Card key={stat.label} className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <span className={cn("text-lg font-semibold", stat.color)}>{stat.value}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Filter & Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent pl-10 pr-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground mr-2" />
          {(["all", "active", "planning", "paused", "completed"] as const).map(status => (
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

      {/* Projects Grid */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Layers className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">No projects found</p>
            <p className="text-sm">Create your first project to get started</p>
            <Button className="mt-4 gap-2" asChild>
              <Link href="/projects/new">
                <Mic className="h-4 w-4" />
                Start Voice Interview
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map(project => {
              const statusConf = statusConfig[project.status]
              const StatusIcon = statusConf.icon
              const priorityConf = priorityConfig[project.priority]

              return (
                <Card key={project.id} className="group hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/projects/${project.id}`}
                            className="font-semibold hover:text-primary truncate"
                          >
                            {project.name}
                          </Link>
                          {project.linearSync?.mode === "two_way" && (
                            <Badge variant="outline" className="text-xs flex-none">
                              Linear
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {project.description}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Status & Priority */}
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={cn("gap-1", statusConf.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConf.label}
                      </Badge>
                      <Badge variant="outline" className={priorityConf.color}>
                        {priorityConf.label}
                      </Badge>
                    </div>

                    {/* Tags */}
                    {project.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {project.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {project.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{project.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Stats Row */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <GitBranch className="h-4 w-4" />
                        <span>{project.repos.length} repos</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        <span>{project.packetIds.length} packets</span>
                      </div>
                    </div>

                    {/* Linear Sync Status */}
                    {project.linearSync && (
                      <div className="flex items-center gap-2 text-xs">
                        {project.linearSync.mode === "two_way" ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <RefreshCw className="h-3 w-3" />
                            <span>Two-way sync active</span>
                          </div>
                        ) : project.linearSync.mode === "imported" ? (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <CheckCircle className="h-3 w-3" />
                            <span>Imported from Linear</span>
                          </div>
                        ) : null}
                        {project.linearSync.syncErrors && project.linearSync.syncErrors.length > 0 && (
                          <div className="flex items-center gap-1 text-red-400">
                            <AlertCircle className="h-3 w-3" />
                            <span>Sync errors</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-muted-foreground">
                        Updated {formatDate(project.updatedAt)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <Link href={`/projects/${project.id}`}>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-400 hover:bg-red-400/10"
                          onClick={() => handleDelete(project.id, project.name)}
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

      {/* New Project CTA */}
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Mic className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-medium mb-1">Start a Voice Interview</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Describe what you want to build and let Claudia ask the right questions
            </p>
            <Button className="gap-2" asChild>
              <Link href="/projects/new">
                <Plus className="h-4 w-4" />
                New Project
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
