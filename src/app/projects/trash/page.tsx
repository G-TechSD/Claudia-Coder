"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Search,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Clock,
  GitBranch,
  Package,
  RefreshCw,
  CheckCircle,
  Pause,
  PlayCircle,
  Archive,
  Layers
} from "lucide-react"
import {
  getTrashedProjects,
  restoreProject,
  permanentlyDeleteProject,
  emptyTrash
} from "@/lib/data/projects"
import { useAuth } from "@/components/auth/auth-provider"
import type { Project, ProjectStatus } from "@/lib/data/types"

// Status config for showing previous status badge
const statusConfig: Record<ProjectStatus, {
  label: string
  color: string
  icon: typeof CheckCircle
}> = {
  planning: { label: "Planning", color: "text-blue-400", icon: Clock },
  active: { label: "Active", color: "text-green-400", icon: PlayCircle },
  paused: { label: "Paused", color: "text-yellow-400", icon: Pause },
  completed: { label: "Completed", color: "text-purple-400", icon: CheckCircle },
  archived: { label: "Archived", color: "text-gray-400", icon: Archive },
  trashed: { label: "Trashed", color: "text-red-400", icon: Trash2 }
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

export default function TrashPage() {
  const { user } = useAuth()
  const userId = user?.id
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // Load trashed projects
  useEffect(() => {
    if (userId) {
      loadTrashedProjects()
    }
  }, [userId])

  const loadTrashedProjects = () => {
    if (!userId) return
    setIsLoading(true)
    const trashedProjects = getTrashedProjects(userId)
    setProjects(trashedProjects)
    setIsLoading(false)
  }

  // Filter projects by search
  const filteredProjects = useMemo(() => {
    if (!search) return projects

    const lower = search.toLowerCase()
    return projects.filter(p =>
      p.name.toLowerCase().includes(lower) ||
      p.description.toLowerCase().includes(lower) ||
      p.tags.some(t => t.toLowerCase().includes(lower))
    )
  }, [projects, search])

  const handleRestore = (id: string, name: string) => {
    if (confirm(`Restore project "${name}"?`)) {
      restoreProject(id, userId)
      loadTrashedProjects()
    }
  }

  const handlePermanentDelete = (id: string, name: string) => {
    if (confirm(`Permanently delete project "${name}"? This action cannot be undone.`)) {
      permanentlyDeleteProject(id, userId)
      loadTrashedProjects()
    }
  }

  const handleEmptyTrash = () => {
    if (projects.length === 0 || !userId) return

    if (confirm(`Permanently delete all ${projects.length} projects in trash? This action cannot be undone.`)) {
      const deleted = emptyTrash(userId)
      loadTrashedProjects()
      alert(`${deleted} projects permanently deleted.`)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-400" />
            <h1 className="text-2xl font-semibold tracking-tight">Trash</h1>
          </div>
          <Badge variant="secondary" className="text-sm">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </Badge>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadTrashedProjects} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          {projects.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEmptyTrash}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Empty Trash</span>
            </Button>
          )}
        </div>
      </div>

      {/* Warning Banner */}
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Projects in trash can be restored or permanently deleted. Permanently deleted projects cannot be recovered.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      {projects.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search trashed projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent pl-10 pr-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      )}

      {/* Projects List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Layers className="h-12 w-12 mb-4 opacity-50" />
            {projects.length === 0 ? (
              <>
                <p className="text-lg font-medium">Trash is empty</p>
                <p className="text-sm">Projects you delete will appear here</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium">No projects match your search</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearch("")}
                  className="mt-2"
                >
                  Clear search
                </Button>
              </>
            )}
            <Button className="mt-4 gap-2" variant="outline" asChild>
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4" />
                Back to Projects
              </Link>
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg divide-y">
            {filteredProjects.map(project => {
              const previousStatusConf = project.previousStatus
                ? statusConfig[project.previousStatus]
                : null
              const PreviousStatusIcon = previousStatusConf?.icon

              return (
                <div
                  key={project.id}
                  className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors group"
                >
                  {/* Trash Icon */}
                  <div className="flex-none w-10 h-10 rounded-full flex items-center justify-center bg-red-400/10 text-red-400">
                    <Trash2 className="h-5 w-5" />
                  </div>

                  {/* Name & Description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {project.name}
                      </span>
                      {previousStatusConf && PreviousStatusIcon && (
                        <Badge variant="outline" className={cn("text-xs gap-1", previousStatusConf.color)}>
                          <PreviousStatusIcon className="h-3 w-3" />
                          was {previousStatusConf.label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {project.description}
                    </p>
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

                  {/* Trashed Date */}
                  <div className="hidden sm:block text-xs text-muted-foreground flex-none w-28 text-right">
                    {project.trashedAt ? (
                      <>Trashed {formatDate(project.trashedAt)}</>
                    ) : (
                      <>Updated {formatDate(project.updatedAt)}</>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-none">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-green-500 hover:text-green-600 hover:border-green-500/50"
                      onClick={() => handleRestore(project.id, project.name)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Restore</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                      onClick={() => handlePermanentDelete(project.id, project.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Delete Forever</span>
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
