"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Brain,
  Mic,
  FileAudio,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
  Trash2,
  ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { BrainDump } from "@/lib/data/types"
import { getBrainDumpsForProject, deleteBrainDump } from "@/lib/data/resources"

interface BrainDumpListProps {
  projectId: string
  onSelect?: (brainDumpId: string) => void
  onStartNew?: () => void
  className?: string
}

const statusConfig: Record<BrainDump["status"], {
  label: string
  color: string
  icon: typeof Clock
}> = {
  recording: {
    label: "Recording",
    color: "bg-red-500/10 text-red-500 border-red-500/30",
    icon: Mic
  },
  transcribing: {
    label: "Transcribing",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    icon: Loader2
  },
  processing: {
    label: "Processing",
    color: "bg-purple-500/10 text-purple-500 border-purple-500/30",
    icon: Brain
  },
  review: {
    label: "Ready for Review",
    color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    icon: Clock
  },
  completed: {
    label: "Completed",
    color: "bg-green-500/10 text-green-500 border-green-500/30",
    icon: CheckCircle2
  },
  archived: {
    label: "Archived",
    color: "bg-gray-500/10 text-gray-500 border-gray-500/30",
    icon: AlertCircle
  }
}

export function BrainDumpList({
  projectId,
  onSelect,
  onStartNew,
  className
}: BrainDumpListProps) {
  const [brainDumps, setBrainDumps] = useState<BrainDump[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadBrainDumps()
  }, [projectId])

  function loadBrainDumps() {
    setIsLoading(true)
    const dumps = getBrainDumpsForProject(projectId)
    setBrainDumps(dumps)
    setIsLoading(false)
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (confirm("Delete this brain dump?")) {
      deleteBrainDump(id)
      loadBrainDumps()
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    })
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with New Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-medium">Brain Dumps</h3>
          <Badge variant="secondary">{brainDumps.length}</Badge>
        </div>
        {onStartNew && (
          <Button size="sm" onClick={onStartNew}>
            <Mic className="h-4 w-4 mr-1" />
            New Brain Dump
          </Button>
        )}
      </div>

      {/* Empty State */}
      {brainDumps.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileAudio className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No brain dumps yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Record your thoughts and let AI structure them into actionable items
            </p>
            {onStartNew && (
              <Button onClick={onStartNew}>
                <Mic className="h-4 w-4 mr-1" />
                Start Recording
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Brain Dump List */
        <div className="space-y-2">
          {brainDumps.map(dump => {
            const status = statusConfig[dump.status]
            const StatusIcon = status.icon
            const isProcessing = dump.status === "transcribing" || dump.status === "processing"

            return (
              <Card
                key={dump.id}
                className={cn(
                  "group cursor-pointer hover:border-primary/50 transition-colors",
                  dump.status === "review" && "border-yellow-500/30"
                )}
                onClick={() => onSelect?.(dump.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Status Icon */}
                    <div className={cn(
                      "flex-none w-10 h-10 rounded-full flex items-center justify-center",
                      status.color
                    )}>
                      <StatusIcon className={cn(
                        "h-5 w-5",
                        isProcessing && "animate-spin"
                      )} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {dump.processedContent?.summary?.slice(0, 50) ||
                           dump.transcription?.text?.slice(0, 50) ||
                           "Brain Dump"}
                          {(dump.processedContent?.summary?.length || 0) > 50 && "..."}
                        </span>
                        <Badge variant="outline" className={cn("text-xs", status.color)}>
                          {status.label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span>{formatDate(dump.createdAt)}</span>
                        {dump.transcription?.duration && (
                          <span className="flex items-center gap-1">
                            <Play className="h-3 w-3" />
                            {formatDuration(dump.transcription.duration)}
                          </span>
                        )}
                        {dump.transcription?.wordCount && (
                          <span>{dump.transcription.wordCount} words</span>
                        )}
                        {dump.processedContent?.actionItems && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {dump.processedContent.actionItems.length} actions
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={(e) => handleDelete(dump.id, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Processing Progress */}
                  {isProcessing && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>
                          {dump.status === "transcribing"
                            ? "Converting speech to text..."
                            : "Analyzing and structuring content..."}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Review Prompt */}
                  {dump.status === "review" && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-yellow-600">
                          Ready for your review and approval
                        </span>
                        <Button size="sm" variant="outline">
                          Review Now
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Completed Summary */}
                  {dump.status === "completed" && dump.approvedSections && (
                    <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                      {dump.approvedSections.length} sections approved
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
