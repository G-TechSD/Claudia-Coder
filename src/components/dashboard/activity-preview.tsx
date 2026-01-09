"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowRight, CheckCircle, XCircle, Clock, Loader2, Inbox } from "lucide-react"
import Link from "next/link"

interface ActivityItem {
  id: string
  type: "success" | "error" | "pending" | "running"
  message: string
  timestamp: string
  projectId?: string
  projectName?: string
}

type StatusConfigValue = {
  icon: typeof CheckCircle
  color: string
  bg: string
  animate?: boolean
}

const statusConfig: Record<string, StatusConfigValue> = {
  success: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-400" },
  error: { icon: XCircle, color: "text-red-400", bg: "bg-red-400" },
  pending: { icon: Clock, color: "text-yellow-400", bg: "bg-yellow-400" },
  running: { icon: Loader2, color: "text-blue-400", bg: "bg-blue-400", animate: true },
}

// Default config for unknown status types
const defaultStatusConfig: StatusConfigValue = {
  icon: Clock,
  color: "text-muted-foreground",
  bg: "bg-muted-foreground",
}

function getStatusConfig(type: string): StatusConfigValue {
  return statusConfig[type] ?? defaultStatusConfig
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

/**
 * Fetch activities from the server-side API
 * This captures activity from curl/API calls that don't have localStorage access
 */
async function fetchServerActivities(): Promise<ActivityItem[]> {
  try {
    const response = await fetch("/api/activity-events?limit=10")
    if (!response.ok) return []

    const data = await response.json()
    if (!data.events || !Array.isArray(data.events)) return []

    return data.events.map((event: {
      id: string
      type: ActivityItem["type"]
      message: string
      timestamp: string
      projectId?: string
      projectName?: string
    }) => ({
      id: event.id,
      type: event.type,
      message: event.message,
      timestamp: formatTimeAgo(new Date(event.timestamp)),
      projectId: event.projectId,
      projectName: event.projectName
    }))
  } catch (error) {
    console.error("Failed to fetch server activities:", error)
    return []
  }
}

function loadLocalActivities(): ActivityItem[] {
  if (typeof window === "undefined") return []

  const activities: ActivityItem[] = []

  // Build a projectId -> projectName map for lookups
  const projectNameMap: Record<string, string> = {}
  try {
    const projectsData = localStorage.getItem("claudia_projects")
    if (projectsData) {
      const projects = JSON.parse(projectsData)
      for (const project of projects) {
        if (project.id && project.name) {
          projectNameMap[project.id] = project.name
        }
      }
    }
  } catch {
    // Ignore errors building project map
  }

  try {
    // Load from stored events in localStorage
    const eventsData = localStorage.getItem("claudia_activity_events")
    if (eventsData) {
      const events = JSON.parse(eventsData)
      for (const event of events.slice(-10)) {
        const projectId = event.projectId
        activities.push({
          id: event.id || Math.random().toString(36).slice(2),
          type: event.type || "pending",
          message: event.message || "Activity",
          timestamp: formatTimeAgo(new Date(event.timestamp)),
          projectId: projectId,
          projectName: event.projectName || (projectId ? projectNameMap[projectId] : undefined)
        })
      }
    }

    // Check agent state for running status
    const agentState = localStorage.getItem("claudia_agent_state")
    if (agentState) {
      const { state } = JSON.parse(agentState)
      if (state === "running") {
        const queue = localStorage.getItem("claudia_execution_queue")
        if (queue) {
          const queueData = JSON.parse(queue)
          if (queueData.length > 0) {
            const projectId = queueData[0].projectId
            const projectName = queueData[0].project?.name || (projectId ? projectNameMap[projectId] : undefined)
            activities.unshift({
              id: "agent-running",
              type: "running",
              message: `Generating: ${projectName || "Project"}`,
              timestamp: "now",
              projectId: projectId,
              projectName: projectName
            })
          }
        }
      }
    }

    // If no activities, check for recent projects
    if (activities.length === 0) {
      const projectsData = localStorage.getItem("claudia_projects")
      if (projectsData) {
        const projects = JSON.parse(projectsData).slice(-3)
        for (const project of projects) {
          activities.push({
            id: `project-${project.id}`,
            type: "pending",
            message: `Project created: ${project.name}`,
            timestamp: formatTimeAgo(new Date(project.createdAt)),
            projectId: project.id,
            projectName: project.name
          })
        }
      }
    }
  } catch (error) {
    console.error("Failed to load local activities:", error)
  }

  return activities
}

/**
 * Merge and deduplicate activities from localStorage and server API
 * Server activities take precedence (more accurate for API/curl executions)
 */
function mergeActivities(localActivities: ActivityItem[], serverActivities: ActivityItem[]): ActivityItem[] {
  const seenIds = new Set<string>()
  const merged: ActivityItem[] = []

  // Add server activities first (they're more authoritative for API calls)
  for (const activity of serverActivities) {
    if (!seenIds.has(activity.id)) {
      seenIds.add(activity.id)
      merged.push(activity)
    }
  }

  // Add local activities that aren't duplicates
  for (const activity of localActivities) {
    if (!seenIds.has(activity.id)) {
      seenIds.add(activity.id)
      merged.push(activity)
    }
  }

  // Sort by most recent (running activities first, then by recency indicator)
  merged.sort((a, b) => {
    // Running activities always first
    if (a.type === "running" && b.type !== "running") return -1
    if (b.type === "running" && a.type !== "running") return 1
    // "just now" and "now" come first
    if (a.timestamp === "now" || a.timestamp === "just now") return -1
    if (b.timestamp === "now" || b.timestamp === "just now") return 1
    return 0
  })

  return merged.slice(0, 5)
}

export function ActivityPreview() {
  const [activities, setActivities] = useState<ActivityItem[]>([])

  const loadAllActivities = useCallback(async () => {
    // Load from both localStorage and server API
    const localActivities = loadLocalActivities()
    const serverActivities = await fetchServerActivities()

    // Merge and deduplicate
    const merged = mergeActivities(localActivities, serverActivities)
    setActivities(merged)
  }, [])

  useEffect(() => {
    // Initial load
    loadAllActivities()

    // Refresh periodically
    const interval = setInterval(() => {
      loadAllActivities()
    }, 3000)

    return () => clearInterval(interval)
  }, [loadAllActivities])

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/activity" className="gap-1">
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Inbox className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">No recent activity</p>
            <p className="text-xs mt-1">Activity will appear here as you work</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => {
              const config = getStatusConfig(activity.type)
              return (
                <Link
                  key={activity.id}
                  href="/activity"
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <div className="relative flex h-2 w-2 flex-shrink-0">
                    <span
                      className={cn(
                        "absolute inline-flex h-full w-full rounded-full opacity-75",
                        config.bg,
                        config.animate && "animate-ping"
                      )}
                    />
                    <span
                      className={cn(
                        "relative inline-flex h-2 w-2 rounded-full",
                        config.bg
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block truncate text-foreground">
                      {activity.message}
                    </span>
                    {activity.projectName && (
                      <span className="block text-xs text-muted-foreground truncate">
                        {activity.projectName}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {activity.timestamp}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
