"use client"

import { useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ArrowLeftToLine, X, FolderOpen, Loader2 } from "lucide-react"
import { ClaudeCodeTerminal } from "@/components/claude-code/terminal"
import { MultiTerminalSession, TerminalStatus } from "@/lib/multi-terminal/types"
import { loadLayout } from "@/lib/multi-terminal/storage"
import {
  requestPopIn,
  notifyStatusChange,
  notifyWindowClosed,
  subscribeToBroadcast,
} from "@/lib/multi-terminal/window-manager"

interface PoppedOutTerminalProps {
  terminalId: string
}

const statusColors = {
  idle: "bg-gray-400",
  connecting: "bg-yellow-400 animate-pulse",
  connected: "bg-green-400",
  error: "bg-red-400",
  closed: "bg-gray-400",
}

const statusLabels = {
  idle: "Idle",
  connecting: "Connecting",
  connected: "Connected",
  error: "Error",
  closed: "Closed",
}

export function PoppedOutTerminal({ terminalId }: PoppedOutTerminalProps) {
  const [terminal, setTerminal] = useState<MultiTerminalSession | null>(null)
  const [status, setStatus] = useState<TerminalStatus>("idle")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load terminal data from localStorage
  useEffect(() => {
    try {
      const layout = loadLayout()
      const found = layout.terminals.find((t) => t.id === terminalId)
      if (found) {
        setTerminal(found)
        setStatus(found.status)
      } else {
        setError("Terminal not found")
      }
    } catch (_err) {
      setError("Failed to load terminal data")
    } finally {
      setIsLoading(false)
    }
  }, [terminalId])

  // Update window title
  useEffect(() => {
    if (terminal) {
      document.title = `${terminal.label} - Claude Code`
    }
  }, [terminal])

  // Notify main window when this window closes
  useEffect(() => {
    const handleBeforeUnload = () => {
      notifyWindowClosed(terminalId)
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [terminalId])

  // Listen for messages from main window
  useEffect(() => {
    const unsubscribe = subscribeToBroadcast((message) => {
      if (message.terminalId !== terminalId) return

      switch (message.type) {
        case "pop-in-request":
          // Main window wants us to close
          window.close()
          break
        case "session-update":
          // Update terminal data if sent
          if (message.payload && typeof message.payload === "object") {
            setTerminal((prev) => (prev ? { ...prev, ...(message.payload as Partial<MultiTerminalSession>) } : prev))
          }
          break
      }
    })

    return unsubscribe
  }, [terminalId])

  const handleStatusChange = useCallback((newStatus: TerminalStatus) => {
    setStatus(newStatus)
    notifyStatusChange(terminalId, newStatus)
  }, [terminalId])

  const handlePopIn = useCallback(() => {
    requestPopIn(terminalId)
    window.close()
  }, [terminalId])

  const handleClose = useCallback(() => {
    notifyWindowClosed(terminalId)
    window.close()
  }, [terminalId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !terminal) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background">
        <div className="text-destructive mb-4">{error || "Terminal not found"}</div>
        <Button variant="outline" onClick={() => window.close()}>
          Close Window
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center px-4 py-2 border-b bg-card gap-3">
        {/* Status indicator */}
        <div className={cn("h-3 w-3 rounded-full flex-shrink-0", statusColors[status])} />

        {/* Label */}
        <span className="font-medium truncate">{terminal.label}</span>

        {/* Project info */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <FolderOpen className="h-4 w-4" />
          <span className="truncate max-w-[200px]">{terminal.projectName}</span>
        </div>

        {/* Status text */}
        <span className="text-xs text-muted-foreground">
          {statusLabels[status]}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePopIn}
          title="Return to main dashboard"
        >
          <ArrowLeftToLine className="h-4 w-4 mr-2" />
          Pop In
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          title="Close window"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Terminal */}
      <div className="flex-1 overflow-hidden">
        <ClaudeCodeTerminal
          projectId={terminal.projectId || "unknown"}
          projectName={terminal.projectName}
          workingDirectory={terminal.workingDirectory}
          className="h-full"
          onSessionEnd={() => handleStatusChange("closed")}
        />
      </div>
    </div>
  )
}
