"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Play, Square, RefreshCw, Loader2, FileText, History, Shield, Radio, Zap, Users, PanelRight, PanelBottom, Layers, GripVertical, AlertTriangle } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MiniMePanel } from "./mini-me-panel"
import { MiniMeAgent, MiniMeStatus } from "./mini-me"
import { useAuth } from "@/components/auth/auth-provider"

// LocalStorage key for persistent session settings
const STORAGE_KEY_NEVER_LOSE_SESSION = "claude-code-never-lose-session"
const STORAGE_KEY_RECENT_SESSIONS = "claude-code-recent-sessions"
const STORAGE_KEY_BACKGROUND_SESSIONS = "claude-code-background-sessions"
const STORAGE_KEY_AUTO_KICKOFF = "claude-code-auto-kickoff"
const STORAGE_KEY_BYPASS_PERMISSIONS = "claude-code-bypass-permissions"
const STORAGE_KEY_MINI_ME_MODE = "claude-code-mini-me-mode"
const STORAGE_KEY_MINI_ME_LAYOUT = "claude-code-mini-me-layout"
const STORAGE_KEY_MINI_ME_PANEL_SIZE = "claude-code-mini-me-panel-size"

// Mini-Me panel layout types
type MiniMePanelLayout = "side" | "bottom" | "floating"

// Maximum number of recent sessions to store
const MAX_RECENT_SESSIONS = 10

/**
 * Resize Handle component for resizable panels
 * Exported for use in multi-terminal dashboard
 */
export function ResizeHandle({
  direction,
  onResize
}: {
  direction: "horizontal" | "vertical"
  onResize: (delta: number) => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const startPosRef = useRef(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    startPosRef.current = direction === "horizontal" ? e.clientX : e.clientY
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = direction === "horizontal" ? e.clientX : e.clientY
      const delta = direction === "horizontal"
        ? startPosRef.current - currentPos  // For side panel, moving left = larger
        : startPosRef.current - currentPos  // For bottom panel, moving up = larger
      onResize(delta)
      startPosRef.current = currentPos
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, direction, onResize])

  return (
    <div
      onMouseDown={handleMouseDown}
      className={cn(
        "flex items-center justify-center transition-colors hover:bg-cyan-500/30 flex-shrink-0",
        isDragging && "bg-cyan-500/50",
        direction === "horizontal"
          ? "w-1.5 cursor-col-resize"
          : "h-1.5 cursor-row-resize"
      )}
    >
      <GripVertical className={cn(
        "h-4 w-4 text-gray-600",
        direction === "vertical" && "rotate-90",
        isDragging && "text-cyan-400"
      )} />
    </div>
  )
}

interface RecentSession {
  id: string                    // Claudia's session ID
  claudeSessionId?: string      // Claude CLI's internal session ID for --resume
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
  // Auth for passing user info to API
  const { user } = useAuth()

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
  // Default OFF - will be set to true only if there are existing sessions for this project
  // This ensures first run is fresh, subsequent runs continue
  const [continueSession, setContinueSession] = useState(false)
  const [resumeSessionId, setResumeSessionId] = useState<string>("")
  const [neverLoseSession, setNeverLoseSession] = useState(false)
  const [autoKickoff, setAutoKickoff] = useState(false)
  const [bypassPermissionsLocal, setBypassPermissionsLocal] = useState(false) // Dangerous mode toggle
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [backgroundSessions, setBackgroundSessions] = useState<BackgroundSession[]>([])
  const [showSessionOptions, setShowSessionOptions] = useState(false)
  const [miniMeMode, setMiniMeMode] = useState(false)
  const [activeSubAgents, setActiveSubAgents] = useState(0)

  // Mini-Me Panel states
  const [miniMeAgents, setMiniMeAgents] = useState<MiniMeAgent[]>([])
  const [miniMePanelLayout, setMiniMePanelLayout] = useState<MiniMePanelLayout>("side")
  const [miniMePanelSize, setMiniMePanelSize] = useState(320)
  const [showMiniMePanel, setShowMiniMePanel] = useState(false)
  const miniMeIdCounterRef = useRef(0)

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

      // Load "auto kickoff" setting
      const savedAutoKickoff = localStorage.getItem(STORAGE_KEY_AUTO_KICKOFF)
      if (savedAutoKickoff === "true") {
        setAutoKickoff(true)
      }

      // Load "bypass permissions" setting
      const savedBypassPermissions = localStorage.getItem(STORAGE_KEY_BYPASS_PERMISSIONS)
      if (savedBypassPermissions === "true") {
        setBypassPermissionsLocal(true)
      }

      // Load "mini-me mode" setting
      const savedMiniMeMode = localStorage.getItem(STORAGE_KEY_MINI_ME_MODE)
      if (savedMiniMeMode === "true") {
        setMiniMeMode(true)
      }

      // Load Mini-Me panel layout
      const savedLayout = localStorage.getItem(STORAGE_KEY_MINI_ME_LAYOUT) as MiniMePanelLayout | null
      if (savedLayout && ["side", "bottom", "floating"].includes(savedLayout)) {
        setMiniMePanelLayout(savedLayout)
      }

      // Load Mini-Me panel size
      const savedPanelSize = localStorage.getItem(STORAGE_KEY_MINI_ME_PANEL_SIZE)
      if (savedPanelSize) {
        const size = parseInt(savedPanelSize, 10)
        if (!isNaN(size) && size >= 200 && size <= 600) {
          setMiniMePanelSize(size)
        }
      }

      // Load recent sessions
      try {
        const savedSessions = localStorage.getItem(STORAGE_KEY_RECENT_SESSIONS)
        if (savedSessions) {
          const parsed = JSON.parse(savedSessions) as RecentSession[]
          // Filter to only sessions for this project
          const projectSessions = parsed.filter(s => s.projectId === projectId)
          setRecentSessions(projectSessions)

          // IMPORTANT: Only enable continueSession if there are existing sessions
          // First run should be fresh (no --continue), subsequent runs should continue
          if (projectSessions.length > 0) {
            setContinueSession(true) // Has previous sessions - enable continue
          } else {
            setContinueSession(false) // First time - start fresh
          }
        } else {
          // No sessions saved at all - first time, start fresh
          setContinueSession(false)
        }
      } catch (e) {
        console.error("[Terminal] Failed to load recent sessions:", e)
        setContinueSession(false) // On error, default to fresh start
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

  // Save "auto kickoff" setting when it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_AUTO_KICKOFF, autoKickoff.toString())
    }
  }, [autoKickoff])

  // Save "bypass permissions" setting when it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_BYPASS_PERMISSIONS, bypassPermissionsLocal.toString())
    }
  }, [bypassPermissionsLocal])

  // Save "mini-me mode" setting when it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_MINI_ME_MODE, miniMeMode.toString())
      // Auto-show panel when mode is enabled
      if (miniMeMode) {
        setShowMiniMePanel(true)
      }
    }
  }, [miniMeMode])

  // Save Mini-Me panel layout when it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_MINI_ME_LAYOUT, miniMePanelLayout)
    }
  }, [miniMePanelLayout])

  // Save Mini-Me panel size when it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_MINI_ME_PANEL_SIZE, miniMePanelSize.toString())
    }
  }, [miniMePanelSize])

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
  // Returns: { success: boolean, skipped?: boolean, reason?: string }
  const refreshKickoff = useCallback(async (): Promise<{ success: boolean; skipped?: boolean; reason?: string }> => {
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
        return { success: false }
      }

      const data = await response.json()

      // Handle skipped case (developer paths like claudia-admin)
      if (data.skipped) {
        console.log("[Terminal] KICKOFF.md skipped:", data.reason)
        setKickoffStatus("ready")
        return { success: true, skipped: true, reason: data.reason }
      }

      console.log("[Terminal] KICKOFF.md generated:", data.kickoffPath)
      setKickoffStatus("ready")

      if (xtermRef.current) {
        xtermRef.current.write("\r\n\x1b[1;32m● KICKOFF.md updated\x1b[0m\r\n")
      }

      return { success: true }
    } catch (err) {
      console.error("[Terminal] Failed to refresh kickoff:", err)
      setKickoffStatus("error")
      return { success: false }
    }
  }, [projectId, projectName, projectDescription, workingDirectory, currentPacket, allPackets])

  // Send the initial prompt to Claude Code
  const sendInitialPrompt = useCallback(async () => {
    if (initialPromptSentRef.current) return
    initialPromptSentRef.current = true

    // Use "build this app" for auto kickoff, otherwise use provided prompt or default
    const prompt = autoKickoff
      ? "build this app"
      : (initialPrompt || "Read KICKOFF.md for your instructions and current task.")

    // Wait a brief moment for Claude Code to fully initialize
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Send the initial message
    await sendInput(prompt + "\n")

    if (xtermRef.current) {
      console.log("[Terminal] Sent initial prompt:", prompt, autoKickoff ? "(auto kickoff)" : "")
    }
  }, [initialPrompt, sendInput, autoKickoff])

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

  // Parse terminal output to detect Mini-Me (Task tool) events
  const parseTerminalOutputForMiniMe = useCallback((content: string) => {
    if (!miniMeMode) return

    // Detection patterns for Task tool / agent spawning
    // Pattern 1: "Task:" or "Spawning agent" - new Mini-Me
    const taskSpawnPatterns = [
      /Task:\s*(.+?)(?:\n|$)/i,
      /Spawning\s+(?:agent|task)[:\s]*(.+?)(?:\n|$)/i,
      /Starting\s+(?:sub-?)?agent[:\s]*(.+?)(?:\n|$)/i,
      /(?:Task|Agent)\s+spawned[:\s]*(.+?)(?:\n|$)/i,
      /Running\s+parallel\s+task[:\s]*(.+?)(?:\n|$)/i,
      /TodoWrite.*"content":\s*"([^"]+)"/i,
    ]

    // Pattern 2: Agent ID extraction
    const agentIdPattern = /(?:agent[_-]?id|task[_-]?id)[:\s]*([a-zA-Z0-9_-]+)/i

    // Pattern 3: "Agent completed" or task result - update to completed
    const completionPatterns = [
      /Agent\s+completed[:\s]*(.+?)(?:\n|$)/i,
      /Task\s+(?:completed|finished)[:\s]*(.+?)(?:\n|$)/i,
      /Sub-?agent\s+finished[:\s]*(.+?)(?:\n|$)/i,
      /completed\s+successfully/i,
      /Task\s+result[:\s]*(.+?)(?:\n|$)/i,
    ]

    // Pattern 4: "Agent failed" or error - update to failed
    const failurePatterns = [
      /Agent\s+failed[:\s]*(.+?)(?:\n|$)/i,
      /Task\s+(?:failed|error)[:\s]*(.+?)(?:\n|$)/i,
      /Sub-?agent\s+error[:\s]*(.+?)(?:\n|$)/i,
      /Error\s+in\s+(?:task|agent)[:\s]*(.+?)(?:\n|$)/i,
    ]

    // Check for new task spawn
    for (const pattern of taskSpawnPatterns) {
      const match = content.match(pattern)
      if (match) {
        const taskDescription = match[1]?.trim() || "Sub-agent task"
        const idMatch = content.match(agentIdPattern)
        const agentId = idMatch?.[1] || `agent-${Date.now().toString(36)}-${(miniMeIdCounterRef.current++).toString(36)}`

        // Don't add duplicate agents
        setMiniMeAgents(prev => {
          const exists = prev.some(a => a.id === agentId || (a.task === taskDescription && a.status !== "completed" && a.status !== "failed"))
          if (exists) return prev

          const newAgent: MiniMeAgent = {
            id: agentId,
            status: "spawning",
            task: taskDescription,
            startedAt: new Date()
          }

          // Transition to "running" after a brief delay
          setTimeout(() => {
            setMiniMeAgents(agents =>
              agents.map(a =>
                a.id === agentId && a.status === "spawning"
                  ? { ...a, status: "running" as MiniMeStatus }
                  : a
              )
            )
          }, 800)

          return [...prev, newAgent]
        })

        setActiveSubAgents(prev => prev + 1)
        break
      }
    }

    // Check for completion
    for (const pattern of completionPatterns) {
      if (pattern.test(content)) {
        // Mark the most recent running/spawning agent as completed
        setMiniMeAgents(prev => {
          const runningIdx = prev.findIndex(a => a.status === "running" || a.status === "spawning")
          if (runningIdx === -1) return prev

          return prev.map((a, i) =>
            i === runningIdx
              ? { ...a, status: "completed" as MiniMeStatus, completedAt: new Date() }
              : a
          )
        })
        setActiveSubAgents(prev => Math.max(0, prev - 1))
        break
      }
    }

    // Check for failure
    for (const pattern of failurePatterns) {
      const match = content.match(pattern)
      if (match) {
        const errorMsg = match[1]?.trim() || "Task execution failed"
        // Mark the most recent running/spawning agent as failed
        setMiniMeAgents(prev => {
          const runningIdx = prev.findIndex(a => a.status === "running" || a.status === "spawning")
          if (runningIdx === -1) return prev

          return prev.map((a, i) =>
            i === runningIdx
              ? { ...a, status: "failed" as MiniMeStatus, completedAt: new Date(), error: errorMsg }
              : a
          )
        })
        setActiveSubAgents(prev => Math.max(0, prev - 1))
        break
      }
    }
  }, [miniMeMode])

  // Handle Mini-Me panel resize
  const handleMiniMePanelResize = useCallback((delta: number) => {
    setMiniMePanelSize(prev => {
      const newSize = miniMePanelLayout === "side"
        ? Math.max(200, Math.min(600, prev + delta))
        : Math.max(150, Math.min(400, prev + delta))
      return newSize
    })
  }, [miniMePanelLayout])

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

    // Combine prop and local state for bypass permissions
    const effectiveBypassPermissions = bypassPermissions || bypassPermissionsLocal

    // Show session options being used
    const useContinue = continueSession || neverLoseSession
    const useResume = resumeSessionId && resumeSessionId !== ""

    // Get Claude's session ID for proper resume (not Claudia's session ID)
    const selectedSession = recentSessions.find(s => s.id === resumeSessionId)
    const claudeIdToResume = selectedSession?.claudeSessionId

    if (useContinue && !useResume) {
      term.write("\x1b[90m  Mode: --continue (resuming last session)\x1b[0m\r\n")
    } else if (useResume) {
      if (claudeIdToResume) {
        term.write(`\x1b[90m  Mode: --resume ${claudeIdToResume}\x1b[0m\r\n`)
      } else {
        term.write(`\x1b[33m  Warning: Session selected but no Claude session ID found, using --continue instead\x1b[0m\r\n`)
      }
    }

    if (neverLoseSession) {
      term.write("\x1b[90m  Persistent session: enabled\x1b[0m\r\n")
    }

    if (effectiveBypassPermissions) {
      term.write("\x1b[1;33m  WARNING: Bypass permissions enabled (dangerous)\x1b[0m\r\n")
    }

    // Generate KICKOFF.md before starting the session (unless developer path)
    term.write("\x1b[90m  Generating KICKOFF.md...\x1b[0m\r\n")
    const kickoffResult = await refreshKickoff()
    if (kickoffResult.skipped) {
      term.write("\x1b[90m  KICKOFF.md skipped (developer mode)\x1b[0m\r\n")
    } else if (kickoffResult.success) {
      term.write("\x1b[90m  KICKOFF.md ready\x1b[0m\r\n")
    } else {
      term.write("\x1b[33m  Warning: Could not generate KICKOFF.md\x1b[0m\r\n")
    }

    try {
      // Determine resume behavior: use Claude's session ID if available, otherwise fall back to --continue
      const shouldResume = useResume && !!claudeIdToResume
      const shouldContinue = useContinue || (useResume && !claudeIdToResume)

      const response = await fetch("/api/claude-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          workingDirectory,
          bypassPermissions: effectiveBypassPermissions,
          continueSession: shouldContinue && !shouldResume, // Only use continue if not resuming
          resume: shouldResume,
          resumeSessionId: shouldResume ? claudeIdToResume : undefined,
          isBackground: neverLoseSession, // Track as background if never lose is enabled
          // Pass user info for authorization checks
          userId: user?.id,
          userRole: user?.role,
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

            // Parse terminal output for Mini-Me agent detection when enabled
            parseTerminalOutputForMiniMe(message.content as string)
          } else if (message.type === "status") {
            if (message.status === "running") {
              setStatus("connected")
              // Send initial prompt once Claude Code is ready
              sendInitialPrompt()
            }
          } else if (message.type === "claude_session_id") {
            // Store Claude's internal session ID for proper --resume functionality
            const claudeId = message.claudeSessionId
            console.log("[Terminal] Received Claude session ID:", claudeId)

            // Update the stored session with Claude's session ID
            try {
              const savedSessions = localStorage.getItem(STORAGE_KEY_RECENT_SESSIONS)
              if (savedSessions) {
                const sessions: RecentSession[] = JSON.parse(savedSessions)
                const sessionToUpdate = sessions.find(s => s.id === newSessionId)
                if (sessionToUpdate) {
                  sessionToUpdate.claudeSessionId = claudeId
                  localStorage.setItem(STORAGE_KEY_RECENT_SESSIONS, JSON.stringify(sessions))
                  setRecentSessions(sessions.filter(s => s.projectId === projectId))
                  term.write(`\x1b[90m  Claude session ID captured for resume\x1b[0m\r\n`)
                }
              }
            } catch (e) {
              console.error("[Terminal] Failed to update session with Claude ID:", e)
            }
          } else if (message.type === "exit") {
            term.write(`\r\n\x1b[1;33m● Session ended (code: ${message.code})\x1b[0m\r\n`)
            setStatus("closed")
            setActiveSubAgents(0) // Reset sub-agent count on session end
            // Don't clear miniMeAgents - keep history visible
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
  }, [projectId, workingDirectory, bypassPermissions, bypassPermissionsLocal, sendResize, onSessionEnd, status, refreshKickoff, sendInitialPrompt, continueSession, neverLoseSession, resumeSessionId, recentSessions, parseTerminalOutputForMiniMe])

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

          {/* Background session indicator */}
          {hasBackgroundSession && status !== "connected" && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">
              <Radio className="h-3 w-3 animate-pulse" />
              <span>Background session active</span>
            </div>
          )}

          {/* Mini-Me mode active indicator */}
          {miniMeMode && status === "connected" && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs bg-cyan-500/20 text-cyan-400">
              <Users className="h-3 w-3" />
              <span>Mini-Me Mode</span>
              {activeSubAgents > 0 && (
                <span className="flex items-center gap-1 px-1 py-0.5 rounded bg-cyan-500/30 text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  {activeSubAgents}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Session Options Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSessionOptions(!showSessionOptions)}
            className={cn(
              "text-gray-400 hover:text-gray-300 hover:bg-gray-500/10 h-7",
              showSessionOptions && "bg-gray-500/20 text-gray-300"
            )}
            title="Session options"
          >
            <History className="h-3 w-3 mr-1" />
            Options
          </Button>

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

      {/* Session Options Panel */}
      {showSessionOptions && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-2 bg-[#161b22] border-b border-[#30363d]">
          {/* Continue Session Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              checked={continueSession}
              onCheckedChange={setContinueSession}
              disabled={neverLoseSession}
              className="data-[state=checked]:bg-blue-600"
            />
            <label className="text-xs text-[#8b949e] cursor-pointer" onClick={() => !neverLoseSession && setContinueSession(!continueSession)}>
              Continue Session
              <span className="ml-1 text-[#6e7681]">(--continue)</span>
            </label>
          </div>

          {/* Resume Session Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#8b949e]">Resume:</label>
            <Select value={resumeSessionId} onValueChange={setResumeSessionId}>
              <SelectTrigger className="h-7 w-48 text-xs bg-[#0d1117] border-[#30363d] text-[#c9d1d9]">
                <SelectValue placeholder="Select session..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  <span className="text-[#8b949e]">None (start fresh)</span>
                </SelectItem>
                {recentSessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    <div className="flex flex-col">
                      <span className="text-xs">
                        {session.claudeSessionId
                          ? `Claude: ${session.claudeSessionId.slice(0, 15)}...`
                          : `${session.id.slice(0, 20)}...`}
                      </span>
                      <span className="text-[10px] text-[#6e7681]">
                        {new Date(session.startedAt).toLocaleString()}
                        {!session.claudeSessionId && " (no resume ID)"}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Never Lose Session Toggle */}
          <div className="flex items-center gap-2 ml-auto">
            <Shield className={cn("h-3.5 w-3.5", neverLoseSession ? "text-green-400" : "text-[#6e7681]")} />
            <Switch
              checked={neverLoseSession}
              onCheckedChange={setNeverLoseSession}
              className="data-[state=checked]:bg-green-600"
            />
            <label
              className="text-xs text-[#8b949e] cursor-pointer"
              onClick={() => setNeverLoseSession(!neverLoseSession)}
              title="Automatically use --continue on every session start. Session state persists even if browser is closed."
            >
              Never Lose Session
            </label>
          </div>

          {/* Auto Project Kickoff Toggle */}
          <div className="flex items-center gap-2">
            <Zap className={cn("h-3.5 w-3.5", autoKickoff ? "text-yellow-400" : "text-[#6e7681]")} />
            <Switch
              checked={autoKickoff}
              onCheckedChange={setAutoKickoff}
              className="data-[state=checked]:bg-yellow-600"
            />
            <label
              className="text-xs text-[#8b949e] cursor-pointer"
              onClick={() => setAutoKickoff(!autoKickoff)}
              title="Automatically send 'build this app' when session starts. Combined with bypass permissions for fully autonomous operation."
            >
              Auto Kickoff
            </label>
          </div>

          {/* Bypass Permissions Toggle (Dangerous) */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={cn("h-3.5 w-3.5", bypassPermissionsLocal ? "text-red-400" : "text-[#6e7681]")} />
                  <Switch
                    checked={bypassPermissionsLocal}
                    onCheckedChange={setBypassPermissionsLocal}
                    className="data-[state=checked]:bg-red-600"
                  />
                  <label
                    className={cn(
                      "text-xs cursor-pointer",
                      bypassPermissionsLocal ? "text-red-400" : "text-[#8b949e]"
                    )}
                    onClick={() => setBypassPermissionsLocal(!bypassPermissionsLocal)}
                  >
                    Bypass Permissions
                  </label>
                  {bypassPermissionsLocal && (
                    <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-medium">
                      DANGEROUS
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-red-300">Skips all permission prompts. Claude can execute any command without asking. Use only for trusted projects.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Mini-Me Mode Toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <Users className={cn("h-3.5 w-3.5", miniMeMode ? "text-cyan-400" : "text-[#6e7681]")} />
                  <Switch
                    checked={miniMeMode}
                    onCheckedChange={setMiniMeMode}
                    className="data-[state=checked]:bg-cyan-600"
                  />
                  <label
                    className="text-xs text-[#8b949e] cursor-pointer"
                    onClick={() => setMiniMeMode(!miniMeMode)}
                  >
                    Mini-Me Mode
                  </label>
                  {miniMeMode && activeSubAgents > 0 && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      {activeSubAgents} active
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p>Enable parallel sub-agent processing. Sub-agents appear as Mini-Me&apos;s working in parallel.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Mini-Me Panel Layout Selector (when Mini-Me mode is enabled) */}
          {miniMeMode && (
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-[#30363d]">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setMiniMePanelLayout("side")}
                      className={cn(
                        "p-1 rounded hover:bg-gray-700/50",
                        miniMePanelLayout === "side" ? "bg-gray-700/50 text-cyan-400" : "text-gray-500"
                      )}
                    >
                      <PanelRight className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Side panel</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setMiniMePanelLayout("bottom")}
                      className={cn(
                        "p-1 rounded hover:bg-gray-700/50",
                        miniMePanelLayout === "bottom" ? "bg-gray-700/50 text-cyan-400" : "text-gray-500"
                      )}
                    >
                      <PanelBottom className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Bottom panel</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setMiniMePanelLayout("floating")}
                      className={cn(
                        "p-1 rounded hover:bg-gray-700/50",
                        miniMePanelLayout === "floating" ? "bg-gray-700/50 text-cyan-400" : "text-gray-500"
                      )}
                    >
                      <Layers className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Floating panel</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <button
                onClick={() => setShowMiniMePanel(!showMiniMePanel)}
                className={cn(
                  "ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
                  showMiniMePanel
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "bg-gray-700/50 text-gray-400 hover:text-gray-300"
                )}
              >
                {showMiniMePanel ? "Hide" : "Show"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main content area - handles side panel layout */}
      <div className={cn(
        "flex-1 flex overflow-hidden",
        miniMePanelLayout === "side" && showMiniMePanel && miniMeMode ? "flex-row" : "flex-col"
      )}>
        {/* Terminal + Bottom Panel wrapper */}
        <div className={cn(
          "flex flex-col flex-1 min-w-0",
          miniMePanelLayout === "bottom" && showMiniMePanel && miniMeMode && "overflow-hidden"
        )}>
          {/* Terminal container */}
          <div
            ref={terminalRef}
            className="flex-1 w-full"
            style={{ minHeight: miniMePanelLayout === "bottom" && showMiniMePanel && miniMeMode ? "200px" : "400px" }}
          />

          {/* Bottom Panel with Resize Handle */}
          {miniMeMode && showMiniMePanel && miniMePanelLayout === "bottom" && (
            <>
              {/* Resize Handle for Bottom Panel */}
              <ResizeHandle
                direction="vertical"
                onResize={handleMiniMePanelResize}
              />
              <div
                className="border-t border-[#30363d] bg-[#0d1117] overflow-hidden"
                style={{ height: miniMePanelSize }}
              >
                <MiniMePanel
                  agents={miniMeAgents}
                  defaultExpanded={true}
                  title={`Mini-Me's (${activeSubAgents} active)`}
                />
              </div>
            </>
          )}
        </div>

        {/* Side Panel with Resize Handle */}
        {miniMeMode && showMiniMePanel && miniMePanelLayout === "side" && (
          <>
            {/* Resize Handle for Side Panel */}
            <ResizeHandle
              direction="horizontal"
              onResize={handleMiniMePanelResize}
            />
            <div
              className="border-l border-[#30363d] bg-[#0d1117] overflow-y-auto"
              style={{ width: miniMePanelSize }}
            >
              <MiniMePanel
                agents={miniMeAgents}
                defaultExpanded={true}
                title={`Mini-Me's (${activeSubAgents} active)`}
              />
            </div>
          </>
        )}
      </div>

      {/* Floating Panel */}
      {miniMeMode && showMiniMePanel && miniMePanelLayout === "floating" && (
        <div
          className="absolute bottom-4 right-4 z-50 rounded-lg border border-[#30363d] bg-[#0d1117] shadow-2xl overflow-hidden"
          style={{ width: 360, maxHeight: 400 }}
        >
          <MiniMePanel
            agents={miniMeAgents}
            defaultExpanded={true}
            title={`Mini-Me's (${activeSubAgents} active)`}
          />
        </div>
      )}

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
