"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  Mic,
  MicOff,
  Send,
  Bot,
  User,
  Loader2,
  X,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Volume2,
  VolumeX
} from "lucide-react"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis"
import { getProjects } from "@/lib/data/projects"
import type { Project } from "@/lib/data/types"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  source?: "voice" | "text"
}

interface VoiceControlPanelProps {
  className?: string
  onClose?: () => void
}

export function VoiceControlPanel({ className, onClose }: VoiceControlPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [textInput, setTextInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true)

  // Project selection
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [showProjectPicker, setShowProjectPicker] = useState(false)

  // Audio visualization
  const [audioLevel, setAudioLevel] = useState(0)
  const [pendingVoiceInput, setPendingVoiceInput] = useState("")
  const voiceSubmitTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isListeningRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load projects on mount
  useEffect(() => {
    setProjects(getProjects())
  }, [])

  // Speech recognition
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
        }, 2000)
      }
    }
  })

  // Text-to-speech
  const tts = useSpeechSynthesis()

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

  // Cleanup
  useEffect(() => {
    return () => {
      if (voiceSubmitTimeoutRef.current) {
        clearTimeout(voiceSubmitTimeoutRef.current)
      }
      stopAudioVisualization()
    }
  }, [stopAudioVisualization])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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

  const handleSubmit = async (content: string, source: "voice" | "text" = "text") => {
    if (!content.trim() || isProcessing) return

    tts.cancel()

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
      source
    }
    setMessages(prev => [...prev, userMessage])
    setTextInput("")
    setIsProcessing(true)

    try {
      // Build context from selected projects
      const selectedProjectData = projects
        .filter(p => selectedProjects.has(p.id))
        .map(p => ({
          name: p.name,
          description: p.description,
          status: p.status,
          priority: p.priority,
          tags: p.tags
        }))

      const response = await fetch("/api/llm/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: `You are a helpful AI assistant for project management. ${
            selectedProjectData.length > 0
              ? `The user has selected the following projects for context:\n${JSON.stringify(selectedProjectData, null, 2)}`
              : "No specific projects are selected - answer general questions about project management."
          }

Be concise and helpful. If the user asks about a project they haven't selected, suggest they select it.`,
          userPrompt: content,
          allowPaidFallback: false
        })
      })

      const data = await response.json()

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content || data.error || "I couldn't process that request.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])

      // Speak the response
      if (autoSpeak && assistantMessage.content) {
        tts.speak(assistantMessage.content)
      }
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSubmit(textInput, "text")
  }

  const toggleProject = (projectId: string) => {
    setSelectedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  const selectAllProjects = () => {
    setSelectedProjects(new Set(projects.map(p => p.id)))
  }

  const deselectAllProjects = () => {
    setSelectedProjects(new Set())
  }

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Voice Assistant</CardTitle>
              <CardDescription>Ask questions about your projects</CardDescription>
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
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Project Selection */}
      <div className="px-4 py-2 border-b">
        <button
          onClick={() => setShowProjectPicker(!showProjectPicker)}
          className="flex items-center justify-between w-full p-2 rounded-md hover:bg-accent"
        >
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            <span className="text-sm font-medium">
              {selectedProjects.size === 0
                ? "Select projects"
                : `${selectedProjects.size} project${selectedProjects.size === 1 ? "" : "s"} selected`}
            </span>
          </div>
          {showProjectPicker ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {showProjectPicker && (
          <div className="mt-2 space-y-2">
            <div className="flex gap-2 mb-2">
              <Button variant="outline" size="sm" onClick={selectAllProjects}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAllProjects}>
                Clear
              </Button>
            </div>
            <ScrollArea className="h-[150px]">
              <div className="space-y-1">
                {projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No projects yet. Create a project first.
                  </p>
                ) : (
                  projects.map(project => (
                    <label
                      key={project.id}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedProjects.has(project.id)}
                        onCheckedChange={() => toggleProject(project.id)}
                      />
                      <span className="text-sm flex-1">{project.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {project.status}
                      </Badge>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Click the mic or type to ask about your projects</p>
            {selectedProjects.size === 0 && (
              <p className="text-xs mt-1">Select projects above for context</p>
            )}
          </div>
        )}

        {messages.map(message => (
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
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              {message.source === "voice" && (
                <div className="flex items-center gap-1 mt-1 opacity-60">
                  <Mic className="h-3 w-3" />
                  <span className="text-xs">voice</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Processing indicator */}
        {isProcessing && (
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
                <span className="text-xs">listening...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t space-y-3">
        {/* Voice Control with Visualization */}
        <div className="flex flex-col items-center gap-3">
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
              disabled={!speech.isSupported || isProcessing}
              className={cn(
                "relative h-14 w-14 rounded-full flex items-center justify-center transition-all",
                speech.isListening
                  ? "bg-red-500 text-white scale-110"
                  : "bg-muted hover:bg-accent",
                (!speech.isSupported || isProcessing) && "opacity-50 cursor-not-allowed"
              )}
            >
              {speech.isListening ? (
                <MicOff className="h-6 w-6" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </button>
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

          {speech.isListening && (
            <p className="text-xs text-muted-foreground">
              Pause for 2s to send, or click to stop
            </p>
          )}
        </div>

        {/* Text Input */}
        <form onSubmit={handleTextSubmit} className="flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Or type your question..."
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
    </Card>
  )
}
