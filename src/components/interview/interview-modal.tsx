"use client"

import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Sparkles
} from "lucide-react"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis"
import { useInterview } from "@/hooks/useInterview"
import type { InterviewSession, InterviewTargetType } from "@/lib/data/types"

interface InterviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetType: InterviewTargetType
  targetId: string
  targetTitle: string
  targetContext?: Record<string, unknown>
  onComplete?: (session: InterviewSession) => void
}

export function InterviewModal({
  open,
  onOpenChange,
  targetType,
  targetId,
  targetTitle,
  targetContext,
  onComplete
}: InterviewModalProps) {
  const [textInput, setTextInput] = useState("")
  const [autoSpeak, setAutoSpeak] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Interview hook
  const interview = useInterview({
    type: "contextual",
    targetType,
    targetId,
    targetTitle,
    targetContext,
    onComplete: (session) => {
      onComplete?.(session)
      onOpenChange(false)
    },
    onCancel: () => {
      onOpenChange(false)
    }
  })

  // Speech hooks
  const speech = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    onResult: (transcript, isFinal) => {
      if (isFinal && transcript.trim()) {
        handleSubmit(transcript.trim(), "voice")
        speech.resetTranscript()
      }
    }
  })

  const tts = useSpeechSynthesis({
    onEnd: () => {
      // Could auto-start listening after speech ends
    }
  })

  // Start interview when modal opens
  useEffect(() => {
    if (open && !interview.session) {
      interview.start()
    }
  }, [open])

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

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      tts.cancel()
      speech.stopListening()
      interview.reset()
    }
  }, [open])

  const handleSubmit = async (content: string, source: "voice" | "text" = "text") => {
    if (!content.trim() || interview.isProcessing) return

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
      speech.stopListening()
    } else {
      tts.cancel()
      speech.startListening()
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base">
                  Interview: {targetTitle}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {isComplete ? "Complete" : "Voice or text"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setAutoSpeak(!autoSpeak)}
                className={cn(!autoSpeak && "text-muted-foreground")}
              >
                {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              {!isComplete && (
                <Button variant="ghost" size="icon" onClick={handleCancel}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-2",
                message.role === "user" && "flex-row-reverse"
              )}
            >
              <div className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
                message.role === "user" ? "bg-primary" : "bg-muted"
              )}>
                {message.role === "user" ? (
                  <User className="h-3 w-3 text-primary-foreground" />
                ) : (
                  <Bot className="h-3 w-3" />
                )}
              </div>
              <div className={cn(
                "max-w-[80%] rounded-xl px-3 py-2",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}>
                <p className="text-sm">{message.content}</p>
                {message.transcribedFrom === "voice" && (
                  <div className="flex items-center gap-1 mt-1 opacity-60">
                    <Mic className="h-2.5 w-2.5" />
                    <span className="text-xs">voice</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Processing indicator */}
          {interview.isProcessing && (
            <div className="flex gap-2">
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                <Bot className="h-3 w-3" />
              </div>
              <div className="bg-muted rounded-xl px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}

          {/* Live transcript */}
          {speech.isListening && (speech.transcript || speech.interimTranscript) && (
            <div className="flex gap-2 flex-row-reverse">
              <div className="h-6 w-6 rounded-full bg-primary/50 flex items-center justify-center">
                <User className="h-3 w-3 text-primary-foreground" />
              </div>
              <div className="max-w-[80%] rounded-xl px-3 py-2 bg-primary/50 text-primary-foreground">
                <p className="text-sm">
                  {speech.transcript}
                  {speech.interimTranscript && (
                    <span className="opacity-60"> {speech.interimTranscript}</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Completion summary */}
          {isComplete && interview.session && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-green-400">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">Interview Complete</span>
              </div>
              {interview.session.summary && (
                <p className="text-sm">{interview.session.summary}</p>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {!isComplete && (
          <div className="p-4 border-t space-y-3">
            {/* Voice Control */}
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                disabled={interview.isProcessing}
              >
                <SkipForward className="h-4 w-4 mr-1" />
                Skip
              </Button>

              <button
                onClick={toggleListening}
                disabled={!speech.isSupported}
                className={cn(
                  "relative h-12 w-12 rounded-full flex items-center justify-center transition-all",
                  speech.isListening
                    ? "bg-red-500 text-white scale-105"
                    : "bg-muted hover:bg-accent"
                )}
              >
                {speech.isListening && (
                  <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-25" />
                )}
                {speech.isListening ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleFinish}
                disabled={interview.isProcessing || messages.length < 3}
              >
                <Check className="h-4 w-4 mr-1" />
                Done
              </Button>
            </div>

            {/* Text Input */}
            <form onSubmit={handleTextSubmit} className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type your response..."
                disabled={interview.isProcessing}
                className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button
                type="submit"
                size="icon"
                className="h-9 w-9"
                disabled={!textInput.trim() || interview.isProcessing}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        )}

        {/* Complete Actions */}
        {isComplete && (
          <div className="p-4 border-t">
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
