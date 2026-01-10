"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sparkles,
  Target,
  Users,
  Lightbulb,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Gamepad2,
  Star,
  Quote
} from "lucide-react"
import { cn } from "@/lib/utils"

interface VisionPacketMetadata {
  source: string
  projectType: string
  storeDescription: string
  tagline: string
  keyFeatures: string[]
  targetAudience: string
  uniqueSellingPoints: string[]
  isVisionPacket: boolean
  completionGate: boolean
}

interface VisionPacket {
  id: string
  phaseId: string
  title: string
  description: string
  type: "vision"
  priority: string
  status: string
  tasks: Array<{ id: string; description: string; completed: boolean; order: number }>
  acceptanceCriteria: string[]
  metadata: VisionPacketMetadata
}

interface VisionDisplayProps {
  projectId: string
  className?: string
}

/**
 * Displays the vision/store description for game and creative projects
 * Shows prominently at the top of the project overview when a vision packet exists
 */
export function VisionDisplay({ projectId, className }: VisionDisplayProps) {
  const [visionPacket, setVisionPacket] = useState<VisionPacket | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)
  const [loading, setLoading] = useState(true)

  // Load vision packet from localStorage
  useEffect(() => {
    if (!projectId) {
      setLoading(false)
      return
    }

    try {
      const storedPackets = localStorage.getItem("claudia_packets")
      if (storedPackets) {
        const allPackets = JSON.parse(storedPackets)
        const projectPackets = allPackets[projectId] || []

        // Find vision packet - it has type: "vision" or metadata.isVisionPacket: true
        const vision = projectPackets.find((p: VisionPacket) =>
          p.type === "vision" || p.metadata?.isVisionPacket === true
        )

        if (vision) {
          setVisionPacket(vision)
        }
      }
    } catch (error) {
      console.error("[VisionDisplay] Failed to load vision packet:", error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // Don't render anything if no vision packet
  if (loading || !visionPacket) {
    return null
  }

  const meta = visionPacket.metadata
  const completedTasks = visionPacket.tasks.filter(t => t.completed).length
  const totalTasks = visionPacket.tasks.length
  const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <Card className={cn(
      "border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/5 via-purple-500/10 to-pink-500/5",
      className
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Gamepad2 className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-400" />
                Game Vision & Story
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs bg-purple-500/10 border-purple-500/30 text-purple-400">
                  {meta.projectType || "Game"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {completionPercent}% complete
                </span>
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Tagline */}
          {meta.tagline && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <Quote className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium italic text-yellow-200">
                "{meta.tagline}"
              </p>
            </div>
          )}

          {/* Store Description */}
          {meta.storeDescription && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Star className="h-4 w-4 text-purple-400" />
                About This Game
              </h4>
              <ScrollArea className="h-[200px] rounded-lg border border-border/50 bg-background/50 p-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {meta.storeDescription}
                  </p>
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Key Features */}
          {meta.keyFeatures && meta.keyFeatures.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-blue-400" />
                Key Features
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {meta.keyFeatures.map((feature, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2 rounded-lg bg-blue-500/5 border border-blue-500/20"
                  >
                    <CheckCircle2 className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unique Selling Points */}
          {meta.uniqueSellingPoints && meta.uniqueSellingPoints.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-green-400" />
                What Makes This Special
              </h4>
              <div className="space-y-1">
                {meta.uniqueSellingPoints.map((usp, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/20"
                  >
                    <Sparkles className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{usp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Target Audience */}
          {meta.targetAudience && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
              <Users className="h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-muted-foreground">Target Audience:</span>
                <p className="text-sm font-medium">{meta.targetAudience}</p>
              </div>
            </div>
          )}

          {/* Completion Criteria */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Vision Completion Criteria
            </h4>
            <div className="grid grid-cols-1 gap-1">
              {visionPacket.tasks.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg text-sm",
                    task.completed
                      ? "bg-green-500/10 text-green-400"
                      : "bg-muted/50 text-muted-foreground"
                  )}
                >
                  <CheckCircle2
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      task.completed ? "text-green-400" : "text-muted-foreground/50"
                    )}
                  />
                  <span className={task.completed ? "line-through" : ""}>
                    {task.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
