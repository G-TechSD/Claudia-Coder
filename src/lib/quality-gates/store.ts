/**
 * Quality Gates Store
 *
 * Persists quality gate results to localStorage for display in the Quality page.
 * Works across both client-side execution and API calls.
 */

// Storage key for quality gate results
const QUALITY_GATES_KEY = "claudia_quality_gates"
const QUALITY_RUNS_KEY = "claudia_quality_runs"
const MAX_RUNS = 100

export type GateStatus = "passed" | "failed" | "warning" | "pending" | "skipped"
export type GateCategory = "code" | "test" | "security" | "review" | "performance"

/**
 * Quality Gate Definition
 */
export interface QualityGate {
  id: string
  name: string
  description: string
  category: GateCategory
  status: GateStatus
  required: boolean
  lastRun: string | null
  details: {
    passed: number
    failed: number
    warnings: number
  }
  threshold?: string
}

/**
 * Quality Gate Run - A single execution of quality gates
 */
export interface QualityGateRun {
  id: string
  gateId: string
  gateName: string
  packetId: string
  packetTitle?: string
  projectId?: string
  projectName?: string
  status: GateStatus
  timestamp: string
  duration: number
  message?: string
  output?: string
}

/**
 * Quality Gate Result - Complete result from an execution
 */
export interface QualityGateResult {
  id: string
  packetId: string
  packetTitle: string
  projectId: string
  projectName: string
  timestamp: string
  duration: number
  passed: boolean
  mode: string
  gates: {
    tests: GateResult
    typeCheck: GateResult
    build: GateResult
  }
}

interface GateResult {
  success: boolean
  output: string
  errorCount?: number
}

/**
 * Default quality gates shown in the UI
 */
export function getDefaultGates(): QualityGate[] {
  return [
    {
      id: "test-pass",
      name: "Tests Pass",
      description: "All unit and integration tests must pass",
      category: "test",
      status: "pending",
      required: true,
      lastRun: null,
      details: { passed: 0, failed: 0, warnings: 0 },
      threshold: "100% pass rate"
    },
    {
      id: "type-check",
      name: "TypeScript Check",
      description: "TypeScript compilation must succeed with no errors",
      category: "code",
      status: "pending",
      required: true,
      lastRun: null,
      details: { passed: 0, failed: 0, warnings: 0 },
      threshold: "0 type errors"
    },
    {
      id: "build-pass",
      name: "Build Success",
      description: "Production build must complete without errors",
      category: "code",
      status: "pending",
      required: true,
      lastRun: null,
      details: { passed: 0, failed: 0, warnings: 0 },
      threshold: "Successful build"
    },
    {
      id: "security-scan",
      name: "Security Scan",
      description: "No critical or high severity security vulnerabilities",
      category: "security",
      status: "pending",
      required: false,
      lastRun: null,
      details: { passed: 0, failed: 0, warnings: 0 },
      threshold: "No critical/high issues"
    },
    {
      id: "lint-check",
      name: "Lint Check",
      description: "Code must pass linting rules",
      category: "code",
      status: "pending",
      required: false,
      lastRun: null,
      details: { passed: 0, failed: 0, warnings: 0 },
      threshold: "0 lint errors"
    },
    {
      id: "code-review",
      name: "Code Review",
      description: "AI-powered code review for best practices",
      category: "review",
      status: "pending",
      required: false,
      lastRun: null,
      details: { passed: 0, failed: 0, warnings: 0 },
      threshold: "Score > 80%"
    }
  ]
}

/**
 * Load quality gates from localStorage
 */
export function loadQualityGates(): QualityGate[] {
  if (typeof window === "undefined") return getDefaultGates()

  try {
    const stored = localStorage.getItem(QUALITY_GATES_KEY)
    if (!stored) return getDefaultGates()

    const gates: QualityGate[] = JSON.parse(stored)
    return gates.length > 0 ? gates : getDefaultGates()
  } catch {
    return getDefaultGates()
  }
}

/**
 * Save quality gates to localStorage
 */
export function saveQualityGates(gates: QualityGate[]): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(QUALITY_GATES_KEY, JSON.stringify(gates))
  } catch (error) {
    console.error("[QualityGatesStore] Failed to save gates:", error)
  }
}

/**
 * Load quality gate runs from localStorage
 */
export function loadQualityRuns(): QualityGateRun[] {
  if (typeof window === "undefined") return []

  try {
    const stored = localStorage.getItem(QUALITY_RUNS_KEY)
    if (!stored) return []

    return JSON.parse(stored)
  } catch {
    return []
  }
}

/**
 * Save quality gate runs to localStorage
 */
export function saveQualityRuns(runs: QualityGateRun[]): void {
  if (typeof window === "undefined") return

  try {
    // Keep only the most recent runs
    const trimmedRuns = runs.slice(-MAX_RUNS)
    localStorage.setItem(QUALITY_RUNS_KEY, JSON.stringify(trimmedRuns))
  } catch (error) {
    console.error("[QualityGatesStore] Failed to save runs:", error)
  }
}

/**
 * Add a new quality gate run
 */
export function addQualityRun(run: Omit<QualityGateRun, "id">): QualityGateRun {
  const newRun: QualityGateRun = {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...run
  }

  const runs = loadQualityRuns()
  runs.push(newRun)
  saveQualityRuns(runs)

  return newRun
}

/**
 * Update quality gates based on execution result
 * This is the main function called after a packet execution
 */
export function updateQualityGatesFromResult(result: QualityGateResult): void {
  const gates = loadQualityGates()
  const runs = loadQualityRuns()
  const timestamp = new Date().toISOString()

  // Update test gate
  const testGate = gates.find(g => g.id === "test-pass")
  if (testGate) {
    testGate.status = result.gates.tests.success ? "passed" : "failed"
    testGate.lastRun = timestamp
    testGate.details = {
      passed: result.gates.tests.success ? 1 : 0,
      failed: result.gates.tests.success ? 0 : 1,
      warnings: 0
    }

    // Add run
    runs.push({
      id: `${result.id}-tests`,
      gateId: "test-pass",
      gateName: "Tests Pass",
      packetId: result.packetId,
      packetTitle: result.packetTitle,
      projectId: result.projectId,
      projectName: result.projectName,
      status: result.gates.tests.success ? "passed" : "failed",
      timestamp,
      duration: Math.round(result.duration / 3),
      message: result.gates.tests.success ? "All tests passed" : "Tests failed",
      output: result.gates.tests.output?.substring(0, 500)
    })
  }

  // Update type check gate
  const typeGate = gates.find(g => g.id === "type-check")
  if (typeGate) {
    typeGate.status = result.gates.typeCheck.success ? "passed" : "failed"
    typeGate.lastRun = timestamp
    typeGate.details = {
      passed: result.gates.typeCheck.success ? 1 : 0,
      failed: result.gates.typeCheck.errorCount || (result.gates.typeCheck.success ? 0 : 1),
      warnings: 0
    }

    // Add run
    runs.push({
      id: `${result.id}-typecheck`,
      gateId: "type-check",
      gateName: "TypeScript Check",
      packetId: result.packetId,
      packetTitle: result.packetTitle,
      projectId: result.projectId,
      projectName: result.projectName,
      status: result.gates.typeCheck.success ? "passed" : "failed",
      timestamp,
      duration: Math.round(result.duration / 3),
      message: result.gates.typeCheck.success
        ? "TypeScript check passed"
        : `${result.gates.typeCheck.errorCount || 0} type errors`,
      output: result.gates.typeCheck.output?.substring(0, 500)
    })
  }

  // Update build gate
  const buildGate = gates.find(g => g.id === "build-pass")
  if (buildGate) {
    buildGate.status = result.gates.build.success ? "passed" : "failed"
    buildGate.lastRun = timestamp
    buildGate.details = {
      passed: result.gates.build.success ? 1 : 0,
      failed: result.gates.build.success ? 0 : 1,
      warnings: 0
    }

    // Add run
    runs.push({
      id: `${result.id}-build`,
      gateId: "build-pass",
      gateName: "Build Success",
      packetId: result.packetId,
      packetTitle: result.packetTitle,
      projectId: result.projectId,
      projectName: result.projectName,
      status: result.gates.build.success ? "passed" : "failed",
      timestamp,
      duration: Math.round(result.duration / 3),
      message: result.gates.build.success ? "Build succeeded" : "Build failed",
      output: result.gates.build.output?.substring(0, 500)
    })
  }

  // Save updated gates and runs
  saveQualityGates(gates)
  saveQualityRuns(runs)
}

/**
 * Get aggregate stats across all gates
 */
export function getQualityStats(): {
  total: number
  passed: number
  failed: number
  warnings: number
  pending: number
} {
  const gates = loadQualityGates()

  return {
    total: gates.length,
    passed: gates.filter(g => g.status === "passed").length,
    failed: gates.filter(g => g.status === "failed").length,
    warnings: gates.filter(g => g.status === "warning").length,
    pending: gates.filter(g => g.status === "pending" || g.status === "skipped").length
  }
}

/**
 * Reset all quality gates to pending state
 */
export function resetQualityGates(): void {
  const gates = getDefaultGates()
  saveQualityGates(gates)
  saveQualityRuns([])
}

/**
 * Get the most recent runs for display
 */
export function getRecentRuns(limit: number = 20): QualityGateRun[] {
  const runs = loadQualityRuns()
  return runs.slice(-limit).reverse()
}
