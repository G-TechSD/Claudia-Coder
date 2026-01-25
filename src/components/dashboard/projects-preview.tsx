"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowRight, FolderOpen, Layers } from "lucide-react"
import Link from "next/link"
import { ProjectStatus } from "@/lib/data/types"
import { getAllProjects, fetchProjects } from "@/lib/data/projects"
import { useAuth } from "@/components/auth/auth-provider"

interface ProjectPreviewItem {
  id: string
  name: string
  description: string
  status: ProjectStatus
}

const statusColors: Record<ProjectStatus, string> = {
  active: "bg-green-400",
  planning: "bg-blue-400",
  paused: "bg-yellow-400",
  completed: "bg-gray-400",
  archived: "bg-gray-300",
  trashed: "bg-red-400",
}

function loadActiveProjects(userId: string | undefined): ProjectPreviewItem[] {
  if (typeof window === "undefined" || !userId) return []

  try {
    // Use user-scoped storage via getAllProjects
    const projects = getAllProjects({ userId })

    // Filter for active and planning projects
    const activeProjects = projects.filter(
      (p) => p.status === "active" || p.status === "planning"
    )

    // Sort by updatedAt (most recent first), then by status (active before planning)
    activeProjects.sort((a, b) => {
      // Active projects first
      if (a.status === "active" && b.status === "planning") return -1
      if (a.status === "planning" && b.status === "active") return 1
      // Then by most recently updated
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

    return activeProjects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
    }))
  } catch (error) {
    console.error("Failed to load projects:", error)
    return []
  }
}

export function ProjectsPreview() {
  const { user } = useAuth()
  const userId = user?.id
  const [projects, setProjects] = useState<ProjectPreviewItem[]>([])

  useEffect(() => {
    const loadProjects = async () => {
      if (!userId) return

      // Show cached data immediately
      setProjects(loadActiveProjects(userId))

      // Fetch fresh data from server
      try {
        await fetchProjects(userId) // This updates the cache
        setProjects(loadActiveProjects(userId)) // Re-read from updated cache
      } catch (error) {
        console.error("[ProjectsPreview] Failed to fetch projects:", error)
      }
    }

    loadProjects()

    // Refresh periodically (30s to avoid interrupting user flow)
    const interval = setInterval(loadProjects, 30000)

    return () => clearInterval(interval)
  }, [userId])

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">Projects</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects" className="gap-1">
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <FolderOpen className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">No active projects</p>
            <p className="text-xs mt-1">Create a project to get started</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group"
              >
                <div className="flex flex-col gap-1.5 rounded-md border p-3 hover:bg-accent/50 transition-colors cursor-pointer h-full">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium text-sm truncate flex-1">
                      {project.name}
                    </span>
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full flex-shrink-0",
                        statusColors[project.status]
                      )}
                      title={project.status}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {project.description || "No description"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
