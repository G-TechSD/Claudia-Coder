/**
 * Packet Runs Data Store
 * Storage module for packet execution run history using localStorage
 */

import { PacketRun, PacketRunRating } from "./types"

const STORAGE_KEY = "claudia_packet_runs"

// ============ Helper Functions ============

/**
 * UUID generator that works in all contexts (HTTP, HTTPS, localhost)
 */
function generateUUID(): string {
  // Try native crypto.randomUUID first (requires secure context)
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  // Fallback for insecure contexts (HTTP over network)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Calculate the next iteration number for a packet
 */
function calculateNextIteration(packetId: string): number {
  const runs = getPacketRuns(packetId)
  if (runs.length === 0) return 1
  return Math.max(...runs.map(r => r.iteration)) + 1
}

// ============ Storage Helpers ============

function getStoredRuns(): PacketRun[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

function saveRuns(runs: PacketRun[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs))
}

// ============ Packet Run CRUD ============

/**
 * Get all runs for a specific packet
 * Returns runs sorted by iteration (newest first)
 */
export function getPacketRuns(packetId: string): PacketRun[] {
  const runs = getStoredRuns()
  return runs
    .filter(r => r.packetId === packetId)
    .sort((a, b) => b.iteration - a.iteration)
}

/**
 * Get a specific run by ID
 */
export function getPacketRun(runId: string): PacketRun | null {
  const runs = getStoredRuns()
  return runs.find(r => r.id === runId) || null
}

/**
 * Create a new run for a packet
 * Automatically generates ID, sets timestamps, and calculates iteration number
 */
export function createPacketRun(packetId: string, projectId: string): PacketRun {
  const runs = getStoredRuns()
  const now = new Date().toISOString()

  const run: PacketRun = {
    id: generateUUID(),
    packetId,
    projectId,
    startedAt: now,
    status: "running",
    output: "",
    iteration: calculateNextIteration(packetId)
  }

  runs.push(run)
  saveRuns(runs)
  return run
}

/**
 * Update a run with partial updates
 * Useful for adding output, completing runs, etc.
 */
export function updatePacketRun(runId: string, updates: Partial<PacketRun>): PacketRun | null {
  const runs = getStoredRuns()
  const index = runs.findIndex(r => r.id === runId)

  if (index === -1) return null

  // Don't allow changing id, packetId, projectId, startedAt, or iteration
  const { id, packetId, projectId, startedAt, iteration, ...allowedUpdates } = updates

  runs[index] = {
    ...runs[index],
    ...allowedUpdates
  }

  saveRuns(runs)
  return runs[index]
}

/**
 * Add feedback (rating and optional comment) to a run
 */
export function addRunFeedback(
  runId: string,
  rating: "thumbs_up" | "thumbs_down" | null,
  comment?: string
): PacketRun | null {
  const runs = getStoredRuns()
  const index = runs.findIndex(r => r.id === runId)

  if (index === -1) return null

  runs[index] = {
    ...runs[index],
    rating,
    comment: comment !== undefined ? comment : runs[index].comment
  }

  saveRuns(runs)
  return runs[index]
}

/**
 * Get the latest (most recent) run for a packet
 */
export function getLatestPacketRun(packetId: string): PacketRun | null {
  const runs = getPacketRuns(packetId)
  return runs.length > 0 ? runs[0] : null
}

/**
 * Get all runs for a project
 * Returns runs sorted by startedAt (newest first)
 */
export function getProjectRuns(projectId: string): PacketRun[] {
  const runs = getStoredRuns()
  return runs
    .filter(r => r.projectId === projectId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
}

// ============ Additional Utilities ============

/**
 * Delete a specific run
 */
export function deletePacketRun(runId: string): boolean {
  const runs = getStoredRuns()
  const filtered = runs.filter(r => r.id !== runId)

  if (filtered.length === runs.length) return false

  saveRuns(filtered)
  return true
}

/**
 * Delete all runs for a packet
 */
export function deletePacketRuns(packetId: string): number {
  const runs = getStoredRuns()
  const filtered = runs.filter(r => r.packetId !== packetId)
  const deletedCount = runs.length - filtered.length

  saveRuns(filtered)
  return deletedCount
}

/**
 * Get run statistics for a packet
 */
export function getPacketRunStats(packetId: string): {
  total: number
  completed: number
  failed: number
  cancelled: number
  running: number
  thumbsUp: number
  thumbsDown: number
} {
  const runs = getPacketRuns(packetId)

  return {
    total: runs.length,
    completed: runs.filter(r => r.status === "completed").length,
    failed: runs.filter(r => r.status === "failed").length,
    cancelled: runs.filter(r => r.status === "cancelled").length,
    running: runs.filter(r => r.status === "running").length,
    thumbsUp: runs.filter(r => r.rating === "thumbs_up").length,
    thumbsDown: runs.filter(r => r.rating === "thumbs_down").length
  }
}

/**
 * Clear all stored runs (useful for testing/reset)
 */
export function clearAllRuns(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}
