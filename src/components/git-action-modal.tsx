"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  RotateCcw,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  GitCommit,
  GitBranch,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  Flag
} from "lucide-react"

type ActionType = "rollback" | "comment" | "approve" | "reject" | "flag"

interface GitActionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  actionType: ActionType
  target: {
    type: "commit" | "pr" | "branch" | "activity"
    id: string
    title: string
    sha?: string
    branch?: string
    repo?: string
  }
  onSubmit: (action: ActionType, data: { comment?: string; reason?: string }) => Promise<void>
}

const actionConfig = {
  rollback: {
    title: "Request Rollback",
    description: "Request to revert this change. This will create an approval request.",
    icon: RotateCcw,
    color: "text-red-400",
    bg: "bg-red-400/10",
    buttonLabel: "Request Rollback",
    buttonVariant: "destructive" as const,
    requiresReason: true
  },
  comment: {
    title: "Add Comment",
    description: "Leave a comment on this action for the team.",
    icon: MessageSquare,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    buttonLabel: "Post Comment",
    buttonVariant: "default" as const,
    requiresReason: false
  },
  approve: {
    title: "Approve Action",
    description: "Approve this change and allow it to proceed.",
    icon: ThumbsUp,
    color: "text-green-400",
    bg: "bg-green-400/10",
    buttonLabel: "Approve",
    buttonVariant: "default" as const,
    requiresReason: false
  },
  reject: {
    title: "Reject Action",
    description: "Reject this change and block it from proceeding.",
    icon: ThumbsDown,
    color: "text-red-400",
    bg: "bg-red-400/10",
    buttonLabel: "Reject",
    buttonVariant: "destructive" as const,
    requiresReason: true
  },
  flag: {
    title: "Flag for Review",
    description: "Flag this action for manual review by a human.",
    icon: Flag,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    buttonLabel: "Flag for Review",
    buttonVariant: "default" as const,
    requiresReason: true
  }
}

export function GitActionModal({
  open,
  onOpenChange,
  actionType,
  target,
  onSubmit
}: GitActionModalProps) {
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<"success" | "error" | null>(null)

  const config = actionConfig[actionType]
  const Icon = config.icon

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onSubmit(actionType, {
        comment: comment || undefined,
        reason: config.requiresReason ? comment : undefined
      })
      setResult("success")
      setTimeout(() => {
        onOpenChange(false)
        setResult(null)
        setComment("")
      }, 1500)
    } catch (_error) {
      setResult("error")
      setTimeout(() => setResult(null), 3000)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setComment("")
    setResult(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", config.bg)}>
              <Icon className={cn("h-5 w-5", config.color)} />
            </div>
            <div>
              <DialogTitle>{config.title}</DialogTitle>
              <DialogDescription>{config.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 space-y-4">
          {/* Target Info */}
          <div className="p-3 rounded-lg bg-muted space-y-2">
            <p className="text-sm font-medium">{target.title}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {target.sha && (
                <div className="flex items-center gap-1">
                  <GitCommit className="h-3 w-3" />
                  <code className="font-mono">{target.sha}</code>
                </div>
              )}
              {target.branch && (
                <div className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  <code className="font-mono">{target.branch}</code>
                </div>
              )}
              {target.repo && (
                <Badge variant="outline" className="text-xs">
                  {target.repo}
                </Badge>
              )}
            </div>
          </div>

          {/* Comment/Reason Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {config.requiresReason ? "Reason" : "Comment"}
              {config.requiresReason && <span className="text-red-400">*</span>}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                actionType === "rollback"
                  ? "Explain why this change should be reverted..."
                  : actionType === "reject"
                    ? "Explain why this is being rejected..."
                    : actionType === "flag"
                      ? "What should be reviewed..."
                      : "Add your comment..."
              }
              className="w-full h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* Rollback Warning */}
          {actionType === "rollback" && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-400/10 text-yellow-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-none" />
              <p className="text-sm">
                This will create an approval request to revert the changes.
                The rollback will only proceed after approval.
              </p>
            </div>
          )}

          {/* Result Message */}
          {result && (
            <div className={cn(
              "flex items-center gap-2 p-3 rounded-lg",
              result === "success" ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"
            )}>
              {result === "success" ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">Action submitted successfully!</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">Failed to submit action. Please try again.</span>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={config.buttonVariant}
            onClick={handleSubmit}
            disabled={isSubmitting || (config.requiresReason && !comment.trim())}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {config.buttonLabel}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Quick action buttons component for inline use
interface GitActionButtonsProps {
  target: GitActionModalProps["target"]
  onAction: (type: ActionType) => void
  compact?: boolean
  showApproval?: boolean
}

export function GitActionButtons({ target: _target, onAction, compact = false, showApproval = false }: GitActionButtonsProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => { e.stopPropagation(); onAction("comment") }}
          title="Comment"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => { e.stopPropagation(); onAction("flag") }}
          title="Flag for review"
        >
          <Flag className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-red-400 hover:text-red-400 hover:bg-red-400/10"
          onClick={(e) => { e.stopPropagation(); onAction("rollback") }}
          title="Request rollback"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => onAction("comment")}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Comment
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => onAction("flag")}
      >
        <Flag className="h-3.5 w-3.5" />
        Flag
      </Button>
      {showApproval && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-green-400 hover:text-green-400 hover:bg-green-400/10"
            onClick={() => onAction("approve")}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            Approve
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-red-400 hover:text-red-400 hover:bg-red-400/10"
            onClick={() => onAction("reject")}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            Reject
          </Button>
        </>
      )}
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-red-400 hover:text-red-400 hover:bg-red-400/10"
        onClick={() => onAction("rollback")}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Rollback
      </Button>
    </div>
  )
}
