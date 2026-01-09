"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  Send,
  Bot,
  User,
  Loader2,
  Lightbulb,
  TrendingUp,
  Target,
  Sparkles,
  RefreshCw
} from "lucide-react"
import { ProjectProposal, type ProjectProposalData } from "./project-proposal"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
}

export interface BrainstormSession {
  id: string
  messages: ChatMessage[]
  currentProposal?: ProjectProposalData
  createdAt: string
}

interface BrainstormChatProps {
  onProjectCreated?: (project: ProjectProposalData) => void
  initialContext?: string
}

export function BrainstormChat({ onProjectCreated, initialContext }: BrainstormChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [currentProposal, setCurrentProposal] = useState<ProjectProposalData | null>(null)
  const [sessionId] = useState(() => `brainstorm-${Date.now()}`)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingContent])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [input])

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      const greeting: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: initialContext
          ? `I see you want to explore business ideas around: "${initialContext}". Let's brainstorm together! What aspects interest you most - the problem you want to solve, the target audience, or the business model?`
          : "Welcome to the Business Idea Brainstorming session! I'm here to help you explore and refine your business ideas. Share what's on your mind - whether it's a problem you've noticed, a market opportunity, or just a spark of an idea. Together we'll explore market potential, monetization strategies, and turn your concept into a concrete project plan.",
        timestamp: new Date().toISOString()
      }
      setMessages([greeting])
    }
  }, [initialContext, messages.length])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: content.trim(),
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsStreaming(true)
    setStreamingContent("")
    setCurrentProposal(null)

    try {
      const response = await fetch("/api/business-ideas/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let fullContent = ""
      let proposalData: ProjectProposalData | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)

            if (data === "[DONE]") {
              continue
            }

            try {
              const parsed = JSON.parse(data)

              if (parsed.type === "content") {
                fullContent += parsed.content
                setStreamingContent(fullContent)
              } else if (parsed.type === "proposal") {
                proposalData = parsed.proposal
              } else if (parsed.type === "error") {
                console.error("Stream error:", parsed.error)
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      // Add the complete assistant message
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: fullContent,
        timestamp: new Date().toISOString()
      }

      setMessages(prev => [...prev, assistantMessage])
      setStreamingContent("")

      // Show proposal if detected
      if (proposalData) {
        setCurrentProposal(proposalData)
      }

    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return
      }

      console.error("Chat error:", error)

      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: "I apologize, but I encountered an issue processing your request. Please try again.",
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsStreaming(false)
      setStreamingContent("")
    }
  }, [isStreaming, messages, sessionId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleApproveProject = (project: ProjectProposalData) => {
    setCurrentProposal(null)
    onProjectCreated?.(project)
  }

  const handleDenyProject = () => {
    setCurrentProposal(null)
    // Add a message to continue brainstorming
    const continueMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: "No problem! Let's continue exploring. What aspects of the idea would you like to refine or change? We can adjust the scope, target audience, features, or explore entirely different directions.",
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, continueMessage])
  }

  const handleEditProject = (editedProject: ProjectProposalData) => {
    setCurrentProposal(editedProject)
  }

  const suggestedPrompts = [
    { icon: Lightbulb, text: "I have an idea for..." },
    { icon: Target, text: "I want to solve the problem of..." },
    { icon: TrendingUp, text: "I see a market opportunity in..." }
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Business Idea Brainstorming</h2>
          <p className="text-sm text-muted-foreground">
            Explore ideas, validate concepts, create projects
          </p>
        </div>
        <div className="ml-auto">
          <Badge variant="info">AI-Powered</Badge>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-3xl mx-auto">
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
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

          {/* Streaming content */}
          {isStreaming && streamingContent && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-muted">
                <p className="text-sm whitespace-pre-wrap">{streamingContent}</p>
                <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isStreaming && !streamingContent && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}

          {/* Project Proposal Card */}
          {currentProposal && (
            <div className="my-6">
              <ProjectProposal
                proposal={currentProposal}
                onApprove={handleApproveProject}
                onDeny={handleDenyProject}
                onEdit={handleEditProject}
              />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Suggested Prompts - show when conversation is just starting */}
      {messages.length === 1 && !isStreaming && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2 justify-center">
            {suggestedPrompts.map((prompt, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setInput(prompt.text)}
              >
                <prompt.icon className="h-4 w-4" />
                {prompt.text}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Share your business idea or ask a question..."
              disabled={isStreaming}
              className="min-h-[44px] max-h-[150px] resize-none pr-12"
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isStreaming}
              className="absolute right-2 bottom-2 h-8 w-8"
            >
              {isStreaming ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
        <p className="text-xs text-center text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
