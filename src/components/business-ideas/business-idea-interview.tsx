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
  Bot,
  User,
  Volume2,
  VolumeX,
  Loader2,
  Check,
  X,
  Lightbulb,
  ArrowLeft
} from "lucide-react"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis"

interface BusinessIdeaInterviewProps {
  initialDescription: string
  onComplete: (summary: BusinessIdeaSummary) => void
  onCancel: () => void
}

export interface BusinessIdeaSummary {
  title: string
  summary: string
  problemStatement: string
  targetAudience: string
  valueProposition: string
  revenueModel: string
  competitiveAdvantage: string
  keyRisks: string[]
  nextSteps: string[]
  potential: "low" | "medium" | "high" | "very-high"
  projectType: "business" | "dev" | "both" | null
  messages: Array<{ role: "assistant" | "user"; content: string; timestamp: string }>
}

interface InterviewMessage {
  id: string
  role: "assistant" | "user"
  content: string
  timestamp: string
  transcribedFrom?: "voice" | "text"
  skipped?: boolean
}

const INTERVIEW_SYSTEM_PROMPT = `You are an expert business strategist helping someone develop their business idea through a structured interview.

Your goal is to gather information to create a comprehensive executive summary. Ask questions one at a time, and adapt your follow-ups based on their answers.

Key areas to explore:
1. The core problem being solved
2. The proposed solution
3. Target audience/customers
4. Unique value proposition
5. Revenue model / monetization strategy
6. Competitive landscape
7. Key risks and challenges
8. Required resources and timeline
9. Whether this is a software/app idea or a business model/service

Be conversational but focused. After gathering enough information (typically 8-12 questions), indicate you're ready to generate their executive summary.

IMPORTANT: Keep responses concise (2-3 sentences max for questions). Be encouraging but ask probing questions.`

export function BusinessIdeaInterview({
  initialDescription,
  onComplete,
  onCancel
}: BusinessIdeaInterviewProps) {
  const [messages, setMessages] = useState<InterviewMessage[]>([])
  const [textInput, setTextInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [questionCount, setQuestionCount] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Voice state
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
        setPendingVoiceInput(prev => (prev + " " + transcript).trim())

        if (voiceSubmitTimeoutRef.current) {
          clearTimeout(voiceSubmitTimeoutRef.current)
        }

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

  const tts = useSpeechSynthesis({
    onEnd: () => {}
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

  // Start interview on mount
  useEffect(() => {
    startInterview()

    return () => {
      if (voiceSubmitTimeoutRef.current) {
        clearTimeout(voiceSubmitTimeoutRef.current)
      }
      stopAudioVisualization()
    }
  }, [stopAudioVisualization])

  // Speak new assistant messages
  useEffect(() => {
    if (autoSpeak && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === "assistant" && !tts.isSpeaking) {
        tts.speak(lastMessage.content)
      }
    }
  }, [messages, autoSpeak, tts])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const startInterview = async () => {
    setIsProcessing(true)

    const initialMessage: InterviewMessage = {
      id: generateId(),
      role: "assistant",
      content: `Great, I'd love to help you develop your business idea! You mentioned:\n\n"${initialDescription}"\n\nLet's explore this further. What specific problem are you trying to solve, and who experiences this problem most acutely?`,
      timestamp: new Date().toISOString()
    }

    setMessages([initialMessage])
    setQuestionCount(1)
    setIsProcessing(false)
  }

  const handleSubmit = async (content: string, source: "voice" | "text" = "text") => {
    if (!content.trim() || isProcessing) return

    tts.cancel()
    setIsProcessing(true)

    // Add user message
    const userMessage: InterviewMessage = {
      id: generateId(),
      role: "user",
      content: content.trim(),
      timestamp: new Date().toISOString(),
      transcribedFrom: source
    }

    setMessages(prev => [...prev, userMessage])
    setTextInput("")

    try {
      // Call API to get next question
      const response = await fetch("/api/business-ideas/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          initialDescription,
          questionCount: questionCount + 1
        })
      })

      if (!response.ok) {
        throw new Error("Failed to get response")
      }

      const data = await response.json()

      // Add assistant message
      const assistantMessage: InterviewMessage = {
        id: generateId(),
        role: "assistant",
        content: data.content,
        timestamp: new Date().toISOString()
      }

      setMessages(prev => [...prev, assistantMessage])
      setQuestionCount(prev => prev + 1)

      // Check if interview is complete
      if (data.isComplete) {
        setIsComplete(true)
      }
    } catch (error) {
      console.error("Interview error:", error)
      // Fallback response
      const fallbackMessage: InterviewMessage = {
        id: generateId(),
        role: "assistant",
        content: "Thank you for sharing that. Can you tell me more about your target audience and how they currently deal with this problem?",
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, fallbackMessage])
      setQuestionCount(prev => prev + 1)
    } finally {
      setIsProcessing(false)
    }
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
      tts.cancel()
      speech.startListening()
      startAudioVisualization()
    }
  }

  const handleSkip = async () => {
    tts.cancel()
    handleSubmit("skip this question", "text")
  }

  const handleFinish = async () => {
    tts.cancel()
    speech.stopListening()
    setIsComplete(true)
  }

  const handleGenerateSummary = async () => {
    setIsProcessing(true)

    try {
      const response = await fetch("/api/business-ideas/executive-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          initialDescription
        })
      })

      if (!response.ok) {
        throw new Error("Failed to generate summary")
      }

      const summary: BusinessIdeaSummary = await response.json()
      summary.messages = messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp
      }))

      onComplete(summary)
    } catch (error) {
      console.error("Summary generation error:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancel = () => {
    tts.cancel()
    speech.stopListening()
    onCancel()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <h2 className="font-semibold">Business Idea Interview</h2>
            <p className="text-sm text-muted-foreground">
              {isComplete ? "Interview complete" : `Question ${questionCount} - Voice or text`}
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
              message.role === "user" ? "bg-primary" : "bg-yellow-500/20"
            )}>
              {message.role === "user" ? (
                <User className="h-4 w-4 text-primary-foreground" />
              ) : (
                <Lightbulb className="h-4 w-4 text-yellow-500" />
              )}
            </div>
            <div className={cn(
              "max-w-[80%] rounded-2xl px-4 py-3",
              message.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            )}>
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              {message.transcribedFrom === "voice" && (
                <div className="flex items-center gap-1 mt-1 opacity-60">
                  <Mic className="h-3 w-3" />
                  <span className="text-xs">voice</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Processing indicator */}
        {isProcessing && !isComplete && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
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

        {/* Completion message */}
        {isComplete && (
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-500">
                <Check className="h-5 w-5" />
                <span className="font-medium">Interview Complete!</span>
              </div>
              <p className="text-sm text-muted-foreground">
                I have enough information to create your executive summary.
                Click the button below to generate it.
              </p>
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
                disabled={isProcessing}
              >
                <SkipForward className="h-4 w-4 mr-1" />
                Skip
              </Button>

              <div className="relative">
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
                disabled={isProcessing || messages.length < 5}
              >
                <Check className="h-4 w-4 mr-1" />
                Finish
              </Button>
            </div>

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

          {/* Text Input */}
          <form onSubmit={handleTextSubmit} className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Or type your response..."
              disabled={isProcessing}
              className="flex-1 h-10 rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!textInput.trim() || isProcessing}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      {/* Complete Actions */}
      {isComplete && (
        <div className="p-4 border-t">
          <Button
            className="w-full gap-2"
            onClick={handleGenerateSummary}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lightbulb className="h-4 w-4" />
            )}
            Generate Executive Summary
          </Button>
        </div>
      )}
    </div>
  )
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}
