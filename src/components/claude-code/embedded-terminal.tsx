"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Play, Square, AlertTriangle, Shield, RefreshCw, Loader2, Image, FolderOpen, Mic, MicOff } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { getAllProjects, getEffectiveWorkingDirectory } from "@/lib/data/projects"
import type { Project } from "@/lib/data/types"

// LocalStorage keys
const STORAGE_KEY_RECENT_SESSIONS = "claude-code-recent-sessions"
const STORAGE_KEY_ACTIVE_SESSION_PREFIX = "claude-code-active-session-"

interface RecentSession {
  id: string
  claudeSessionId?: string
  projectId: string
  projectName: string
  startedAt: string
  lastActiveAt: string
}

interface EmbeddedTerminalProps {
  projectId?: string
  projectName?: string
  workingDirectory?: string
  label?: string // Label for human-readable tmux session name
  className?: string
  onStatusChange?: (status: "idle" | "connecting" | "connected" | "error" | "closed" | "reconnecting") => void
  onSessionStart?: (sessionId: string) => void
  onProjectChange?: (project: { projectId: string; projectName: string; workingDirectory: string }) => void
  // Tmux session created callback - for storing the session name for reconnection
  onTmuxSessionCreated?: (tmuxSessionName: string) => void
  // If provided, reconnect to existing tmux session instead of starting new
  reconnectToTmux?: string
}

/**
 * Compact embedded terminal for multi-terminal dashboard
 * Includes essential session options in a minimal header
 */
export function EmbeddedTerminal({
  projectId: initialProjectId,
  projectName: initialProjectName,
  workingDirectory: initialWorkingDirectory,
  label,
  className,
  onStatusChange,
  onSessionStart,
  onProjectChange,
  onTmuxSessionCreated,
  reconnectToTmux,
}: EmbeddedTerminalProps) {
  const { user } = useAuth()
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const isInitializedRef = useRef(false)
  const pasteHandlerRef = useRef<((e: ClipboardEvent) => void) | null>(null)

  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error" | "closed" | "reconnecting">("idle")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  // Project selection
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || "")
  const [currentProjectName, setCurrentProjectName] = useState<string>(initialProjectName || "No Project")
  const [currentWorkingDirectory, setCurrentWorkingDirectory] = useState<string>(initialWorkingDirectory || "")

  // Session options
  const [continueSession, setContinueSession] = useState(false)
  const [bypassPermissions, setBypassPermissions] = useState(false)
  const [resumeSessionId, setResumeSessionId] = useState<string>("")
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])

  // Load available projects
  useEffect(() => {
    const allProjects = getAllProjects({ userId: user?.id })
    setProjects(allProjects)
  }, [user?.id])

  // Handle project selection change
  const handleProjectChange = useCallback(async (newProjectId: string) => {
    if (newProjectId === selectedProjectId) return

    const project = projects.find(p => p.id === newProjectId)
    if (!project) return

    // Stop current session if running
    if (sessionIdRef.current && (status === "connected" || status === "connecting")) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      try {
        await fetch(`/api/claude-code?sessionId=${sessionIdRef.current}`, {
          method: "DELETE"
        })
      } catch (err) {
        console.error("[EmbeddedTerminal] Failed to stop session:", err)
      }
      setSessionId(null)
      sessionIdRef.current = null
    }

    const workingDir = getEffectiveWorkingDirectory(project)

    setSelectedProjectId(newProjectId)
    setCurrentProjectName(project.name)
    setCurrentWorkingDirectory(workingDir)
    setStatus("idle")
    setResumeSessionId("")

    // Notify parent of project change
    onProjectChange?.({
      projectId: newProjectId,
      projectName: project.name,
      workingDirectory: workingDir,
    })

    // Clear terminal and show new project info
    if (xtermRef.current) {
      xtermRef.current.clear()
      xtermRef.current.write(`\x1b[1;36m● Project changed to: ${project.name}\x1b[0m\r\n`)
      xtermRef.current.write(`\x1b[90m  Directory: ${workingDir}\x1b[0m\r\n`)
      xtermRef.current.write("\x1b[90m  Click 'Start' to begin a new session\x1b[0m\r\n")
    }
  }, [selectedProjectId, projects, status, onProjectChange])

  // Load recent sessions for this project
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const effectiveProjectId = selectedProjectId || "quick-session"
        const savedSessions = localStorage.getItem(STORAGE_KEY_RECENT_SESSIONS)
        if (savedSessions) {
          const parsed = JSON.parse(savedSessions) as RecentSession[]
          const projectSessions = parsed.filter(s => s.projectId === effectiveProjectId)
          setRecentSessions(projectSessions)
          // Auto-enable continue if there are previous sessions for this project
          setContinueSession(projectSessions.length > 0)
        } else {
          setRecentSessions([])
          setContinueSession(false)
        }
      } catch (e) {
        console.error("[EmbeddedTerminal] Failed to load recent sessions:", e)
        setRecentSessions([])
        setContinueSession(false)
      }
    }
  }, [selectedProjectId])

  // Update status and notify parent
  const updateStatus = useCallback((newStatus: "idle" | "connecting" | "connected" | "error" | "closed" | "reconnecting") => {
    setStatus(newStatus)
    onStatusChange?.(newStatus)
  }, [onStatusChange])

  // Helper functions for active session storage
  const getActiveSessionKey = useCallback(() => {
    const effectiveProjectId = selectedProjectId || "quick-session"
    return `${STORAGE_KEY_ACTIVE_SESSION_PREFIX}${effectiveProjectId}`
  }, [selectedProjectId])

  const saveActiveSession = useCallback((sid: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(getActiveSessionKey(), sid)
      console.log(`[EmbeddedTerminal] Saved active session: ${sid}`)
    }
  }, [getActiveSessionKey])

  const clearActiveSession = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(getActiveSessionKey())
      console.log(`[EmbeddedTerminal] Cleared active session`)
    }
  }, [getActiveSessionKey])

  const getStoredActiveSession = useCallback((): string | null => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(getActiveSessionKey())
    }
    return null
  }, [getActiveSessionKey])

  // Keep ref in sync with state
  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  // Send input to the terminal
  const sendInput = useCallback(async (input: string) => {
    const currentSessionId = sessionIdRef.current
    if (!currentSessionId) return

    try {
      const response = await fetch("/api/claude-code", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId, input })
      })

      if (!response.ok && response.status === 404) {
        updateStatus("error")
      }
    } catch (err) {
      console.error("[EmbeddedTerminal] Failed to send input:", err)
    }
  }, [updateStatus])

  // Speech recognition for voice input
  const {
    isListening,
    isSupported: isSpeechSupported,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript
  } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    onResult: (text, isFinal) => {
      if (isFinal && text.trim()) {
        // Show in terminal what was transcribed
        if (xtermRef.current) {
          xtermRef.current.write(`\r\n\x1b[1;35m🎤 Voice: ${text}\x1b[0m\r\n`)
        }
      }
    }
  })

  // Keep transcript in ref for handleMicClick closure
  const transcriptRef = useRef(transcript)
  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])

  // Keep interimTranscript in ref too
  const interimRef = useRef(interimTranscript)
  useEffect(() => {
    interimRef.current = interimTranscript
  }, [interimTranscript])

  // Handle stopping speech and sending to terminal
  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening()
      // Combine finalized transcript with any interim text that hasn't been finalized yet
      const finalText = transcriptRef.current.trim()
      const interimText = interimRef.current.trim()
      const textToSend = (finalText + " " + interimText).trim()

      if (textToSend && sessionIdRef.current) {
        sendInput(textToSend + "\n")
        if (xtermRef.current) {
          xtermRef.current.write(`\x1b[90m→ Sent: "${textToSend}"\x1b[0m\r\n`)
        }
      } else if (!textToSend) {
        if (xtermRef.current) {
          xtermRef.current.write(`\x1b[90m→ No text to send\x1b[0m\r\n`)
        }
      }
      resetTranscript()
    } else {
      resetTranscript()
      startListening()
      if (xtermRef.current) {
        xtermRef.current.write(`\r\n\x1b[1;35m🎤 Listening... (click mic again to send)\x1b[0m\r\n`)
      }
    }
  }, [isListening, startListening, stopListening, resetTranscript, sendInput])

  // Resize the terminal
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
      console.error("[EmbeddedTerminal] Failed to send resize:", err)
    }
  }, [])

  // Handle pasted images
  const handleImagePaste = useCallback(async (imageData: string) => {
    if (!xtermRef.current) return
    const term = xtermRef.current

    setIsUploadingImage(true)
    term.write("\r\n\x1b[1;35m⎙ Uploading pasted image...\x1b[0m")

    try {
      const response = await fetch("/api/claude-code/paste-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageData,
          currentWorkingDirectory,
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save image")
      }

      // Insert the image path reference into the terminal
      // Claude Code supports @/path/to/file syntax for file references
      const imagePath = data.path
      term.write(`\r\n\x1b[1;32m✓ Image saved:\x1b[0m ${imagePath}\r\n`)
      term.write(`\x1b[90mYou can reference this image with: @${imagePath}\x1b[0m\r\n`)

      // If there's an active session, send the reference as input
      if (sessionIdRef.current && (status === "connected" || status === "connecting")) {
        // Show a preview message and insert the @reference
        sendInput(`@${imagePath} `)
        term.write(`\r\n\x1b[1;36m→ Inserted image reference into prompt\x1b[0m\r\n`)
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload image"
      term.write(`\r\n\x1b[1;31m✗ Error: ${message}\x1b[0m\r\n`)
    } finally {
      setIsUploadingImage(false)
    }
  }, [currentWorkingDirectory, status, sendInput])

  // Save session to localStorage
  const saveSession = useCallback((newSessionId: string, claudeSessionId?: string) => {
    if (typeof window === "undefined") return

    const effectiveProjectId = selectedProjectId || "quick-session"
    const newSession: RecentSession = {
      id: newSessionId,
      claudeSessionId,
      projectId: effectiveProjectId,
      projectName: currentProjectName,
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    }

    try {
      const savedSessions = localStorage.getItem(STORAGE_KEY_RECENT_SESSIONS)
      let sessions: RecentSession[] = savedSessions ? JSON.parse(savedSessions) : []
      sessions = sessions.filter(s => s.id !== newSessionId)
      sessions.unshift(newSession)
      sessions = sessions.slice(0, 10)
      localStorage.setItem(STORAGE_KEY_RECENT_SESSIONS, JSON.stringify(sessions))
      setRecentSessions(sessions.filter(s => s.projectId === effectiveProjectId))
    } catch (e) {
      console.error("[EmbeddedTerminal] Failed to save session:", e)
    }
  }, [selectedProjectId, currentProjectName])

  // Start session
  const startSession = useCallback(async () => {
    if (!xtermRef.current) return

    updateStatus("connecting")
    const term = xtermRef.current
    term.clear()
    term.write("\x1b[1;36m● Starting Claude Code session...\x1b[0m\r\n")
    term.write(`\x1b[90m  Directory: ${currentWorkingDirectory}\x1b[0m\r\n`)

    // Show options being used
    const useContinue = continueSession
    const useResume = resumeSessionId && resumeSessionId !== ""
    const selectedSession = recentSessions.find(s => s.id === resumeSessionId)
    const claudeIdToResume = selectedSession?.claudeSessionId

    if (useContinue && !useResume) {
      term.write("\x1b[90m  Mode: --continue (resuming last session)\x1b[0m\r\n")
    } else if (useResume && claudeIdToResume) {
      term.write(`\x1b[90m  Mode: --resume ${claudeIdToResume}\x1b[0m\r\n`)
    }

    if (bypassPermissions) {
      term.write("\x1b[1;33m  WARNING: Bypass permissions enabled\x1b[0m\r\n")
    }

    try {
      const shouldResume = useResume && !!claudeIdToResume
      const shouldContinue = useContinue || (useResume && !claudeIdToResume)

      const response = await fetch("/api/claude-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId || "quick-session",
          workingDirectory: currentWorkingDirectory,
          bypassPermissions,
          continueSession: shouldContinue && !shouldResume,
          resume: shouldResume,
          resumeSessionId: shouldResume ? claudeIdToResume : undefined,
          label: label || currentProjectName, // Use label for human-readable tmux session name
          reconnectToTmux, // Reconnect to existing tmux session if provided
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to start session")
      }

      const newSessionId = data.sessionId
      setSessionId(newSessionId)
      saveSession(newSessionId)
      saveActiveSession(newSessionId) // Store for auto-reconnect
      onSessionStart?.(newSessionId)

      // Handle tmux session info - store for reconnection
      if (data.tmux?.sessionName && onTmuxSessionCreated) {
        onTmuxSessionCreated(data.tmux.sessionName)
        if (data.tmux.reconnected) {
          term.write(`\x1b[1;32m● Reconnected to tmux session: ${data.tmux.sessionName}\x1b[0m\r\n`)
        }
      }

      term.write(`\x1b[1;32m● Session started (PID: ${data.pid})\x1b[0m\r\n\r\n`)

      // Connect to SSE stream
      const eventSource = new EventSource(`/api/claude-code?sessionId=${newSessionId}`)
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          if (message.type === "output") {
            term.write(message.content)
            if (status !== "connected") {
              updateStatus("connected")
            }
          } else if (message.type === "status" && message.status === "running") {
            updateStatus("connected")
          } else if (message.type === "claude_session_id") {
            // Store Claude's session ID for proper --resume functionality
            const claudeId = message.claudeSessionId
            try {
              const effectiveProjectId = selectedProjectId || "quick-session"
              const savedSessions = localStorage.getItem(STORAGE_KEY_RECENT_SESSIONS)
              if (savedSessions) {
                const sessions: RecentSession[] = JSON.parse(savedSessions)
                const sessionToUpdate = sessions.find(s => s.id === newSessionId)
                if (sessionToUpdate) {
                  sessionToUpdate.claudeSessionId = claudeId
                  localStorage.setItem(STORAGE_KEY_RECENT_SESSIONS, JSON.stringify(sessions))
                  setRecentSessions(sessions.filter(s => s.projectId === effectiveProjectId))
                }
              }
            } catch (e) {
              console.error("[EmbeddedTerminal] Failed to update session with Claude ID:", e)
            }
          } else if (message.type === "exit") {
            term.write(`\r\n\x1b[1;33m● Session ended (code: ${message.code})\x1b[0m\r\n`)
            updateStatus("closed")
            clearActiveSession() // Clear stored session on natural exit
            eventSource.close()
            eventSourceRef.current = null
          } else if (message.type === "error") {
            term.write(`\x1b[1;31m${message.content}\x1b[0m`)
          }
        } catch (e) {
          console.error("Failed to parse SSE message:", e)
        }
      }

      eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
          updateStatus("closed")
          term.write("\r\n\x1b[1;31m● Connection closed\x1b[0m\r\n")
        }
      }

      // Send initial resize
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
        sendResize(term.cols, term.rows)
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect"
      updateStatus("error")
      term.write(`\x1b[1;31m● Error: ${message}\x1b[0m\r\n`)
    }
  }, [selectedProjectId, currentWorkingDirectory, bypassPermissions, continueSession, resumeSessionId, recentSessions, sendResize, updateStatus, onSessionStart, saveSession, saveActiveSession, clearActiveSession, status])

  // Stop session
  const stopSession = useCallback(async () => {
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
        console.error("[EmbeddedTerminal] Failed to stop session:", err)
      }
    }

    // Clear active session on explicit stop
    clearActiveSession()

    updateStatus("closed")
    setSessionId(null)

    if (xtermRef.current) {
      xtermRef.current.write("\r\n\x1b[1;33m● Session stopped\x1b[0m\r\n")
    }
  }, [updateStatus, clearActiveSession])

  // Reconnect to an existing session
  const reconnectToSession = useCallback(async (storedSessionId: string) => {
    if (!xtermRef.current) return false

    updateStatus("reconnecting")

    const term = xtermRef.current
    term.clear()
    term.write("\x1b[1;36m● Reconnecting to existing session...\x1b[0m\r\n")
    term.write(`\x1b[90m  Session ID: ${storedSessionId.slice(0, 20)}...\x1b[0m\r\n`)

    try {
      // Try to reconnect via SSE - the API will check if session exists
      const eventSource = new EventSource(`/api/claude-code?sessionId=${storedSessionId}`)

      // Set up a timeout for reconnection
      const reconnectTimeout = setTimeout(() => {
        eventSource.close()
        term.write("\r\n\x1b[1;33m● Reconnection timed out\x1b[0m\r\n")
        clearActiveSession()
        updateStatus("idle")
        term.write("\x1b[90m  Click 'Start' to begin a new session\x1b[0m\r\n")
      }, 5000) // 5 second timeout

      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          if (message.type === "error" && message.content?.includes("not found")) {
            // Session doesn't exist anymore
            clearTimeout(reconnectTimeout)
            eventSource.close()
            term.write("\r\n\x1b[1;33m● Session no longer exists\x1b[0m\r\n")
            clearActiveSession()
            updateStatus("idle")
            term.write("\x1b[90m  Click 'Start' to begin a new session\x1b[0m\r\n")
            return
          }

          if (message.type === "output") {
            clearTimeout(reconnectTimeout)
            term.write(message.content)
            if (status !== "connected") {
              updateStatus("connected")
              setSessionId(storedSessionId)
              eventSourceRef.current = eventSource
              term.write("\r\n\x1b[1;32m● Reconnected to existing session\x1b[0m\r\n")
            }
          } else if (message.type === "status") {
            clearTimeout(reconnectTimeout)
            if (message.status === "running") {
              updateStatus("connected")
              setSessionId(storedSessionId)
              eventSourceRef.current = eventSource
              term.write("\r\n\x1b[1;32m● Reconnected to existing session\x1b[0m\r\n")
            }
          } else if (message.type === "exit") {
            clearTimeout(reconnectTimeout)
            term.write(`\r\n\x1b[1;33m● Session ended (code: ${message.code})\x1b[0m\r\n`)
            updateStatus("closed")
            clearActiveSession()
            eventSource.close()
            eventSourceRef.current = null
          } else if (message.type === "error") {
            term.write(`\x1b[1;31m${message.content}\x1b[0m`)
          }
        } catch (e) {
          console.error("Failed to parse SSE message:", e)
        }
      }

      eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
          clearTimeout(reconnectTimeout)
          console.log("[EmbeddedTerminal] SSE connection closed during reconnect")
          term.write("\r\n\x1b[1;33m● Could not reconnect\x1b[0m\r\n")
          clearActiveSession()
          updateStatus("idle")
          term.write("\x1b[90m  Click 'Start' to begin a new session\x1b[0m\r\n")
        }
      }

      // Send initial resize
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
        sendResize(term.cols, term.rows)
      }

      return true
    } catch (err) {
      console.error("[EmbeddedTerminal] Reconnection failed:", err)
      clearActiveSession()
      updateStatus("idle")
      return false
    }
  }, [clearActiveSession, sendResize, updateStatus, status])

  // Initialize xterm.js
  useEffect(() => {
    if (!terminalRef.current || isInitializedRef.current) return
    isInitializedRef.current = true

    let term: any = null
    let fitAddon: any = null
    let resizeObserver: ResizeObserver | null = null

    const initTerminal = async () => {
      try {
        const { Terminal } = await import("@xterm/xterm")
        const { FitAddon } = await import("@xterm/addon-fit")
        await import("@xterm/xterm/css/xterm.css")

        term = new Terminal({
          cursorBlink: true,
          fontSize: 13,
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
          scrollback: 5000,
        })

        fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.open(terminalRef.current!)

        // Wait for container to have proper dimensions
        await new Promise(resolve => setTimeout(resolve, 150))
        fitAddon.fit()

        xtermRef.current = term
        fitAddonRef.current = fitAddon

        // Handle terminal input
        term.onData((data: string) => {
          sendInput(data)
        })

        // Handle paste events for images
        const handlePaste = async (e: ClipboardEvent) => {
          const items = e.clipboardData?.items
          if (!items) return

          for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
              e.preventDefault() // Prevent default paste behavior

              const blob = item.getAsFile()
              if (!blob) continue

              // Convert to base64
              const reader = new FileReader()
              reader.onloadend = () => {
                const base64 = reader.result as string
                handleImagePaste(base64)
              }
              reader.readAsDataURL(blob)
              return // Only handle first image
            }
          }
        }

        // Store reference for cleanup
        pasteHandlerRef.current = handlePaste

        // Add paste listener to the terminal container
        const termContainer = terminalRef.current
        if (termContainer) {
          termContainer.addEventListener("paste", handlePaste as unknown as EventListener)
        }

        // Handle resize with debouncing
        let resizeTimeout: ReturnType<typeof setTimeout> | null = null
        resizeObserver = new ResizeObserver(() => {
          if (resizeTimeout) clearTimeout(resizeTimeout)
          resizeTimeout = setTimeout(() => {
            if (fitAddon && term && terminalRef.current) {
              try {
                fitAddon.fit()
                sendResize(term.cols, term.rows)
              } catch (e) {
                // Ignore resize errors
              }
            }
          }, 100)
        })

        if (terminalRef.current) {
          resizeObserver.observe(terminalRef.current)
        }

        // Check for existing active session to reconnect
        const storedSessionId = getStoredActiveSession()
        if (storedSessionId && currentWorkingDirectory) {
          term.write("\x1b[1;36m● Found existing session, attempting reconnect...\x1b[0m\r\n")
          setTimeout(() => {
            reconnectToSession(storedSessionId)
          }, 500)
        } else if (reconnectToTmux && currentWorkingDirectory) {
          // Auto-reconnect to existing tmux session (persistent session across navigation)
          term.write("\x1b[1;36m● Reconnecting to tmux session: " + reconnectToTmux + "\x1b[0m\r\n")
          setTimeout(() => {
            startSession()
          }, 500)
        } else {
          // Show ready message
          term.write("\x1b[1;36m● Ready to start Claude Code session\x1b[0m\r\n")
          if (currentWorkingDirectory) {
            term.write(`\x1b[90m  Project: ${currentProjectName}\x1b[0m\r\n`)
            term.write(`\x1b[90m  Directory: ${currentWorkingDirectory}\x1b[0m\r\n`)
            term.write("\x1b[90m  Click 'Start' to begin\x1b[0m\r\n")
          } else {
            term.write("\x1b[90m  Select a project above to get started\x1b[0m\r\n")
          }
        }

      } catch (err) {
        console.error("Failed to initialize terminal:", err)
        updateStatus("error")
      }
    }

    initTerminal()

    const termContainer = terminalRef.current

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      // Remove paste listener
      if (termContainer && pasteHandlerRef.current) {
        termContainer.removeEventListener("paste", pasteHandlerRef.current as unknown as EventListener)
        pasteHandlerRef.current = null
      }
      if (term) {
        term.dispose()
      }
      // Clean up session
      if (sessionIdRef.current) {
        fetch(`/api/claude-code?sessionId=${sessionIdRef.current}`, {
          method: "DELETE"
        }).catch(() => {})
      }
    }
  }, [handleImagePaste]) // Include handleImagePaste in deps

  const isRunning = status === "connecting" || status === "connected" || status === "reconnecting"

  return (
    <div className={cn("flex flex-col bg-[#0d1117] rounded-lg overflow-hidden", className)}>
      {/* Compact options header */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-[#30363d] bg-[#161b22]">
        {/* Start/Stop button */}
        {/* Project selector */}
        <Select
          value={selectedProjectId}
          onValueChange={handleProjectChange}
          disabled={isRunning}
        >
          <SelectTrigger className="h-7 w-40 text-xs bg-transparent border-gray-700">
            <FolderOpen className="h-3 w-3 mr-1 flex-shrink-0 text-gray-400" />
            <span className="truncate">
              {currentProjectName || "Select project..."}
            </span>
          </SelectTrigger>
          <SelectContent>
            {projects.length === 0 ? (
              <SelectItem value="_none" disabled>
                No projects found
              </SelectItem>
            ) : (
              projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {/* Start/Stop button */}
        {isRunning ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={stopSession}
            className="h-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Square className="h-3 w-3 mr-1" />
            Stop
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={startSession}
            disabled={!currentWorkingDirectory}
            className="h-7 text-green-400 hover:text-green-300 hover:bg-green-500/10 disabled:opacity-50"
          >
            <Play className="h-3 w-3 mr-1" />
            Start
          </Button>
        )}

        {/* Continue session toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <Shield className={cn("h-3 w-3", continueSession ? "text-green-400" : "text-gray-500")} />
                <Switch
                  checked={continueSession}
                  onCheckedChange={setContinueSession}
                  disabled={isRunning}
                  className="h-4 w-7 data-[state=checked]:bg-green-600"
                />
                <span className="text-xs text-gray-400">Continue</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Resume from last session (--continue)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Bypass permissions toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className={cn("h-3 w-3", bypassPermissions ? "text-red-400" : "text-gray-500")} />
                <Switch
                  checked={bypassPermissions}
                  onCheckedChange={setBypassPermissions}
                  disabled={isRunning}
                  className="h-4 w-7 data-[state=checked]:bg-red-600"
                />
                <span className="text-xs text-gray-400">Bypass</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-red-300">Skip all permission prompts (dangerous)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Resume session selector */}
        {recentSessions.length > 0 && (
          <Select
            value={resumeSessionId}
            onValueChange={setResumeSessionId}
            disabled={isRunning}
          >
            <SelectTrigger className="h-7 w-32 text-xs bg-transparent border-gray-700">
              <SelectValue placeholder="Resume..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">
                <span className="text-gray-400">New session</span>
              </SelectItem>
              {recentSessions.map((session) => (
                <SelectItem key={session.id} value={session.id}>
                  <span className="text-xs">
                    {session.claudeSessionId
                      ? session.claudeSessionId.slice(0, 12) + "..."
                      : new Date(session.startedAt).toLocaleTimeString()}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Image upload indicator */}
        {isUploadingImage && (
          <div className="flex items-center gap-1.5 text-purple-400">
            <Image className="h-3 w-3 animate-pulse" />
            <span className="text-xs">Uploading...</span>
          </div>
        )}

        {/* Voice input microphone */}
        {isSpeechSupported && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMicClick}
                  disabled={status !== "connected"}
                  className={cn(
                    "h-7 w-7 p-0",
                    status !== "connected" && "opacity-50 cursor-not-allowed",
                    isListening
                      ? "text-red-400 hover:text-red-300 hover:bg-red-500/10 animate-pulse"
                      : "text-gray-400 hover:text-gray-300 hover:bg-gray-500/10"
                  )}
                >
                  {isListening ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {status !== "connected" ? (
                  <p>Connect to a session to use voice input</p>
                ) : (
                  <>
                    <p>{isListening ? "Click to send voice input" : "Click to start voice input"}</p>
                    {isListening && interimTranscript && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">
                        {interimTranscript}
                      </p>
                    )}
                  </>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Status indicator */}
        <div className="ml-auto flex items-center gap-1.5">
          {status === "connecting" && <Loader2 className="h-3 w-3 animate-spin text-yellow-400" />}
          {status === "reconnecting" && <RefreshCw className="h-3 w-3 animate-spin text-blue-400" />}
          <div className={cn(
            "h-2 w-2 rounded-full",
            status === "connected" && "bg-green-400",
            status === "connecting" && "bg-yellow-400 animate-pulse",
            status === "reconnecting" && "bg-blue-400 animate-pulse",
            status === "error" && "bg-red-400",
            (status === "idle" || status === "closed") && "bg-gray-400"
          )} />
          <span className="text-xs text-gray-500 capitalize">{status}</span>
        </div>
      </div>

      {/* Terminal */}
      <div
        ref={terminalRef}
        className="flex-1 w-full min-h-0"
      />
    </div>
  )
}
