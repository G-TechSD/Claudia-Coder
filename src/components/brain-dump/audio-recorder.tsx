"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Mic,
  Square,
  Pause,
  Play,
  Trash2,
  Upload,
  AlertCircle,
  Brain
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAudioRecorder, formatDuration } from "@/hooks/useAudioRecorder"
import { uploadResource } from "@/lib/data/resources"
import { createBrainDumpFromRecording } from "@/lib/data/resources"

interface AudioRecorderProps {
  projectId: string
  onRecordingComplete?: (resourceId: string, brainDumpId: string) => void
  onCancel?: () => void
  className?: string
}

export function AudioRecorder({
  projectId,
  onRecordingComplete,
  onCancel,
  className
}: AudioRecorderProps) {
  const [isSaving, setIsSaving] = useState(false)

  const {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    error,
    isSupported,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording
  } = useAudioRecorder()

  const handleStop = async () => {
    const blob = await stopRecording()
    if (!blob) return

    setIsSaving(true)

    try {
      // Create a file from the blob
      const filename = `brain-dump-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`
      const file = new File([blob], filename, { type: "audio/webm" })

      // Upload as a resource
      const resource = await uploadResource(projectId, file, "Brain dump recording")

      // Create a brain dump entry
      const brainDump = createBrainDumpFromRecording(projectId, resource.id)

      onRecordingComplete?.(resource.id, brainDump.id)
    } catch (err) {
      console.error("Failed to save recording:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    cancelRecording()
    onCancel?.()
  }

  // Generate audio level bars for visualization
  const bars = Array.from({ length: 12 }, (_, i) => {
    const threshold = (i + 1) / 12
    const isActive = audioLevel > threshold * 0.8
    return isActive
  })

  if (!isSupported) {
    return (
      <Card className={cn("bg-red-500/10 border-red-500/30", className)}>
        <CardContent className="p-6 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <div>
            <p className="font-medium">Recording Not Supported</p>
            <p className="text-sm text-muted-foreground">
              Your browser doesn't support audio recording. Try Chrome, Firefox, or Edge.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Brain Dump Recording
        </CardTitle>
        <CardDescription>
          Record your thoughts freely. We'll transcribe and organize them for you.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-red-500" />
            {error}
          </div>
        )}

        {/* Recording visualization */}
        <div className="flex flex-col items-center py-8">
          {/* Record button */}
          <button
            onClick={isRecording ? (isPaused ? resumeRecording : pauseRecording) : startRecording}
            disabled={isSaving}
            className={cn(
              "relative w-24 h-24 rounded-full flex items-center justify-center transition-all",
              "focus:outline-none focus:ring-4 focus:ring-primary/30",
              isRecording
                ? isPaused
                  ? "bg-yellow-500 hover:bg-yellow-600"
                  : "bg-red-500 hover:bg-red-600"
                : "bg-primary hover:bg-primary/90",
              isSaving && "opacity-50 cursor-not-allowed"
            )}
          >
            {/* Pulse animation when recording */}
            {isRecording && !isPaused && (
              <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
            )}

            {isRecording ? (
              isPaused ? (
                <Play className="h-10 w-10 text-white" />
              ) : (
                <Pause className="h-10 w-10 text-white" />
              )
            ) : (
              <Mic className="h-10 w-10 text-white" />
            )}
          </button>

          {/* Status */}
          <div className="mt-4 text-center">
            {isRecording ? (
              <>
                <Badge variant={isPaused ? "secondary" : "destructive"} className="mb-2">
                  {isPaused ? "Paused" : "Recording"}
                </Badge>
                <p className="text-3xl font-mono font-bold">
                  {formatDuration(duration)}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                Click to start recording
              </p>
            )}
          </div>
        </div>

        {/* Audio level visualization */}
        {isRecording && !isPaused && (
          <div className="flex items-center justify-center gap-1 h-12">
            {bars.map((isActive, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 rounded-full transition-all duration-75",
                  isActive
                    ? "bg-primary"
                    : "bg-muted",
                )}
                style={{
                  height: isActive
                    ? `${20 + Math.random() * 28}px`
                    : "8px",
                }}
              />
            ))}
          </div>
        )}

        {/* Tips */}
        {!isRecording && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-2">Tips for a great brain dump:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Speak naturally - don't worry about structure</li>
              <li>• Take pauses when you need to think</li>
              <li>• Mention project names, features, or technical details</li>
              <li>• Express concerns, ideas, and decisions openly</li>
            </ul>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {isRecording ? (
            <>
              <Button
                variant="destructive"
                onClick={handleStop}
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Stop & Save
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Discard
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={onCancel}
              className="w-full"
            >
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
