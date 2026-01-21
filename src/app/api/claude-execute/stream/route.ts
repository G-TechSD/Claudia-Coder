/**
 * Claude Code Streaming Execution API
 *
 * This endpoint provides real-time streaming output from Claude Code execution
 * using Server-Sent Events (SSE). Unlike the regular POST endpoint which waits
 * for completion, this endpoint streams progress updates as they happen.
 *
 * Usage:
 * - POST to start a streaming execution session
 * - Returns SSE stream with real-time updates
 *
 * Event types:
 * - start: Execution started
 * - thinking: Claude is processing
 * - tool_use: Claude is using a tool (Read, Write, Edit, Bash, etc.)
 * - file_change: A file was modified
 * - progress: Progress update with percentage
 * - output: Text output from Claude
 * - complete: Execution finished successfully
 * - error: An error occurred
 */

import { NextRequest } from "next/server"
import { spawn, ChildProcess } from "child_process"
import * as path from "path"

// Force dynamic rendering
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Timeout for execution (10 minutes)
const EXECUTION_TIMEOUT_MS = 10 * 60 * 1000

interface StreamExecutionRequest {
  projectId: string
  projectName: string
  repoPath: string
  prompt: string
  options?: {
    maxIterations?: number
    dangerouslySkipPermissions?: boolean
  }
}

/**
 * POST - Start a streaming Claude Code execution
 * Returns Server-Sent Events stream with real-time updates
 */
export async function POST(request: NextRequest) {
  let body: StreamExecutionRequest

  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  const { repoPath, prompt, options = {} } = body
  const maxTurns = options.maxIterations || 10
  const skipPermissions = options.dangerouslySkipPermissions ?? true

  console.log("[claude-execute/stream] Starting streaming execution")
  console.log("[claude-execute/stream] Repo path:", repoPath)
  console.log("[claude-execute/stream] Max turns:", maxTurns)

  // Build Claude CLI arguments
  // Note: --verbose is required when using --print with --output-format stream-json
  const args = [
    "--print",
    "--verbose",
    "--output-format", "stream-json",
    "--max-turns", String(maxTurns)
  ]

  if (skipPermissions) {
    args.push("--dangerously-skip-permissions")
  }

  // Create the SSE stream
  const encoder = new TextEncoder()
  let isStreamClosed = false
  let childProcess: ChildProcess | null = null

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (type: string, data: Record<string, unknown>) => {
        if (isStreamClosed) return
        try {
          const eventData = JSON.stringify({ type, ...data, timestamp: new Date().toISOString() })
          controller.enqueue(encoder.encode(`data: ${eventData}\n\n`))
        } catch (error) {
          console.error("[claude-execute/stream] Error sending event:", error)
          isStreamClosed = true
        }
      }

      // Send initial event
      sendEvent("start", {
        message: "Starting Claude Code execution",
        repoPath,
        maxTurns
      })

      try {
        // Spawn Claude CLI process
        childProcess = spawn("claude", args, {
          cwd: repoPath,
          env: {
            ...process.env,
            PATH: process.env.PATH,
            FORCE_COLOR: "1",
            LANG: "en_US.UTF-8",
            LC_ALL: "en_US.UTF-8"
          },
          stdio: ["pipe", "pipe", "pipe"]
        })

        const filesChanged: string[] = []
        let accumulatedOutput = ""
        let partialLine = ""

        // Send prompt to Claude
        if (childProcess.stdin) {
          childProcess.stdin.write(prompt)
          childProcess.stdin.end()
        }

        // Process stdout - parse stream-json output
        childProcess.stdout?.on("data", (data: Buffer) => {
          const chunk = data.toString()
          accumulatedOutput += chunk

          // Handle partial lines (JSON can span multiple chunks)
          const combined = partialLine + chunk
          const lines = combined.split("\n")

          // Keep the last potentially incomplete line
          partialLine = lines.pop() || ""

          for (const line of lines) {
            if (!line.trim()) continue

            try {
              const json = JSON.parse(line)
              processStreamJsonMessage(json, sendEvent, filesChanged)
            } catch {
              // Not valid JSON - could be plain text output
              if (line.trim() && !line.startsWith("{")) {
                sendEvent("output", { content: line })
              }
            }
          }
        })

        // Handle stderr
        childProcess.stderr?.on("data", (data: Buffer) => {
          const content = data.toString()
          if (content.trim()) {
            console.log("[claude-execute/stream] stderr:", content.substring(0, 200))
            sendEvent("error", { message: "stderr", content })
          }
        })

        // Set up timeout
        const timeoutId = setTimeout(() => {
          console.error("[claude-execute/stream] Execution timed out")
          sendEvent("error", { message: "Execution timed out", timeout: EXECUTION_TIMEOUT_MS })

          if (childProcess && !childProcess.killed) {
            childProcess.kill("SIGTERM")
            setTimeout(() => {
              if (childProcess && !childProcess.killed) {
                childProcess.kill("SIGKILL")
              }
            }, 5000)
          }
        }, EXECUTION_TIMEOUT_MS)

        // Handle process exit
        childProcess.on("close", (code) => {
          clearTimeout(timeoutId)

          // Process any remaining partial line
          if (partialLine.trim()) {
            try {
              const json = JSON.parse(partialLine)
              processStreamJsonMessage(json, sendEvent, filesChanged)
            } catch {
              if (partialLine.trim() && !partialLine.startsWith("{")) {
                sendEvent("output", { content: partialLine })
              }
            }
          }

          console.log("[claude-execute/stream] Process exited with code:", code)

          if (code === 0) {
            sendEvent("complete", {
              message: "Execution completed successfully",
              exitCode: code,
              filesChanged
            })
          } else {
            sendEvent("error", {
              message: `Claude Code exited with code ${code}`,
              exitCode: code,
              filesChanged
            })
          }

          // Close the stream
          if (!isStreamClosed) {
            isStreamClosed = true
            controller.close()
          }
        })

        // Handle spawn errors
        childProcess.on("error", (error) => {
          clearTimeout(timeoutId)
          console.error("[claude-execute/stream] Process error:", error)

          let errorMessage = error.message
          if (error.message.includes("ENOENT")) {
            errorMessage = "Claude Code CLI not found. Ensure 'claude' is installed and in PATH."
          }

          sendEvent("error", { message: errorMessage })

          if (!isStreamClosed) {
            isStreamClosed = true
            controller.close()
          }
        })

      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to start execution"
        console.error("[claude-execute/stream] Error:", message)
        sendEvent("error", { message })

        if (!isStreamClosed) {
          isStreamClosed = true
          controller.close()
        }
      }
    },

    cancel() {
      console.log("[claude-execute/stream] Stream cancelled by client")
      isStreamClosed = true

      // Kill the child process if still running
      if (childProcess && !childProcess.killed) {
        childProcess.kill("SIGTERM")
      }
    }
  })

  // Handle client disconnect
  request.signal.addEventListener("abort", () => {
    console.log("[claude-execute/stream] Request aborted")
    isStreamClosed = true

    if (childProcess && !childProcess.killed) {
      childProcess.kill("SIGTERM")
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    }
  })
}

/**
 * Process a message from Claude Code's stream-json output format
 */
function processStreamJsonMessage(
  json: Record<string, unknown>,
  sendEvent: (type: string, data: Record<string, unknown>) => void,
  filesChanged: string[]
) {
  const msgType = json.type as string

  switch (msgType) {
    case "system":
      // System message (e.g., session start)
      sendEvent("thinking", {
        message: "System",
        detail: json.message || json.subtype
      })
      break

    case "assistant":
      // Assistant message with content
      if (json.message && typeof json.message === "object") {
        const message = json.message as { content?: unknown }
        if (message.content) {
          const content = Array.isArray(message.content)
            ? message.content
                .filter((c: { type?: string }) => c.type === "text")
                .map((c: { text?: string }) => c.text || "")
                .join("")
            : String(message.content)

          if (content) {
            sendEvent("output", { content })
          }
        }
      }
      break

    case "content_block_start":
      // Content block starting (could be text or tool_use)
      if (json.content_block && typeof json.content_block === "object") {
        const block = json.content_block as { type?: string; name?: string }
        if (block.type === "tool_use" && block.name) {
          sendEvent("thinking", {
            message: `Using tool: ${block.name}`,
            tool: block.name
          })
        }
      }
      break

    case "content_block_delta":
      // Streaming delta (text or tool input)
      if (json.delta && typeof json.delta === "object") {
        const delta = json.delta as { type?: string; text?: string; partial_json?: string }
        if (delta.type === "text_delta" && delta.text) {
          sendEvent("output", { content: delta.text, streaming: true })
        }
      }
      break

    case "tool_use":
      // Tool is being used
      handleToolUse(json, sendEvent, filesChanged)
      break

    case "tool_result":
      // Tool returned a result
      sendEvent("thinking", {
        message: "Tool completed",
        tool: json.tool_name || json.name,
        success: !json.error
      })
      break

    case "result":
      // Final result
      sendEvent("progress", {
        message: "Processing complete",
        progress: 100
      })
      break

    case "error":
      // Error from Claude
      sendEvent("error", {
        message: json.error || json.message || "Unknown error",
        detail: json
      })
      break

    default:
      // Unknown type - log for debugging
      if (msgType) {
        console.log("[claude-execute/stream] Unknown message type:", msgType, json)
      }
  }
}

/**
 * Handle tool_use messages and track file changes
 */
function handleToolUse(
  json: Record<string, unknown>,
  sendEvent: (type: string, data: Record<string, unknown>) => void,
  filesChanged: string[]
) {
  const toolName = (json.name || json.tool_name) as string
  const toolInput = (json.input || json.tool_input || {}) as Record<string, unknown>

  // Log the tool use
  console.log("[claude-execute/stream] Tool use:", toolName, toolInput)

  // Send appropriate event based on tool
  switch (toolName) {
    case "Read":
      sendEvent("thinking", {
        message: `Reading file: ${toolInput.file_path || toolInput.path}`,
        tool: toolName,
        file: toolInput.file_path || toolInput.path
      })
      break

    case "Write":
    case "Edit":
      {
        const filePath = (toolInput.file_path || toolInput.path) as string
        if (filePath && !filesChanged.includes(filePath)) {
          filesChanged.push(filePath)
        }
        sendEvent("file_change", {
          message: `${toolName === "Write" ? "Writing" : "Editing"} file: ${path.basename(filePath)}`,
          tool: toolName,
          file: filePath,
          operation: toolName.toLowerCase()
        })
      }
      break

    case "Bash":
      sendEvent("thinking", {
        message: `Running command: ${String(toolInput.command || "").substring(0, 100)}`,
        tool: toolName,
        command: toolInput.command
      })
      break

    case "Glob":
    case "Grep":
      sendEvent("thinking", {
        message: `Searching: ${toolInput.pattern || toolInput.query}`,
        tool: toolName,
        pattern: toolInput.pattern || toolInput.query
      })
      break

    case "WebFetch":
      sendEvent("thinking", {
        message: `Fetching URL: ${toolInput.url}`,
        tool: toolName,
        url: toolInput.url
      })
      break

    default:
      sendEvent("thinking", {
        message: `Using ${toolName}`,
        tool: toolName,
        input: toolInput
      })
  }
}
