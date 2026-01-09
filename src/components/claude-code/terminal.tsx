"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Play, Square, RefreshCw, Loader2, FileText, History, Shield, Radio } from "lucide-react"

// LocalStorage key for persistent session settings
const STORAGE_KEY_NEVER_LOSE_SESSION = "claude-code-never-lose-session"
const STORAGE_KEY_RECENT_SESSIONS = "claude-code-recent-sessions"
const STORAGE_KEY_BACKGROUND_SESSIONS = "claude-code-background-sessions"

// Maximum number of recent sessions to store
const MAX_RECENT_SESSIONS = 10

interface RecentSession {
  id: string
  projectId: string
  projectName: string
  startedAt: string
  lastActiveAt: string
}

interface BackgroundSession {
  sessionId: string
  projectId: string
  projectName: string
  workingDirectory: string
  startedAt: string
  isActive: boolean
}

interface CurrentPacket {
  id: string
  title: string
  description: string
  type: string
  priority: string
  tasks: Array<{ id: string; description: string; completed: boolean }>
  acceptanceCriteria: string[]
}

interface ClaudeCodeTerminalProps {
  projectId: string
  projectName: string
  projectDescription?: string
  workingDirectory: string
  bypassPermissions?: boolean
  className?: string
  onSessionEnd?: () => void
  initialPrompt?: string
  currentPacket?: CurrentPacket
  allPackets?: Array<{ id: string; title: string; status: string }>
}

export function ClaudeCodeTerminal({
  projectId,
  projectName,
  projectDescription = "",
  workingDirectory,
  bypassPermissions = false,
  className,
  onSessionEnd,
  initialPrompt,
  currentPacket,
  allPackets
}: ClaudeCodeTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error" | "closed">("idle")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kickoffStatus, setKickoffStatus] = useState<"idle" | "generating" | "ready" | "error">("idle")
  const eventSourceRef = useRef<EventSource | null>(null)
  const isInitializedRef = useRef(false)
  const initialPromptSentRef = useRef(false)
  // Use refs to hold the latest sessionId so that the onData callback
  // (which is set up once during initialization) always has access to
  // the current sessionId without needing to re-register handlers
  const sessionIdRef = useRef<string | null>(null)

  // Session management states
  const [continueSession, setContinueSession] = useState(false)
  const [resumeSessionId, setResumeSessionId] = useState<string>("")
  const [neverLoseSession, setNeverLoseSession] = useState(false)
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [backgroundSessions, setBackgroundSessions] = useState<BackgroundSession[]>([])
  const [showSessionOptions, setShowSessionOptions] = useState(false)

  // Keep ref in sync with state
  useEffect(() => {
    sessionIdRef.current = sessionId
    console.log(`[Terminal] sessionId updated: ${sessionId}`)
  }, [sessionId])

  // Load persistent settings from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Load "never lose session" setting
      const savedNeverLose = localStorage.getItem(STORAGE_KEY_NEVER_LOSE_SESSION)
      if (savedNeverLose === "true") {
        setNeverLoseSession(true)
        setContinueSession(true) // Auto-enable continue when never lose is on
      }

      // Load recent sessions
      try {
        const savedSessions = localStorage.getItem(STORAGE_KEY_RECENT_SESSIONS)
        if (savedSessions) {
          const parsed = JSON.parse(savedSessions) as RecentSession[]
          // Filter to only sessions for this project
          const projectSessions = parsed.filter(s => s.projectId === projectId)
          setRecentSessions(projectSessions)
        }
      } catch (e) {
        console.error("[Terminal] Failed to load recent sessions:", e)
      }

      // Load background sessions
      try {
        const savedBackground = localStorage.getItem(STORAGE_KEY_BACKGROUND_SESSIONS)
        if (savedBackground) {
          const parsed = JSON.parse(savedBackground) as BackgroundSession[]
          setBackgroundSessions(parsed)
        }
      } catch (e) {
        console.error("[Terminal] Failed to load background sessions:", e)
      }
    }
  }, [projectId])

  // Save "never lose session" setting when it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_NEVER_LOSE_SESSION, neverLoseSession.toString())
      // Auto-enable continue when never lose is on
      if (neverLoseSession) {
        setContinueSession(true)
      }
    }
  }, [neverLoseSession])

  // Save current session to recent sessions when connected
  useEffect(() => {
    if (status === "connected" && sessionId && typeof window !== "undefined") {
      const newSession: RecentSession = {
        id: sessionId,
        projectId,
        projectName,
        startedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString()
      }

      try {
        const savedSessions = localStorage.getItem(STORAGE_KEY_RECENT_SESSIONS)
        let sessions: RecentSession[] = savedSessions ? JSON.parse(savedSessions) : []

        // Remove existing session with same ID if exists
        sessions = sessions.filter(s => s.id !== sessionId)

        // Add new session at the beginning
        sessions.unshift(newSession)

        // Keep only MAX_RECENT_SESSIONS
        sessions = sessions.slice(0, MAX_RECENT_SESSIONS)

        localStorage.setItem(STORAGE_KEY_RECENT_SESSIONS, JSON.stringify(sessions))

        // Update local state for this project's sessions
        setRecentSessions(sessions.filter(s => s.projectId === projectId))
      } catch (e) {
        console.error("[Terminal] Failed to save recent session:", e)
      }

      // Track as background session if never lose is enabled
      if (neverLoseSession) {
        const bgSession: BackgroundSession = {
          sessionId,
          projectId,
          projectName,
          workingDirectory,
          startedAt: new Date().toISOString(),
          isActive: true
        }

        try {
          const savedBackground = localStorage.getItem(STORAGE_KEY_BACKGROUND_SESSIONS)
          let bgSessions: BackgroundSession[] = savedBackground ? JSON.parse(savedBackground) : []

          // Remove existing for this project
          bgSessions = bgSessions.filter(s => s.projectId !== projectId)

          // Add new
          bgSessions.push(bgSession)

          localStorage.setItem(STORAGE_KEY_BACKGROUND_SESSIONS, JSON.stringify(bgSessions))
          setBackgroundSessions(bgSessions)
        } catch (e) {
          console.error("[Terminal] Failed to save background session:", e)
        }
      }
    }
  }, [status, sessionId, projectId, projectName, workingDirectory, neverLoseSession])

  // Check for background sessions on mount
  const hasBackgroundSession = backgroundSessions.some(
    s => s.projectId === projectId && s.isActive
  )
  const currentBackgroundSession = backgroundSessions.find(
    s => s.projectId === projectId && s.isActive
  )

  // Send input to the terminal - uses ref to always have current sessionId
  const sendInput = useCallback(async (input: string) => {
    const currentSessionId = sessionIdRef.current
    if (!currentSessionId) {
      console.warn("[Terminal] sendInput called but no sessionId available")
      return
    }

    try {
      const response = await fetch("/api/claude-code", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId, input })
      })

      if (!response.ok) {
        const data = await response.json()
        console.error("[Terminal] Failed to send input:", data.error, data.hint || "")
        // If session not found, update UI
        if (response.status === 404) {
          setError("Session disconnected")
          setStatus("error")
        }
      }
    } catch (err) {
      console.error("[Terminal] Failed to send input:", err)
    }
  }, []) // No dependencies - uses ref

  // Resize the terminal - uses ref to always have current sessionId
  const sendResize = useCallback(async (cols: number, rows: number) => {
    const currentSessionId = sessionIdRef.current
    if (!currentSessionId) return

    try {
      await fetch("/api/claude-code", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId, resize: { cols, rows } })
      })
    } catch (err) {
      console.error("[Terminal] Failed to send resize:", err)
    }
  }, []) // No dependencies - uses ref

  // Generate/refresh KICKOFF.md
  const refreshKickoff = useCallback(async () => {
    setKickoffStatus("generating")

    try {
      const response = await fetch(`/api/projects/${projectId}/kickoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          projectDescription,
          workingDirectory,
          currentPacket,
          allPackets
        })
      })

      if (!response.ok) {
        const data = await response.json()
        console.error("[Terminal] Failed to generate KICKOFF.md:", data.error)
        setKickoffStatus("error")
        return false
      }

      const data = await response.json()
      console.log("[Terminal] KICKOFF.md generated:", data.kickoffPath)
      setKickoffStatus("ready")

      if (xtermRef.current) {
        xtermRef.current.write("\r\n\x1b[1;32m● KICKOFF.md updated\x1b[0m\r\n")
      }

      return true
    } catch (err) {
      console.error("[Terminal] Failed to refresh kickoff:", err)
      setKickoffStatus("error")
      return false
    }
  }, [projectId, projectName, projectDescription, workingDirectory, currentPacket, allPackets])

  // Send the initial prompt to Claude Code
  const sendInitialPrompt = useCallback(async () => {
    if (initialPromptSentRef.current) return
    initialPromptSentRef.current = true

    const prompt = initialPrompt || "Read KICKOFF.md for your instructions and current task."

    // Wait a brief moment for Claude Code to fully initialize
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Send the initial message
    await sendInput(prompt + "\n")

    if (xtermRef.current) {
      console.log("[Terminal] Sent initial prompt:", prompt)
    }
  }, [initialPrompt, sendInput])

  // Stop the session - uses ref for sessionId
  const stopSession = useCallback(async () => {
    console.log("[Terminal] stopSession called")
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    const currentSessionId = sessionIdRef.current
    if (currentSessionId) {
      try {
        await fetch(`/api/claude-code?sessionId=${currentSessionId}`, {
          method: "DELETE"
        })
      } catch (err) {
        console.error("[Terminal] Failed to stop session:", err)
      }
    }

    // Clear background session tracking
    if (typeof window !== "undefined") {
      try {
        const savedBackground = localStorage.getItem(STORAGE_KEY_BACKGROUND_SESSIONS)
        if (savedBackground) {
          let bgSessions: BackgroundSession[] = JSON.parse(savedBackground)
          bgSessions = bgSessions.filter(s => s.projectId !== projectId)
          localStorage.setItem(STORAGE_KEY_BACKGROUND_SESSIONS, JSON.stringify(bgSessions))
          setBackgroundSessions(bgSessions)
        }
      } catch (e) {
        console.error("[Terminal] Failed to clear background session:", e)
      }
    }

    setStatus("closed")
    setSessionId(null)
    sessionIdRef.current = null
    onSessionEnd?.()

    if (xtermRef.current) {
      xtermRef.current.write("\r\n\x1b[1;33m● Session stopped\x1b[0m\r\n")
    }
  }, [onSessionEnd, projectId]) // Added projectId for background session cleanup

  // Clear background session tracking when session ends
  const clearBackgroundSession = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const savedBackground = localStorage.getItem(STORAGE_KEY_BACKGROUND_SESSIONS)
        if (savedBackground) {
          let bgSessions: BackgroundSession[] = JSON.parse(savedBackground)
          bgSessions = bgSessions.filter(s => s.projectId !== projectId)
          localStorage.setItem(STORAGE_KEY_BACKGROUND_SESSIONS, JSON.stringify(bgSessions))
          setBackgroundSessions(bgSessions)
        }
      } catch (e) {
        console.error("[Terminal] Failed to clear background session:", e)
      }
    }
  }, [projectId])

  // Start a new session
  const startSession = useCallback(async () => {
    if (!xtermRef.current) return

    setStatus("connecting")
    setError(null)
    initialPromptSentRef.current = false // Reset for new session

    const term = xtermRef.current
    term.clear()
    term.write("\x1b[1;36m● Starting Claude Code session...\x1b[0m\r\n")
    term.write(`\x1b[90m  Directory: ${workingDirectory}\x1b[0m\r\n`)

    // Show session options being used
    const useContinue = continueSession || neverLoseSession
    const useResume = resumeSessionId && resumeSessionId !== ""

    if (useContinue && !useResume) {
      term.write("\x1b[90m  Mode: --continue (resuming last session)\x1b[0m\r\n")
    } else if (useResume) {
      term.write(`\x1b[90m  Mode: --resume ${resumeSessionId}\x1b[0m\r\n`)
    }

    if (neverLoseSession) {
      term.write("\x1b[90m  Persistent session: enabled\x1b[0m\r\n")
    }

    // Generate KICKOFF.md before starting the session
    term.write("\x1b[90m  Generating KICKOFF.md...\x1b[0m\r\n")
    const kickoffGenerated = await refreshKickoff()
    if (kickoffGenerated) {
      term.write("\x1b[90m  KICKOFF.md ready\x1b[0m\r\n")
    } else {
      term.write("\x1b[33m  Warning: Could not generate KICKOFF.md\x1b[0m\r\n")
    }

    try {
      const response = await fetch("/api/claude-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          workingDirectory,
          bypassPermissions,
          continueSession: useContinue,
          resumeSessionId: useResume ? resumeSessionId : undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to start session")
      }

      const newSessionId = data.sessionId
      setSessionId(newSessionId)
      term.write(`\x1b[1;32m● Session started (PID: ${data.pid})\x1b[0m\r\n\r\n`)

      // Connect to SSE stream
      const eventSource = new EventSource(`/api/claude-code?sessionId=${newSessionId}`)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        console.log("[Terminal] SSE connected")
      }

      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          if (message.type === "output") {
            term.write(message.content)
            if (status !== "connected") {
              setStatus("connected")
            }
          } else if (message.type === "status") {
            if (message.status === "running") {
              setStatus("connected")
              // Send initial prompt once Claude Code is ready
              sendInitialPrompt()
            }
          } else if (message.type === "exit") {
            term.write(`\r\n\x1b[1;33m● Session ended (code: ${message.code})\x1b[0m\r\n`)
            setStatus("closed")
            onSessionEnd?.()
            eventSource.close()
            eventSourceRef.current = null
          } else if (message.type === "error") {
            term.write(`\x1b[1;31m${message.content}\x1b[0m`)
          }
        } catch (e) {
          console.error("Failed to parse SSE message:", e)
        }
      }

      eventSource.onerror = (e) => {
        console.error("[Terminal] SSE error:", e, "readyState:", eventSource.readyState)
        if (eventSource.readyState === EventSource.CLOSED) {
          console.log("[Terminal] SSE connection closed")
          setStatus("closed")
          term.write("\r\n\x1b[1;31m● Connection closed\x1b[0m\r\n")
        } else if (eventSource.readyState === EventSource.CONNECTING) {
          console.log("[Terminal] SSE reconnecting...")
          term.write("\r\n\x1b[1;33m● Reconnecting...\x1b[0m\r\n")
        }
      }

      // Send initial resize
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
        sendResize(term.cols, term.rows)
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect"
      setError(message)
      setStatus("error")
      term.write(`\x1b[1;31m● Error: ${message}\x1b[0m\r\n`)
    }
  }, [projectId, workingDirectory, bypassPermissions, sendResize, onSessionEnd, status, refreshKickoff, sendInitialPrompt, continueSession, neverLoseSession, resumeSessionId])

  // Initialize xterm.js
  useEffect(() => {
    if (!terminalRef.current || isInitializedRef.current) return
    isInitializedRef.current = true

    let term: any = null
    let fitAddon: any = null
    let resizeObserver: ResizeObserver | null = null

    const initTerminal = async () => {
      try {
        // Dynamic import for client-side only
        const { Terminal } = await import("@xterm/xterm")
        const { FitAddon } = await import("@xterm/addon-fit")

        // Import CSS - TypeScript doesn't recognize CSS module paths
        // @ts-expect-error CSS import handled by bundler at runtime
        await import("@xterm/xterm/css/xterm.css")

        term = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Monaco', 'Menlo', 'Consolas', monospace",
          theme: {
            background: "#0d1117",
            foreground: "#c9d1d9",
            cursor: "#58a6ff",
            cursorAccent: "#0d1117",
            selectionBackground: "#264f78",
            black: "#484f58",
            red: "#ff7b72",
            green: "#3fb950",
            yellow: "#d29922",
            blue: "#58a6ff",
            magenta: "#bc8cff",
            cyan: "#39c5cf",
            white: "#b1bac4",
            brightBlack: "#6e7681",
            brightRed: "#ffa198",
            brightGreen: "#56d364",
            brightYellow: "#e3b341",
            brightBlue: "#79c0ff",
            brightMagenta: "#d2a8ff",
            brightCyan: "#56d4dd",
            brightWhite: "#f0f6fc",
          },
          allowProposedApi: true,
          scrollback: 10000,
        })

        fitAddon = new FitAddon()
        term.loadAddon(fitAddon)

        term.open(terminalRef.current!)

        // Wait for container to have proper dimensions
        await new Promise(resolve => setTimeout(resolve, 100))
        fitAddon.fit()

        xtermRef.current = term
        fitAddonRef.current = fitAddon

        // Handle terminal input - send keystrokes to PTY
        term.onData((data: string) => {
          sendInput(data)
        })

        // Handle resize
        resizeObserver = new ResizeObserver(() => {
          if (fitAddon && term && terminalRef.current) {
            try {
              fitAddon.fit()
              sendResize(term.cols, term.rows)
            } catch (e) {
              // Ignore resize errors during initialization
            }
          }
        })

        if (terminalRef.current) {
          resizeObserver.observe(terminalRef.current)
        }

        // Auto-start session
        term.write("\x1b[1;36m● Initializing Claude Code terminal...\x1b[0m\r\n")

        // Start session after a brief delay
        setTimeout(() => {
          startSession()
        }, 500)

      } catch (err) {
        console.error("Failed to initialize terminal:", err)
        setError("Failed to initialize terminal")
        setStatus("error")
      }
    }

    initTerminal()

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (term) {
        term.dispose()
      }
    }
  }, []) // Empty deps - only run once on mount

  // NOTE: The sendInput callback already handles sessionId correctly via its
  // dependency array. We do NOT need a separate useEffect to re-attach onData
  // handlers when sessionId changes - doing so would create duplicate handlers
  // that cause the terminal to disconnect/reset when the user types.

  return (
    <div className={cn("relative flex flex-col rounded-lg overflow-hidden bg-[#0d1117]", className)}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center gap-3">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={stopSession}
              className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 transition-colors"
              title="Stop session"
            />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
          </div>
          <span className="text-sm text-[#8b949e] font-medium">Claude Code</span>
          {/* Status indicator */}
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded text-xs",
            status === "connecting" && "text-yellow-400",
            status === "connected" && "text-green-400",
            status === "error" && "text-red-400",
            status === "closed" && "text-gray-400",
            status === "idle" && "text-gray-400"
          )}>
            {status === "connecting" && <Loader2 className="h-3 w-3 animate-spin" />}
            {status === "connected" && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
            {status === "error" && <span className="w-2 h-2 rounded-full bg-red-400" />}
            {status === "closed" && <span className="w-2 h-2 rounded-full bg-gray-400" />}
            <span className="capitalize">{status}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Refresh Kickoff button */}
          {status === "connected" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshKickoff}
              disabled={kickoffStatus === "generating"}
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-7"
              title="Refresh KICKOFF.md with current project state"
            >
              {kickoffStatus === "generating" ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <FileText className="h-3 w-3 mr-1" />
              )}
              Refresh Kickoff
            </Button>
          )}
          {(status === "closed" || status === "error") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={startSession}
              className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-7"
            >
              <Play className="h-3 w-3 mr-1" />
              Restart
            </Button>
          )}
          {status === "connected" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={stopSession}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7"
            >
              <Square className="h-3 w-3 mr-1" />
              Stop
            </Button>
          )}
        </div>
      </div>

      {/* Terminal container */}
      <div
        ref={terminalRef}
        className="flex-1 w-full"
        style={{ minHeight: "400px" }}
      />

      {/* Error banner */}
      {error && status === "error" && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-t border-red-500/30 text-red-400 text-sm">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={startSession}
            className="ml-auto text-red-400 hover:text-red-300 h-7"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      )}
    </div>
  )
}

// Compact terminal widget for dashboard
export function ClaudeCodeTerminalWidget({
  projectId,
  projectName,
  workingDirectory,
  bypassPermissions,
  onOpenFull
}: {
  projectId: string
  projectName: string
  workingDirectory: string
  bypassPermissions?: boolean
  onOpenFull?: () => void
}) {
  return (
    <div className="p-4 rounded-lg border bg-gray-950">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Claude Code Terminal</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenFull}
          className="text-gray-400 hover:text-gray-200"
        >
          Open Terminal
        </Button>
      </div>
    </div>
  )
}
