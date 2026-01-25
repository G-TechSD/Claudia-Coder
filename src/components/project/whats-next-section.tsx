"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Sparkles,
  Send,
  Loader2,
  Plus,
  CheckCircle2,
  TestTube,
  Code2,
  Shield,
  FileText,
  Zap,
  Palette,
  Bug,
  RefreshCw,
  Package,
  Lightbulb,
  ArrowRight,
  X,
  RotateCcw
} from "lucide-react"

interface WorkPacket {
  id: string
  title: string
  description: string
  type: string
  priority: string
  status: string
}

interface NextStepRecommendation {
  id: string
  title: string
  description: string
  type: "testing" | "refactor" | "security" | "docs" | "performance" | "ux" | "bugfix" | "feature"
  priority: "high" | "medium" | "low"
  reasoning: string
  icon: React.ElementType
  color: string
}

interface WhatsNextSectionProps {
  projectId: string
  projectName: string
  projectDescription?: string
  packets: WorkPacket[]
  hasBuildPlan: boolean
  workingDirectory?: string
  onPacketCreated?: (packetId: string) => void
  onResetPackets?: () => void
}

// Icon and color mapping for recommendation types
const recommendationConfig: Record<NextStepRecommendation["type"], { icon: React.ElementType; color: string }> = {
  testing: { icon: TestTube, color: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  refactor: { icon: Code2, color: "text-purple-400 bg-purple-400/10 border-purple-400/30" },
  security: { icon: Shield, color: "text-red-400 bg-red-400/10 border-red-400/30" },
  docs: { icon: FileText, color: "text-green-400 bg-green-400/10 border-green-400/30" },
  performance: { icon: Zap, color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  ux: { icon: Palette, color: "text-pink-400 bg-pink-400/10 border-pink-400/30" },
  bugfix: { icon: Bug, color: "text-orange-400 bg-orange-400/10 border-orange-400/30" },
  feature: { icon: Sparkles, color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30" }
}

// Generate contextual recommendations based on project state
function generateRecommendations(
  packets: WorkPacket[],
  projectName: string,
  hasBuildPlan: boolean
): NextStepRecommendation[] {
  const recommendations: NextStepRecommendation[] = []
  const completedPackets = packets.filter(p => p.status === "completed")
  const hasFeatures = packets.some(p => p.type === "feature")
  const hasTests = packets.some(p => p.type === "testing" || p.title.toLowerCase().includes("test"))
  const hasDocs = packets.some(p => p.type === "docs" || p.title.toLowerCase().includes("documentation"))
  const hasSecurityWork = packets.some(p => p.type === "security" || p.title.toLowerCase().includes("security"))
  const hasPerformanceWork = packets.some(p => p.title.toLowerCase().includes("performance") || p.title.toLowerCase().includes("optimize"))

  // Testing recommendations
  if (hasFeatures && !hasTests) {
    recommendations.push({
      id: "rec-testing-1",
      title: "Add unit tests for new features",
      description: "Ensure code quality and prevent regressions by adding comprehensive unit tests for recently implemented features.",
      type: "testing",
      priority: "high",
      reasoning: "New features were added without corresponding tests",
      icon: TestTube,
      color: recommendationConfig.testing.color
    })
  }

  if (completedPackets.length >= 3 && !hasTests) {
    recommendations.push({
      id: "rec-testing-2",
      title: "Add integration tests",
      description: "With multiple features complete, add integration tests to verify components work together correctly.",
      type: "testing",
      priority: "medium",
      reasoning: "Multiple features completed - time for integration testing",
      icon: TestTube,
      color: recommendationConfig.testing.color
    })
  }

  // Refactoring recommendations
  if (completedPackets.length >= 5) {
    recommendations.push({
      id: "rec-refactor-1",
      title: "Refactor for code quality",
      description: "Review and refactor code to improve maintainability, reduce duplication, and follow best practices.",
      type: "refactor",
      priority: "medium",
      reasoning: "Significant work completed - good time for code cleanup",
      icon: Code2,
      color: recommendationConfig.refactor.color
    })
  }

  // Error handling recommendations
  if (hasFeatures) {
    recommendations.push({
      id: "rec-refactor-2",
      title: "Add error handling and edge cases",
      description: "Improve robustness by adding comprehensive error handling, input validation, and edge case coverage.",
      type: "refactor",
      priority: "high",
      reasoning: "Ensure production readiness with proper error handling",
      icon: Bug,
      color: recommendationConfig.bugfix.color
    })
  }

  // Documentation recommendations
  if (completedPackets.length >= 3 && !hasDocs) {
    recommendations.push({
      id: "rec-docs-1",
      title: "Improve documentation",
      description: "Add or update README, API documentation, and inline code comments for better maintainability.",
      type: "docs",
      priority: "medium",
      reasoning: "Project has grown - documentation needed",
      icon: FileText,
      color: recommendationConfig.docs.color
    })
  }

  // Performance recommendations
  if (completedPackets.length >= 5 && !hasPerformanceWork) {
    recommendations.push({
      id: "rec-perf-1",
      title: "Performance optimization",
      description: "Profile and optimize performance bottlenecks. Consider caching, lazy loading, and code splitting.",
      type: "performance",
      priority: "low",
      reasoning: "Project maturity suggests performance review",
      icon: Zap,
      color: recommendationConfig.performance.color
    })
  }

  // Security recommendations
  if (hasFeatures && !hasSecurityWork) {
    recommendations.push({
      id: "rec-security-1",
      title: "Security review",
      description: "Conduct a security audit: check for vulnerabilities, validate inputs, and ensure proper authentication/authorization.",
      type: "security",
      priority: "high",
      reasoning: "No security-focused work detected yet",
      icon: Shield,
      color: recommendationConfig.security.color
    })
  }

  // UX recommendations
  if (completedPackets.length >= 3) {
    recommendations.push({
      id: "rec-ux-1",
      title: "UX refinement",
      description: "Review and improve user experience: accessibility, responsive design, loading states, and error messages.",
      type: "ux",
      priority: "medium",
      reasoning: "Polish the user experience after core features",
      icon: Palette,
      color: recommendationConfig.ux.color
    })
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return recommendations.slice(0, 6) // Return top 6 recommendations
}

export function WhatsNextSection({
  projectId,
  projectName,
  projectDescription,
  packets,
  hasBuildPlan,
  workingDirectory,
  onPacketCreated,
  onResetPackets
}: WhatsNextSectionProps) {
  const [inputValue, setInputValue] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddingRecommendation, setIsAddingRecommendation] = useState<string | null>(null)
  const [addedRecommendations, setAddedRecommendations] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Calculate project state
  const activePackets = packets.filter(p =>
    p.status === "pending" || p.status === "in_progress" || p.status === "assigned"
  )
  const completedPackets = packets.filter(p => p.status === "completed")
  const allComplete = packets.length > 0 && activePackets.length === 0
  const queueEmpty = packets.length === 0

  // Generate recommendations
  const recommendations = generateRecommendations(packets, projectName, hasBuildPlan)
  const availableRecommendations = recommendations.filter(r => !addedRecommendations.has(r.id))

  // Show section when queue is empty or all packets complete
  const shouldShow = queueEmpty || allComplete || completedPackets.length > 0

  if (!shouldShow) {
    return null
  }

  const handleSubmit = async () => {
    if (!inputValue.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      // Call the packetize API to create new packets from the input
      const response = await fetch("/api/brain-dump/packetize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: inputValue,
          projectId,
          projectName,
          projectDescription,
          existingContext: {
            hasBuildPlan,
            hasPackets: packets.length > 0,
            recentActivity: completedPackets.slice(0, 5).map(p => p.title)
          }
        })
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to create packets")
      }

      // Save packets to server
      if (data.proposedPackets && data.proposedPackets.length > 0) {
        // Fetch existing packets from server
        const existingResponse = await fetch(`/api/projects/${projectId}/packets`)
        const existingData = await existingResponse.json()
        const existingPackets = existingData.success && Array.isArray(existingData.packets)
          ? existingData.packets
          : []

        // Add new packets
        const newPackets = data.proposedPackets.map((packet: {
          id: string
          title: string
          description: string
          type: string
          priority: string
          tasks?: Array<{ id: string; description: string; completed: boolean; order: number }>
          acceptanceCriteria?: string[]
        }) => ({
          id: packet.id,
          title: packet.title,
          description: packet.description,
          type: packet.type,
          priority: packet.priority,
          status: "pending",
          tasks: packet.tasks || [],
          acceptanceCriteria: packet.acceptanceCriteria || []
        }))

        // Save to server
        await fetch(`/api/projects/${projectId}/packets`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packets: [...existingPackets, ...newPackets] })
        })

        // Notify parent
        if (onPacketCreated) {
          onPacketCreated(data.proposedPackets[0].id)
        }

        // Clear input
        setInputValue("")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create packets")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddRecommendation = async (recommendation: NextStepRecommendation) => {
    setIsAddingRecommendation(recommendation.id)
    setError(null)

    try {
      // Fetch existing packets from server
      const existingResponse = await fetch(`/api/projects/${projectId}/packets`)
      const existingData = await existingResponse.json()
      const existingPackets = existingData.success && Array.isArray(existingData.packets)
        ? existingData.packets
        : []

      const newPacket = {
        id: `packet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: recommendation.title,
        description: recommendation.description,
        type: recommendation.type,
        priority: recommendation.priority,
        status: "pending",
        tasks: [],
        acceptanceCriteria: [],
        source: "recommendation",
        reasoning: recommendation.reasoning
      }

      // Save to server
      await fetch(`/api/projects/${projectId}/packets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packets: [...existingPackets, newPacket] })
      })

      // Mark as added
      setAddedRecommendations(prev => new Set([...prev, recommendation.id]))

      // Notify parent
      if (onPacketCreated) {
        onPacketCreated(newPacket.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add recommendation")
    } finally {
      setIsAddingRecommendation(null)
    }
  }

  return (
    <Card className={cn(
      "border-2",
      allComplete ? "border-green-500/30 bg-green-500/5" : "border-primary/30 bg-primary/5"
    )}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {allComplete ? (
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle2 className="h-6 w-6 text-green-400" />
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-primary/20">
                <Lightbulb className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg">
                {allComplete ? "All packets complete!" : "What's Next?"}
              </CardTitle>
              <CardDescription>
                {allComplete
                  ? "Great work! Ready to add more tasks to the queue?"
                  : queueEmpty
                    ? "Your queue is empty. What would you like to work on?"
                    : "Add new work to your queue or try a recommended next step"
                }
              </CardDescription>
            </div>
          </div>

          {/* Reset button - shows when all packets are complete */}
          {allComplete && onResetPackets && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResetPackets}
              className="gap-2 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20"
            >
              <RotateCcw className="h-4 w-4" />
              Reset All Packets
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="space-y-3">
          <div className="relative">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Describe what you'd like to work on next... (e.g., 'Add dark mode support' or 'Fix the login bug on mobile')"
              className="min-h-[80px] pr-12 resize-none"
              disabled={isSubmitting}
            />
            <Button
              size="icon"
              className="absolute bottom-2 right-2"
              onClick={handleSubmit}
              disabled={!inputValue.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          {error && (
            <div className="text-sm text-red-400 flex items-center gap-2">
              <X className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        {/* Recommendations Section */}
        {availableRecommendations.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              <span className="font-medium">Recommended Next Steps</span>
              <span className="text-xs">based on your project</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableRecommendations.map((rec) => {
                const Icon = rec.icon
                const isAdding = isAddingRecommendation === rec.id
                const colorClasses = rec.color.split(" ")

                return (
                  <div
                    key={rec.id}
                    className={cn(
                      "group relative rounded-lg border p-3 transition-all hover:shadow-md cursor-pointer",
                      colorClasses[1], // bg color
                      colorClasses[2], // border color
                      "hover:scale-[1.02]"
                    )}
                    onClick={() => !isAdding && handleAddRecommendation(rec)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("p-1.5 rounded-md", colorClasses[1])}>
                        <Icon className={cn("h-4 w-4", colorClasses[0])} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm truncate">{rec.title}</h4>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs flex-shrink-0",
                              rec.priority === "high" && "border-red-400/50 text-red-400",
                              rec.priority === "medium" && "border-yellow-400/50 text-yellow-400",
                              rec.priority === "low" && "border-gray-400/50 text-gray-400"
                            )}
                          >
                            {rec.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {rec.description}
                        </p>
                      </div>
                    </div>

                    {/* Add button overlay */}
                    <div className={cn(
                      "absolute inset-0 rounded-lg flex items-center justify-center",
                      "bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                    )}>
                      <Button
                        size="sm"
                        className="gap-2"
                        disabled={isAdding}
                      >
                        {isAdding ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            Add to Queue
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Stats when recommendations are shown */}
        {packets.length > 0 && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
            <div className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" />
              <span>{packets.length} total packets</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
              <span>{completedPackets.length} completed</span>
            </div>
            {activePackets.length > 0 && (
              <div className="flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
                <span>{activePackets.length} in progress</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
