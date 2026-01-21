"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { CompactActivityStream, ActivityBadge } from "@/components/execution/compact-activity-stream"
import { useActivityPersistence } from "@/hooks/useActivityPersistence"
import {
  Rocket,
  ChevronDown,
  History,
  Play,
  ExternalLink,
} from "lucide-react"

interface SidebarExecutionProps {
  projectId?: string
  projectName?: string
  collapsed?: boolean
}

/**
 * Sidebar Execution Widget
 *
 * Shows compact execution controls and activity feed when on a project page.
 * Expandable to show recent activity.
 */
export function SidebarExecution({
  projectId,
  projectName,
  collapsed
}: SidebarExecutionProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = React.useState(false)

  // Only show on project pages
  const isProjectPage = pathname?.startsWith("/projects/") && projectId

  // Get activity events for current project
  const { events, isLoading } = useActivityPersistence(projectId || "")

  // Get recent runs count (mock for now - would come from run history)
  const recentRuns = events.filter(e => e.type === "start").length
  const isRunning = events.some(
    e => e.type === "start" && !events.find(
      complete => (complete.type === "complete" || complete.type === "error") &&
        complete.timestamp > e.timestamp
    )
  )

  if (!isProjectPage || collapsed) {
    return null
  }

  return (
    <div className="border-t border-gray-800 p-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              isRunning ? "text-green-400" : "text-muted-foreground"
            )}
          >
            <Rocket className={cn("h-4 w-4 shrink-0", isRunning && "animate-pulse")} />
            <span className="flex-1 text-left">Execution</span>
            <ActivityBadge events={events} isRunning={isRunning} />
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200",
                isOpen ? "rotate-180" : ""
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="mt-2 space-y-2">
            {/* Quick Actions */}
            <div className="flex items-center gap-2 px-2">
              <Link href={`/projects/${projectId}`} className="flex-1">
                <Button
                  variant="default"
                  size="sm"
                  className="w-full bg-green-600 hover:bg-green-500 text-white"
                >
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Go to Project
                </Button>
              </Link>
              <Link href="/run-history">
                <Button variant="outline" size="sm" title="View Run History">
                  <History className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>

            {/* Activity Feed */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-2">
                <div className="flex items-center justify-between mb-2 px-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Recent Activity
                  </span>
                  {events.length > 0 && (
                    <Link
                      href={`/projects/${projectId}`}
                      className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1"
                    >
                      View All
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>

                {isLoading ? (
                  <div className="text-center py-4 text-xs text-muted-foreground">
                    Loading...
                  </div>
                ) : (
                  <CompactActivityStream
                    events={events}
                    maxEvents={5}
                    isRunning={isRunning}
                  />
                )}
              </CardContent>
            </Card>

            {/* Run Stats */}
            {recentRuns > 0 && (
              <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground">
                <span>{recentRuns} run{recentRuns !== 1 ? "s" : ""} this session</span>
                <Link
                  href="/run-history"
                  className="text-green-400 hover:text-green-300"
                >
                  View History
                </Link>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

/**
 * Hook to extract project info from pathname
 */
export function useProjectFromPath(): { projectId: string | null; isProjectPage: boolean } {
  const pathname = usePathname()

  const result = React.useMemo(() => {
    if (!pathname) return { projectId: null, isProjectPage: false }

    // Match /projects/[id] or /projects/[id]/anything
    const match = pathname.match(/^\/projects\/([^\/]+)/)
    if (match && match[1] !== "new" && match[1] !== "trash") {
      return { projectId: match[1], isProjectPage: true }
    }

    return { projectId: null, isProjectPage: false }
  }, [pathname])

  return result
}
