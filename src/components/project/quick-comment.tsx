"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Mic,
  MicOff,
  Send,
  Package,
  Loader2,
  Check,
  X,
  ChevronDown,
  MessageSquarePlus,
  Sparkles,
  Edit,
  Plus
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// Comment types
export type CommentType =
  | "feature-request"
  | "bug-fix"
  | "change"
  | "enhancement"
  | "feedback"
  | "question"

export type CommentStatus = "pending" | "converted" | "dismissed"

export interface ProjectComment {
  id: string
  projectId: string
  content: string
  type: CommentType
  createdAt: string
  linkedPacketId?: string
  status: CommentStatus
}

// Proposed packet from LLM
export interface ProposedPacket {
  title: string
  description: string
  type: string
  priority: "low" | "medium" | "high" | "critical"
  tasks: Array<{ id: string; description: string; completed: boolean }>
  acceptanceCriteria: string[]
}

interface QuickCommentProps {
  projectId: string
  projectName: string
  onPacketCreated?: (packetId: string) => void
  onCommentAdded?: (comment: ProjectComment) => void
  className?: string
}

const COMMENT_TYPES: Array<{ value: CommentType; label: string; color: string }> = [
  { value: "feature-request", label: "Feature Request", color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  { value: "bug-fix", label: "Bug Fix", color: "bg-red-500/10 text-red-500 border-red-500/30" },
  { value: "change", label: "Change", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30" },
  { value: "enhancement", label: "Enhancement", color: "bg-green-500/10 text-green-500 border-green-500/30" },
  { value: "feedback", label: "Feedback", color: "bg-purple-500/10 text-purple-500 border-purple-500/30" },
  { value: "question", label: "Question", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30" }
]

/**
 * Quick Comment Component
 *
 * Allows users to quickly add comments to a project with optional voice input.
 * When "Auto-create packet" is enabled, comments are sent to an LLM to be
 * structured as work packets with one-click add to queue.
 */
export function QuickComment({
  projectId,
  projectName,
  onPacketCreated,
  onCommentAdded,
  className
}: QuickCommentProps) {
  // UI State
  const [isExpanded, setIsExpanded] = useState(false)
  const [content, setContent] = useState("")
  const [commentType, setCommentType] = useState<CommentType>("feature-request")
  const [autoPacketize, setAutoPacketize] = useState(true)

  // Voice input state
  const [isListening, setIsListening] = useState(false)
  const [isVoiceSupported, setIsVoiceSupported] = useState(false)
  const [interimText, setInterimText] = useState("")
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Processing state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPacketizing, setIsPacketizing] = useState(false)
  const [proposedPacket, setProposedPacket] = useState<ProposedPacket | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Check for voice support
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setIsVoiceSupported(!!SpeechRecognitionAPI)

    if (!SpeechRecognitionAPI) return

    const recognition = new SpeechRecognitionAPI() as SpeechRecognitionInstance
    recognitionRef.current = recognition

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onstart = () => {
      setIsListening(true)
      setError(null)
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
        setContent(prev => (prev + " " + finalText).trim())
      }
      setInterimText(interim)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        setError("Microphone access denied")
        stopListening()
      } else if (event.error === "audio-capture") {
        setError("No microphone found")
        stopListening()
      }
    }

    recognition.onend = () => {
      if (isListening) {
        // Auto-restart if still listening
        try {
          recognition.start()
        } catch {
          // Already started
        }
      }
    }

    return () => {
      recognition.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return
    setError(null)
    setInterimText("")
    try {
      recognitionRef.current.start()
      setIsListening(true)
    } catch {
      // Already started
    }
  }, [])

  const stopListening = useCallback(() => {
    setIsListening(false)
    setInterimText("")
    try {
      recognitionRef.current?.stop()
    } catch {
      // Ignore
    }
  }, [])

  const toggleVoice = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  // Auto-expand when content is added
  useEffect(() => {
    if (content && !isExpanded) {
      setIsExpanded(true)
    }
  }, [content, isExpanded])

  // Handle submit
  const handleSubmit = async () => {
    if (!content.trim()) return

    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      // First, save the comment
      const commentResponse = await fetch(`/api/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          type: commentType,
          autoPacketize
        })
      })

      if (!commentResponse.ok) {
        throw new Error("Failed to save comment")
      }

      const { comment } = await commentResponse.json()
      onCommentAdded?.(comment)

      // If auto-packetize is enabled, get the proposed packet
      if (autoPacketize) {
        setIsPacketizing(true)

        const packetResponse = await fetch(`/api/projects/${projectId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "packetize",
            commentId: comment.id,
            content: content.trim(),
            type: commentType,
            projectName
          })
        })

        if (packetResponse.ok) {
          const { proposedPacket: packet } = await packetResponse.json()
          setProposedPacket(packet)
        } else {
          console.warn("Packetization failed, comment saved anyway")
          setSuccess("Comment added (packetization unavailable)")
          setContent("")
        }

        setIsPacketizing(false)
      } else {
        setSuccess("Comment added!")
        setContent("")
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Add packet to queue
  const handleAddToQueue = async () => {
    if (!proposedPacket) return

    setIsSubmitting(true)
    setError(null)

    try {
      // Get existing packets from localStorage
      const storedPackets = localStorage.getItem("claudia_packets")
      const allPackets = storedPackets ? JSON.parse(storedPackets) : {}
      const projectPackets = allPackets[projectId] || []

      // Create new packet
      const newPacket = {
        id: `packet-${Date.now()}`,
        ...proposedPacket,
        status: "ready",
        order: projectPackets.length
      }

      // Add to project packets
      projectPackets.push(newPacket)
      allPackets[projectId] = projectPackets

      // Save to localStorage
      localStorage.setItem("claudia_packets", JSON.stringify(allPackets))

      onPacketCreated?.(newPacket.id)
      setSuccess("Packet added to queue!")
      setProposedPacket(null)
      setContent("")

      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add packet")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className={cn("fixed bottom-6 right-6 z-50", className)}>
      {/* Collapsed FAB */}
      {!isExpanded && !proposedPacket && (
        <Button
          size="lg"
          className="rounded-full h-14 w-14 shadow-lg"
          onClick={() => setIsExpanded(true)}
        >
          <MessageSquarePlus className="h-6 w-6" />
        </Button>
      )}

      {/* Expanded Comment Panel */}
      {isExpanded && !proposedPacket && (
        <Card className="w-[400px] shadow-xl border-border/50 bg-background/95 backdrop-blur">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquarePlus className="h-4 w-4" />
              Quick Comment
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsExpanded(false)}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Type Selector */}
            <div className="flex items-center gap-2">
              <Select value={commentType} onValueChange={(v) => setCommentType(v as CommentType)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <Badge variant="outline" className={cn("text-xs", type.color)}>
                        {type.label}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Text Input */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={content + (interimText ? ` ${interimText}` : "")}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your comment or click mic to speak..."
                className={cn(
                  "w-full min-h-[100px] p-3 text-sm rounded-lg border border-input",
                  "bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring",
                  interimText && "text-muted-foreground"
                )}
                disabled={isSubmitting}
              />

              {/* Voice indicator */}
              {isListening && (
                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-xs text-muted-foreground">Listening...</span>
                </div>
              )}
            </div>

            {/* Auto-packetize Toggle */}
            <div className="flex items-center justify-between py-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch
                  checked={autoPacketize}
                  onCheckedChange={setAutoPacketize}
                />
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  Auto-create packet
                </span>
              </label>

              {autoPacketize && (
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI will structure
                </Badge>
              )}
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="text-sm text-red-500 p-2 bg-red-500/10 rounded-lg">
                {error}
              </div>
            )}
            {success && (
              <div className="text-sm text-green-500 p-2 bg-green-500/10 rounded-lg flex items-center gap-2">
                <Check className="h-4 w-4" />
                {success}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {isVoiceSupported && (
                  <Button
                    variant={isListening ? "destructive" : "outline"}
                    size="icon"
                    className="h-9 w-9"
                    onClick={toggleVoice}
                    disabled={isSubmitting}
                  >
                    {isListening ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setContent("")
                    setIsExpanded(false)
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!content.trim() || isSubmitting}
                  className="gap-1"
                >
                  {isSubmitting || isPacketizing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isPacketizing ? "Packetizing..." : "Submit"}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Press Cmd+Enter to submit
            </p>
          </CardContent>
        </Card>
      )}

      {/* Proposed Packet Preview */}
      {proposedPacket && (
        <Card className="w-[450px] shadow-xl border-primary/30 bg-background/95 backdrop-blur">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Proposed Work Packet
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setProposedPacket(null)
                  setContent("")
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Packet Preview */}
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-start justify-between">
                <h4 className="font-medium text-sm">{proposedPacket.title}</h4>
                <Badge variant="outline" className="text-xs">
                  {proposedPacket.priority}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {proposedPacket.description}
              </p>

              {/* Tasks */}
              {proposedPacket.tasks.length > 0 && (
                <div className="space-y-1">
                  <h5 className="text-xs font-medium text-muted-foreground">Tasks:</h5>
                  <ul className="text-xs space-y-0.5">
                    {proposedPacket.tasks.slice(0, 3).map((task, i) => (
                      <li key={task.id} className="flex items-center gap-1">
                        <span className="text-muted-foreground">{i + 1}.</span>
                        {task.description}
                      </li>
                    ))}
                    {proposedPacket.tasks.length > 3 && (
                      <li className="text-muted-foreground">
                        +{proposedPacket.tasks.length - 3} more...
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Acceptance Criteria */}
              {proposedPacket.acceptanceCriteria.length > 0 && (
                <div className="space-y-1">
                  <h5 className="text-xs font-medium text-muted-foreground">Acceptance Criteria:</h5>
                  <ul className="text-xs space-y-0.5">
                    {proposedPacket.acceptanceCriteria.slice(0, 2).map((criteria, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <Check className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                        {criteria}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="text-sm text-red-500 p-2 bg-red-500/10 rounded-lg">
                {error}
              </div>
            )}
            {success && (
              <div className="text-sm text-green-500 p-2 bg-green-500/10 rounded-lg flex items-center gap-2">
                <Check className="h-4 w-4" />
                {success}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // TODO: Open edit modal
                  console.log("Edit packet:", proposedPacket)
                }}
                className="gap-1"
              >
                <Edit className="h-4 w-4" />
                Edit First
              </Button>
              <Button
                size="sm"
                onClick={handleAddToQueue}
                disabled={isSubmitting}
                className="gap-1"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add to Queue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
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
