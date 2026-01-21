/**
 * Hook for streaming Claude Code execution with real-time updates
 *
 * This hook provides a way to execute Claude Code tasks with real-time
 * streaming updates via Server-Sent Events (SSE).
 *
 * Usage:
 * ```tsx
 * const { execute, events, isRunning, error, filesChanged } = useStreamingExecution()
 *
 * // Start execution
 * await execute({
 *   repoPath: '/path/to/project',
 *   prompt: 'Implement feature X',
 *   options: { maxIterations: 10 }
 * })
 *
 * // Events are updated in real-time as execution progresses
 * ```
 */

import { useState, useCallback, useRef } from "react"

export interface StreamingEvent {
  id: string
  type: "start" | "thinking" | "tool_use" | "file_change" | "progress" | "output" | "complete" | "error"
  timestamp: Date
  message: string
  detail?: string
  tool?: string
  file?: string
  command?: string
  content?: string
  progress?: number
  filesChanged?: string[]
  streaming?: boolean
}

export interface StreamingExecutionOptions {
  projectId?: string
  projectName?: string
  repoPath: string
  prompt: string
  options?: {
    maxIterations?: number
    dangerouslySkipPermissions?: boolean
  }
  onEvent?: (event: StreamingEvent) => void
  onComplete?: (result: { success: boolean; filesChanged: string[] }) => void
  onError?: (error: string) => void
}

export interface StreamingExecutionResult {
  execute: (options: StreamingExecutionOptions) => Promise<void>
  cancel: () => void
  events: StreamingEvent[]
  isRunning: boolean
  error: string | null
  filesChanged: string[]
  progress: number
  clearEvents: () => void
}

/**
 * Hook for streaming Claude Code execution
 */
export function useStreamingExecution(): StreamingExecutionResult {
  const [events, setEvents] = useState<StreamingEvent[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filesChanged, setFilesChanged] = useState<string[]>([])
  const [progress, setProgress] = useState(0)

  // Ref to track current abort controller
  const abortControllerRef = useRef<AbortController | null>(null)

  // Accumulated output for streaming text
  const streamingOutputRef = useRef<string>("")

  const addEvent = useCallback((event: Omit<StreamingEvent, "id" | "timestamp">) => {
    const fullEvent: StreamingEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date(),
      ...event
    }
    setEvents(prev => [...prev, fullEvent])
    return fullEvent
  }, [])

  const clearEvents = useCallback(() => {
    setEvents([])
    setError(null)
    setFilesChanged([])
    setProgress(0)
    streamingOutputRef.current = ""
  }, [])

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsRunning(false)
  }, [])

  const execute = useCallback(async (options: StreamingExecutionOptions) => {
    const {
      projectId,
      projectName,
      repoPath,
      prompt,
      options: execOptions,
      onEvent,
      onComplete,
      onError
    } = options

    // Cancel any existing execution
    cancel()

    // Reset state
    clearEvents()
    setIsRunning(true)
    setError(null)
    streamingOutputRef.current = ""

    // Create new abort controller
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      // Make request to streaming endpoint
      const response = await fetch("/api/claude-execute/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          projectId,
          projectName,
          repoPath,
          prompt,
          options: execOptions
        }),
        signal: abortController.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error("No response body")
      }

      // Process SSE stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      const localFilesChanged: string[] = []

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)

            try {
              const eventData = JSON.parse(data)
              const eventType = eventData.type as StreamingEvent["type"]

              // Build event object
              const event: Omit<StreamingEvent, "id" | "timestamp"> = {
                type: eventType,
                message: eventData.message || "",
                detail: eventData.detail,
                tool: eventData.tool,
                file: eventData.file,
                command: eventData.command,
                content: eventData.content,
                progress: eventData.progress,
                filesChanged: eventData.filesChanged,
                streaming: eventData.streaming
              }

              // Handle specific event types
              switch (eventType) {
                case "file_change":
                  if (eventData.file && !localFilesChanged.includes(eventData.file)) {
                    localFilesChanged.push(eventData.file)
                    setFilesChanged([...localFilesChanged])
                  }
                  break

                case "progress":
                  if (typeof eventData.progress === "number") {
                    setProgress(eventData.progress)
                  }
                  break

                case "output":
                  // For streaming output, accumulate it
                  if (eventData.streaming && eventData.content) {
                    streamingOutputRef.current += eventData.content
                    event.content = streamingOutputRef.current
                  }
                  break

                case "complete":
                  if (eventData.filesChanged) {
                    setFilesChanged(eventData.filesChanged)
                  }
                  setProgress(100)
                  setIsRunning(false)
                  onComplete?.({
                    success: true,
                    filesChanged: eventData.filesChanged || localFilesChanged
                  })
                  break

                case "error":
                  setError(eventData.message)
                  setIsRunning(false)
                  onError?.(eventData.message)
                  break
              }

              // Add event and notify callback
              const fullEvent = addEvent(event)
              onEvent?.(fullEvent)

            } catch (parseError) {
              console.error("[useStreamingExecution] Failed to parse event:", parseError, data)
            }
          }
        }
      }

    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Execution was cancelled
        addEvent({
          type: "error",
          message: "Execution cancelled"
        })
      } else {
        const message = err instanceof Error ? err.message : "Unknown error"
        setError(message)
        addEvent({
          type: "error",
          message
        })
        onError?.(message)
      }
    } finally {
      setIsRunning(false)
      abortControllerRef.current = null
    }
  }, [addEvent, cancel, clearEvents])

  return {
    execute,
    cancel,
    events,
    isRunning,
    error,
    filesChanged,
    progress,
    clearEvents
  }
}

/**
 * Helper function to build a prompt for packet execution
 */
export function buildPacketPrompt(packet: {
  title: string
  description: string
  tasks: Array<{ description: string }>
  acceptanceCriteria: string[]
}): string {
  const taskList = packet.tasks.map((t, i) => `${i + 1}. ${t.description}`).join("\n")
  const criteria = packet.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")

  return `# Task: ${packet.title}

## Description
${packet.description}

## Tasks to Complete
${taskList}

## Acceptance Criteria
${criteria}

## QUALITY STANDARDS (Non-Negotiable)

You are Claudia Coder - you build PRODUCTION-QUALITY software. Every deliverable must meet these standards:

### Code Quality
- Clean, readable, self-documenting code
- Proper error handling and edge cases
- No hardcoded values - use constants and configuration
- DRY principles - extract common patterns
- TypeScript strict mode compatible (if applicable)

### UI/UX Excellence
- Modern, polished visual design
- Smooth animations and transitions
- Responsive across all screen sizes
- Accessible (WCAG 2.1 AA minimum)
- Intuitive user interactions

### Architecture
- Clear separation of concerns
- Modular, reusable components
- Proper file organization
- Scalable patterns that grow with the app

### Testing & Reliability
- Comprehensive test coverage
- Handle loading, error, and empty states
- Graceful degradation when things fail
- Performance optimized

## Instructions
1. Read existing code to understand patterns
2. Implement with the quality standards above
3. Write tests to verify the implementation
4. Iterate until the code is polished, not just working
5. The goal is EXCELLENCE, not just completion

Work autonomously. Do not stop until the deliverable is production-ready.`
}
