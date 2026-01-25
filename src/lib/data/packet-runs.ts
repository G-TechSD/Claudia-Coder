/**
 * Packet Runs Data Store
 * Storage module for packet execution run history using localStorage
 *
 * IMPORTANT: All packet run data is user-scoped. Runs belong to specific users
 * and are stored in user-specific localStorage keys.
 */

import { PacketRun, PacketRunRating } from "./types"
import {
  getUserStorageItem,
  setUserStorageItem,
  USER_STORAGE_KEYS,
  dispatchStorageChange
} from "./user-storage"

// Legacy storage key (kept for migration purposes)
const LEGACY_STORAGE_KEY = "claudia_packet_runs"

// Server sync helpers
async function syncRunToServer(run: PacketRun): Promise<void> {
  try {
    await fetch("/api/packet-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(run)
    })
  } catch (error) {
    console.warn("[packet-runs] Failed to sync to server:", error)
  }
}

async function updateRunOnServer(runId: string, updates: Partial<PacketRun>): Promise<void> {
  try {
    await fetch("/api/packet-runs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: runId, ...updates })
    })
  } catch (error) {
    console.warn("[packet-runs] Failed to update on server:", error)
  }
}

/**
 * Fetch runs from server and merge with localStorage
 * Call this on app init to sync from server
 */
export async function syncRunsFromServer(userId: string): Promise<void> {
  try {
    const response = await fetch("/api/packet-runs")
    const data = await response.json()
    if (data.success && Array.isArray(data.runs)) {
      // Merge server runs with local runs
      const localRuns = getStoredRunsForUser(userId)
      const serverRunIds = new Set(data.runs.map((r: PacketRun) => r.id))

      // Add local runs that aren't on server
      for (const localRun of localRuns) {
        if (!serverRunIds.has(localRun.id)) {
          syncRunToServer(localRun)
        }
      }

      // Update local with server runs
      const mergedMap = new Map<string, PacketRun>()
      for (const run of localRuns) {
        mergedMap.set(run.id, run)
      }
      for (const run of data.runs) {
        mergedMap.set(run.id, run)
      }

      saveRunsForUser(userId, Array.from(mergedMap.values()))
    }
  } catch (error) {
    console.warn("[packet-runs] Failed to sync from server:", error)
  }
}

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
function calculateNextIteration(packetId: string, userId?: string): number {
  const runs = getPacketRuns(packetId, userId)
  if (runs.length === 0) return 1
  return Math.max(...runs.map(r => r.iteration)) + 1
}

// ============ Storage Helpers ============

/**
 * Get all packet runs for a specific user
 */
function getStoredRunsForUser(userId: string): PacketRun[] {
  if (typeof window === "undefined") return []

  const userRuns = getUserStorageItem<PacketRun[]>(userId, USER_STORAGE_KEYS.PACKET_RUNS)
  if (Array.isArray(userRuns)) return userRuns

  // Fallback to legacy storage
  try {
    const stored = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // JSON parse failed, return empty
  }
  return []
}

/**
 * Save packet runs for a specific user
 */
function saveRunsForUser(userId: string, runs: PacketRun[]): void {
  if (typeof window === "undefined") return
  setUserStorageItem(userId, USER_STORAGE_KEYS.PACKET_RUNS, runs)
  dispatchStorageChange(userId, USER_STORAGE_KEYS.PACKET_RUNS, runs)
}

/**
 * @deprecated Use getStoredRunsForUser instead
 */
function getStoredRuns(): PacketRun[] {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // JSON parse failed, return empty
  }
  return []
}

/**
 * @deprecated Use saveRunsForUser instead
 */
function saveRuns(runs: PacketRun[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(runs))
}

// ============ Packet Run CRUD ============

/**
 * Get all runs for a specific packet
 * @param packetId - The packet ID
 * @param userId - The user ID (for access control)
 * @returns Runs sorted by iteration (newest first)
 */
export function getPacketRuns(packetId: string, userId?: string): PacketRun[] {
  const runs = userId ? getStoredRunsForUser(userId) : getStoredRuns()
  if (!Array.isArray(runs)) return []
  return runs
    .filter(r => r.packetId === packetId)
    .sort((a, b) => b.iteration - a.iteration)
}

/**
 * Get a specific run by ID
 * @param runId - The run ID
 * @param userId - The user ID (for access control)
 */
export function getPacketRun(runId: string, userId?: string): PacketRun | null {
  const runs = userId ? getStoredRunsForUser(userId) : getStoredRuns()
  if (!Array.isArray(runs)) return null
  return runs.find(r => r.id === runId) || null
}

/**
 * Create a new run for a packet
 * @param packetId - The packet ID
 * @param projectId - The project ID
 * @param userId - The user ID (owner of the run)
 * @returns The created run with auto-generated ID, timestamps, and iteration number
 */
export function createPacketRun(packetId: string, projectId: string, userId?: string): PacketRun {
  const runs = userId ? getStoredRunsForUser(userId) : getStoredRuns()
  const now = new Date().toISOString()

  const run: PacketRun = {
    id: generateUUID(),
    packetId,
    projectId,
    startedAt: now,
    status: "running",
    output: "",
    iteration: calculateNextIteration(packetId, userId)
  }

  runs.push(run)

  if (userId) {
    saveRunsForUser(userId, runs)
  } else {
    saveRuns(runs)
  }

  // Sync to server asynchronously
  syncRunToServer(run)

  return run
}

/**
 * Update a run with partial updates
 * @param runId - The run ID
 * @param updates - Partial updates
 * @param userId - The user ID (for access control)
 */
export function updatePacketRun(runId: string, updates: Partial<PacketRun>, userId?: string): PacketRun | null {
  const runs = userId ? getStoredRunsForUser(userId) : getStoredRuns()
  const index = runs.findIndex(r => r.id === runId)

  if (index === -1) return null

  // Don't allow changing id, packetId, projectId, startedAt, or iteration
  const { id, packetId, projectId, startedAt, iteration, ...allowedUpdates } = updates

  runs[index] = {
    ...runs[index],
    ...allowedUpdates
  }

  if (userId) {
    saveRunsForUser(userId, runs)
  } else {
    saveRuns(runs)
  }

  // Sync to server asynchronously
  updateRunOnServer(runId, allowedUpdates)

  return runs[index]
}

/**
 * Add feedback (rating and optional comment) to a run
 * @param runId - The run ID
 * @param rating - Thumbs up/down or null
 * @param comment - Optional comment
 * @param userId - The user ID (for access control)
 */
export function addRunFeedback(
  runId: string,
  rating: "thumbs_up" | "thumbs_down" | null,
  comment?: string,
  userId?: string
): PacketRun | null {
  const runs = userId ? getStoredRunsForUser(userId) : getStoredRuns()
  const index = runs.findIndex(r => r.id === runId)

  if (index === -1) return null

  runs[index] = {
    ...runs[index],
    rating,
    comment: comment !== undefined ? comment : runs[index].comment
  }

  if (userId) {
    saveRunsForUser(userId, runs)
  } else {
    saveRuns(runs)
  }

  return runs[index]
}

/**
 * Get the latest (most recent) run for a packet
 * @param packetId - The packet ID
 * @param userId - The user ID (for access control)
 */
export function getLatestPacketRun(packetId: string, userId?: string): PacketRun | null {
  const runs = getPacketRuns(packetId, userId)
  return runs.length > 0 ? runs[0] : null
}

/**
 * Get all runs for a project
 * @param projectId - The project ID
 * @param userId - The user ID (for access control)
 * @returns Runs sorted by startedAt (newest first)
 */
export function getProjectRuns(projectId: string, userId?: string): PacketRun[] {
  const runs = userId ? getStoredRunsForUser(userId) : getStoredRuns()
  // Ensure runs is an array (handle corrupted/malformed storage)
  if (!Array.isArray(runs)) {
    console.warn("Packet runs storage is corrupted, returning empty array")
    return []
  }
  return runs
    .filter(r => r.projectId === projectId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
}

/**
 * Get all runs for a project grouped by packet ID
 * @param projectId - The project ID
 * @param userId - The user ID (for access control)
 * @returns Object with packetId keys and arrays of runs as values
 */
export function getPacketRunsForProject(projectId: string, userId?: string): Record<string, PacketRun[]> {
  const runs = getProjectRuns(projectId, userId)
  const grouped: Record<string, PacketRun[]> = {}

  for (const run of runs) {
    if (!grouped[run.packetId]) {
      grouped[run.packetId] = []
    }
    grouped[run.packetId].push(run)
  }

  return grouped
}

// ============ Additional Utilities ============

/**
 * Delete a specific run
 * @param runId - The run ID
 * @param userId - The user ID (for access control)
 */
export function deletePacketRun(runId: string, userId?: string): boolean {
  const runs = userId ? getStoredRunsForUser(userId) : getStoredRuns()
  if (!Array.isArray(runs)) return false
  const filtered = runs.filter(r => r.id !== runId)

  if (filtered.length === runs.length) return false

  if (userId) {
    saveRunsForUser(userId, filtered)
  } else {
    saveRuns(filtered)
  }

  return true
}

/**
 * Delete all runs for a packet
 * @param packetId - The packet ID
 * @param userId - The user ID (for access control)
 */
export function deletePacketRuns(packetId: string, userId?: string): number {
  const runs = userId ? getStoredRunsForUser(userId) : getStoredRuns()
  if (!Array.isArray(runs)) return 0
  const filtered = runs.filter(r => r.packetId !== packetId)
  const deletedCount = runs.length - filtered.length

  if (userId) {
    saveRunsForUser(userId, filtered)
  } else {
    saveRuns(filtered)
  }

  return deletedCount
}

/**
 * Get run statistics for a packet
 * @param packetId - The packet ID
 * @param userId - The user ID (for access control)
 */
export function getPacketRunStats(packetId: string, userId?: string): {
  total: number
  completed: number
  failed: number
  cancelled: number
  running: number
  thumbsUp: number
  thumbsDown: number
} {
  const runs = getPacketRuns(packetId, userId)

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
 * Clear all stored runs for a user
 * @param userId - Required: The user ID
 */
export function clearAllRuns(userId: string): void {
  if (typeof window === "undefined") return
  if (!userId) {
    console.warn("clearAllRuns called without userId - no action taken for safety")
    return
  }
  saveRunsForUser(userId, [])
}
