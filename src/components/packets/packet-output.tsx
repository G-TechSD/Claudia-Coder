"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Copy, X, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react"
import type { PacketRun, PacketRunStatus } from "@/lib/data/types"

interface PacketOutputProps {
  run: PacketRun
  onClose?: () => void
}

/**
 * Strip ANSI escape codes from text
 */
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "")
}

/**
 * Parse ANSI escape codes and convert to styled spans
 */
function parseAnsiToHtml(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const ansiRegex = /\x1b\[([0-9;]*)m/g

  let lastIndex = 0
  let currentStyle: React.CSSProperties = {}
  let match
  let keyIndex = 0

  while ((match = ansiRegex.exec(text)) !== null) {
    // Add text before this escape code
    if (match.index > lastIndex) {
      const textContent = text.slice(lastIndex, match.index)
      parts.push(
        <span key={keyIndex++} style={currentStyle}>
          {textContent}
        </span>
      )
    }

    // Parse the ANSI codes
    const codes = match[1].split(";").map(Number)
    for (const code of codes) {
      switch (code) {
        case 0: // Reset
          currentStyle = {}
          break
        case 1: // Bold
          currentStyle = { ...currentStyle, fontWeight: "bold" }
          break
        case 2: // Dim
          currentStyle = { ...currentStyle, opacity: 0.7 }
          break
        case 3: // Italic
          currentStyle = { ...currentStyle, fontStyle: "italic" }
          break
        case 4: // Underline
          currentStyle = { ...currentStyle, textDecoration: "underline" }
          break
        case 30: currentStyle = { ...currentStyle, color: "#484f58" }; break // Black
        case 31: currentStyle = { ...currentStyle, color: "#ff7b72" }; break // Red
        case 32: currentStyle = { ...currentStyle, color: "#3fb950" }; break // Green
        case 33: currentStyle = { ...currentStyle, color: "#d29922" }; break // Yellow
        case 34: currentStyle = { ...currentStyle, color: "#58a6ff" }; break // Blue
        case 35: currentStyle = { ...currentStyle, color: "#bc8cff" }; break // Magenta
        case 36: currentStyle = { ...currentStyle, color: "#39c5cf" }; break // Cyan
        case 37: currentStyle = { ...currentStyle, color: "#b1bac4" }; break // White
        case 90: currentStyle = { ...currentStyle, color: "#6e7681" }; break // Bright Black
        case 91: currentStyle = { ...currentStyle, color: "#ffa198" }; break // Bright Red
        case 92: currentStyle = { ...currentStyle, color: "#56d364" }; break // Bright Green
        case 93: currentStyle = { ...currentStyle, color: "#e3b341" }; break // Bright Yellow
        case 94: currentStyle = { ...currentStyle, color: "#79c0ff" }; break // Bright Blue
        case 95: currentStyle = { ...currentStyle, color: "#d2a8ff" }; break // Bright Magenta
        case 96: currentStyle = { ...currentStyle, color: "#56d4dd" }; break // Bright Cyan
        case 97: currentStyle = { ...currentStyle, color: "#f0f6fc" }; break // Bright White
        default:
          break
      }
    }

    lastIndex = ansiRegex.lastIndex
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(
      <span key={keyIndex++} style={currentStyle}>
        {text.slice(lastIndex)}
      </span>
    )
  }

  return parts
}

/**
 * Format duration between two dates
 */
function formatDuration(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt)
  const end = completedAt ? new Date(completedAt) : new Date()
  const diffMs = end.getTime() - start.getTime()

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  })
}

/**
 * Status configuration for visual styling
 */
const statusConfig: Record<PacketRunStatus, {
  icon: typeof Clock
  color: string
  bgColor: string
  label: string
}> = {
  running: {
    icon: Loader2,
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    label: "Running"
  },
  completed: {
    icon: CheckCircle,
    color: "text-green-400",
    bgColor: "bg-green-400/10",
    label: "Completed"
  },
  failed: {
    icon: XCircle,
    color: "text-red-400",
    bgColor: "bg-red-400/10",
    label: "Failed"
  },
  cancelled: {
    icon: XCircle,
    color: "text-gray-400",
    bgColor: "bg-gray-400/10",
    label: "Cancelled"
  }
}

export function PacketOutput({ run, onClose }: PacketOutputProps) {
  const outputRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const prevOutputLengthRef = useRef(0)

  // Auto-scroll to bottom when output updates
  useEffect(() => {
    if (outputRef.current && run.output.length > prevOutputLengthRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
    prevOutputLengthRef.current = run.output.length
  }, [run.output])

  // Copy output to clipboard
  const handleCopy = useCallback(async () => {
    try {
      // Copy plain text without ANSI codes
      await navigator.clipboard.writeText(stripAnsi(run.output))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy output:", err)
    }
  }, [run.output])

  const config = statusConfig[run.status]
  const StatusIcon = config.icon

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex-none pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            Packet Run Output
            <Badge variant="outline" className="font-mono text-xs">
              #{run.iteration}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5 h-8"
            >
              <Copy className="h-4 w-4" />
              {copied ? "Copied!" : "Copy Output"}
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Metadata bar */}
        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
          {/* Status */}
          <div className={cn("flex items-center gap-1.5", config.color)}>
            <StatusIcon className={cn("h-4 w-4", run.status === "running" && "animate-spin")} />
            <span className="font-medium">{config.label}</span>
          </div>

          {/* Started at */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Started: {formatDate(run.startedAt)}</span>
          </div>

          {/* Duration */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span>Duration: {formatDuration(run.startedAt, run.completedAt)}</span>
          </div>

          {/* Exit code */}
          {run.exitCode !== undefined && (
            <Badge
              variant="outline"
              className={cn(
                "font-mono",
                run.exitCode === 0 ? "text-green-400 border-green-400/50" : "text-red-400 border-red-400/50"
              )}
            >
              Exit: {run.exitCode}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0">
        {/* Terminal-style output container */}
        <div
          ref={outputRef}
          className="h-full overflow-auto font-mono text-sm leading-relaxed px-4 py-3"
          style={{
            backgroundColor: "#0d1117",
            color: "#c9d1d9",
            minHeight: "200px"
          }}
        >
          {run.output ? (
            <pre className="whitespace-pre-wrap break-words m-0">
              {parseAnsiToHtml(run.output)}
            </pre>
          ) : (
            <div className="flex items-center justify-center h-full text-[#6e7681]">
              {run.status === "running" ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Waiting for output...</span>
                </div>
              ) : (
                <span>No output recorded</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
