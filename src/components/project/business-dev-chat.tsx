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
  Bot,
  User,
  Volume2,
  VolumeX,
  Loader2,
  Phone,
  PhoneOff,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Package,
  FileEdit,
  X
} from "lucide-react"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis"
import type { BusinessDevData, BusinessDevFeature, RevenueStream } from "./business-dev-section"

interface BusinessDevChatProps {
  projectId: string
  projectName: string
  projectDescription: string
  businessData: BusinessDevData | null
  onBusinessDataUpdate?: (data: BusinessDevData) => void
  onCreatePacket?: (packet: WorkPacketProposal) => void
  className?: string
}

interface ChatMessage {
  id: string
  role: "assistant" | "user"
  content: string
  timestamp: string
  transcribedFrom?: "voice" | "text"
  reportUpdate?: ReportUpdate
  workPacket?: WorkPacketProposal
}

interface ReportUpdate {
  updateType: "minor" | "major"
  changes: {
    executiveSummary?: string
    valueProposition?: string
    targetMarket?: string
    competitiveAdvantage?: string
    addFeatures?: Array<{ name: string; description: string; priority: string }>
    addRisks?: string[]
    addOpportunities?: string[]
    addRevenueStream?: {
      name: string
      description: string
      estimatedRevenue: string
      timeframe: string
      confidence: string
    }
  }
  reason: string
}

interface WorkPacketProposal {
  title: string
  description: string
  type: "feature" | "bugfix" | "research" | "docs" | "config"
  priority: "low" | "medium" | "high" | "critical"
  tasks: Array<{ description: string }>
  acceptanceCriteria: string[]
}

// Storage key for localStorage persistence
const CHAT_STORAGE_KEY = "claudia_business_dev_chat"

function getStorageKey(projectId: string): string {
  return `${CHAT_STORAGE_KEY}_${projectId}`
}

function loadMessagesFromStorage(projectId: string): ChatMessage[] {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(getStorageKey(projectId))
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch (err) {
    console.error("[BusinessDevChat] Failed to load messages:", err)
  }
  return []
}

function saveMessagesToStorage(projectId: string, messages: ChatMessage[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(getStorageKey(projectId), JSON.stringify(messages))
  } catch (err) {
    console.error("[BusinessDevChat] Failed to save messages:", err)
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

export function BusinessDevChat({
  projectId,
  projectName,
  projectDescription,
  businessData,
  onBusinessDataUpdate,
  onCreatePacket,
  className
}: BusinessDevChatProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessagesFromStorage(projectId))
  const [textInput, setTextInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCallActive, setIsCallActive] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Double-submit prevention
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
  const isAgentSpeakingRef = useRef(false)

  // Pending actions from chat
  const [pendingReportUpdate, setPendingReportUpdate] = useState<ReportUpdate | null>(null)
  const [pendingWorkPacket, setPendingWorkPacket] = useState<WorkPacketProposal | null>(null)

  const speech = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    onResult: (transcript, isFinal) => {
      if (isAgentSpeakingRef.current) return

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
        }, 2500)
      }
    }
  })

  const tts = useSpeechSynthesis({
    onStart: () => {
      isAgentSpeakingRef.current = true
    },
    onEnd: () => {
      setTimeout(() => {
        isAgentSpeakingRef.current = false
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
    isAgentSpeakingRef.current = false
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

  // Cleanup
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

  // Persist messages
  useEffect(() => {
    if (messages.length > 0) {
      saveMessagesToStorage(projectId, messages)
    }
  }, [messages, projectId])

  // Speak new assistant messages
  useEffect(() => {
    if (autoSpeak && messages.length > 0 && isExpanded) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === "assistant" && !tts.isSpeaking) {
        tts.speak(lastMessage.content)
      }
    }
  }, [messages, autoSpeak, tts, isExpanded])

  // Apply report update to business data
  const applyReportUpdate = (update: ReportUpdate) => {
    if (!businessData || !onBusinessDataUpdate) return

    const updatedData = { ...businessData }
    const changes = update.changes

    if (changes.executiveSummary) {
      updatedData.executiveSummary = changes.executiveSummary
    }
    if (changes.valueProposition) {
      updatedData.valueProposition = changes.valueProposition
    }
    if (changes.targetMarket) {
      updatedData.targetMarket = changes.targetMarket
    }
    if (changes.competitiveAdvantage) {
      updatedData.competitiveAdvantage = changes.competitiveAdvantage
    }
    if (changes.addFeatures) {
      const newFeatures: BusinessDevFeature[] = changes.addFeatures.map((f, i) => ({
        id: `feat-chat-${Date.now()}-${i}`,
        name: f.name,
        description: f.description,
        priority: f.priority as "high" | "medium" | "low",
        status: "planned" as const
      }))
      updatedData.features = [...updatedData.features, ...newFeatures]
    }
    if (changes.addRisks) {
      updatedData.risks = [...updatedData.risks, ...changes.addRisks]
    }
    if (changes.addOpportunities) {
      updatedData.opportunities = [...updatedData.opportunities, ...changes.addOpportunities]
    }
    if (changes.addRevenueStream) {
      const newStream: RevenueStream = {
        name: changes.addRevenueStream.name,
        description: changes.addRevenueStream.description,
        estimatedRevenue: changes.addRevenueStream.estimatedRevenue,
        timeframe: changes.addRevenueStream.timeframe,
        confidence: changes.addRevenueStream.confidence as "high" | "medium" | "low"
      }
      updatedData.revenueStreams = [...updatedData.revenueStreams, newStream]
    }

    onBusinessDataUpdate(updatedData)
    setPendingReportUpdate(null)
  }

  const handleSubmit = async (content: string, source: "voice" | "text" = "text") => {
    const normalizedContent = content.trim()

    if (!normalizedContent || isProcessingRef.current) return
    if (lastSubmittedContentRef.current === normalizedContent) return

    const lastUserMessage = messages.filter(m => m.role === "user").slice(-1)[0]
    if (lastUserMessage && lastUserMessage.content === normalizedContent) return

    isProcessingRef.current = true
    lastSubmittedContentRef.current = normalizedContent

    tts.cancel()
    isAgentSpeakingRef.current = false
    setIsProcessing(true)

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
      // Build context from business data
      const businessDevContext = businessData ? {
        projectName,
        projectDescription,
        executiveSummary: businessData.executiveSummary,
        valueProposition: businessData.valueProposition,
        targetMarket: businessData.targetMarket,
        competitiveAdvantage: businessData.competitiveAdvantage,
        features: businessData.features.map(f => ({
          name: f.name,
          description: f.description,
          priority: f.priority
        })),
        marketSegments: businessData.marketSegments,
        revenueStreams: businessData.revenueStreams.map(r => ({
          name: r.name,
          description: r.description,
          estimatedRevenue: r.estimatedRevenue
        })),
        proFormaSummary: businessData.proForma.summary,
        risks: businessData.risks,
        opportunities: businessData.opportunities
      } : {
        projectName,
        projectDescription
      }

      const response = await fetch("/api/business-dev/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          businessDevContext
        })
      })

      if (!response.ok) {
        throw new Error("Failed to get response")
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let fullContent = ""
      let reportUpdate: ReportUpdate | null = null
      let workPacket: WorkPacketProposal | null = null

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
            } else if (parsed.type === "content_replace") {
              fullContent = parsed.content
            } else if (parsed.type === "report_update") {
              reportUpdate = parsed.update
            } else if (parsed.type === "work_packet") {
              workPacket = parsed.packet
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
        timestamp: new Date().toISOString(),
        reportUpdate: reportUpdate || undefined,
        workPacket: workPacket || undefined
      }

      setMessages(prev => [...prev, assistantMessage])

      // Handle pending actions
      if (reportUpdate) {
        setPendingReportUpdate(reportUpdate)
      }
      if (workPacket) {
        setPendingWorkPacket(workPacket)
      }

    } catch (error) {
      console.error("Chat error:", error)

      const errorMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date().toISOString()
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
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
    setIsExpanded(true)
    startListening()

    if (messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: `Hey! I'm your business coach. I've been reviewing your plan for "${projectName}" and I'm excited to dig in with you. What's on your mind - any specific areas you want to strengthen or questions about your strategy?`,
        timestamp: new Date().toISOString()
      }
      setMessages([welcomeMessage])
    }
  }

  const endCall = () => {
    setIsCallActive(false)
    stopListening()
    tts.cancel()
  }

  const clearChat = () => {
    setMessages([])
    localStorage.removeItem(getStorageKey(projectId))
    setPendingReportUpdate(null)
    setPendingWorkPacket(null)
  }

  return (
    <Card className={cn("border-blue-500/20 overflow-hidden", className)}>
      {/* Collapsed Header */}
      <div
        className={cn(
          "flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors",
          isExpanded && "border-b"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-medium">Business Coach Chat</span>
          {messages.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {messages.length} messages
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isExpanded && !isCallActive && (
            <Button
              size="sm"
              variant="default"
              className="gap-1 bg-green-600 hover:bg-green-700 h-7 px-2"
              onClick={(e) => {
                e.stopPropagation()
                startCall()
              }}
            >
              <Phone className="h-3 w-3" />
              Start
            </Button>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <CardContent className="p-3 space-y-3">
          {/* Actions Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAutoSpeak(!autoSpeak)}
                className={cn("h-7 px-2", !autoSpeak && "text-muted-foreground")}
              >
                {autoSpeak ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
              </Button>
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearChat}
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            {!isCallActive ? (
              <Button
                size="sm"
                variant="default"
                className="gap-1 bg-green-600 hover:bg-green-700 h-7"
                onClick={startCall}
              >
                <Phone className="h-3 w-3" />
                Start Call
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                className="gap-1 h-7"
                onClick={endCall}
              >
                <PhoneOff className="h-3 w-3" />
                End Call
              </Button>
            )}
          </div>

          {/* Pending Actions */}
          {pendingReportUpdate && (
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-500">
                  <FileEdit className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {pendingReportUpdate.updateType === "major" ? "Major" : "Minor"} Report Update
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => setPendingReportUpdate(null)}
                  >
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 px-2 text-xs bg-amber-500 hover:bg-amber-600"
                    onClick={() => applyReportUpdate(pendingReportUpdate)}
                  >
                    Apply Update
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{pendingReportUpdate.reason}</p>
            </div>
          )}

          {pendingWorkPacket && (
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-500">
                  <Package className="h-4 w-4" />
                  <span className="text-sm font-medium">Create Work Packet</span>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => setPendingWorkPacket(null)}
                  >
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 px-2 text-xs bg-purple-500 hover:bg-purple-600"
                    onClick={() => {
                      onCreatePacket?.(pendingWorkPacket)
                      setPendingWorkPacket(null)
                    }}
                  >
                    Create Packet
                  </Button>
                </div>
              </div>
              <p className="text-xs font-medium">{pendingWorkPacket.title}</p>
              <p className="text-xs text-muted-foreground">{pendingWorkPacket.description}</p>
            </div>
          )}

          {/* Messages */}
          <div className="h-[200px] overflow-auto space-y-2">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Sparkles className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-xs text-center">
                  {isCallActive
                    ? "I'm listening... What would you like to discuss about your business plan?"
                    : "Start a call to chat with your business coach about strategy, planning, and next steps."}
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
                      "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
                      msg.role === "user" ? "bg-primary" : "bg-muted"
                    )}>
                      {msg.role === "user" ? (
                        <User className="h-3 w-3 text-primary-foreground" />
                      ) : (
                        <Bot className="h-3 w-3" />
                      )}
                    </div>
                    <div className={cn(
                      "max-w-[85%] rounded-lg px-2 py-1.5",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}>
                      <p className="text-xs">{msg.content}</p>
                      {msg.transcribedFrom === "voice" && (
                        <div className="flex items-center gap-1 mt-0.5 opacity-60">
                          <Mic className="h-2 w-2" />
                          <span className="text-[10px]">voice</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}

            {isProcessing && (
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                  <Bot className="h-3 w-3" />
                </div>
                <div className="bg-muted rounded-lg px-2 py-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                </div>
              </div>
            )}

            {/* Live transcript */}
            {speech.isListening && (pendingVoiceInput || speech.interimTranscript) && (
              <div className="flex gap-2 flex-row-reverse">
                <div className="h-6 w-6 rounded-full bg-primary/50 flex items-center justify-center">
                  <User className="h-3 w-3 text-primary-foreground" />
                </div>
                <div className="max-w-[85%] rounded-lg px-2 py-1.5 bg-primary/50 text-primary-foreground">
                  <p className="text-xs">
                    {pendingVoiceInput}
                    {speech.interimTranscript && (
                      <span className="opacity-60"> {speech.interimTranscript}</span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Voice visualization */}
          {isCallActive && speech.isListening && (
            <div className="flex items-center justify-center gap-2 py-1 border-t border-b">
              <div className="flex items-end gap-0.5 h-4">
                {[0.3, 0.5, 0.7, 1, 0.7, 0.5, 0.3].map((multiplier, i) => (
                  <div
                    key={i}
                    className="w-0.5 bg-red-500 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(3, audioLevel * 16 * multiplier)}px`,
                    }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">Listening...</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={stopListening}
                className="h-5 px-1"
              >
                <MicOff className="h-2.5 w-2.5" />
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
              className="flex-1 h-7 rounded-md border border-input bg-transparent px-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {!isCallActive && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={speech.isListening ? stopListening : startListening}
                disabled={!speech.isSupported}
                className={cn(
                  "h-7 w-7",
                  speech.isListening && "bg-red-500 text-white hover:bg-red-600"
                )}
              >
                {speech.isListening ? (
                  <MicOff className="h-3 w-3" />
                ) : (
                  <Mic className="h-3 w-3" />
                )}
              </Button>
            )}
            <Button
              type="submit"
              size="icon"
              disabled={!textInput.trim() || isProcessing}
              className="h-7 w-7"
            >
              <Send className="h-3 w-3" />
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  )
}
