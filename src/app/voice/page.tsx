"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useAudioRecorder, formatDuration } from "@/hooks/useAudioRecorder"
import { useTranscription } from "@/hooks/useTranscription"
import { useAuth } from "@/components/auth/auth-provider"
import { RecordingLibrary } from "@/components/voice/recording-library"
import {
  createRecording,
  getRecordings,
  getRecordingStats,
  formatDuration as formatRecordingDuration
} from "@/lib/data/voice-recordings-client"
import type { VoiceRecording } from "@/lib/data/types"
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Settings,
  History,
  MessageSquare,
  Play,
  Square,
  Pause,
  Bot,
  User,
  Clock,
  CheckCircle,
  Save,
  Loader2,
  FolderPlus,
  Archive,
  FileText,
  Sparkles,
  AlertCircle
} from "lucide-react"

interface VoiceCommand {
  id: string
  type: "user" | "assistant"
  text: string
  timestamp: Date
  action?: string
  status?: "executed" | "pending" | "failed"
}

interface QuickCommand {
  phrase: string
  description: string
  action: string
}

const quickCommands: QuickCommand[] = [
  { phrase: "What's the status?", description: "Get overall pipeline status", action: "status_check" },
  { phrase: "Show me errors", description: "List recent errors and failures", action: "show_errors" },
  { phrase: "Start next packet", description: "Begin the next queued packet", action: "start_next" },
  { phrase: "Pause everything", description: "Pause all running agents", action: "pause_all" },
  { phrase: "How much have I spent?", description: "Get today's cost summary", action: "cost_summary" },
  { phrase: "Approve all pending", description: "Approve waiting requests", action: "approve_pending" }
]

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  })
}

export default function VoicePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<"record" | "library">("record")
  const [isMuted, setIsMuted] = useState(false)
  const [history, setHistory] = useState<VoiceCommand[]>([])
  const [currentTranscript, setCurrentTranscript] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [recentRecording, setRecentRecording] = useState<VoiceRecording | null>(null)

  // Audio recorder hook
  const {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    error: recorderError,
    isSupported,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording
  } = useAudioRecorder()

  // Transcription hook
  const {
    isTranscribing,
    progress: transcriptionProgress,
    method: transcriptionMethod,
    result: transcriptionResult,
    error: transcriptionError,
    transcribe,
    reset: resetTranscription
  } = useTranscription()

  // Recording stats
  const [stats, setStats] = useState<{
    totalRecordings: number
    totalDuration: number
    createdProjects: number
  } | null>(null)

  // Load stats on mount
  useEffect(() => {
    if (user?.id) {
      const recordingStats = getRecordingStats(user.id)
      setStats({
        totalRecordings: recordingStats.totalRecordings,
        totalDuration: recordingStats.totalDuration,
        createdProjects: recordingStats.createdProjects
      })
    }
  }, [user?.id, activeTab])

  // Generate visualizer bars based on audio level
  const visualizerBars = Array(32).fill(0).map(() =>
    isRecording && !isPaused
      ? Math.random() * 60 * (audioLevel + 0.3) + 10
      : 0
  )

  const handleStartRecording = async () => {
    setSaveError("")
    setRecentRecording(null)
    resetTranscription()
    await startRecording()
  }

  const handleStopRecording = async () => {
    const audioBlob = await stopRecording()

    if (audioBlob) {
      // Start transcription
      const result = await transcribe(audioBlob)

      if (result && user?.id) {
        setCurrentTranscript(result.text)

        // Save the recording
        await saveRecording(audioBlob, result)
      }
    }
  }

  const saveRecording = async (audioBlob: Blob, transcription: { text: string; method: string; duration: number; confidence?: number }) => {
    if (!user?.id) return

    setIsSaving(true)
    setSaveError("")

    try {
      // Create form data for API
      const formData = new FormData()
      formData.append("audio", audioBlob, "recording.webm")
      formData.append("transcription", transcription.text)
      formData.append("transcriptionMethod", transcription.method)
      if (transcription.confidence) {
        formData.append("transcriptionConfidence", transcription.confidence.toString())
      }
      formData.append("audioDuration", duration.toString())
      formData.append("sourceContext", "voice-page")

      // Save to API (which saves the audio file)
      const response = await fetch("/api/voice-recordings", {
        method: "POST",
        body: formData
      })

      const data = await response.json()

      if (data.success && data.recording) {
        // Create the recording in localStorage
        const recording = createRecording({
          userId: user.id,
          audioUrl: data.recording.audioUrl,
          audioDuration: data.recording.audioDuration,
          audioMimeType: data.recording.audioMimeType,
          audioSize: data.recording.audioSize,
          transcription: data.recording.transcription,
          transcriptionMethod: data.recording.transcriptionMethod as "whisper-local" | "browser-speech",
          transcriptionConfidence: data.recording.transcriptionConfidence,
          title: data.recording.title,
          tags: data.recording.tags,
          sourceContext: "voice-page"
        })

        setRecentRecording(recording)

        // Update stats
        if (stats) {
          setStats({
            ...stats,
            totalRecordings: stats.totalRecordings + 1,
            totalDuration: stats.totalDuration + duration
          })
        }
      } else {
        setSaveError(data.error || "Failed to save recording")
      }
    } catch (err) {
      console.error("Failed to save recording:", err)
      setSaveError(err instanceof Error ? err.message : "Failed to save recording")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateProject = (recording: VoiceRecording) => {
    // Navigate to project creation with recording context
    router.push(`/projects/new?voiceRecordingId=${recording.id}`)
  }

  const handleLinkToProject = (recording: VoiceRecording) => {
    // Navigate to project selection
    router.push(`/projects?linkRecording=${recording.id}`)
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Voice Studio</h1>
          <p className="text-sm text-muted-foreground">
            Record ideas, create projects from voice - nothing gets lost
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats && (
            <div className="flex items-center gap-4 mr-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Archive className="h-4 w-4" />
                {stats.totalRecordings} recordings
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatRecordingDuration(stats.totalDuration)}
              </span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMuted(!isMuted)}
            className={cn("gap-2", isMuted && "text-muted-foreground")}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {isMuted ? "Unmute" : "Mute"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "record" | "library")}>
        <TabsList>
          <TabsTrigger value="record" className="gap-2">
            <Mic className="h-4 w-4" />
            Record
          </TabsTrigger>
          <TabsTrigger value="library" className="gap-2">
            <Archive className="h-4 w-4" />
            Library
            {stats && stats.totalRecordings > 0 && (
              <Badge variant="secondary" className="ml-1">
                {stats.totalRecordings}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Record Tab */}
        <TabsContent value="record" className="flex-1">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Voice Recording Panel */}
            <Card className="lg:col-span-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                {!isSupported ? (
                  <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">Recording Not Supported</p>
                    <p className="text-sm text-muted-foreground">
                      Your browser doesn&apos;t support audio recording. Try using Chrome, Firefox, or Edge.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Status */}
                    <div className="mb-8 text-center">
                      <Badge
                        variant={isRecording ? "default" : isTranscribing ? "secondary" : isSaving ? "secondary" : "outline"}
                        className="mb-2"
                      >
                        {isRecording
                          ? isPaused ? "Paused" : "Recording..."
                          : isTranscribing
                            ? "Transcribing..."
                            : isSaving
                              ? "Saving..."
                              : "Ready"}
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        {isRecording
                          ? isPaused
                            ? "Recording paused - click to resume"
                            : "Speak your ideas - take your time"
                          : isTranscribing
                            ? `Processing audio... ${transcriptionProgress}%`
                            : isSaving
                              ? "Saving your recording..."
                              : "Press the microphone to start recording"}
                      </p>
                    </div>

                    {/* Visualizer */}
                    <div className="flex items-center justify-center gap-0.5 h-24 mb-8">
                      {visualizerBars.map((height, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-1.5 rounded-full transition-all duration-100",
                            isRecording ? "bg-red-500" : "bg-muted"
                          )}
                          style={{ height: `${Math.max(4, height)}%` }}
                        />
                      ))}
                    </div>

                    {/* Recording Duration */}
                    {isRecording && (
                      <div className="mb-4 text-2xl font-mono font-bold">
                        {formatDuration(duration)}
                      </div>
                    )}

                    {/* Recording Controls */}
                    <div className="flex items-center gap-4">
                      {isRecording ? (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-12 w-12"
                            onClick={isPaused ? resumeRecording : pauseRecording}
                          >
                            {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                          </Button>
                          <button
                            onClick={handleStopRecording}
                            disabled={isTranscribing || isSaving}
                            className={cn(
                              "relative h-24 w-24 rounded-full flex items-center justify-center transition-all",
                              "bg-red-500 text-white scale-110 hover:bg-red-600"
                            )}
                          >
                            <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-25" />
                            <Square className="h-8 w-8" />
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-12 w-12 text-muted-foreground"
                            onClick={cancelRecording}
                          >
                            <MicOff className="h-5 w-5" />
                          </Button>
                        </>
                      ) : (
                        <button
                          onClick={handleStartRecording}
                          disabled={isTranscribing || isSaving}
                          className={cn(
                            "relative h-24 w-24 rounded-full flex items-center justify-center transition-all",
                            "bg-muted hover:bg-accent",
                            (isTranscribing || isSaving) && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {isTranscribing || isSaving ? (
                            <Loader2 className="h-10 w-10 animate-spin" />
                          ) : (
                            <Mic className="h-10 w-10" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Patience Message */}
                    {isRecording && !isPaused && (
                      <p className="text-sm text-muted-foreground mt-4">
                        Take your time - record for up to 30 minutes
                      </p>
                    )}

                    {/* Errors */}
                    {(recorderError || transcriptionError || saveError) && (
                      <div className="mt-4 p-3 rounded-lg bg-red-500/10 text-red-600 text-sm">
                        {recorderError || transcriptionError || saveError}
                      </div>
                    )}

                    {/* Recent Recording */}
                    {recentRecording && (
                      <div className="mt-8 w-full max-w-md">
                        <Card className="border-green-500/30 bg-green-500/5">
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <CardTitle className="text-sm">Recording Saved!</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm font-medium mb-2">{recentRecording.title}</p>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                              {recentRecording.transcription}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCreateProject(recentRecording)}
                              >
                                <FolderPlus className="h-4 w-4 mr-1" />
                                Create Project
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setActiveTab("library")}
                              >
                                View in Library
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Right Sidebar - Quick Commands or Transcription */}
            <div className="space-y-4">
              {/* Current Transcription */}
              {(currentTranscript || transcriptionResult) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Transcription
                    </CardTitle>
                    {transcriptionMethod && (
                      <Badge variant="outline" className="w-fit text-xs">
                        {transcriptionMethod === "whisper-local" ? "Whisper" : "Browser"}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {transcriptionResult?.text || currentTranscript}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Quick Commands */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Quick Ideas
                  </CardTitle>
                  <CardDescription>
                    Say something like...
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {quickCommands.slice(0, 4).map(cmd => (
                      <button
                        key={cmd.phrase}
                        className="flex items-center gap-2 p-2 w-full rounded-lg text-left hover:bg-accent/50 transition-colors"
                      >
                        <MessageSquare className="h-4 w-4 text-muted-foreground flex-none" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">&ldquo;{cmd.phrase}&rdquo;</p>
                          <p className="text-xs text-muted-foreground truncate">{cmd.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Tips */}
              <Card className="border-dashed">
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">
                    <strong>Pro tip:</strong> Recordings are automatically transcribed and saved.
                    You can create projects directly from your recordings or link them to existing projects.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Library Tab */}
        <TabsContent value="library" className="flex-1">
          {user?.id ? (
            <RecordingLibrary
              userId={user.id}
              onCreateProject={handleCreateProject}
              onLinkToProject={handleLinkToProject}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Please sign in to view your recordings.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
