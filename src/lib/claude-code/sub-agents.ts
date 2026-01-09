/**
 * Sub-Agent Tracking for Claude Code
 *
 * Tracks sub-agents spawned by Claude Code using the Task tool.
 * Sub-agents are child processes that handle specific tasks delegated by the main agent.
 */

/**
 * Status of a sub-agent
 */
export type SubAgentStatus = "pending" | "running" | "completed" | "failed"

/**
 * Sub-agent representing a delegated task
 */
export interface SubAgent {
  /** Unique identifier for this sub-agent */
  id: string
  /** Session ID of the parent Claude Code session */
  sessionId: string
  /** Description of the task assigned to this sub-agent */
  taskDescription: string
  /** Current status of the sub-agent */
  status: SubAgentStatus
  /** When the sub-agent was created */
  startedAt: Date
  /** When the sub-agent completed (if finished) */
  completedAt?: Date
  /** Result or output from the sub-agent */
  result?: string
  /** Error message if the sub-agent failed */
  error?: string
  /** Progress percentage (0-100) if available */
  progress?: number
  /** Additional metadata about the task */
  metadata?: Record<string, unknown>
}

/**
 * Serializable version of SubAgent for storage/API
 */
export interface SubAgentSerialized {
  id: string
  sessionId: string
  taskDescription: string
  status: SubAgentStatus
  startedAt: string // ISO date string
  completedAt?: string // ISO date string
  result?: string
  error?: string
  progress?: number
  metadata?: Record<string, unknown>
}

/**
 * In-memory storage for sub-agents per session
 */
const subAgentsBySession = new Map<string, Map<string, SubAgent>>()

/**
 * Generate a unique ID for a sub-agent
 */
function generateSubAgentId(): string {
  return `subagent_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Create a new sub-agent for a session
 */
export function createSubAgent(
  sessionId: string,
  taskDescription: string,
  metadata?: Record<string, unknown>
): SubAgent {
  const subAgent: SubAgent = {
    id: generateSubAgentId(),
    sessionId,
    taskDescription,
    status: "pending",
    startedAt: new Date(),
    metadata
  }

  // Get or create the session's sub-agent map
  if (!subAgentsBySession.has(sessionId)) {
    subAgentsBySession.set(sessionId, new Map())
  }

  const sessionSubAgents = subAgentsBySession.get(sessionId)!
  sessionSubAgents.set(subAgent.id, subAgent)

  console.log(`[sub-agents] Created sub-agent ${subAgent.id} for session ${sessionId}: ${taskDescription}`)

  return subAgent
}

/**
 * Update the status of a sub-agent
 */
export function updateSubAgentStatus(
  sessionId: string,
  subAgentId: string,
  status: SubAgentStatus,
  options?: {
    result?: string
    error?: string
    progress?: number
  }
): SubAgent | null {
  const sessionSubAgents = subAgentsBySession.get(sessionId)
  if (!sessionSubAgents) {
    console.warn(`[sub-agents] Session ${sessionId} not found`)
    return null
  }

  const subAgent = sessionSubAgents.get(subAgentId)
  if (!subAgent) {
    console.warn(`[sub-agents] Sub-agent ${subAgentId} not found in session ${sessionId}`)
    return null
  }

  // Update the sub-agent
  subAgent.status = status

  if (options?.result !== undefined) {
    subAgent.result = options.result
  }

  if (options?.error !== undefined) {
    subAgent.error = options.error
  }

  if (options?.progress !== undefined) {
    subAgent.progress = options.progress
  }

  // Set completion time for terminal states
  if (status === "completed" || status === "failed") {
    subAgent.completedAt = new Date()
  }

  console.log(`[sub-agents] Updated sub-agent ${subAgentId}: status=${status}`)

  return subAgent
}

/**
 * Get all sub-agents for a session
 */
export function getSubAgents(sessionId: string): SubAgent[] {
  const sessionSubAgents = subAgentsBySession.get(sessionId)
  if (!sessionSubAgents) {
    return []
  }

  return Array.from(sessionSubAgents.values()).sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime()
  )
}

/**
 * Get a specific sub-agent
 */
export function getSubAgent(sessionId: string, subAgentId: string): SubAgent | null {
  const sessionSubAgents = subAgentsBySession.get(sessionId)
  if (!sessionSubAgents) {
    return null
  }

  return sessionSubAgents.get(subAgentId) || null
}

/**
 * Get sub-agents by status
 */
export function getSubAgentsByStatus(sessionId: string, status: SubAgentStatus): SubAgent[] {
  return getSubAgents(sessionId).filter(agent => agent.status === status)
}

/**
 * Get active (pending or running) sub-agents count
 */
export function getActiveSubAgentCount(sessionId: string): number {
  return getSubAgents(sessionId).filter(
    agent => agent.status === "pending" || agent.status === "running"
  ).length
}

/**
 * Get completed sub-agents count
 */
export function getCompletedSubAgentCount(sessionId: string): number {
  return getSubAgents(sessionId).filter(agent => agent.status === "completed").length
}

/**
 * Get failed sub-agents count
 */
export function getFailedSubAgentCount(sessionId: string): number {
  return getSubAgents(sessionId).filter(agent => agent.status === "failed").length
}

/**
 * Clear all sub-agents for a session
 */
export function clearSubAgents(sessionId: string): void {
  subAgentsBySession.delete(sessionId)
  console.log(`[sub-agents] Cleared all sub-agents for session ${sessionId}`)
}

/**
 * Remove a specific sub-agent
 */
export function removeSubAgent(sessionId: string, subAgentId: string): boolean {
  const sessionSubAgents = subAgentsBySession.get(sessionId)
  if (!sessionSubAgents) {
    return false
  }

  const deleted = sessionSubAgents.delete(subAgentId)
  if (deleted) {
    console.log(`[sub-agents] Removed sub-agent ${subAgentId} from session ${sessionId}`)
  }

  return deleted
}

/**
 * Serialize a sub-agent for API response
 */
export function serializeSubAgent(subAgent: SubAgent): SubAgentSerialized {
  return {
    id: subAgent.id,
    sessionId: subAgent.sessionId,
    taskDescription: subAgent.taskDescription,
    status: subAgent.status,
    startedAt: subAgent.startedAt.toISOString(),
    completedAt: subAgent.completedAt?.toISOString(),
    result: subAgent.result,
    error: subAgent.error,
    progress: subAgent.progress,
    metadata: subAgent.metadata
  }
}

/**
 * Deserialize a sub-agent from storage/API
 */
export function deserializeSubAgent(data: SubAgentSerialized): SubAgent {
  return {
    id: data.id,
    sessionId: data.sessionId,
    taskDescription: data.taskDescription,
    status: data.status,
    startedAt: new Date(data.startedAt),
    completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
    result: data.result,
    error: data.error,
    progress: data.progress,
    metadata: data.metadata
  }
}

/**
 * Get statistics for a session's sub-agents
 */
export function getSubAgentStats(sessionId: string): {
  total: number
  pending: number
  running: number
  completed: number
  failed: number
  averageDuration: number | null
} {
  const subAgents = getSubAgents(sessionId)

  const stats = {
    total: subAgents.length,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    averageDuration: null as number | null
  }

  let totalDuration = 0
  let completedCount = 0

  for (const agent of subAgents) {
    switch (agent.status) {
      case "pending":
        stats.pending++
        break
      case "running":
        stats.running++
        break
      case "completed":
        stats.completed++
        if (agent.completedAt) {
          totalDuration += agent.completedAt.getTime() - agent.startedAt.getTime()
          completedCount++
        }
        break
      case "failed":
        stats.failed++
        if (agent.completedAt) {
          totalDuration += agent.completedAt.getTime() - agent.startedAt.getTime()
          completedCount++
        }
        break
    }
  }

  if (completedCount > 0) {
    stats.averageDuration = totalDuration / completedCount
  }

  return stats
}
