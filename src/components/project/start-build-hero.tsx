"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Rocket,
  Package,
  Clock,
  Zap,
  CheckCircle2,
  Brain,
  ArrowRight
} from "lucide-react"

interface WorkPacket {
  id: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  tasks: Array<{ id: string; description: string; completed: boolean }>
  acceptanceCriteria: string[]
}

interface StartBuildHeroProps {
  projectId: string
  projectName: string
  packets: WorkPacket[]
  hasBuildPlan: boolean
  buildPlanApproved: boolean
  isExecuting?: boolean
  hasLinkedRepo?: boolean
  onStartBuild: () => void
  className?: string
}

/**
 * Start Build Hero Section
 *
 * A prominent call-to-action section that appears when:
 * - A build plan has been saved/accepted
 * - Packets are loaded/queued
 * - Build is NOT already running
 */
export function StartBuildHero({
  projectId: _projectId,
  projectName: _projectName,
  packets,
  hasBuildPlan,
  buildPlanApproved,
  isExecuting = false,
  hasLinkedRepo = false,
  onStartBuild,
  className
}: StartBuildHeroProps) {
  // projectId and projectName are available for future use (logging, analytics, etc.)
  void _projectId
  void _projectName
  // Filter to executable packets
  const readyPackets = packets.filter(p =>
    p.status === "ready" || p.status === "pending" || p.status === "queued"
  )

  // Calculate estimated time (rough estimate: 2-5 min per packet)
  const estimatedMinutes = readyPackets.length * 3
  const estimatedTimeDisplay = estimatedMinutes < 60
    ? `~${estimatedMinutes} minutes`
    : `~${Math.round(estimatedMinutes / 60)} hour${Math.round(estimatedMinutes / 60) > 1 ? 's' : ''}`

  // Count by priority
  const criticalCount = readyPackets.filter(p => p.priority === "critical").length
  const highCount = readyPackets.filter(p => p.priority === "high").length
  const mediumCount = readyPackets.filter(p => p.priority === "medium").length
  const lowCount = readyPackets.filter(p => p.priority === "low").length

  // Count total tasks
  const totalTasks = readyPackets.reduce((acc, p) => acc + (p.tasks?.length || 0), 0)

  // Determine if we should show this hero
  // Show when: build plan exists + packets queued + not currently executing
  const shouldShow = hasBuildPlan && buildPlanApproved && readyPackets.length > 0 && !isExecuting

  if (!shouldShow) {
    return null
  }

  return (
    <Card className={cn(
      "relative overflow-hidden",
      "border-2 border-green-500/50",
      "bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent",
      className
    )}>
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

      <CardContent className="relative p-6 md:p-8">
        <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
          {/* Left side: Icon and text */}
          <div className="flex-1 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-3">
              <div className="p-3 rounded-2xl bg-green-500/20 border border-green-500/30">
                <Rocket className="h-8 w-8 text-green-400" />
              </div>
              <Badge variant="outline" className="text-green-400 border-green-500/30 bg-green-500/10">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Ready to Execute
              </Badge>
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Ready to Build
            </h2>
            <p className="text-muted-foreground text-lg mb-4">
              Your build plan is approved and{" "}
              <span className="text-green-400 font-semibold">
                {readyPackets.length} packet{readyPackets.length !== 1 ? 's' : ''}
              </span>{" "}
              {readyPackets.length !== 1 ? 'are' : 'is'} queued for execution.
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4 text-green-400" />
                <span>{totalTasks} tasks total</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 text-blue-400" />
                <span>{estimatedTimeDisplay}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Brain className="h-4 w-4 text-purple-400" />
                <span>AI-powered execution</span>
              </div>
            </div>

            {/* Priority breakdown */}
            {(criticalCount > 0 || highCount > 0) && (
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mt-3">
                {criticalCount > 0 && (
                  <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/10">
                    {criticalCount} critical
                  </Badge>
                )}
                {highCount > 0 && (
                  <Badge variant="outline" className="text-orange-400 border-orange-500/30 bg-orange-500/10">
                    {highCount} high priority
                  </Badge>
                )}
                {mediumCount > 0 && (
                  <Badge variant="outline" className="text-yellow-400 border-yellow-500/30 bg-yellow-500/10">
                    {mediumCount} medium
                  </Badge>
                )}
                {lowCount > 0 && (
                  <Badge variant="outline" className="text-gray-400 border-gray-500/30 bg-gray-500/10">
                    {lowCount} low
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Right side: Big button */}
          <div className="flex flex-col items-center gap-3">
            <Button
              size="lg"
              onClick={onStartBuild}
              disabled={!hasLinkedRepo || readyPackets.length === 0}
              className={cn(
                "h-16 px-8 text-lg font-semibold",
                "bg-gradient-to-r from-green-600 to-emerald-600",
                "hover:from-green-500 hover:to-emerald-500",
                "shadow-lg shadow-green-500/25",
                "border border-green-400/30",
                "transition-all duration-300",
                "hover:scale-105 hover:shadow-xl hover:shadow-green-500/30"
              )}
            >
              <Zap className="h-6 w-6 mr-2" />
              Start Build
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>

            {!hasLinkedRepo && (
              <p className="text-xs text-amber-400">
                Link a repository first to enable execution
              </p>
            )}

            <p className="text-xs text-muted-foreground text-center max-w-[200px]">
              Claudia Coder will execute all queued packets using your selected AI provider
            </p>
          </div>
        </div>

        {/* Packet preview list */}
        {readyPackets.length > 0 && readyPackets.length <= 5 && (
          <div className="mt-6 pt-6 border-t border-green-500/20">
            <p className="text-sm text-muted-foreground mb-3">Packets to execute:</p>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {readyPackets.slice(0, 6).map((packet, index) => (
                <div
                  key={packet.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border/50"
                >
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                    {index + 1}
                  </div>
                  <span className="text-sm truncate flex-1">{packet.title}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      packet.priority === "critical" && "text-red-400 border-red-500/30",
                      packet.priority === "high" && "text-orange-400 border-orange-500/30",
                      packet.priority === "medium" && "text-yellow-400 border-yellow-500/30",
                      packet.priority === "low" && "text-gray-400 border-gray-500/30"
                    )}
                  >
                    {packet.type}
                  </Badge>
                </div>
              ))}
            </div>
            {readyPackets.length > 6 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                +{readyPackets.length - 6} more packets
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Compact version for use in sidebars or smaller spaces
 */
export function StartBuildCompact({
  packets,
  hasBuildPlan,
  buildPlanApproved,
  isExecuting = false,
  hasLinkedRepo = false,
  onStartBuild
}: Omit<StartBuildHeroProps, 'projectId' | 'projectName' | 'className'>) {
  const readyPackets = packets.filter(p =>
    p.status === "ready" || p.status === "pending" || p.status === "queued"
  )

  const shouldShow = hasBuildPlan && buildPlanApproved && readyPackets.length > 0 && !isExecuting

  if (!shouldShow) {
    return null
  }

  return (
    <div className="p-4 rounded-lg border-2 border-green-500/50 bg-green-500/5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Rocket className="h-5 w-5 text-green-400" />
          <div>
            <p className="font-medium text-sm">Ready to Build</p>
            <p className="text-xs text-muted-foreground">
              {readyPackets.length} packets queued
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={onStartBuild}
          disabled={!hasLinkedRepo}
          className="bg-green-600 hover:bg-green-500"
        >
          <Zap className="h-4 w-4 mr-1" />
          Start
        </Button>
      </div>
    </div>
  )
}
