"use client"

import { useState, useEffect } from "react"
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
}

const statusConfig: Record<ActivityItem["type"], {
  icon: typeof CheckCircle
  color: string
  bg: string
  animate?: boolean
}> = {
  success: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-400" },
  error: { icon: XCircle, color: "text-red-400", bg: "bg-red-400" },
  pending: { icon: Clock, color: "text-yellow-400", bg: "bg-yellow-400" },
  running: { icon: Loader2, color: "text-blue-400", bg: "bg-blue-400", animate: true },
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

function loadActivities(): ActivityItem[] {
  if (typeof window === "undefined") return []

  const activities: ActivityItem[] = []

  try {
    // Load from stored events
    const eventsData = localStorage.getItem("claudia_activity_events")
    if (eventsData) {
      const events = JSON.parse(eventsData)
      for (const event of events.slice(-10)) {
        activities.push({
          id: event.id || Math.random().toString(36).slice(2),
          type: event.type || "pending",
          message: event.message || "Activity",
          timestamp: formatTimeAgo(new Date(event.timestamp)),
          projectId: event.projectId
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
            activities.unshift({
              id: "agent-running",
              type: "running",
              message: `Generating: ${queueData[0].project?.name || "Project"}`,
              timestamp: "now",
              projectId: queueData[0].projectId
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
            projectId: project.id
          })
        }
      }
    }
  } catch (error) {
    console.error("Failed to load activities:", error)
  }

  return activities.slice(0, 5)
}

export function ActivityPreview() {
  const [activities, setActivities] = useState<ActivityItem[]>([])

  useEffect(() => {
    setActivities(loadActivities())

    // Refresh periodically
    const interval = setInterval(() => {
      setActivities(loadActivities())
    }, 3000)

    return () => clearInterval(interval)
  }, [])

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
              const config = statusConfig[activity.type]
              return (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50 transition-colors"
                >
                  <div className="relative flex h-2 w-2">
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
                  <span className="flex-1 truncate text-foreground">
                    {activity.message}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {activity.timestamp}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
