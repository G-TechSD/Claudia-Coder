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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  MessageSquare,
  Bug,
  Lightbulb,
  Send,
  Loader2,
  CheckCircle,
  XCircle
} from "lucide-react"

type FeedbackType = "bug" | "feature" | "general"

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
}

const feedbackTypes: { type: FeedbackType; label: string; icon: typeof Bug; color: string; bg: string }[] = [
  { type: "bug", label: "Bug Report", icon: Bug, color: "text-red-400", bg: "bg-red-400/10" },
  { type: "feature", label: "Feature Request", icon: Lightbulb, color: "text-yellow-400", bg: "bg-yellow-400/10" },
  { type: "general", label: "General Feedback", icon: MessageSquare, color: "text-blue-400", bg: "bg-blue-400/10" }
]

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("general")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<"success" | "error" | null>(null)

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: feedbackType,
          title: title.trim(),
          description: description.trim(),
          metadata: {
            url: typeof window !== "undefined" ? window.location.href : "",
            timestamp: new Date().toISOString(),
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : ""
          }
        })
      })

      if (!response.ok) throw new Error("Failed to submit feedback")

      setResult("success")
      setTimeout(() => {
        handleClose()
      }, 1500)
    } catch (_error) {
      setResult("error")
      setTimeout(() => setResult(null), 3000)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    onClose()
    setFeedbackType("general")
    setTitle("")
    setDescription("")
    setResult(null)
  }

  const selectedType = feedbackTypes.find(t => t.type === feedbackType)!

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", selectedType.bg)}>
              <selectedType.icon className={cn("h-5 w-5", selectedType.color)} />
            </div>
            <div>
              <DialogTitle>Send Feedback</DialogTitle>
              <DialogDescription>Help us improve by sharing your thoughts</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 space-y-4">
          {/* Feedback Type Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Feedback Type</label>
            <div className="flex gap-2">
              {feedbackTypes.map(({ type, label, icon: Icon, color, bg }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFeedbackType(type)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    feedbackType === type
                      ? cn(bg, color, "ring-1 ring-current")
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Title <span className="text-red-400">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                feedbackType === "bug"
                  ? "Brief description of the issue..."
                  : feedbackType === "feature"
                    ? "What feature would you like?"
                    : "What's on your mind?"
              }
            />
          </div>

          {/* Description Textarea */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Description <span className="text-red-400">*</span>
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                feedbackType === "bug"
                  ? "Steps to reproduce, expected vs actual behavior..."
                  : feedbackType === "feature"
                    ? "Describe the feature and why it would be useful..."
                    : "Share your feedback in detail..."
              }
              className="h-24 resize-none"
            />
          </div>

          {/* Result Message */}
          {result && (
            <div className={cn(
              "flex items-center gap-2 p-3 rounded-lg",
              result === "success" ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"
            )}>
              {result === "success" ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">Feedback submitted successfully!</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">Failed to submit feedback. Please try again.</span>
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
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !description.trim()}
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
                Submit Feedback
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
