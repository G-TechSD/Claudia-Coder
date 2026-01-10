"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Mic,
  MicOff,
  Square,
  Trash2,
  AlertCircle,
  Brain,
  Loader2,
  Check,
  Send
} from "lucide-react"
import { cn } from "@/lib/utils"
import { uploadResource, updateBrainDump } from "@/lib/data/resources"
import { createBrainDumpFromRecording } from "@/lib/data/resources"
import type { TranscriptionData } from "@/lib/data/types"

interface AudioRecorderProps {
  projectId: string
  onRecordingComplete?: (resourceId: string, brainDumpId: string) => void
  onCancel?: () => void
  autoProcess?: boolean  // If true, automatically process after transcription
  className?: string
}

type ProcessingStatus = "idle" | "listening" | "saving" | "processing" | "complete" | "error"

// Type declarations for Web Speech API
type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: { resultIndex: number; results: { length: number; [index: number]: { isFinal: boolean; [index: number]: { transcript: string; confidence: number } } } }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

/**
 * Audio Recorder Component using Browser Speech Recognition
 *
 * Uses the same approach as voice chat - real-time transcription using
 * the browser's Web Speech API. No server/Docker/Whisper required!
 *
 * This replaces the previous MediaRecorder + Whisper approach.
 */
export function AudioRecorder({
  projectId,
  onRecordingComplete,
  onCancel,
  autoProcess = false,
  className
}: AudioRecorderProps) {
  const [status, setStatus] = useState<ProcessingStatus>("idle")
  const [statusMessage, setStatusMessage] = useState<string>("")
  const [processingError, setProcessingError] = useState<string | null>(null)

  // Speech recognition state
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [audioLevel, setAudioLevel] = useState(0)
  const [duration, setDuration] = useState(0)

  // Refs
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isListeningRef = useRef(false)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  // Check support and initialize speech recognition
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setIsSupported(!!SpeechRecognitionAPI)

    if (!SpeechRecognitionAPI) return

    const recognition = new SpeechRecognitionAPI() as SpeechRecognitionInstance
    recognitionRef.current = recognition

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onstart = () => {
      console.log("[BrainDump] Speech recognition started")
      setIsListening(true)
      isListeningRef.current = true
      setStatus("listening")
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let finalText = ""
      let interim = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript

        if (result.isFinal) {
          finalText += text
        } else {
          interim += text
        }
      }

      if (finalText) {
        console.log("[BrainDump] Final:", finalText)
        setTranscript(prev => (prev + " " + finalText).trim())
      }

      setInterimTranscript(interim)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.log("[BrainDump] Error:", event.error)

      if (event.error === "not-allowed") {
        setProcessingError("Microphone access denied. Please allow microphone access.")
        stopListening()
      } else if (event.error === "audio-capture") {
        setProcessingError("No microphone found")
        stopListening()
      }
      // "no-speech" is common and handled by auto-restart
    }

    recognition.onend = () => {
      console.log("[BrainDump] Ended, should restart:", isListeningRef.current)

      if (isListeningRef.current) {
        // Auto-restart for continuous listening
        setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start()
            } catch {
              // Already started
            }
          }
        }, 100)
      } else {
        setIsListening(false)
      }
    }

    return () => {
      stopListening()
      recognition.abort()
    }
  }, [])

  // Audio visualization
  const startAudioVisualization = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateLevel = () => {
        if (!isListeningRef.current) return

        analyser.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length
        setAudioLevel(average / 255)

        animationRef.current = requestAnimationFrame(updateLevel)
      }

      updateLevel()
    } catch (err) {
      console.error("[BrainDump] Audio visualization failed:", err)
    }
  }, [])

  const stopAudioVisualization = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setAudioLevel(0)
  }, [])

  const startDurationTimer = useCallback(() => {
    startTimeRef.current = Date.now()
    durationIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      setDuration(Math.floor(elapsed / 1000))
    }, 100)
  }, [])

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }
  }, [])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return

    setProcessingError(null)
    setTranscript("")
    setInterimTranscript("")
    setDuration(0)
    isListeningRef.current = true

    try {
      recognitionRef.current.start()
      startAudioVisualization()
      startDurationTimer()
    } catch (e) {
      console.error("[BrainDump] Start failed:", e)
    }
  }, [startAudioVisualization, startDurationTimer])

  const stopListening = useCallback(() => {
    isListeningRef.current = false
    setIsListening(false)
    setInterimTranscript("")
    stopAudioVisualization()
    stopDurationTimer()

    try {
      recognitionRef.current?.stop()
    } catch {
      // Ignore
    }
  }, [stopAudioVisualization, stopDurationTimer])

  const handleFinish = async () => {
    stopListening()

    const fullTranscript = transcript.trim()
    if (!fullTranscript) {
      setStatus("idle")
      return
    }

    setStatus("saving")
    setStatusMessage("Saving brain dump...")
    setProcessingError(null)

    try {
      // Create a text blob for the transcript (as resource)
      const filename = `brain-dump-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`
      const textBlob = new Blob([fullTranscript], { type: "text/plain" })
      const file = new File([textBlob], filename, { type: "text/plain" })

      // Upload as a resource
      const resource = await uploadResource(projectId, file, "Brain dump transcript")

      // Create a brain dump entry with the transcription already done
      const brainDump = createBrainDumpFromRecording(projectId, resource.id)

      const transcriptionData: TranscriptionData = {
        text: fullTranscript,
        method: "browser-speech",
        duration: duration,
        wordCount: fullTranscript.split(/\s+/).filter(Boolean).length,
        transcribedAt: new Date().toISOString()
      }

      // Update brain dump with transcription
      updateBrainDump(brainDump.id, {
        transcription: transcriptionData,
        status: autoProcess ? "processing" : "review"
      })

      // If auto-processing enabled, process the transcript
      if (autoProcess) {
        setStatus("processing")
        setStatusMessage("Processing with AI...")

        try {
          await processTranscript(brainDump.id, fullTranscript)
        } catch (processErr) {
          console.error("Auto-processing failed:", processErr)
          // Continue anyway - transcription succeeded
        }
      }

      setStatus("complete")
      setStatusMessage("Complete!")
      onRecordingComplete?.(resource.id, brainDump.id)

    } catch (err) {
      console.error("Failed to save brain dump:", err)
      setStatus("error")
      setProcessingError(err instanceof Error ? err.message : "Failed to save brain dump")
    }
  }

  /**
   * Process transcript using the brain dump processing API
   */
  async function processTranscript(brainDumpId: string, transcriptText: string): Promise<void> {
    const response = await fetch("/api/brain-dump/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: transcriptText })
    })

    const data = await response.json()

    if (data.success && data.processedContent) {
      updateBrainDump(brainDumpId, {
        processedContent: data.processedContent,
        status: "review"
      })
    }
  }

  const handleCancel = () => {
    stopListening()
    setTranscript("")
    setInterimTranscript("")
    setDuration(0)
    setStatus("idle")
    onCancel?.()
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const isProcessing = status === "saving" || status === "processing"
  const hasTranscript = transcript.trim().length > 0

  if (!isSupported) {
    return (
      <Card className={cn("bg-red-500/10 border-red-500/30", className)}>
        <CardContent className="p-6 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <div>
            <p className="font-medium">Speech Recognition Not Supported</p>
            <p className="text-sm text-muted-foreground">
              Your browser doesn't support speech recognition. Try Chrome, Edge, or Safari.
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
          Speak freely - your words appear as you talk. No server setup needed!
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Error message */}
        {processingError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-red-500" />
            {processingError}
          </div>
        )}

        {/* Processing status */}
        {isProcessing && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="font-medium text-sm">{statusMessage}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {status === "saving" && "Saving your brain dump..."}
                  {status === "processing" && "Analyzing and structuring content with AI..."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Microphone button and visualization */}
        <div className="flex flex-col items-center py-6">
          <div className="relative">
            {/* Audio level rings */}
            {isListening && (
              <>
                <div
                  className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"
                  style={{ animationDuration: "1.5s" }}
                />
                <div
                  className="absolute rounded-full bg-red-500/30 transition-all duration-100"
                  style={{
                    inset: `-${Math.max(4, audioLevel * 24)}px`,
                  }}
                />
                <div
                  className="absolute rounded-full bg-red-500/20 transition-all duration-100"
                  style={{
                    inset: `-${Math.max(8, audioLevel * 40)}px`,
                  }}
                />
              </>
            )}

            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isProcessing}
              className={cn(
                "relative w-24 h-24 rounded-full flex items-center justify-center transition-all",
                "focus:outline-none focus:ring-4 focus:ring-primary/30",
                isListening
                  ? "bg-red-500 hover:bg-red-600 scale-110"
                  : "bg-primary hover:bg-primary/90",
                isProcessing && "opacity-50 cursor-not-allowed"
              )}
            >
              {isListening ? (
                <MicOff className="h-10 w-10 text-white" />
              ) : (
                <Mic className="h-10 w-10 text-white" />
              )}
            </button>
          </div>

          {/* Status */}
          <div className="mt-4 text-center">
            {isListening ? (
              <>
                <Badge variant="destructive" className="mb-2">
                  Listening
                </Badge>
                <p className="text-3xl font-mono font-bold">
                  {formatDuration(duration)}
                </p>
              </>
            ) : status === "complete" ? (
              <div className="flex items-center gap-2 text-green-500">
                <Check className="h-5 w-5" />
                <span className="font-medium">Complete!</span>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Click to start speaking
              </p>
            )}
          </div>
        </div>

        {/* Audio level visualization */}
        {isListening && (
          <div className="flex items-center justify-center gap-1 h-8">
            {[0.3, 0.5, 0.7, 1, 0.7, 0.5, 0.3].map((multiplier, i) => (
              <div
                key={i}
                className="w-1.5 bg-red-500 rounded-full transition-all duration-75"
                style={{
                  height: `${Math.max(4, audioLevel * 32 * multiplier)}px`,
                }}
              />
            ))}
          </div>
        )}

        {/* Live transcript */}
        {(isListening || hasTranscript) && (
          <div className="p-4 bg-muted/50 rounded-lg min-h-[120px] max-h-[300px] overflow-y-auto">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <span>Transcript</span>
              {isListening && (
                <Badge variant="outline" className="text-xs animate-pulse">
                  Live
                </Badge>
              )}
            </p>
            <p className="text-sm whitespace-pre-wrap">
              {transcript}
              {interimTranscript && (
                <span className="text-muted-foreground italic">
                  {transcript ? " " : ""}{interimTranscript}
                </span>
              )}
              {!transcript && !interimTranscript && isListening && (
                <span className="text-muted-foreground italic">
                  Start speaking...
                </span>
              )}
            </p>
          </div>
        )}

        {/* Tips */}
        {!isListening && !hasTranscript && status === "idle" && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-2">Tips for a great brain dump:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>- Speak naturally - your words appear in real-time</li>
              <li>- Take pauses when you need to think</li>
              <li>- Mention project names, features, or technical details</li>
              <li>- Works offline - uses your browser's speech recognition</li>
            </ul>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {isListening ? (
            <>
              <Button
                variant="default"
                onClick={handleFinish}
                disabled={!hasTranscript}
                className="flex-1"
              >
                <Send className="h-4 w-4 mr-2" />
                Finish & Save
              </Button>
              <Button
                variant="ghost"
                onClick={handleCancel}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Discard
              </Button>
            </>
          ) : hasTranscript && status !== "complete" ? (
            <>
              <Button
                variant="default"
                onClick={handleFinish}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {statusMessage}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Save Brain Dump
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={startListening}
                disabled={isProcessing}
              >
                <Mic className="h-4 w-4 mr-2" />
                Continue
              </Button>
              <Button
                variant="ghost"
                onClick={handleCancel}
                disabled={isProcessing}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : status === "complete" ? (
            <Button
              variant="default"
              onClick={onCancel}
              className="w-full"
            >
              Done
            </Button>
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
