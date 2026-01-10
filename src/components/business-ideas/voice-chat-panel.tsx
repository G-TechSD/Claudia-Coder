"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Mic,
  MicOff,
  Send,
  Bot,
  User,
  Volume2,
  VolumeX,
  Loader2,
  Phone,
  PhoneOff,
  MessageSquare,
  Lightbulb
} from "lucide-react"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis"
import type { BusinessIdea } from "@/lib/data/business-ideas"

interface VoiceChatPanelProps {
  idea: BusinessIdea
  onMessageSent?: (message: string, response: string) => void
  className?: string
}

interface ChatMessage {
  id: string
  role: "assistant" | "user"
  content: string
  timestamp: string
  transcribedFrom?: "voice" | "text"
}

/**
 * Voice Chat Panel for Business Ideas
 *
 * Provides a phone-call-like experience for discussing business ideas:
 * - Continuous voice conversation mode
 * - Auto-play responses
 * - Text fallback
 */
export function VoiceChatPanel({
  idea,
  onMessageSent,
  className
}: VoiceChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [textInput, setTextInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCallActive, setIsCallActive] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // DOUBLE-SUBMIT FIX: Track processing state synchronously and last submitted content
  const isProcessingRef = useRef(false)
  const lastSubmittedContentRef = useRef<string | null>(null)

  // Voice state
  const [pendingVoiceInput, setPendingVoiceInput] = useState("")
  const [audioLevel, setAudioLevel] = useState(0)
  const voiceSubmitTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isListeningRef = useRef(false)

  // Track if agent is speaking to prevent echo (mic picking up TTS)
  const isAgentSpeakingRef = useRef(false)

  const speech = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    onResult: (transcript, isFinal) => {
      // ECHO FIX: Ignore all input while agent is speaking
      // The microphone picks up the TTS audio, so we must discard it
      if (isAgentSpeakingRef.current) {
        console.log("[Voice] Ignoring transcript while agent is speaking:", transcript.substring(0, 50))
        return
      }

      if (isFinal && transcript.trim()) {
        setPendingVoiceInput(prev => (prev + " " + transcript).trim())

        if (voiceSubmitTimeoutRef.current) {
          clearTimeout(voiceSubmitTimeoutRef.current)
        }

        // Shorter timeout for call mode - more conversational
        voiceSubmitTimeoutRef.current = setTimeout(() => {
          setPendingVoiceInput(current => {
            if (current.trim()) {
              handleSubmit(current.trim(), "voice")
            }
            return ""
          })
          speech.resetTranscript()
        }, 2500)
      }
    }
  })

  const tts = useSpeechSynthesis({
    onStart: () => {
      // ECHO FIX: Mark agent as speaking when TTS starts
      isAgentSpeakingRef.current = true
      console.log("[Voice] Agent started speaking - ignoring mic input")
    },
    onEnd: () => {
      // ECHO FIX: Mark agent as done speaking when TTS ends
      // Add a small delay to ensure any trailing audio doesn't get picked up
      setTimeout(() => {
        isAgentSpeakingRef.current = false
        console.log("[Voice] Agent finished speaking - mic input enabled")

        // In call mode, automatically start listening after speaking
        if (isCallActive && !speech.isListening && !isProcessing) {
          startListening()
        }
      }, 300)
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

  const startListening = useCallback(() => {
    if (!speech.isSupported) return

    isListeningRef.current = true
    isAgentSpeakingRef.current = false // Reset speaking flag when user starts listening
    speech.startListening()
    startAudioVisualization()
  }, [speech, startAudioVisualization])

  const stopListening = useCallback(() => {
    isListeningRef.current = false
    speech.stopListening()
    stopAudioVisualization()
    setPendingVoiceInput("")

    if (voiceSubmitTimeoutRef.current) {
      clearTimeout(voiceSubmitTimeoutRef.current)
    }
  }, [speech, stopAudioVisualization])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening()
      tts.cancel()
    }
  }, [])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Speak new assistant messages
  useEffect(() => {
    if (autoSpeak && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === "assistant" && !tts.isSpeaking) {
        tts.speak(lastMessage.content)
      }
    }
  }, [messages, autoSpeak, tts])

  const handleSubmit = async (content: string, source: "voice" | "text" = "text") => {
    const normalizedContent = content.trim()

    // DOUBLE-SUBMIT FIX: Use synchronous ref check to prevent race conditions
    if (!normalizedContent || isProcessingRef.current) {
      console.log("[VoiceChat] Ignoring submit - empty or already processing")
      return
    }

    // DOUBLE-SUBMIT FIX: Check if this exact content was just submitted
    if (lastSubmittedContentRef.current === normalizedContent) {
      console.log("[VoiceChat] Ignoring duplicate submission:", normalizedContent.substring(0, 50))
      return
    }

    // DOUBLE-SUBMIT FIX: Check if this message already exists in history
    const lastUserMessage = messages.filter(m => m.role === "user").slice(-1)[0]
    if (lastUserMessage && lastUserMessage.content === normalizedContent) {
      console.log("[VoiceChat] Message already in history:", normalizedContent.substring(0, 50))
      return
    }

    // Set synchronous flags immediately to block concurrent calls
    isProcessingRef.current = true
    lastSubmittedContentRef.current = normalizedContent

    // Stop any ongoing TTS and reset speaking flag
    tts.cancel()
    isAgentSpeakingRef.current = false
    setIsProcessing(true)

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: normalizedContent,
      timestamp: new Date().toISOString(),
      transcribedFrom: source
    }

    setMessages(prev => [...prev, userMessage])
    setTextInput("")

    try {
      // Call the chat API
      const response = await fetch("/api/business-ideas/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          ideaContext: {
            title: idea.title,
            summary: idea.summary,
            problemStatement: idea.problemStatement,
            targetAudience: idea.targetAudience,
            valueProposition: idea.valueProposition,
            revenueModel: idea.revenueModel
          }
        })
      })

      if (!response.ok) {
        throw new Error("Failed to get response")
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let fullContent = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue

          const data = line.slice(6)
          if (data === "[DONE]") continue

          try {
            const parsed = JSON.parse(data)
            if (parsed.type === "content") {
              fullContent += parsed.content
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: fullContent || "I apologize, but I couldn't generate a response. Please try again.",
        timestamp: new Date().toISOString()
      }

      setMessages(prev => [...prev, assistantMessage])
      onMessageSent?.(content, fullContent)

    } catch (error) {
      console.error("Chat error:", error)

      // Add error message
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date().toISOString()
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      // Reset synchronous processing flag
      isProcessingRef.current = false
      setIsProcessing(false)
    }
  }

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSubmit(textInput, "text")
  }

  const startCall = () => {
    setIsCallActive(true)
    startListening()

    // Add welcome message
    const welcomeMessage: ChatMessage = {
      id: generateId(),
      role: "assistant",
      content: `Hi! I'm ready to discuss "${idea.title}" with you. What would you like to explore about this idea?`,
      timestamp: new Date().toISOString()
    }
    setMessages([welcomeMessage])
  }

  const endCall = () => {
    setIsCallActive(false)
    stopListening()
    tts.cancel()
  }

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-400" />
            Voice Chat
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
            {!isCallActive ? (
              <Button
                size="sm"
                variant="default"
                className="gap-2 bg-green-600 hover:bg-green-700"
                onClick={startCall}
              >
                <Phone className="h-4 w-4" />
                Start Call
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                className="gap-2"
                onClick={endCall}
              >
                <PhoneOff className="h-4 w-4" />
                End Call
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden min-h-[300px]">
        {/* Messages */}
        <div className="flex-1 overflow-auto space-y-3 mb-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Lightbulb className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm text-center">
                {isCallActive
                  ? "I'm listening... Ask me anything about your business idea!"
                  : "Start a voice call to discuss your idea hands-free"}
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2",
                    msg.role === "user" && "flex-row-reverse"
                  )}
                >
                  <div className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0",
                    msg.role === "user" ? "bg-primary" : "bg-muted"
                  )}>
                    {msg.role === "user" ? (
                      <User className="h-3.5 w-3.5 text-primary-foreground" />
                    ) : (
                      <Bot className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}>
                    <p className="text-sm">{msg.content}</p>
                    {msg.transcribedFrom === "voice" && (
                      <div className="flex items-center gap-1 mt-1 opacity-60">
                        <Mic className="h-2.5 w-2.5" />
                        <span className="text-xs">voice</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <div className="flex gap-2">
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="bg-muted rounded-xl px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}

          {/* Live transcript */}
          {speech.isListening && (pendingVoiceInput || speech.interimTranscript) && (
            <div className="flex gap-2 flex-row-reverse">
              <div className="h-7 w-7 rounded-full bg-primary/50 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <div className="max-w-[85%] rounded-xl px-3 py-2 bg-primary/50 text-primary-foreground">
                <p className="text-sm">
                  {pendingVoiceInput}
                  {speech.interimTranscript && (
                    <span className="opacity-60"> {speech.interimTranscript}</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Voice visualization when in call mode */}
        {isCallActive && speech.isListening && (
          <div className="flex items-center justify-center gap-2 py-2 border-t border-b mb-2">
            <div className="flex items-end gap-0.5 h-6">
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
            <span className="text-xs text-muted-foreground">Listening...</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={stopListening}
              className="h-6 px-2"
            >
              <MicOff className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Text Input */}
        <form onSubmit={handleTextSubmit} className="flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={isCallActive ? "Or type here..." : "Type a message..."}
            disabled={isProcessing}
            className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {!isCallActive && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={speech.isListening ? stopListening : startListening}
              disabled={!speech.isSupported}
              className={cn(
                "h-9 w-9",
                speech.isListening && "bg-red-500 text-white hover:bg-red-600"
              )}
            >
              {speech.isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            type="submit"
            size="icon"
            disabled={!textInput.trim() || isProcessing}
            className="h-9 w-9"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}
