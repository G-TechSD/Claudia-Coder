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
  AlertCircle,
  LayoutGrid,
  LayoutList,
  Star,
  Download,
  Loader2
} from "lucide-react"
import {
  getAllProjects,
  getProjectStats,
  filterProjects,
  trashProject,
  seedSampleProjects,
  toggleProjectStar,
  getTrashedProjects
} from "@/lib/data/projects"
import { useStarredProjects } from "@/hooks/useStarredProjects"
import { useAuth } from "@/components/auth/auth-provider"
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
  archived: { label: "Archived", color: "text-gray-400", bg: "bg-gray-400", icon: Archive },
  trashed: { label: "Trashed", color: "text-red-400", bg: "bg-red-400", icon: Trash2 }
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

type ViewMode = "list" | "grid"

const VIEW_MODE_KEY = "claudia_projects_view"

export default function ProjectsPage() {
  const { user } = useAuth()
  const userId = user?.id
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState<ProjectFilter>({})
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode | null>(null) // Start as null to avoid hydration mismatch
  const [isLoadingTaskFlow, setIsLoadingTaskFlow] = useState(false)
  const { isStarred, toggleStar, refresh: refreshStarred } = useStarredProjects()

  // Load view preference - sets initial value after mount to avoid hydration mismatch
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY)
    if (saved === "list" || saved === "grid") {
      setViewMode(saved)
    } else {
      setViewMode("list") // Default to list view
    }
  }, [])

  // Save view preference
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode)
    if (typeof window !== "undefined") {
      localStorage.setItem(VIEW_MODE_KEY, mode)
    }
  }

  // Derive effective view mode (null becomes list for rendering, but we still show loading)
  const effectiveViewMode = viewMode ?? "list"

  // Load projects
  useEffect(() => {
    if (userId) {
      seedSampleProjects(userId) // Seed sample data on first load
      loadProjects()
    }
  }, [userId])

  const loadProjects = () => {
    if (!userId) return
    setIsLoading(true)
    const allProjects = getAllProjects({ userId })
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

    // Sort by starred first, then by updated date
    return result.sort((a, b) => {
      // Starred projects come first
      if (a.starred && !b.starred) return -1
      if (!a.starred && b.starred) return 1
      // Then sort by updated date
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [projects, statusFilter, search])

  // Stats - use useState to avoid hydration mismatch (localStorage doesn't exist on server)
  const [stats, setStats] = useState({
    total: 0,
    byStatus: { planning: 0, active: 0, paused: 0, completed: 0, archived: 0, trashed: 0 },
    activeRepos: 0,
    activePackets: 0
  })

  // Get trashed projects count - use useState to avoid hydration mismatch
  const [trashedCount, setTrashedCount] = useState(0)

  // Update stats when projects change (client-side only)
  useEffect(() => {
    if (userId) {
      setStats(getProjectStats(userId))
      setTrashedCount(getTrashedProjects(userId).length)
    }
  }, [projects, userId])

  const handleTrash = (id: string, name: string) => {
    if (confirm(`Send project "${name}" to trash?`)) {
      trashProject(id, userId)
      loadProjects()
    }
  }

  const handleToggleStar = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleStar(id)
    loadProjects() // Refresh to update the list order
  }

  const handleLoadTaskFlow = async () => {
    setIsLoadingTaskFlow(true)
    try {
      const response = await fetch('/api/projects/create-taskflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()

      if (!data.success) {
        alert(`Failed to load TaskFlow: ${data.error}`)
        return
      }

      // Get existing data from localStorage
      const existingProjects = JSON.parse(localStorage.getItem('claudia_projects') || '[]')
      const existingBuildPlans = JSON.parse(localStorage.getItem('claudia_build_plans') || '[]')
      const existingPackets = JSON.parse(localStorage.getItem('claudia_packets') || '{}')

      // Filter out any existing TaskFlow project to avoid duplicates
      const taskFlowId = data.project?.id
      const filteredProjects = existingProjects.filter((p: Project) => p.id !== taskFlowId)
      const filteredBuildPlans = existingBuildPlans.filter((bp: { projectId: string }) => bp.projectId !== taskFlowId)

      // Add the new TaskFlow project
      if (data.project) {
        filteredProjects.push(data.project)
      }

      // Add the build plan
      if (data.buildPlan) {
        filteredBuildPlans.push(data.buildPlan)
      }

      // Add packets to the packets object
      const updatedPackets = { ...existingPackets }
      if (data.packets && Array.isArray(data.packets)) {
        for (const packet of data.packets) {
          if (packet.id) {
            updatedPackets[packet.id] = packet
          }
        }
      }

      // Save to localStorage
      localStorage.setItem('claudia_projects', JSON.stringify(filteredProjects))
      localStorage.setItem('claudia_build_plans', JSON.stringify(filteredBuildPlans))
      localStorage.setItem('claudia_packets', JSON.stringify(updatedPackets))

      // Refresh the projects list
      loadProjects()

      alert('TaskFlow Benchmark project loaded successfully!')
    } catch (error) {
      console.error('Failed to load TaskFlow:', error)
      alert(`Failed to load TaskFlow: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoadingTaskFlow(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 h-full">
      {/* Header with inline stats on larger screens */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>

          {/* Inline stats - visible on larger screens */}
          <div className="hidden xl:flex items-center gap-1">
            {[
              { label: "Total", value: stats.total, color: "text-foreground" },
              { label: "Active", value: stats.byStatus.active, color: "text-green-500" },
              { label: "Planning", value: stats.byStatus.planning, color: "text-blue-500" },
              { label: "Paused", value: stats.byStatus.paused, color: "text-yellow-500" },
              { label: "Done", value: stats.byStatus.completed, color: "text-purple-500" }
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
          {/* View Toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={effectiveViewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2 rounded-r-none"
              onClick={() => handleViewChange("list")}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={effectiveViewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2 rounded-l-none"
              onClick={() => handleViewChange("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={loadProjects} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href="/projects/trash">
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Trash</span>
              {trashedCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full text-xs">
                  {trashedCount}
                </Badge>
              )}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadTaskFlow}
            disabled={isLoadingTaskFlow}
            className="gap-2"
          >
            {isLoadingTaskFlow ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {isLoadingTaskFlow ? "Loading..." : "Load TaskFlow Benchmark"}
            </span>
          </Button>
          <Button size="sm" className="gap-2" asChild>
            <Link href="/projects/new">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Project</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards - visible on smaller screens */}
      <div className="grid grid-cols-5 gap-2 xl:hidden">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Active", value: stats.byStatus.active, color: "text-green-400" },
          { label: "Planning", value: stats.byStatus.planning, color: "text-blue-400" },
          { label: "Paused", value: stats.byStatus.paused, color: "text-yellow-400" },
          { label: "Done", value: stats.byStatus.completed, color: "text-purple-400" }
        ].map(stat => (
          <div key={stat.label} className="p-2 rounded-md border bg-card text-center">
            <div className={cn("text-lg font-semibold", stat.color)}>{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
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

      {/* Projects List/Grid */}
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
        ) : effectiveViewMode === "list" ? (
          /* List View */
          <div className="border rounded-lg divide-y">
            {filteredProjects.map(project => {
              const statusConf = statusConfig[project.status]
              const StatusIcon = statusConf.icon
              const priorityConf = priorityConfig[project.priority]

              return (
                <div
                  key={project.id}
                  className="flex items-center gap-4 p-3 hover:bg-muted/50 transition-colors group"
                >
                  {/* Status Icon */}
                  <div className={cn(
                    "flex-none w-8 h-8 rounded-full flex items-center justify-center",
                    statusConf.color,
                    "bg-current/10"
                  )}>
                    <StatusIcon className="h-4 w-4" />
                  </div>

                  {/* Name & Description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium hover:text-primary truncate"
                      >
                        {project.name}
                      </Link>
                      {project.linearSync?.mode === "two_way" && (
                        <Badge variant="outline" className="text-xs flex-none">
                          Linear
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {project.description}
                    </p>
                  </div>

                  {/* Status & Priority Badges */}
                  <div className="hidden md:flex items-center gap-2 flex-none">
                    <Badge variant="secondary" className={cn("gap-1 text-xs", statusConf.color)}>
                      {statusConf.label}
                    </Badge>
                    <Badge variant="outline" className={cn("text-xs", priorityConf.color)}>
                      {priorityConf.label}
                    </Badge>
                  </div>

                  {/* Stats */}
                  <div className="hidden lg:flex items-center gap-4 text-sm text-muted-foreground flex-none">
                    <div className="flex items-center gap-1">
                      <GitBranch className="h-3.5 w-3.5" />
                      <span>{project.repos.length}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" />
                      <span>{project.packetIds.length}</span>
                    </div>
                  </div>

                  {/* Updated */}
                  <div className="hidden sm:block text-xs text-muted-foreground flex-none w-24 text-right">
                    {formatDate(project.updatedAt)}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-none">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7",
                        project.starred
                          ? "text-yellow-400 hover:text-yellow-500"
                          : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-yellow-400"
                      )}
                      onClick={(e) => handleToggleStar(project.id, e)}
                      title={project.starred ? "Unstar project" : "Star project"}
                    >
                      <Star className={cn("h-3.5 w-3.5", project.starred && "fill-current")} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" asChild>
                      <Link href={`/projects/${project.id}`}>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100"
                      onClick={() => handleTrash(project.id, project.name)}
                      title="Send to Trash"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Grid View */
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
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-8 w-8",
                            project.starred
                              ? "text-yellow-400 hover:text-yellow-500"
                              : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-yellow-400"
                          )}
                          onClick={(e) => handleToggleStar(project.id, e)}
                          title={project.starred ? "Unstar project" : "Star project"}
                        >
                          <Star className={cn("h-4 w-4", project.starred && "fill-current")} />
                        </Button>
                      </div>
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
                          onClick={() => handleTrash(project.id, project.name)}
                          title="Send to Trash"
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

      {/* New Project CTA - only show when no projects exist */}
      {projects.length === 0 && (
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
      )}
    </div>
  )
}
