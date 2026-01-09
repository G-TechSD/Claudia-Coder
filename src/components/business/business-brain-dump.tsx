"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Mic,
  Square,
  Pause,
  Play,
  Brain,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  History,
  ChevronDown,
  ChevronUp,
  Trash2,
  RefreshCw
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAudioRecorder, formatDuration } from "@/hooks/useAudioRecorder"
import {
  uploadResource,
  createBrainDump,
  getBrainDumpsForProject,
  getBrainDump,
  updateBrainDump,
  getResourceBlobUrl
} from "@/lib/data/resources"
// Types for Business Brain Dump
export interface BusinessBrainDumpEntry {
  id: string
  projectId: string
  createdAt: string
  updatedAt: string
  inputType: "voice" | "text"

  // Voice recording
  resourceId?: string
  audioDuration?: number

  // Text input
  textContent?: string

  // Transcription
  transcription?: {
    text: string
    method: string
    transcribedAt: string
  }

  // Processing
  status: "recording" | "transcribing" | "processing" | "completed" | "error"
  processingProgress?: number
  processingStage?: string

  // Generated business dev
  generatedBusinessDevId?: string
  error?: string
}

interface BusinessBrainDumpProps {
  projectId: string
  projectName: string
  projectDescription: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onBusinessDevGenerated?: (businessDev: any) => void
  className?: string
}

const STORAGE_KEY = "claudia_business_brain_dumps"

// Storage helpers
function getStoredEntries(): BusinessBrainDumpEntry[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

function saveEntries(entries: BusinessBrainDumpEntry[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

function getEntriesForProject(projectId: string): BusinessBrainDumpEntry[] {
  return getStoredEntries()
    .filter(e => e.projectId === projectId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

function createEntry(data: Omit<BusinessBrainDumpEntry, "id" | "createdAt" | "updatedAt">): BusinessBrainDumpEntry {
  const entries = getStoredEntries()
  const now = new Date().toISOString()

  const entry: BusinessBrainDumpEntry = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  }

  entries.push(entry)
  saveEntries(entries)
  return entry
}

function updateEntry(id: string, updates: Partial<BusinessBrainDumpEntry>): BusinessBrainDumpEntry | null {
  const entries = getStoredEntries()
  const index = entries.findIndex(e => e.id === id)

  if (index === -1) return null

  entries[index] = {
    ...entries[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  saveEntries(entries)
  return entries[index]
}

function deleteEntry(id: string): boolean {
  const entries = getStoredEntries()
  const filtered = entries.filter(e => e.id !== id)
  if (filtered.length === entries.length) return false
  saveEntries(filtered)
  return true
}

export function BusinessBrainDump({
  projectId,
  projectName,
  projectDescription,
  onBusinessDevGenerated,
  className
}: BusinessBrainDumpProps) {
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice")
  const [textInput, setTextInput] = useState("")
  const [currentEntry, setCurrentEntry] = useState<BusinessBrainDumpEntry | null>(null)
  const [entries, setEntries] = useState<BusinessBrainDumpEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<BusinessBrainDumpEntry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingStage, setProcessingStage] = useState("")
  const [transcription, setTranscription] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)

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

  // Load entries on mount
  useEffect(() => {
    setEntries(getEntriesForProject(projectId))
  }, [projectId])

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  // Audio level visualization bars
  const bars = Array.from({ length: 12 }, (_, i) => {
    const threshold = (i + 1) / 12
    return audioLevel > threshold * 0.8
  })

  // Handle stopping recording and saving
  const handleStopRecording = async () => {
    const blob = await stopRecording()
    if (!blob) return

    setError(null)
    setProcessingStage("Saving recording...")
    setProcessingProgress(10)

    try {
      // Create a file from the blob
      const filename = `business-brain-dump-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`
      const file = new File([blob], filename, { type: "audio/webm" })

      // Upload as a resource (NOTHING GETS LOST - audio is preserved)
      const resource = await uploadResource(projectId, file, "Business brain dump recording")

      // Create entry
      const entry = createEntry({
        projectId,
        inputType: "voice",
        resourceId: resource.id,
        audioDuration: duration,
        status: "transcribing"
      })

      setCurrentEntry(entry)
      setEntries(getEntriesForProject(projectId))

      // Start transcription
      setProcessingStage("Transcribing audio...")
      setProcessingProgress(30)

      await transcribeAndProcess(entry, blob)

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save recording")
      setIsProcessing(false)
    }
  }

  // Handle text submission
  const handleTextSubmit = async () => {
    if (!textInput.trim()) return

    setError(null)
    setIsProcessing(true)
    setProcessingStage("Processing text input...")
    setProcessingProgress(20)

    try {
      // Create entry with text (NOTHING GETS LOST - text is preserved)
      const entry = createEntry({
        projectId,
        inputType: "text",
        textContent: textInput,
        status: "processing"
      })

      setCurrentEntry(entry)
      setEntries(getEntriesForProject(projectId))
      setTranscription(textInput)

      // Process directly
      await processIntoBusiness(entry, textInput)

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process text")
      setIsProcessing(false)
    }
  }

  // Transcribe and process audio
  const transcribeAndProcess = async (entry: BusinessBrainDumpEntry, audioBlob: Blob) => {
    setIsProcessing(true)

    try {
      // Send for transcription
      const formData = new FormData()
      formData.append("file", audioBlob, "recording.webm")

      const transcribeResponse = await fetch("/api/transcribe", {
        method: "POST",
        body: formData
      })

      const transcribeData = await transcribeResponse.json()

      if (transcribeData.useBrowserFallback) {
        setError("No transcription service available. Please use text input instead.")
        updateEntry(entry.id, { status: "error", error: "No transcription service" })
        setIsProcessing(false)
        return
      }

      if (transcribeData.error && !transcribeData.transcription) {
        throw new Error(transcribeData.error)
      }

      const transcriptText = transcribeData.transcription?.text || ""

      // Save transcription (NOTHING GETS LOST)
      updateEntry(entry.id, {
        transcription: {
          text: transcriptText,
          method: transcribeData.transcription?.method || "unknown",
          transcribedAt: new Date().toISOString()
        },
        status: "processing"
      })

      setTranscription(transcriptText)
      setProcessingProgress(50)
      setProcessingStage("Generating business analysis...")

      // Now process into business dev
      await processIntoBusiness(entry, transcriptText)

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Transcription failed"
      setError(errorMsg)
      updateEntry(entry.id, { status: "error", error: errorMsg })
      setIsProcessing(false)
    }
  }

  // Process transcription into business development
  const processIntoBusiness = async (entry: BusinessBrainDumpEntry, content: string) => {
    setProcessingStage("Analyzing business potential...")
    setProcessingProgress(60)

    try {
      const response = await fetch("/api/business-dev/brain-dump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName,
          projectDescription,
          brainDumpContent: content,
          brainDumpEntryId: entry.id
        })
      })

      setProcessingProgress(80)
      setProcessingStage("Finalizing business analysis...")

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      if (data.businessDev) {
        // Update entry with link to generated business dev (NOTHING GETS LOST)
        updateEntry(entry.id, {
          status: "completed",
          generatedBusinessDevId: data.businessDev.id
        })

        setProcessingProgress(100)
        setProcessingStage("Complete!")

        // Notify parent
        onBusinessDevGenerated?.(data.businessDev)

        // Reset after short delay
        setTimeout(() => {
          setCurrentEntry(null)
          setTranscription(null)
          setTextInput("")
          setIsProcessing(false)
          setProcessingProgress(0)
          setProcessingStage("")
          setEntries(getEntriesForProject(projectId))
        }, 1500)
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Processing failed"
      setError(errorMsg)
      updateEntry(entry.id, { status: "error", error: errorMsg })
      setIsProcessing(false)
    }
  }

  // Cancel recording
  const handleCancel = () => {
    cancelRecording()
    setCurrentEntry(null)
    setTranscription(null)
    setError(null)
  }

  // Load audio for history entry
  const loadAudioForEntry = async (entry: BusinessBrainDumpEntry) => {
    if (!entry.resourceId) return

    try {
      const resource = await import("@/lib/data/resources").then(m => m.getResource(entry.resourceId!))
      if (resource?.storage === "indexeddb" && resource.indexedDbKey) {
        const url = await getResourceBlobUrl(resource.indexedDbKey)
        if (url) {
          if (audioUrl) URL.revokeObjectURL(audioUrl)
          setAudioUrl(url)
        }
      }
    } catch (err) {
      console.error("Failed to load audio:", err)
    }
  }

  // Select history entry
  const handleSelectHistoryEntry = async (entry: BusinessBrainDumpEntry) => {
    setSelectedHistoryEntry(entry)
    if (entry.inputType === "voice") {
      await loadAudioForEntry(entry)
    }
  }

  // Reprocess a history entry
  const handleReprocess = async (entry: BusinessBrainDumpEntry) => {
    const content = entry.transcription?.text || entry.textContent
    if (!content) return

    setSelectedHistoryEntry(null)
    setCurrentEntry(entry)
    setTranscription(content)
    setIsProcessing(true)
    setProcessingProgress(50)

    updateEntry(entry.id, { status: "processing" })
    await processIntoBusiness(entry, content)
  }

  // Delete history entry
  const handleDeleteEntry = (entryId: string) => {
    deleteEntry(entryId)
    setEntries(getEntriesForProject(projectId))
    if (selectedHistoryEntry?.id === entryId) {
      setSelectedHistoryEntry(null)
    }
  }

  // Toggle audio playback
  const toggleAudioPlayback = () => {
    if (!audioRef.current) return

    if (isPlayingAudio) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlayingAudio(!isPlayingAudio)
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              Business Brain Dump
            </CardTitle>
            <CardDescription>
              Record your business ideas freely. We'll transform them into a structured analysis.
            </CardDescription>
          </div>

          {entries.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="gap-1"
            >
              <History className="h-4 w-4" />
              History ({entries.length})
              {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Error display */}
        {(error || recorderError) && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="h-4 w-4" />
            {error || recorderError}
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
              Dismiss
            </Button>
          </div>
        )}

        {/* History Section */}
        {showHistory && entries.length > 0 && (
          <div className="border rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium">Previous Brain Dumps</h4>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
                      selectedHistoryEntry?.id === entry.id && "border-purple-500 bg-purple-500/5"
                    )}
                    onClick={() => handleSelectHistoryEntry(entry)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {entry.inputType === "voice" ? (
                          <Mic className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            entry.status === "completed" && "text-green-500 border-green-500/30",
                            entry.status === "error" && "text-red-500 border-red-500/30"
                          )}
                        >
                          {entry.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {entry.status === "completed" && entry.generatedBusinessDevId && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteEntry(entry.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {selectedHistoryEntry?.id === entry.id && (
                      <div className="mt-3 pt-3 border-t space-y-3">
                        {entry.transcription?.text && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Transcription:</p>
                            <p className="text-sm line-clamp-3">{entry.transcription.text}</p>
                          </div>
                        )}
                        {entry.textContent && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Input:</p>
                            <p className="text-sm line-clamp-3">{entry.textContent}</p>
                          </div>
                        )}

                        {entry.inputType === "voice" && audioUrl && (
                          <div className="flex items-center gap-2">
                            <audio
                              ref={audioRef}
                              src={audioUrl}
                              onEnded={() => setIsPlayingAudio(false)}
                              className="hidden"
                            />
                            <Button variant="outline" size="sm" onClick={toggleAudioPlayback}>
                              {isPlayingAudio ? (
                                <><Pause className="h-4 w-4 mr-1" /> Pause</>
                              ) : (
                                <><Play className="h-4 w-4 mr-1" /> Play</>
                              )}
                            </Button>
                          </div>
                        )}

                        {(entry.status === "completed" || entry.status === "error") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReprocess(entry)}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Reprocess
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-purple-500" />
            <div className="space-y-2">
              <p className="text-sm font-medium">{processingStage}</p>
              <Progress value={processingProgress} className="w-full max-w-xs mx-auto" />
            </div>

            {transcription && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg max-w-lg mx-auto">
                <p className="text-xs text-muted-foreground mb-2">Transcription:</p>
                <p className="text-sm line-clamp-4">{transcription}</p>
              </div>
            )}
          </div>
        )}

        {/* Input Interface */}
        {!isProcessing && !currentEntry && (
          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "voice" | "text")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="voice" className="gap-2">
                <Mic className="h-4 w-4" />
                Voice Recording
              </TabsTrigger>
              <TabsTrigger value="text" className="gap-2">
                <FileText className="h-4 w-4" />
                Text Input
              </TabsTrigger>
            </TabsList>

            <TabsContent value="voice" className="space-y-6 pt-4">
              {!isSupported ? (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-600">
                  Voice recording is not supported in your browser. Please use text input instead.
                </div>
              ) : (
                <>
                  {/* Recording Interface */}
                  <div className="flex flex-col items-center py-8">
                    <button
                      onClick={isRecording ? (isPaused ? resumeRecording : pauseRecording) : startRecording}
                      className={cn(
                        "relative w-24 h-24 rounded-full flex items-center justify-center transition-all",
                        "focus:outline-none focus:ring-4 focus:ring-purple-500/30",
                        isRecording
                          ? isPaused
                            ? "bg-yellow-500 hover:bg-yellow-600"
                            : "bg-red-500 hover:bg-red-600"
                          : "bg-purple-500 hover:bg-purple-600"
                      )}
                    >
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
                          Click to start recording your business ideas
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Audio Level Visualization */}
                  {isRecording && !isPaused && (
                    <div className="flex items-center justify-center gap-1 h-12">
                      {bars.map((isActive, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-2 rounded-full transition-all duration-75",
                            isActive ? "bg-purple-500" : "bg-muted"
                          )}
                          style={{
                            height: isActive ? `${20 + Math.random() * 28}px` : "8px"
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Recording Actions */}
                  {isRecording && (
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="default"
                        onClick={handleStopRecording}
                        className="gap-2"
                      >
                        <Square className="h-4 w-4" />
                        Stop & Process
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={handleCancel}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Discard
                      </Button>
                    </div>
                  )}

                  {/* Tips */}
                  {!isRecording && (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium mb-2">Tips for a great business brain dump:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>* Describe your product vision and target customers</li>
                        <li>* Mention potential revenue streams and pricing ideas</li>
                        <li>* Talk about competitors and what makes you different</li>
                        <li>* Share your concerns, risks, and opportunities</li>
                        <li>* Don't worry about structure - just speak freely</li>
                      </ul>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="text" className="space-y-4 pt-4">
              <Textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type your business ideas here...

For example:
- What problem does your product solve?
- Who are your target customers?
- How will you make money?
- What makes you different from competitors?
- What are the biggest risks and opportunities?"
                className="min-h-[250px]"
              />

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {textInput.length} characters
                </p>
                <Button
                  onClick={handleTextSubmit}
                  disabled={!textInput.trim()}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Process into Business Analysis
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
