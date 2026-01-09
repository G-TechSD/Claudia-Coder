"use client"

import { useState, useEffect } from "react"
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { PacketRun, PacketRunRating } from "@/lib/data/types"

export interface PacketFeedbackProps {
  run: PacketRun
  onFeedback: (rating: PacketRunRating, comment?: string) => void
}

export function PacketFeedback({ run, onFeedback }: PacketFeedbackProps) {
  const [selectedRating, setSelectedRating] = useState<PacketRunRating>(run.rating ?? null)
  const [comment, setComment] = useState(run.comment ?? "")
  const [showComment, setShowComment] = useState(!!run.comment)

  // Sync state if run props change
  useEffect(() => {
    setSelectedRating(run.rating ?? null)
    setComment(run.comment ?? "")
    setShowComment(!!run.comment)
  }, [run.rating, run.comment])

  const handleRatingClick = (rating: "thumbs_up" | "thumbs_down") => {
    // Toggle off if clicking the same rating
    const newRating = selectedRating === rating ? null : rating
    setSelectedRating(newRating)
  }

  const handleSave = () => {
    onFeedback(selectedRating, comment.trim() || undefined)
  }

  const hasChanges =
    selectedRating !== (run.rating ?? null) ||
    comment.trim() !== (run.comment ?? "")

  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-3 space-y-3">
        {/* Rating buttons row */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">Rate:</span>

          {/* Thumbs Up */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0",
              selectedRating === "thumbs_up"
                ? "bg-green-500/20 text-green-400 hover:bg-green-500/30 hover:text-green-400"
                : "text-muted-foreground hover:text-green-400 hover:bg-green-500/10"
            )}
            onClick={() => handleRatingClick("thumbs_up")}
          >
            <ThumbsUp className="h-4 w-4" />
          </Button>

          {/* Thumbs Down */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0",
              selectedRating === "thumbs_down"
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-400"
                : "text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
            )}
            onClick={() => handleRatingClick("thumbs_down")}
          >
            <ThumbsDown className="h-4 w-4" />
          </Button>

          {/* Toggle comment */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0 ml-auto",
              showComment
                ? "text-primary hover:text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setShowComment(!showComment)}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>

        {/* Comment textarea */}
        {showComment && (
          <Textarea
            placeholder="Add a comment about this run..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[60px] text-sm bg-background/50 border-border/50 resize-none"
            rows={2}
          />
        )}

        {/* Save button */}
        <Button
          size="sm"
          className="w-full h-8"
          onClick={handleSave}
          disabled={!hasChanges}
        >
          Save Feedback
        </Button>
      </CardContent>
    </Card>
  )
}
