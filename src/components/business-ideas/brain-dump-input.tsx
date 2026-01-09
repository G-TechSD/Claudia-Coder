"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Mic,
  MicOff,
  Send,
  Lightbulb,
  Sparkles,
  MessageSquare,
  FileText,
  Loader2,
  X
} from "lucide-react"

interface BrainDumpInputProps {
  onStartInterview: (initialContent: string) => void
  onGenerateSummary: (content: string) => void
  isGenerating?: boolean
  className?: string
}

/**
 * Brain Dump Input Component
 *
 * A prominent input area for capturing business ideas freely through:
 * - Text input with large text area
 * - Voice recording with transcription
 * - Direct submission to interview or executive summary generation
 */
export function BrainDumpInput({
  onStartInterview,
  onGenerateSummary,
  isGenerating = false,
  className
}: BrainDumpInputProps) {
  const [content, setContent] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [pendingText, setPendingText] = useState("")
  const [interimText, setInterimText] = useState("")

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isListeningRef = useRef(false)

  // Check support and initialize
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
      setIsListening(true)
      isListeningRef.current = true
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
        setPendingText(prev => (prev + " " + finalText).trim())
        // Automatically append to content
        setContent(prev => (prev + " " + finalText).trim())
      }

      setInterimText(interim)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "audio-capture") {
        stopListening()
      }
    }

    recognition.onend = () => {
      if (isListeningRef.current) {
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
      console.error("[Voice] Audio visualization failed:", err)
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

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return

    setPendingText("")
    setInterimText("")
    isListeningRef.current = true

    try {
      recognitionRef.current.start()
      startAudioVisualization()
    } catch {
      // Handle error
    }
  }, [startAudioVisualization])

  const stopListening = useCallback(() => {
    isListeningRef.current = false
    setIsListening(false)
    setInterimText("")
    setPendingText("")
    stopAudioVisualization()

    try {
      recognitionRef.current?.stop()
    } catch {
      // Ignore
    }
  }, [stopAudioVisualization])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  const handleClear = () => {
    setContent("")
    setPendingText("")
    setInterimText("")
  }

  const hasContent = content.trim().length > 0

  return (
    <Card className={cn("border-2 border-dashed border-yellow-500/30 bg-yellow-500/5", className)}>
      <CardContent className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <Lightbulb className="h-6 w-6 text-yellow-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">Dump Your Thoughts</h2>
            <p className="text-sm text-muted-foreground">
              Type or speak freely - capture your business idea in any form
            </p>
          </div>
          {hasContent && (
            <Button variant="ghost" size="icon" onClick={handleClear}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Input Area */}
        <div className="relative">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's your business idea? Describe it in any way that feels natural - stream of consciousness, bullet points, or structured thoughts. There's no wrong way to start..."
            className="min-h-[200px] text-base resize-none pr-16"
            disabled={isGenerating}
          />

          {/* Live transcription indicator */}
          {isListening && interimText && (
            <div className="absolute bottom-2 left-2 right-16 text-sm text-muted-foreground italic truncate">
              {interimText}
            </div>
          )}

          {/* Voice Button */}
          {isSupported && (
            <div className="absolute right-2 top-2">
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
                        inset: `-${Math.max(4, audioLevel * 20)}px`,
                      }}
                    />
                  </>
                )}
                <Button
                  type="button"
                  variant={isListening ? "destructive" : "outline"}
                  size="icon"
                  onClick={toggleListening}
                  disabled={isGenerating}
                  className={cn(
                    "relative transition-all",
                    isListening && "scale-110"
                  )}
                >
                  {isListening ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Listening Status */}
        {isListening && (
          <div className="flex items-center justify-center gap-2">
            <div className="flex items-end gap-0.5 h-4">
              {[0.3, 0.5, 0.7, 1, 0.7, 0.5, 0.3].map((multiplier, i) => (
                <div
                  key={i}
                  className="w-0.5 bg-red-500 rounded-full transition-all duration-75"
                  style={{
                    height: `${Math.max(4, audioLevel * 16 * multiplier)}px`,
                  }}
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              Listening... Click mic to stop
            </span>
          </div>
        )}

        {/* Character count and tips */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{content.length} characters</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Tips: Problem, Solution, Audience, Revenue
            </Badge>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            size="lg"
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => onStartInterview(content)}
            disabled={!hasContent || isGenerating}
          >
            <MessageSquare className="h-5 w-5" />
            Explore with Interview
            <Badge variant="secondary" className="ml-1">10-15 questions</Badge>
          </Button>
          <Button
            size="lg"
            className="flex-1 gap-2"
            onClick={() => onGenerateSummary(content)}
            disabled={!hasContent || isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FileText className="h-5 w-5" />
            )}
            Generate Executive Summary
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          <strong>Interview</strong> asks questions to develop your idea further{" "}
          <span className="text-muted-foreground/50">|</span>{" "}
          <strong>Summary</strong> creates a structured business document instantly
        </p>
      </CardContent>
    </Card>
  )
}

// Type declarations for Web Speech API
type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: { resultIndex: number; results: { length: number; [index: number]: { isFinal: boolean; [index: number]: { transcript: string } } } }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}
