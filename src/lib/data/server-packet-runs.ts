/**
 * Server-Side Packet Runs Storage
 *
 * This module provides server-side file operations for packet execution history.
 * The file ~/.claudia-data/packet-runs.json is the SOURCE OF TRUTH.
 *
 * IMPORTANT: This module should ONLY be imported in server-side code (API routes).
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

// Server-side storage location
const DATA_DIR = process.env.CLAUDIA_DATA_DIR || path.join(os.homedir(), ".claudia-data")
const PACKET_RUNS_FILE = path.join(DATA_DIR, "packet-runs.json")

export interface PacketRun {
  id: string
  packetId: string
  projectId: string
  status: "pending" | "running" | "completed" | "failed" | "cancelled"
  startedAt: string
  completedAt?: string
  model?: string
  server?: string
  error?: string
  output?: string
  files?: Array<{ path: string; action: string }>
  commitUrl?: string
  branch?: string
  duration?: number
  userId?: string
}

/**
 * Ensure the data directory exists
 */
async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
  } catch {
    // Directory might already exist
  }
}

/**
 * Read packet runs from the server-side JSON file
 */
export async function readPacketRunsFile(): Promise<PacketRun[]> {
  try {
    await ensureDataDir()
    const content = await fs.readFile(PACKET_RUNS_FILE, "utf-8")
    return JSON.parse(content) as PacketRun[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return []
    }
    console.error("[server-packet-runs] Error reading file:", error)
    throw error
  }
}

/**
 * Write packet runs to the server-side JSON file
 */
export async function writePacketRunsFile(runs: PacketRun[]): Promise<void> {
  await ensureDataDir()
  const tempPath = `${PACKET_RUNS_FILE}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(runs, null, 2), "utf-8")
  await fs.rename(tempPath, PACKET_RUNS_FILE)
}

/**
 * Get packet runs for a specific user
 */
export async function getPacketRunsForUser(userId: string): Promise<PacketRun[]> {
  const allRuns = await readPacketRunsFile()
  return allRuns.filter(run => run.userId === userId || !run.userId)
}

/**
 * Get packet runs for a specific project
 */
export async function getPacketRunsForProject(projectId: string): Promise<PacketRun[]> {
  const allRuns = await readPacketRunsFile()
  return allRuns.filter(run => run.projectId === projectId)
}

/**
 * Add a new packet run
 */
export async function addPacketRun(run: PacketRun): Promise<PacketRun> {
  const allRuns = await readPacketRunsFile()
  allRuns.push(run)

  // Keep only last 1000 runs to prevent file bloat
  const trimmed = allRuns.slice(-1000)
  await writePacketRunsFile(trimmed)
  return run
}

/**
 * Update an existing packet run
 */
export async function updatePacketRun(
  runId: string,
  updates: Partial<PacketRun>
): Promise<PacketRun | null> {
  const allRuns = await readPacketRunsFile()
  const index = allRuns.findIndex(r => r.id === runId)

  if (index === -1) return null

  allRuns[index] = { ...allRuns[index], ...updates }
  await writePacketRunsFile(allRuns)
  return allRuns[index]
}

/**
 * Delete a packet run
 */
export async function deletePacketRun(runId: string): Promise<boolean> {
  const allRuns = await readPacketRunsFile()
  const filtered = allRuns.filter(r => r.id !== runId)

  if (filtered.length === allRuns.length) return false

  await writePacketRunsFile(filtered)
  return true
}
