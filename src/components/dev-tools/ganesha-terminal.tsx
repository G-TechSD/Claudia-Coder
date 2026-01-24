"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Play, Square, RefreshCw, Loader2, Sparkles, Zap, History, Clock } from "lucide-react"
import { GaneshaMode } from "@/lib/dev-tools/types"

interface GaneshaTerminalProps {
  projectId: string
  projectName: string
  workingDirectory: string
  className?: string
  onSessionEnd?: () => void
}

export function GaneshaTerminal({
  projectId,
  projectName,
  workingDirectory,
  className,
  onSessionEnd,
}: GaneshaTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error" | "closed">("idle")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const isInitializedRef = useRef(false)
  const sessionIdRef = useRef<string | null>(null)

  // Ganesha-specific settings
  const [mode, setMode] = useState<GaneshaMode>("interactive")
  const [fluxDuration, setFluxDuration] = useState("30m")
  const [resumeLast, setResumeLast] = useState(false)

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  // Send input to the terminal
  const sendInput = useCallback(async (input: string) => {
    const currentSessionId = sessionIdRef.current
    if (!currentSessionId) return

    try {
      const response = await fetch("/api/dev-tools/ganesha", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId, input }),
      })

      if (!response.ok) {
        const data = await response.json()
        console.error("[Ganesha] Failed to send input:", data.error)
        if (response.status === 404) {
          setError("Session disconnected")
          setStatus("error")
        }
      }
    } catch (err) {
      console.error("[Ganesha] Failed to send input:", err)
    }
  }, [])

  // Resize the terminal
  const sendResize = useCallback(async (cols: number, rows: number) => {
    const currentSessionId = sessionIdRef.current
    if (!currentSessionId) return

    try {
      await fetch("/api/dev-tools/ganesha", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId, resize: { cols, rows } }),
      })
    } catch (err) {
      console.error("[Ganesha] Failed to send resize:", err)
    }
  }, [])

  // Stop the session
  const stopSession = useCallback(async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    const currentSessionId = sessionIdRef.current
    if (currentSessionId) {
      try {
        await fetch(`/api/dev-tools/ganesha?sessionId=${currentSessionId}`, {
          method: "DELETE",
        })
      } catch (err) {
        console.error("[Ganesha] Failed to stop session:", err)
      }
    }

    setStatus("closed")
    setSessionId(null)
    sessionIdRef.current = null
    onSessionEnd?.()

    if (xtermRef.current) {
      xtermRef.current.write("\r\n\x1b[1;33m● Session stopped\x1b[0m\r\n")
    }
  }, [onSessionEnd])

  // Start a new session
  const startSession = useCallback(async () => {
    if (!xtermRef.current) return

    setStatus("connecting")
    setError(null)

    const term = xtermRef.current
    term.clear()
    term.write("\x1b[1;35m● Starting Ganesha AI session...\x1b[0m\r\n")
    term.write(`\x1b[90m  Directory: ${workingDirectory}\x1b[0m\r\n`)
    term.write(`\x1b[90m  Mode: ${mode}${mode === "flux" ? ` (${fluxDuration})` : ""}\x1b[0m\r\n`)

    try {
      const response = await fetch("/api/dev-tools/ganesha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          workingDirectory,
          mode,
          fluxDuration: mode === "flux" ? fluxDuration : undefined,
          resumeLast,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to start session")
      }

      const newSessionId = data.sessionId
      setSessionId(newSessionId)
      term.write(`\x1b[1;32m● Session started (PID: ${data.pid})\x1b[0m\r\n\r\n`)

      // Connect to SSE stream
      const eventSource = new EventSource(`/api/dev-tools/ganesha?sessionId=${newSessionId}`)
      eventSourceRef.current = eventSource

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

      eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
          setStatus("closed")
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
      setError(message)
      setStatus("error")
      term.write(`\x1b[1;31m● Error: ${message}\x1b[0m\r\n`)
    }
  }, [projectId, workingDirectory, mode, fluxDuration, resumeLast, sendResize, onSessionEnd, status])

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
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Monaco', monospace",
          theme: {
            background: "#1a1625", // Darker purple-tinted background
            foreground: "#e0d0ff",
            cursor: "#a855f7",
            cursorAccent: "#1a1625",
            selectionBackground: "#6b21a8",
            black: "#484f58",
            red: "#ff7b72",
            green: "#3fb950",
            yellow: "#d29922",
            blue: "#a855f7", // Purple tint
            magenta: "#c084fc",
            cyan: "#39c5cf",
            white: "#e0d0ff",
            brightBlack: "#6e7681",
            brightRed: "#ffa198",
            brightGreen: "#56d364",
            brightYellow: "#e3b341",
            brightBlue: "#c084fc",
            brightMagenta: "#e879f9",
            brightCyan: "#56d4dd",
            brightWhite: "#f0e6ff",
          },
          allowProposedApi: true,
          scrollback: 10000,
        })

        fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.open(terminalRef.current!)

        await new Promise((resolve) => setTimeout(resolve, 100))
        fitAddon.fit()

        xtermRef.current = term
        fitAddonRef.current = fitAddon

        term.onData((data: string) => {
          sendInput(data)
        })

        resizeObserver = new ResizeObserver(() => {
          if (fitAddon && term && terminalRef.current) {
            try {
              fitAddon.fit()
              sendResize(term.cols, term.rows)
            } catch {
              // Ignore resize errors
            }
          }
        })

        if (terminalRef.current) {
          resizeObserver.observe(terminalRef.current)
        }

        term.write("\x1b[1;35m● Ganesha AI Terminal\x1b[0m\r\n")
        term.write("\x1b[90mSelect a mode and click Start to begin.\x1b[0m\r\n\r\n")
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
  }, [sendInput, sendResize])

  return (
    <div className={cn("relative flex flex-col rounded-lg overflow-hidden bg-[#1a1625]", className)}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#241b35] border-b border-purple-900/30">
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
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span className="text-sm text-purple-200 font-medium">Ganesha AI</span>
          </div>
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
            <span className="capitalize">{status}</span>
          </div>

          {/* Mode indicator when running */}
          {status === "connected" && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-300">
              {mode === "flux" && <Zap className="h-3 w-3" />}
              {mode === "auto" && <Clock className="h-3 w-3" />}
              {mode === "interactive" && <Sparkles className="h-3 w-3" />}
              <span className="capitalize">{mode}</span>
              {mode === "flux" && <span className="text-purple-400">({fluxDuration})</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(status === "closed" || status === "error" || status === "idle") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={startSession}
              className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-7"
            >
              <Play className="h-3 w-3 mr-1" />
              Start
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

      {/* Mode selector (only when not connected) */}
      {status !== "connected" && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-[#241b35] border-b border-purple-900/30">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-purple-300">Mode:</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as GaneshaMode)}>
              <SelectTrigger className="h-8 w-36 text-xs bg-purple-900/30 border-purple-700/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="interactive">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3 w-3" />
                    Interactive
                  </div>
                </SelectItem>
                <SelectItem value="auto">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Auto
                  </div>
                </SelectItem>
                <SelectItem value="flux">
                  <div className="flex items-center gap-2">
                    <Zap className="h-3 w-3" />
                    Flux
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "flux" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-purple-300">Duration:</Label>
              <Input
                value={fluxDuration}
                onChange={(e) => setFluxDuration(e.target.value)}
                placeholder="30m"
                className="h-8 w-20 text-xs bg-purple-900/30 border-purple-700/50"
              />
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <History className="h-3.5 w-3.5 text-purple-400" />
            <input
              type="checkbox"
              id="resumeLast"
              checked={resumeLast}
              onChange={(e) => setResumeLast(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-purple-700"
            />
            <Label htmlFor="resumeLast" className="text-xs text-purple-300 cursor-pointer">
              Resume Last Session
            </Label>
          </div>
        </div>
      )}

      {/* Terminal container */}
      <div ref={terminalRef} className="flex-1 w-full" style={{ minHeight: "400px" }} />

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
