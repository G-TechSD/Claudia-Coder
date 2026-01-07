/**
 * Claude Code Orchestrator
 * The heart of Claudia - executes work packets using Claude Code
 * with Ralph Wiggum loops for iterative refinement
 */

export interface ExecutionConfig {
  projectId: string
  projectName: string
  repoPath: string
  packets: WorkPacket[]
  maxIterations?: number // Ralph Wiggum loop limit per packet
  onProgress?: (event: ProgressEvent) => void
  onPacketComplete?: (packet: WorkPacket, result: PacketResult) => void
  onError?: (error: Error, packet?: WorkPacket) => void
}

export interface WorkPacket {
  id: string
  title: string
  description: string
  type: "feature" | "bugfix" | "refactor" | "test" | "docs" | "config" | "research"
  priority: "critical" | "high" | "medium" | "low"
  tasks: Array<{ id: string; description: string; completed: boolean }>
  acceptanceCriteria: string[]
  dependencies: string[]
}

export interface PacketResult {
  packetId: string
  status: "completed" | "failed" | "needs_review"
  iterations: number
  filesChanged: string[]
  testsRun: number
  testsPassed: number
  summary: string
  duration: number
}

export interface ProgressEvent {
  type: "packet_start" | "iteration" | "test_run" | "file_change" | "thinking" | "packet_complete" | "error"
  packetId?: string
  message: string
  detail?: string
  timestamp: Date
  iteration?: number
  progress?: number // 0-100
}

export interface ExecutionSession {
  id: string
  projectId: string
  status: "running" | "paused" | "completed" | "failed"
  startedAt: Date
  completedAt?: Date
  totalPackets: number
  completedPackets: number
  currentPacketId?: string
  currentIteration?: number
  events: ProgressEvent[]
  results: PacketResult[]
}

/**
 * Start execution of a project's work packets
 * Uses Claude Code in print mode for non-interactive execution
 */
export async function startExecution(config: ExecutionConfig): Promise<ExecutionSession> {
  const session: ExecutionSession = {
    id: `exec-${Date.now()}`,
    projectId: config.projectId,
    status: "running",
    startedAt: new Date(),
    totalPackets: config.packets.length,
    completedPackets: 0,
    events: [],
    results: []
  }

  const emit = (event: Omit<ProgressEvent, "timestamp">) => {
    const fullEvent = { ...event, timestamp: new Date() }
    session.events.push(fullEvent)
    config.onProgress?.(fullEvent)
  }

  emit({
    type: "thinking",
    message: `Starting execution of ${config.projectId}`,
    detail: `${config.packets.length} packets to process`,
    progress: 0
  })

  // Sort packets by priority and dependencies
  const sortedPackets = sortPacketsByPriority(config.packets)

  for (let i = 0; i < sortedPackets.length; i++) {
    const packet = sortedPackets[i]
    session.currentPacketId = packet.id

    emit({
      type: "packet_start",
      packetId: packet.id,
      message: `Starting: ${packet.title}`,
      detail: packet.description,
      progress: Math.round((i / sortedPackets.length) * 100)
    })

    try {
      // Execute packet with Ralph Wiggum loop
      const result = await executePacketWithLoop(
        packet,
        config.repoPath,
        config.maxIterations || 5,
        emit
      )

      session.results.push(result)
      session.completedPackets++

      config.onPacketComplete?.(packet, result)

      emit({
        type: "packet_complete",
        packetId: packet.id,
        message: `Completed: ${packet.title}`,
        detail: result.summary,
        progress: Math.round(((i + 1) / sortedPackets.length) * 100)
      })

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      emit({
        type: "error",
        packetId: packet.id,
        message: `Failed: ${packet.title}`,
        detail: err.message
      })

      config.onError?.(err, packet)

      // Continue with next packet rather than stopping entirely
      session.results.push({
        packetId: packet.id,
        status: "failed",
        iterations: 0,
        filesChanged: [],
        testsRun: 0,
        testsPassed: 0,
        summary: `Failed: ${err.message}`,
        duration: 0
      })
    }
  }

  session.status = session.results.every(r => r.status === "completed") ? "completed" : "failed"
  session.completedAt = new Date()
  session.currentPacketId = undefined

  return session
}

/**
 * Execute a single packet with Ralph Wiggum iterative refinement loop
 * Keeps refining until tests pass and acceptance criteria are met
 */
async function executePacketWithLoop(
  packet: WorkPacket,
  repoPath: string,
  maxIterations: number,
  emit: (event: Omit<ProgressEvent, "timestamp">) => void
): Promise<PacketResult> {
  const startTime = Date.now()
  let iteration = 0
  let lastTestResult = { passed: 0, failed: 0, total: 0 }
  const filesChanged: Set<string> = new Set()

  // Build the prompt for Claude Code
  const prompt = buildPacketPrompt(packet)

  while (iteration < maxIterations) {
    iteration++

    emit({
      type: "iteration",
      packetId: packet.id,
      message: `Iteration ${iteration}/${maxIterations}`,
      detail: iteration === 1 ? "Initial implementation" : "Refining based on test results",
      iteration
    })

    // Execute via Claude Code API or CLI
    const claudeResult = await executeWithClaude(prompt, repoPath, iteration)

    // Track changed files
    claudeResult.filesChanged.forEach(f => filesChanged.add(f))

    emit({
      type: "file_change",
      packetId: packet.id,
      message: `Modified ${claudeResult.filesChanged.length} files`,
      detail: claudeResult.filesChanged.join(", "),
      iteration
    })

    // Run tests
    emit({
      type: "test_run",
      packetId: packet.id,
      message: "Running tests...",
      iteration
    })

    const testResult = await runTests(repoPath)
    lastTestResult = testResult

    emit({
      type: "test_run",
      packetId: packet.id,
      message: `Tests: ${testResult.passed}/${testResult.total} passed`,
      detail: testResult.failed > 0 ? `${testResult.failed} failures` : "All tests passing!",
      iteration
    })

    // Ralph Wiggum decision: Are we done?
    if (testResult.failed === 0 && testResult.total > 0) {
      // All tests pass! Check acceptance criteria
      const criteriaResult = await checkAcceptanceCriteria(packet.acceptanceCriteria, repoPath)

      if (criteriaResult.allMet) {
        // We're done!
        return {
          packetId: packet.id,
          status: "completed",
          iterations: iteration,
          filesChanged: Array.from(filesChanged),
          testsRun: testResult.total,
          testsPassed: testResult.passed,
          summary: `Completed in ${iteration} iteration(s). ${filesChanged.size} files changed.`,
          duration: Date.now() - startTime
        }
      }

      // Tests pass but criteria not met - continue refining
      emit({
        type: "thinking",
        packetId: packet.id,
        message: "Tests pass but acceptance criteria need work",
        detail: criteriaResult.unmetCriteria.join(", "),
        iteration
      })
    }

    // Not done yet - update prompt for next iteration
    // This is the Ralph Wiggum loop - keep trying!
  }

  // Max iterations reached
  return {
    packetId: packet.id,
    status: lastTestResult.failed === 0 ? "completed" : "needs_review",
    iterations: iteration,
    filesChanged: Array.from(filesChanged),
    testsRun: lastTestResult.total,
    testsPassed: lastTestResult.passed,
    summary: `Reached ${maxIterations} iterations. ${lastTestResult.passed}/${lastTestResult.total} tests passing.`,
    duration: Date.now() - startTime
  }
}

/**
 * Execute a prompt using Claude Code
 */
async function executeWithClaude(
  prompt: string,
  repoPath: string,
  iteration: number
): Promise<{ filesChanged: string[]; output: string }> {
  // Call the Claude Code execution API
  try {
    const response = await fetch("/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        workingDirectory: repoPath,
        iteration,
        mode: "autonomous" // Let Claude work without prompts
      })
    })

    if (!response.ok) {
      throw new Error(`Claude execution failed: ${response.statusText}`)
    }

    const result = await response.json()
    return {
      filesChanged: result.filesChanged || [],
      output: result.output || ""
    }
  } catch (error) {
    console.error("Claude execution error:", error)
    return { filesChanged: [], output: "" }
  }
}

/**
 * Run tests in the repo
 */
async function runTests(repoPath: string): Promise<{ passed: number; failed: number; total: number }> {
  try {
    const response = await fetch("/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Run the test suite and report results. Use npm test, pytest, or whatever test runner is appropriate.",
        workingDirectory: repoPath,
        mode: "test"
      })
    })

    if (!response.ok) {
      return { passed: 0, failed: 0, total: 0 }
    }

    const result = await response.json()
    return {
      passed: result.testsPassed || 0,
      failed: result.testsFailed || 0,
      total: (result.testsPassed || 0) + (result.testsFailed || 0)
    }
  } catch {
    return { passed: 0, failed: 0, total: 0 }
  }
}

/**
 * Check if acceptance criteria are met
 */
async function checkAcceptanceCriteria(
  criteria: string[],
  repoPath: string
): Promise<{ allMet: boolean; unmetCriteria: string[] }> {
  if (criteria.length === 0) {
    return { allMet: true, unmetCriteria: [] }
  }

  try {
    const response = await fetch("/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `Check if these acceptance criteria are met:\n${criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nRespond with JSON: { "met": ["criteria that are met"], "unmet": ["criteria not met"] }`,
        workingDirectory: repoPath,
        mode: "check"
      })
    })

    if (!response.ok) {
      return { allMet: false, unmetCriteria: criteria }
    }

    const result = await response.json()
    const unmet = result.unmet || []
    return {
      allMet: unmet.length === 0,
      unmetCriteria: unmet
    }
  } catch {
    return { allMet: false, unmetCriteria: criteria }
  }
}

/**
 * Build prompt for Claude Code based on packet
 */
function buildPacketPrompt(packet: WorkPacket): string {
  const taskList = packet.tasks.map((t, i) => `${i + 1}. ${t.description}`).join("\n")
  const criteria = packet.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")

  return `# Task: ${packet.title}

## Description
${packet.description}

## Tasks to Complete
${taskList}

## Acceptance Criteria
${criteria}

## Instructions
1. Implement the required changes
2. Write or update tests to verify the implementation
3. Ensure all tests pass
4. Follow the existing code style and patterns in the repository

Work autonomously to complete this task. Make commits as you go with clear messages.`
}

/**
 * Sort packets by priority and dependencies
 */
function sortPacketsByPriority(packets: WorkPacket[]): WorkPacket[] {
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }

  return [...packets].sort((a, b) => {
    // First by dependency (packets with no deps first)
    const aDeps = a.dependencies.length
    const bDeps = b.dependencies.length
    if (aDeps !== bDeps) return aDeps - bDeps

    // Then by priority
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

/**
 * Save execution session to storage
 */
export function saveExecutionSession(session: ExecutionSession): void {
  const key = `claudia_execution_${session.id}`
  localStorage.setItem(key, JSON.stringify(session))

  // Also update the list of sessions
  const sessionsKey = "claudia_execution_sessions"
  const sessions = JSON.parse(localStorage.getItem(sessionsKey) || "[]")
  if (!sessions.includes(session.id)) {
    sessions.push(session.id)
    localStorage.setItem(sessionsKey, JSON.stringify(sessions))
  }
}

/**
 * Get execution session from storage
 */
export function getExecutionSession(sessionId: string): ExecutionSession | null {
  const key = `claudia_execution_${sessionId}`
  const data = localStorage.getItem(key)
  return data ? JSON.parse(data) : null
}

/**
 * Get all execution sessions for a project
 */
export function getProjectExecutions(projectId: string): ExecutionSession[] {
  const sessionsKey = "claudia_execution_sessions"
  const sessionIds = JSON.parse(localStorage.getItem(sessionsKey) || "[]")

  return sessionIds
    .map((id: string) => getExecutionSession(id))
    .filter((s: ExecutionSession | null): s is ExecutionSession => s !== null && s.projectId === projectId)
    .sort((a: ExecutionSession, b: ExecutionSession) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )
}
