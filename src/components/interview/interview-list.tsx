"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  MessageSquare,
  Plus,
  Play,
  Trash2,
  ChevronDown,
  ChevronRight,
  Eye,
  RefreshCw,
  Sparkles,
  Bot,
  User,
  Calendar,
  CheckCircle2,
  Clock,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  InterviewSession,
  InterviewType,
} from "@/lib/data/types"
import type { CombinedInterviewInsights } from "@/lib/data/projects"

interface InterviewListProps {
  projectId: string
  interviews: InterviewSession[]
  combinedInsights?: CombinedInterviewInsights
  onStartNew: () => void
  onContinue: (interview: InterviewSession) => void
  onDelete: (interviewId: string) => void
  onView: (interview: InterviewSession) => void
  onRegenerateBuildPlan?: () => void
  isRegenerating?: boolean
}

function getInterviewTypeLabel(type: InterviewType): string {
  switch (type) {
    case "project_creation":
      return "Creation"
    case "feature_discussion":
      return "Feature"
    case "refinement":
      return "Refinement"
    case "feedback":
      return "Feedback"
    case "contextual":
      return "Contextual"
    default:
      return type
  }
}

function getInterviewTypeColor(type: InterviewType): string {
  switch (type) {
    case "project_creation":
      return "bg-blue-500/10 text-blue-500"
    case "feature_discussion":
      return "bg-purple-500/10 text-purple-500"
    case "refinement":
      return "bg-amber-500/10 text-amber-500"
    case "feedback":
      return "bg-green-500/10 text-green-500"
    case "contextual":
      return "bg-gray-500/10 text-gray-500"
    default:
      return "bg-gray-500/10 text-gray-500"
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  })
}

function InterviewCard({
  interview,
  onContinue,
  onDelete,
  onView,
}: {
  interview: InterviewSession
  onContinue: () => void
  onDelete: () => void
  onView: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const canContinue = interview.status === "in_progress" || interview.isActive
  const isCompleted = interview.status === "completed"

  // Get preview of conversation
  const previewMessage = interview.messages.length > 0
    ? interview.messages[interview.messages.length - 1].content.substring(0, 100) + "..."
    : "No messages yet"

  return (
    <>
      <Card className="border-border/50 hover:border-border transition-colors">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <CardContent className="p-4 cursor-pointer">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-0.5">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="secondary"
                        className={cn("text-xs", getInterviewTypeColor(interview.type))}
                      >
                        {getInterviewTypeLabel(interview.type)}
                      </Badge>
                      {interview.version && (
                        <span className="text-xs text-muted-foreground">
                          #{interview.version}
                        </span>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(interview.createdAt)}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {interview.summary || previewMessage}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {isCompleted ? (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/20">
                          <Clock className="h-3 w-3 mr-1" />
                          In Progress
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {interview.messages.length} messages
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {canContinue && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onContinue}
                      title="Continue interview"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Continue
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onView}
                    title="View transcript"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowDeleteConfirm(true)}
                    title="Delete interview"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 pt-0 border-t border-border/50">
              {/* Key Points */}
              {interview.keyPoints && interview.keyPoints.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Key Points
                  </h4>
                  <ul className="space-y-1">
                    {interview.keyPoints.map((point, idx) => (
                      <li key={idx} className="text-sm text-foreground flex items-start gap-2">
                        <Sparkles className="h-3 w-3 mt-1 text-amber-500 shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Transcript Preview */}
              <div className="mt-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Recent Messages
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {interview.messages.slice(-4).map((msg, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-start gap-2 text-sm",
                        msg.role === "assistant" ? "text-muted-foreground" : "text-foreground"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <Bot className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                      ) : (
                        <User className="h-4 w-4 mt-0.5 shrink-0" />
                      )}
                      <p className="line-clamp-2">{msg.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Interview?</DialogTitle>
            <DialogDescription>
              This will permanently delete this interview and its transcript.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete()
                setShowDeleteConfirm(false)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function InterviewList({
  projectId,
  interviews,
  combinedInsights,
  onStartNew,
  onContinue,
  onDelete,
  onView,
  onRegenerateBuildPlan,
  isRegenerating = false,
}: InterviewListProps) {
  const [showInsights, setShowInsights] = useState(false)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">
            Interviews ({interviews.length})
          </h3>
        </div>
        <Button onClick={onStartNew} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" />
          New Interview
        </Button>
      </div>

      {/* Interview List */}
      {interviews.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-3">
              No interviews yet. Start one to discuss features, get feedback, or refine your project.
            </p>
            <Button onClick={onStartNew} variant="default">
              <Plus className="h-4 w-4 mr-1" />
              Start Interview
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {interviews.map((interview) => (
            <InterviewCard
              key={interview.id}
              interview={interview}
              onContinue={() => onContinue(interview)}
              onDelete={() => onDelete(interview.id)}
              onView={() => onView(interview)}
            />
          ))}
        </div>
      )}

      {/* Combined Insights Section */}
      {combinedInsights && interviews.length > 0 && (
        <Collapsible open={showInsights} onOpenChange={setShowInsights}>
          <Card className="border-border/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Combined Insights
                    <span className="text-xs text-muted-foreground font-normal">
                      (from all interviews)
                    </span>
                  </CardTitle>
                  {showInsights ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-4 space-y-4">
                {/* Goals */}
                {combinedInsights.goals.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Goals
                    </h4>
                    <ul className="space-y-1">
                      {combinedInsights.goals.map((goal, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <CheckCircle2 className="h-3 w-3 mt-1 text-green-500 shrink-0" />
                          {goal}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Tech Stack */}
                {combinedInsights.techStack.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Tech Stack
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {combinedInsights.techStack.map((tech, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Features */}
                {combinedInsights.features.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Features
                    </h4>
                    <ul className="space-y-1">
                      {combinedInsights.features.slice(0, 5).map((feature, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <Sparkles className="h-3 w-3 mt-1 text-amber-500 shrink-0" />
                          {feature}
                        </li>
                      ))}
                      {combinedInsights.features.length > 5 && (
                        <li className="text-xs text-muted-foreground">
                          +{combinedInsights.features.length - 5} more features
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Key Points */}
                {combinedInsights.keyPoints.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Key Points
                    </h4>
                    <ul className="space-y-1">
                      {combinedInsights.keyPoints.slice(0, 5).map((point, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground">
                          • {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Regenerate Build Plan Button */}
                {onRegenerateBuildPlan && (
                  <div className="pt-2 border-t border-border/50">
                    <Button
                      onClick={onRegenerateBuildPlan}
                      disabled={isRegenerating}
                      variant="outline"
                      className="w-full"
                    >
                      {isRegenerating ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Regenerating Build Plan...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Regenerate Build Plan from All Interviews
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  )
}
