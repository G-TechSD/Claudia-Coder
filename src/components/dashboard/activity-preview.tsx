"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowRight, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react"
import Link from "next/link"

interface ActivityItem {
  id: string
  type: "success" | "error" | "pending" | "running"
  message: string
  timestamp: string
}

const mockActivities: ActivityItem[] = [
  { id: "1", type: "success", message: "Agent completed LoginForm", timestamp: "2m ago" },
  { id: "2", type: "success", message: "Tests passed: 47/47", timestamp: "5m ago" },
  { id: "3", type: "pending", message: "Waiting: API integration", timestamp: "12m ago" },
  { id: "4", type: "running", message: "Agent started Dashboard", timestamp: "15m ago" },
  { id: "5", type: "error", message: "Build failed: type error", timestamp: "18m ago" },
]

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

export function ActivityPreview() {
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
      <CardContent className="flex-1 space-y-2">
        {mockActivities.map((activity) => {
          const config = statusConfig[activity.type]
          const Icon = config.icon
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
      </CardContent>
    </Card>
  )
}
