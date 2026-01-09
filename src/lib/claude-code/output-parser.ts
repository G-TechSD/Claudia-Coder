/**
 * Claude Code Terminal Output Parser
 *
 * Parses terminal output to detect Task tool usage and sub-agent activity.
 * This allows Claudia Coder to track when Claude Code spawns sub-agents.
 */

import { createSubAgent, updateSubAgentStatus, type SubAgent } from "./sub-agents"

/**
 * Pattern detection result
 */
interface ParsedEvent {
  type: "task_started" | "task_completed" | "task_failed" | "agent_spawned" | "agent_completed"
  taskDescription?: string
  taskId?: string
  result?: string
  error?: string
  rawMatch: string
}

/**
 * State tracker for ongoing parsing
 */
interface ParserState {
  sessionId: string
  /** Map of detected task patterns to sub-agent IDs */
  taskToSubAgentMap: Map<string, string>
  /** Buffer for incomplete lines */
  lineBuffer: string
  /** Track if we're inside a task block */
  inTaskBlock: boolean
  /** Current task being tracked */
  currentTaskDescription: string | null
}

/**
 * Patterns to detect Task tool usage in Claude Code output
 *
 * Claude Code uses the Task tool with patterns like:
 * - "Task:" followed by description
 * - Agent spawning indicators
 * - TodoWrite/Task tool invocations
 */
const PATTERNS = {
  // Task tool invocation patterns
  taskStart: [
    // Direct Task tool usage
    /(?:Task|TodoWrite):\s*(.+?)(?:\n|$)/i,
    // Agent tool invocation
    /(?:Using|Invoking|Calling)\s+(?:Task|Agent)\s+tool(?:\s+for)?:?\s*(.+?)(?:\n|$)/i,
    // Sub-agent spawning
    /(?:Spawning|Creating|Starting)\s+(?:sub-?agent|agent|task)(?:\s+for)?:?\s*(.+?)(?:\n|$)/i,
    // Task delegation
    /(?:Delegating|Assigning)\s+(?:task|work)(?:\s+to\s+agent)?:?\s*(.+?)(?:\n|$)/i,
    // Background task
    /(?:Running|Executing)\s+(?:in\s+)?background(?:\s+task)?:?\s*(.+?)(?:\n|$)/i,
    // TodoWrite task creation with content
    /TodoWrite.*?"content":\s*"([^"]+)"/i,
    // Task tool with description parameter
    /Task.*?(?:description|task):\s*"?([^"\n]+)"?/i
  ],

  // Task completion patterns
  taskComplete: [
    // Task completed successfully
    /(?:Task|Agent)\s+completed(?:\s+successfully)?:?\s*(.+?)(?:\n|$)/i,
    // Sub-agent finished
    /(?:Sub-?agent|Agent)\s+finished:?\s*(.+?)(?:\n|$)/i,
    // Task done
    /(?:Done|Finished|Completed)\s+(?:with\s+)?(?:task|agent):?\s*(.+?)(?:\n|$)/i,
    // Success marker
    /\[(?:SUCCESS|DONE|COMPLETE)\]\s*(.+?)(?:\n|$)/i
  ],

  // Task failure patterns
  taskFailed: [
    // Task failed
    /(?:Task|Agent)\s+(?:failed|error|aborted):?\s*(.+?)(?:\n|$)/i,
    // Sub-agent error
    /(?:Sub-?agent|Agent)\s+(?:error|failed):?\s*(.+?)(?:\n|$)/i,
    // Error marker
    /\[(?:ERROR|FAILED|ABORT)\]\s*(.+?)(?:\n|$)/i,
    // Exception in task
    /(?:Exception|Error)\s+in\s+(?:task|agent):?\s*(.+?)(?:\n|$)/i
  ],

  // ANSI escape sequence pattern for stripping
  ansiEscape: /\x1b\[[0-9;]*[a-zA-Z]/g,

  // Common Claude Code output markers
  claudeMarkers: {
    toolUse: /(?:antml:invoke|antml:function_calls)/i,
    taskTool: /name="(?:Task|TodoWrite)"/i,
    agentSpawn: /(?:spawning|creating)\s+(?:new\s+)?agent/i
  }
}

/**
 * Strip ANSI escape sequences from text
 */
export function stripAnsi(text: string): string {
  return text.replace(PATTERNS.ansiEscape, "")
}

/**
 * Create a new parser state for a session
 */
export function createParserState(sessionId: string): ParserState {
  return {
    sessionId,
    taskToSubAgentMap: new Map(),
    lineBuffer: "",
    inTaskBlock: false,
    currentTaskDescription: null
  }
}

/**
 * Parse a chunk of terminal output for task-related events
 */
export function parseOutputChunk(
  state: ParserState,
  chunk: string
): ParsedEvent[] {
  const events: ParsedEvent[] = []

  // Strip ANSI codes for cleaner parsing
  const cleanChunk = stripAnsi(chunk)

  // Combine with buffer from previous incomplete line
  const fullText = state.lineBuffer + cleanChunk

  // Split into lines, keeping the last incomplete line in buffer
  const lines = fullText.split("\n")
  state.lineBuffer = lines.pop() || ""

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue

    // Check for task start patterns
    for (const pattern of PATTERNS.taskStart) {
      const match = trimmedLine.match(pattern)
      if (match && match[1]) {
        const taskDescription = match[1].trim()

        // Avoid duplicates - check if we've already tracked this task
        if (!state.taskToSubAgentMap.has(taskDescription)) {
          events.push({
            type: "task_started",
            taskDescription,
            rawMatch: trimmedLine
          })

          // Create sub-agent and track it
          const subAgent = createSubAgent(state.sessionId, taskDescription, {
            detectedFrom: "output_parser",
            rawLine: trimmedLine
          })

          state.taskToSubAgentMap.set(taskDescription, subAgent.id)

          // Mark as running
          updateSubAgentStatus(state.sessionId, subAgent.id, "running")
        }
        break
      }
    }

    // Check for task completion patterns
    for (const pattern of PATTERNS.taskComplete) {
      const match = trimmedLine.match(pattern)
      if (match) {
        const description = match[1]?.trim() || ""

        events.push({
          type: "task_completed",
          taskDescription: description,
          result: trimmedLine,
          rawMatch: trimmedLine
        })

        // Try to find the matching sub-agent and mark complete
        const matchedSubAgentId = findMatchingSubAgent(state, description)
        if (matchedSubAgentId) {
          updateSubAgentStatus(state.sessionId, matchedSubAgentId, "completed", {
            result: trimmedLine
          })
        }
        break
      }
    }

    // Check for task failure patterns
    for (const pattern of PATTERNS.taskFailed) {
      const match = trimmedLine.match(pattern)
      if (match) {
        const description = match[1]?.trim() || ""

        events.push({
          type: "task_failed",
          taskDescription: description,
          error: trimmedLine,
          rawMatch: trimmedLine
        })

        // Try to find the matching sub-agent and mark failed
        const matchedSubAgentId = findMatchingSubAgent(state, description)
        if (matchedSubAgentId) {
          updateSubAgentStatus(state.sessionId, matchedSubAgentId, "failed", {
            error: trimmedLine
          })
        }
        break
      }
    }
  }

  return events
}

/**
 * Find a matching sub-agent ID based on task description
 */
function findMatchingSubAgent(state: ParserState, description: string): string | null {
  // Direct match
  if (state.taskToSubAgentMap.has(description)) {
    return state.taskToSubAgentMap.get(description) || null
  }

  // Fuzzy match - check if description contains or is contained by any tracked task
  const entries = Array.from(state.taskToSubAgentMap.entries())
  for (const [taskDesc, subAgentId] of entries) {
    if (
      description.toLowerCase().includes(taskDesc.toLowerCase()) ||
      taskDesc.toLowerCase().includes(description.toLowerCase())
    ) {
      return subAgentId
    }
  }

  // Return the most recent running sub-agent if no match found
  // This handles cases where completion messages don't include the full description
  if (entries.length > 0) {
    return entries[entries.length - 1][1]
  }

  return null
}

/**
 * Parse XML-style tool invocations that might indicate sub-agent creation
 */
export function parseToolInvocation(text: string): ParsedEvent | null {
  // Check for Task tool invocation in XML format
  const toolMatch = text.match(
    /<invoke\s+name="(?:Task|TodoWrite)"[^>]*>[\s\S]*?<parameter\s+name="(?:description|content|task)"[^>]*>([^<]+)/i
  )

  if (toolMatch && toolMatch[1]) {
    return {
      type: "agent_spawned",
      taskDescription: toolMatch[1].trim(),
      rawMatch: toolMatch[0]
    }
  }

  return null
}

/**
 * Process a complete terminal output buffer and extract all events
 */
export function parseFullOutput(sessionId: string, output: string): ParsedEvent[] {
  const state = createParserState(sessionId)
  return parseOutputChunk(state, output)
}

/**
 * Create a streaming parser that maintains state across chunks
 */
export function createStreamingParser(sessionId: string) {
  const state = createParserState(sessionId)

  return {
    /**
     * Process a new chunk of output
     */
    processChunk(chunk: string): ParsedEvent[] {
      return parseOutputChunk(state, chunk)
    },

    /**
     * Get the current parser state
     */
    getState(): ParserState {
      return state
    },

    /**
     * Get all tracked sub-agents
     */
    getTrackedSubAgents(): Map<string, string> {
      return new Map(state.taskToSubAgentMap)
    },

    /**
     * Flush any remaining buffered content
     */
    flush(): ParsedEvent[] {
      if (state.lineBuffer) {
        const events = parseOutputChunk(state, "\n")
        state.lineBuffer = ""
        return events
      }
      return []
    },

    /**
     * Reset the parser state
     */
    reset(): void {
      state.taskToSubAgentMap.clear()
      state.lineBuffer = ""
      state.inTaskBlock = false
      state.currentTaskDescription = null
    }
  }
}

export type { ParsedEvent, ParserState }
