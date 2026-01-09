"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  Play,
  Square,
  Loader2,
  CheckCircle2,
  Circle,
  ListChecks
} from "lucide-react"

export interface PacketTask {
  id: string
  title: string
  completed: boolean
}

export interface Packet {
  id: string
  title: string
  description: string
  type: string
  priority: "low" | "medium" | "high" | "critical"
  status: "pending" | "in_progress" | "completed" | "failed"
  tasks: PacketTask[]
  acceptanceCriteria: string[]
}

interface PacketCardProps {
  packet: Packet
  onStart: () => void
  onStop: () => void
  isExecuting: boolean
}

const priorityConfig: Record<Packet["priority"], { label: string; variant: "default" | "secondary" | "warning" | "error" }> = {
  low: { label: "Low", variant: "secondary" },
  medium: { label: "Medium", variant: "default" },
  high: { label: "High", variant: "warning" },
  critical: { label: "Critical", variant: "error" }
}

type StatusConfigValue = { label: string; color: string; icon: React.ElementType }

const defaultStatusConfig: StatusConfigValue = {
  label: "Unknown",
  color: "text-muted-foreground",
  icon: Circle
}

const statusConfig: Record<Packet["status"], StatusConfigValue> = {
  pending: { label: "Pending", color: "text-muted-foreground", icon: Circle },
  in_progress: { label: "In Progress", color: "text-blue-400", icon: Loader2 },
  completed: { label: "Completed", color: "text-green-400", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-red-400", icon: Circle }
}

function getStatusConfig(status: string): StatusConfigValue {
  return statusConfig[status as Packet["status"]] ?? defaultStatusConfig
}

export function PacketCard({ packet, onStart, onStop, isExecuting }: PacketCardProps) {
  const completedTasks = packet.tasks.filter(task => task.completed).length
  const totalTasks = packet.tasks.length
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  const statusInfo = getStatusConfig(packet.status)
  const StatusIcon = statusInfo.icon
  const priorityInfo = priorityConfig[packet.priority]

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {packet.type}
              </Badge>
              <Badge variant={priorityInfo.variant} className="text-xs">
                {priorityInfo.label}
              </Badge>
            </div>
            <CardTitle className="text-base font-medium truncate">
              {packet.title}
            </CardTitle>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusIcon
              className={cn(
                "h-4 w-4",
                statusInfo.color,
                packet.status === "in_progress" && "animate-spin"
              )}
            />
            <span className={cn("text-sm font-medium", statusInfo.color)}>
              {statusInfo.label}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {packet.description}
        </p>

        {/* Task Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ListChecks className="h-4 w-4" />
              <span>Tasks</span>
            </div>
            <span className="font-medium">
              {completedTasks}/{totalTasks} completed
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Acceptance Criteria Preview */}
        {packet.acceptanceCriteria.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Acceptance Criteria:</span>{" "}
            {packet.acceptanceCriteria.length} item{packet.acceptanceCriteria.length !== 1 ? "s" : ""}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {isExecuting ? (
            <>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                disabled
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Executing...
              </Button>
              <Button
                variant="destructive"
                size="icon"
                onClick={onStop}
                title="Stop execution"
              >
                <Square className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              className="flex-1 gap-2 bg-green-600 hover:bg-green-500 text-white"
              onClick={onStart}
              disabled={packet.status === "completed"}
            >
              <Play className="h-4 w-4" />
              {packet.status === "completed" ? "Completed" : "Start"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
