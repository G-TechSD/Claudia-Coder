"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Settings,
  History,
  AudioLines,
  MessageSquare,
  Play,
  Square,
  ChevronRight,
  Bot,
  User,
  Clock,
  CheckCircle
} from "lucide-react"

interface VoiceCommand {
  id: string
  type: "user" | "assistant"
  text: string
  timestamp: Date
  action?: string
  status?: "executed" | "pending" | "failed"
}

interface QuickCommand {
  phrase: string
  description: string
  action: string
}

const quickCommands: QuickCommand[] = [
  { phrase: "What's the status?", description: "Get overall pipeline status", action: "status_check" },
  { phrase: "Show me errors", description: "List recent errors and failures", action: "show_errors" },
  { phrase: "Start next packet", description: "Begin the next queued packet", action: "start_next" },
  { phrase: "Pause everything", description: "Pause all running agents", action: "pause_all" },
  { phrase: "How much have I spent?", description: "Get today's cost summary", action: "cost_summary" },
  { phrase: "Approve all pending", description: "Approve waiting requests", action: "approve_pending" }
]

const mockHistory: VoiceCommand[] = [
  {
    id: "v1",
    type: "user",
    text: "Hey Claudia, what's the status of the authentication feature?",
    timestamp: new Date(Date.now() - 300000)
  },
  {
    id: "v2",
    type: "assistant",
    text: "The authentication feature is 62% complete. BEAST is currently working on the password reset flow. 5 of 8 tasks are done, with an estimated 45 minutes remaining.",
    timestamp: new Date(Date.now() - 295000),
    action: "status_check",
    status: "executed"
  },
  {
    id: "v3",
    type: "user",
    text: "Start working on the dashboard metrics next",
    timestamp: new Date(Date.now() - 180000)
  },
  {
    id: "v4",
    type: "assistant",
    text: "I've queued the dashboard metrics packet. It will start automatically once BEDROOM becomes available. The estimated cost is $1.80.",
    timestamp: new Date(Date.now() - 175000),
    action: "queue_packet",
    status: "executed"
  },
  {
    id: "v5",
    type: "user",
    text: "How much have I spent today?",
    timestamp: new Date(Date.now() - 60000)
  },
  {
    id: "v6",
    type: "assistant",
    text: "Today you've spent $23.45 out of your $35 daily budget. That's 67% used with about $11.55 remaining. Most spending was on Claude API calls at $15.20.",
    timestamp: new Date(Date.now() - 55000),
    action: "cost_summary",
    status: "executed"
  }
]

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  })
}

export default function VoicePage() {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [history, setHistory] = useState<VoiceCommand[]>(mockHistory)
  const [currentTranscript, setCurrentTranscript] = useState("")
  const [visualizerBars, setVisualizerBars] = useState<number[]>(Array(32).fill(0))

  // Simulate audio visualizer
  useEffect(() => {
    if (!isListening && !isSpeaking) {
      setVisualizerBars(Array(32).fill(0))
      return
    }

    const interval = setInterval(() => {
      setVisualizerBars(
        Array(32).fill(0).map(() =>
          isListening
            ? Math.random() * 60 + 10
            : Math.random() * 40 + 5
        )
      )
    }, 100)

    return () => clearInterval(interval)
  }, [isListening, isSpeaking])

  // Simulate transcript when listening
  useEffect(() => {
    if (!isListening) {
      setCurrentTranscript("")
      return
    }

    const phrases = [
      "Hey",
      "Hey Claudia",
      "Hey Claudia, show",
      "Hey Claudia, show me the",
      "Hey Claudia, show me the current",
      "Hey Claudia, show me the current status"
    ]

    let index = 0
    const interval = setInterval(() => {
      if (index < phrases.length) {
        setCurrentTranscript(phrases[index])
        index++
      }
    }, 400)

    return () => clearInterval(interval)
  }, [isListening])

  const toggleListening = () => {
    setIsListening(!isListening)
    if (isListening) {
      // Stop listening, process command
      setTimeout(() => setIsSpeaking(true), 500)
      setTimeout(() => setIsSpeaking(false), 3000)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Voice Control</h1>
          <p className="text-sm text-muted-foreground">
            Speak to control your development pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMuted(!isMuted)}
            className={cn("gap-2", isMuted && "text-muted-foreground")}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {isMuted ? "Unmute" : "Mute"}
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Main Voice Interface */}
      <div className="grid gap-6 lg:grid-cols-3 flex-1">
        {/* Voice Control Panel */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardContent className="flex-1 flex flex-col items-center justify-center py-12">
            {/* Status */}
            <div className="mb-8 text-center">
              <Badge
                variant={isListening ? "default" : isSpeaking ? "secondary" : "outline"}
                className="mb-2"
              >
                {isListening ? "Listening..." : isSpeaking ? "Speaking..." : "Ready"}
              </Badge>
              <p className="text-sm text-muted-foreground">
                {isListening
                  ? "Speak your command"
                  : isSpeaking
                    ? "Processing response"
                    : "Click the microphone or say \"Hey Claudia\""}
              </p>
            </div>

            {/* Visualizer */}
            <div className="flex items-center justify-center gap-0.5 h-24 mb-8">
              {visualizerBars.map((height, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1.5 rounded-full transition-all duration-100",
                    isListening ? "bg-primary" : isSpeaking ? "bg-green-400" : "bg-muted"
                  )}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>

            {/* Microphone Button */}
            <button
              onClick={toggleListening}
              className={cn(
                "relative h-24 w-24 rounded-full flex items-center justify-center transition-all",
                isListening
                  ? "bg-primary text-primary-foreground scale-110"
                  : "bg-muted hover:bg-accent"
              )}
            >
              {isListening && (
                <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-25" />
              )}
              {isListening ? (
                <Square className="h-8 w-8" />
              ) : (
                <Mic className="h-10 w-10" />
              )}
            </button>

            {/* Current Transcript */}
            {currentTranscript && (
              <div className="mt-8 p-4 rounded-lg bg-muted/50 max-w-md text-center">
                <p className="text-lg">{currentTranscript}</p>
              </div>
            )}

            {/* Quick Commands */}
            <div className="mt-8 w-full max-w-2xl">
              <p className="text-sm text-muted-foreground mb-3 text-center">Quick Commands</p>
              <div className="grid grid-cols-2 gap-2">
                {quickCommands.slice(0, 4).map(cmd => (
                  <button
                    key={cmd.phrase}
                    className="flex items-center gap-2 p-3 rounded-lg border text-left hover:bg-accent/50 transition-colors"
                  >
                    <MessageSquare className="h-4 w-4 text-muted-foreground flex-none" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">&ldquo;{cmd.phrase}&rdquo;</p>
                      <p className="text-xs text-muted-foreground truncate">{cmd.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conversation History */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">History</CardTitle>
            <Button variant="ghost" size="sm" className="gap-1">
              <History className="h-4 w-4" />
              Clear
            </Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            <div className="space-y-4">
              {history.map(cmd => (
                <div key={cmd.id} className="space-y-2">
                  <div className={cn(
                    "flex gap-3",
                    cmd.type === "user" ? "flex-row-reverse" : ""
                  )}>
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center flex-none",
                      cmd.type === "user" ? "bg-primary" : "bg-muted"
                    )}>
                      {cmd.type === "user" ? (
                        <User className="h-4 w-4 text-primary-foreground" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div className={cn(
                      "flex-1 p-3 rounded-lg text-sm",
                      cmd.type === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}>
                      {cmd.text}
                      {cmd.status && (
                        <div className="flex items-center gap-1 mt-2 text-xs opacity-75">
                          <CheckCircle className="h-3 w-3" />
                          {cmd.action?.replace("_", " ")}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className={cn(
                    "text-xs text-muted-foreground",
                    cmd.type === "user" ? "text-right" : "text-left ml-11"
                  )}>
                    {formatTime(cmd.timestamp)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Quick Commands */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">All Voice Commands</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickCommands.map(cmd => (
              <button
                key={cmd.phrase}
                className="flex flex-col p-3 rounded-lg border text-left hover:bg-accent/50 transition-colors"
              >
                <p className="text-sm font-medium mb-1">&ldquo;{cmd.phrase}&rdquo;</p>
                <p className="text-xs text-muted-foreground">{cmd.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Keyboard Shortcut Hint */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span>Press</span>
        <kbd className="px-2 py-1 rounded bg-muted text-xs font-mono">Space</kbd>
        <span>to start/stop listening, or say &ldquo;Hey Claudia&rdquo;</span>
      </div>
    </div>
  )
}
