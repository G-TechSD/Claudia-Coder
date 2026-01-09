"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Mic,
  MicOff,
  Send,
  SkipForward,
  ChevronDown,
  Bot,
  User,
  Volume2,
  VolumeX,
  Loader2,
  Check,
  X,
  Sparkles,
  MessageSquare
} from "lucide-react"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis"
import { useInterview } from "@/hooks/useInterview"
import type { InterviewSession, InterviewType, InterviewTargetType } from "@/lib/data/types"

interface InterviewPanelProps {
  type: InterviewType
  targetType?: InterviewTargetType
  targetId?: string
  targetTitle?: string
  targetContext?: Record<string, unknown>
  initialDescription?: string  // Pre-filled description from user input
  onComplete: (session: InterviewSession) => void
  onCancel: () => void
}

export function InterviewPanel({
  type,
  targetType,
  targetId,
  targetTitle,
  targetContext,
  initialDescription,
  onComplete,
  onCancel
}: InterviewPanelProps) {
  const [textInput, setTextInput] = useState("")
  const [autoSpeak, setAutoSpeak] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Interview hook - merge initialDescription into targetContext
  const interview = useInterview({
    type,
    targetType,
    targetId,
    targetTitle,
    targetContext: initialDescription
      ? { ...targetContext, initialDescription }
      : targetContext,
    onComplete,
    onCancel
  })

  // Speech hooks - track pending transcript for voice input
  const [pendingVoiceInput, setPendingVoiceInput] = useState("")
  const [audioLevel, setAudioLevel] = useState(0)
  const voiceSubmitTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isListeningRef = useRef(false)

  const speech = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    onResult: (transcript, isFinal) => {
      if (isFinal && transcript.trim()) {
        // Accumulate final transcripts
        setPendingVoiceInput(prev => (prev + " " + transcript).trim())

        // Clear any existing timeout
        if (voiceSubmitTimeoutRef.current) {
          clearTimeout(voiceSubmitTimeoutRef.current)
        }

        // Wait for a pause in speech before submitting (3.5 seconds)
        // Increased from 1.5s to give users time to think and pause naturally
        // without cutting them off mid-thought
        voiceSubmitTimeoutRef.current = setTimeout(() => {
          setPendingVoiceInput(current => {
            if (current.trim()) {
              handleSubmit(current.trim(), "voice")
            }
            return ""
          })
          speech.resetTranscript()
        }, 3500)
      }
    }
  })

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

  const tts = useSpeechSynthesis({
    onEnd: () => {
      // Could auto-start listening after speech ends
    }
  })

  // Start interview on mount and cleanup voice timeout
  useEffect(() => {
    interview.start()

    return () => {
      if (voiceSubmitTimeoutRef.current) {
        clearTimeout(voiceSubmitTimeoutRef.current)
      }
      stopAudioVisualization()
    }
  }, [stopAudioVisualization])

  // Speak new assistant messages
  useEffect(() => {
    if (autoSpeak && interview.currentQuestion && !tts.isSpeaking) {
      tts.speak(interview.currentQuestion)
    }
  }, [interview.currentQuestion, autoSpeak])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [interview.session?.messages])

  const handleSubmit = async (content: string, source: "voice" | "text" = "text") => {
    if (!content.trim() || interview.isProcessing) return

    // Stop any ongoing TTS
    tts.cancel()

    await interview.respond(content.trim(), source)
    setTextInput("")
  }

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSubmit(textInput, "text")
  }

  const toggleListening = () => {
    if (speech.isListening) {
      isListeningRef.current = false
      speech.stopListening()
      stopAudioVisualization()
    } else {
      isListeningRef.current = true
      tts.cancel() // Stop speaking before listening
      speech.startListening()
      startAudioVisualization()
    }
  }

  const handleSkip = async () => {
    tts.cancel()
    await interview.skip()
  }

  const handleFinish = async () => {
    tts.cancel()
    speech.stopListening()
    await interview.finish()
  }

  const handleCancel = () => {
    tts.cancel()
    speech.stopListening()
    interview.cancel()
  }

  const messages = interview.session?.messages || []
  const isComplete = interview.session?.status === "completed"

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">
              {type === "project_creation" ? "New Project Interview" : "Context Interview"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isComplete ? "Interview complete" : "Voice or text - your choice"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoSpeak(!autoSpeak)}
            className={cn(!autoSpeak && "text-muted-foreground")}
          >
            {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          {!isComplete && (
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3",
              message.role === "user" && "flex-row-reverse"
            )}
          >
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
              message.role === "user" ? "bg-primary" : "bg-muted"
            )}>
              {message.role === "user" ? (
                <User className="h-4 w-4 text-primary-foreground" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
            </div>
            <div className={cn(
              "max-w-[80%] rounded-2xl px-4 py-3",
              message.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            )}>
              <p className="text-sm">{message.content}</p>
              {message.transcribedFrom === "voice" && (
                <div className="flex items-center gap-1 mt-1 opacity-60">
                  <Mic className="h-3 w-3" />
                  <span className="text-xs">voice</span>
                </div>
              )}
              {message.skipped && (
                <Badge variant="outline" className="mt-1 text-xs">skipped</Badge>
              )}
            </div>
          </div>
        ))}

        {/* Processing indicator */}
        {interview.isProcessing && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-muted rounded-2xl px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}

        {/* Live transcript */}
        {speech.isListening && (pendingVoiceInput || speech.interimTranscript) && (
          <div className="flex gap-3 flex-row-reverse">
            <div className="h-8 w-8 rounded-full bg-primary/50 flex items-center justify-center">
              <User className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-primary/50 text-primary-foreground">
              <p className="text-sm">
                {pendingVoiceInput}
                {speech.interimTranscript && (
                  <span className="opacity-60"> {speech.interimTranscript}</span>
                )}
              </p>
              <div className="flex items-center gap-1 mt-1 opacity-60">
                <Mic className="h-3 w-3 animate-pulse" />
                <span className="text-xs">listening... (pause 3.5s to send)</span>
              </div>
            </div>
          </div>
        )}

        {/* Completion summary */}
        {isComplete && interview.session && (
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-400">
                <Check className="h-5 w-5" />
                <span className="font-medium">Interview Complete</span>
              </div>
              {interview.session.summary && (
                <p className="text-sm">{interview.session.summary}</p>
              )}
              {interview.session.keyPoints && interview.session.keyPoints.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase">Key Points</p>
                  <ul className="text-sm space-y-1">
                    {interview.session.keyPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-green-400">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {!isComplete && (
        <div className="p-4 border-t space-y-3">
          {/* Voice Control */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                disabled={interview.isProcessing}
              >
                <SkipForward className="h-4 w-4 mr-1" />
                Skip
              </Button>

              <div className="relative">
                {/* Audio level rings */}
                {speech.isListening && (
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
                  onClick={toggleListening}
                  disabled={!speech.isSupported}
                  className={cn(
                    "relative h-16 w-16 rounded-full flex items-center justify-center transition-all",
                    speech.isListening
                      ? "bg-red-500 text-white scale-110"
                      : "bg-muted hover:bg-accent"
                  )}
                >
                  {speech.isListening ? (
                    <MicOff className="h-6 w-6" />
                  ) : (
                    <Mic className="h-6 w-6" />
                  )}
                </button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleFinish}
                disabled={interview.isProcessing || messages.length < 3}
              >
                <Check className="h-4 w-4 mr-1" />
                Finish
              </Button>
            </div>

            {/* Audio Level Bars */}
            {speech.isListening && (
              <div className="flex items-end justify-center gap-1 h-6">
                {[0.3, 0.5, 0.7, 1, 0.7, 0.5, 0.3].map((multiplier, i) => (
                  <div
                    key={i}
                    className="w-1 bg-red-500 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(4, audioLevel * 24 * multiplier)}px`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {!speech.isSupported && (
            <p className="text-xs text-center text-muted-foreground">
              Voice not supported in this browser - use text input below
            </p>
          )}

          {speech.isListening && (
            <p className="text-xs text-center text-muted-foreground">
              Pause for 3.5s to auto-send, or click mic to stop
            </p>
          )}

          {/* Text Input */}
          <form onSubmit={handleTextSubmit} className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Or type your response..."
              disabled={interview.isProcessing}
              className="flex-1 h-10 rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!textInput.trim() || interview.isProcessing}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>

          {/* Quick Actions */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>Say</span>
            <Badge variant="outline" className="font-mono">"skip"</Badge>
            <span>to skip,</span>
            <Badge variant="outline" className="font-mono">"more"</Badge>
            <span>for depth,</span>
            <Badge variant="outline" className="font-mono">"done"</Badge>
            <span>to finish</span>
          </div>
        </div>
      )}

      {/* Complete Actions */}
      {isComplete && (
        <div className="p-4 border-t">
          <Button className="w-full" onClick={() => onComplete(interview.session!)}>
            Create Project
          </Button>
        </div>
      )}
    </div>
  )
}
