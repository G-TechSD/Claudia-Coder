"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ClipboardList,
  Rocket,
  CheckCircle2,
  Circle,
  ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProjectStatus, StoredBuildPlan } from "@/lib/data/types"
import { getBuildPlanForProject } from "@/lib/data/build-plans"

interface ProjectTimelineProps {
  projectId: string
  projectStatus: ProjectStatus
  className?: string
}

interface TimelinePhase {
  id: string
  name: string
  description?: string
  status: "completed" | "active" | "upcoming"
  order: number
}

export function ProjectTimeline({
  projectId,
  projectStatus,
  className
}: ProjectTimelineProps) {
  // Load build plan to get phases
  const buildPlan = useMemo(() => {
    return getBuildPlanForProject(projectId)
  }, [projectId])

  // Build timeline phases
  const phases = useMemo((): TimelinePhase[] => {
    const timeline: TimelinePhase[] = []

    // Always start with Planning
    timeline.push({
      id: "planning",
      name: "Planning",
      description: "Project definition and build plan",
      status: projectStatus === "planning" ? "active" :
        ["active", "paused", "completed", "archived"].includes(projectStatus) ? "completed" : "upcoming",
      order: 0
    })

    // Add phases from build plan if available
    if (buildPlan?.originalPlan?.phases) {
      buildPlan.originalPlan.phases
        .sort((a, b) => a.order - b.order)
        .forEach((phase, index) => {
          // Determine phase status based on project status
          let status: TimelinePhase["status"] = "upcoming"

          if (projectStatus === "completed" || projectStatus === "archived") {
            status = "completed"
          } else if (projectStatus === "active") {
            // For now, mark first phase as active if project is active
            // In the future, this should track actual phase progress
            status = index === 0 ? "active" : "upcoming"
          }

          timeline.push({
            id: phase.id,
            name: phase.name,
            description: phase.description,
            status,
            order: index + 1
          })
        })
    } else {
      // Default phases if no build plan
      timeline.push(
        {
          id: "development",
          name: "Development",
          description: "Core implementation",
          status: projectStatus === "active" ? "active" :
            projectStatus === "completed" ? "completed" : "upcoming",
          order: 1
        },
        {
          id: "testing",
          name: "Testing",
          description: "Quality assurance",
          status: projectStatus === "completed" ? "completed" : "upcoming",
          order: 2
        }
      )
    }

    // Always end with Fully Developed
    timeline.push({
      id: "complete",
      name: "Fully Developed",
      description: "Production-ready version",
      status: projectStatus === "completed" ? "completed" : "upcoming",
      order: timeline.length
    })

    return timeline
  }, [buildPlan, projectStatus])

  const activePhaseIndex = phases.findIndex(p => p.status === "active")
  const progressPercent = activePhaseIndex >= 0
    ? ((activePhaseIndex + 0.5) / phases.length) * 100
    : projectStatus === "completed" ? 100 : 0

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" />
          Project Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        <div className="relative mb-6">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Timeline phases */}
        <div className="relative">
          {/* Connecting line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted" />

          {/* Phase nodes */}
          <div className="relative flex justify-between">
            {phases.map((phase, index) => {
              const isFirst = index === 0
              const isLast = index === phases.length - 1

              return (
                <div
                  key={phase.id}
                  className={cn(
                    "flex flex-col items-center",
                    isFirst && "items-start",
                    isLast && "items-end"
                  )}
                  style={{
                    width: `${100 / phases.length}%`,
                    maxWidth: isFirst || isLast ? "120px" : undefined
                  }}
                >
                  {/* Node */}
                  <div
                    className={cn(
                      "relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all",
                      phase.status === "completed" && "bg-primary border-primary text-primary-foreground",
                      phase.status === "active" && "bg-background border-primary animate-pulse",
                      phase.status === "upcoming" && "bg-muted border-muted-foreground/30"
                    )}
                  >
                    {phase.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : phase.status === "active" ? (
                      <Circle className="h-3 w-3 fill-primary text-primary" />
                    ) : (
                      <Circle className="h-3 w-3 text-muted-foreground/50" />
                    )}
                  </div>

                  {/* Label */}
                  <div className={cn(
                    "mt-2 text-center",
                    isFirst && "text-left",
                    isLast && "text-right"
                  )}>
                    <p className={cn(
                      "text-xs font-medium",
                      phase.status === "active" && "text-primary",
                      phase.status === "upcoming" && "text-muted-foreground"
                    )}>
                      {phase.name}
                    </p>
                    {phase.status === "active" && (
                      <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0">
                        Current
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Phase details for active phase */}
        {activePhaseIndex >= 0 && phases[activePhaseIndex].description && (
          <div className="mt-6 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-sm font-medium text-primary">
              {phases[activePhaseIndex].name}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {phases[activePhaseIndex].description}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
