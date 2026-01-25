/**
 * Touchdown Detector
 *
 * Detects when all packets in a project are completed (a "Touchdown")
 * and generates celebration documentation.
 *
 * When a touchdown is detected:
 * 1. Generate TOUCHDOWN.md documenting what was built
 * 2. Create a "touchdown" packet for review
 * 3. Update project status
 * 4. Trigger celebration UI
 *
 * NOTE: Uses file-based storage (.local-storage/packets.json)
 */

import { promises as fs } from "fs"
import path from "path"
import os from "os"
import { getProject, updateProject } from "@/lib/data/projects"
import { getRecentRunsForProject } from "@/lib/data/execution-sessions"
import type { Project } from "@/lib/data/types"

// Storage configuration for file-based packets
const STORAGE_DIR = path.join(process.cwd(), ".local-storage")
const PACKETS_FILE = path.join(STORAGE_DIR, "packets.json")

interface WorkPacket {
  id: string
  phaseId: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  tasks?: Array<{ id: string; description: string; completed: boolean; order: number }>
  acceptanceCriteria?: string[]
  suggestedTaskType?: string
  estimatedTokens?: number
  blockedBy?: string[]
  blocks?: string[]
  metadata?: Record<string, unknown>
}

interface PacketsStore {
  packets: Record<string, WorkPacket[]>
  lastUpdated: string
}

async function ensureStorageDir(): Promise<void> {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true })
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code !== "EEXIST") throw error
  }
}

async function readPacketsStore(): Promise<PacketsStore> {
  try {
    await ensureStorageDir()
    const data = await fs.readFile(PACKETS_FILE, "utf-8")
    const parsed = JSON.parse(data)
    if (parsed && typeof parsed.packets === "object") {
      return parsed as PacketsStore
    }
    return { packets: {}, lastUpdated: new Date().toISOString() }
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === "ENOENT" || error instanceof SyntaxError) {
      return { packets: {}, lastUpdated: new Date().toISOString() }
    }
    throw error
  }
}

async function writePacketsStore(store: PacketsStore): Promise<void> {
  await ensureStorageDir()
  store.lastUpdated = new Date().toISOString()
  await fs.writeFile(PACKETS_FILE, JSON.stringify(store, null, 2), "utf-8")
}

async function getPacketsForProject(projectId: string): Promise<WorkPacket[]> {
  const store = await readPacketsStore()
  return store.packets[projectId] || []
}

async function savePackets(projectId: string, packets: WorkPacket[]): Promise<void> {
  const store = await readPacketsStore()
  store.packets[projectId] = packets
  await writePacketsStore(store)
}

// ============================================================================
// Types
// ============================================================================

export interface TouchdownResult {
  triggered: boolean
  projectId: string
  projectName?: string
  completedPackets: number
  totalPackets: number
  markdownPath?: string
  touchdownPacketId?: string
  celebrationData?: {
    duration: string
    filesChanged: number
    linesOfCode: number
    keyAchievements: string[]
  }
}

export interface TouchdownPacket extends WorkPacket {
  metadata: WorkPacket["metadata"] & {
    isTouchdown: true
    touchdownAt: string
    completedPacketIds: string[]
  }
}

// ============================================================================
// Helpers
// ============================================================================

function expandPath(p: string): string {
  if (!p) return p
  return p.replace(/^~/, os.homedir())
}

function formatDuration(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffMs = end.getTime() - start.getTime()

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days} day${days > 1 ? "s" : ""}`
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${minutes} minutes`
}

function generatePacketId(): string {
  return `packet-td-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Check if all packets in a project are completed
 */
export async function checkTouchdown(projectId: string): Promise<TouchdownResult> {
  const packets = await getPacketsForProject(projectId)
  const project = getProject(projectId)

  // Filter out any existing touchdown packets for the count
  const workPackets = packets.filter(p => !p.metadata?.isTouchdown)

  if (workPackets.length === 0) {
    return {
      triggered: false,
      projectId,
      projectName: project?.name,
      completedPackets: 0,
      totalPackets: 0,
    }
  }

  const completedPackets = workPackets.filter(p => p.status === "completed")

  // Not all completed yet
  if (completedPackets.length < workPackets.length) {
    return {
      triggered: false,
      projectId,
      projectName: project?.name,
      completedPackets: completedPackets.length,
      totalPackets: workPackets.length,
    }
  }

  // Check if touchdown was already triggered
  const existingTouchdown = packets.find(p => p.metadata?.isTouchdown)
  if (existingTouchdown) {
    return {
      triggered: false,
      projectId,
      projectName: project?.name,
      completedPackets: completedPackets.length,
      totalPackets: workPackets.length,
      touchdownPacketId: existingTouchdown.id,
    }
  }

  // TOUCHDOWN! All packets completed
  console.log(`[touchdown] TOUCHDOWN detected for project ${projectId} - ${completedPackets.length} packets completed!`)

  // Generate touchdown documentation
  const result = await triggerTouchdown(projectId, project, completedPackets)

  return result
}

/**
 * Trigger touchdown - generate documentation and packet
 */
export async function triggerTouchdown(
  projectId: string,
  project: Project | null,
  completedPackets: WorkPacket[]
): Promise<TouchdownResult> {
  const projectName = project?.name || "Unknown Project"

  // Calculate celebration data
  const completionDates = completedPackets
    .map(p => p.metadata?.completedAt as string | undefined)
    .filter((d): d is string => !!d)
    .sort()

  const firstCompletedAt = completionDates[0] || new Date().toISOString()
  const lastCompletedAt = completionDates[completionDates.length - 1] || new Date().toISOString()

  const filesChanged = completedPackets
    .flatMap(p => (p.metadata?.filesChanged as string[] | undefined) || [])
    .filter((f, i, arr) => arr.indexOf(f) === i)
    .length

  const keyAchievements = completedPackets
    .map(p => p.title)
    .slice(0, 10)

  const celebrationData = {
    duration: formatDuration(firstCompletedAt, lastCompletedAt),
    filesChanged,
    linesOfCode: 0, // Would need to calculate from git diff
    keyAchievements,
  }

  // Generate TOUCHDOWN.md
  const markdown = generateTouchdownMarkdown(projectName, completedPackets, celebrationData)

  // Write to project directory
  let markdownPath: string | undefined
  if (project?.workingDirectory || project?.basePath) {
    const projectDir = expandPath(project.workingDirectory || project.basePath || "")
    const claudiaDir = path.join(projectDir, ".claudia")

    try {
      await fs.mkdir(claudiaDir, { recursive: true })
      markdownPath = path.join(claudiaDir, "TOUCHDOWN.md")
      await fs.writeFile(markdownPath, markdown, "utf-8")
      console.log(`[touchdown] Generated ${markdownPath}`)
    } catch (error) {
      console.error("[touchdown] Failed to write TOUCHDOWN.md:", error)
    }
  }

  // Create touchdown packet
  const touchdownPacket = createTouchdownPacket(projectId, projectName, completedPackets, celebrationData)

  // Save the touchdown packet
  const allPackets = await getPacketsForProject(projectId)
  allPackets.push(touchdownPacket)
  await await savePackets(projectId, allPackets)

  // Update project status to completed
  if (project) {
    updateProject(projectId, {
      status: "completed",
    })
  }

  return {
    triggered: true,
    projectId,
    projectName,
    completedPackets: completedPackets.length,
    totalPackets: completedPackets.length,
    markdownPath,
    touchdownPacketId: touchdownPacket.id,
    celebrationData,
  }
}

/**
 * Generate TOUCHDOWN.md content
 */
export function generateTouchdownMarkdown(
  projectName: string,
  completedPackets: WorkPacket[],
  celebrationData: TouchdownResult["celebrationData"]
): string {
  const now = new Date().toLocaleString()

  const lines: string[] = []

  lines.push(`# 🏈 TOUCHDOWN! ${projectName}`)
  lines.push("")
  lines.push(`> All ${completedPackets.length} work packets completed successfully!`)
  lines.push("")
  lines.push(`**Completed:** ${now}`)
  if (celebrationData?.duration) {
    lines.push(`**Duration:** ${celebrationData.duration}`)
  }
  if (celebrationData?.filesChanged) {
    lines.push(`**Files Changed:** ${celebrationData.filesChanged}`)
  }
  lines.push("")
  lines.push("---")
  lines.push("")

  // Summary
  lines.push("## Summary")
  lines.push("")
  lines.push(`This project has reached completion with all ${completedPackets.length} work packets successfully delivered.`)
  lines.push("")

  // Packet breakdown by type
  const byType: { [type: string]: WorkPacket[] } = {}
  for (const packet of completedPackets) {
    const type = packet.type || "other"
    if (!byType[type]) byType[type] = []
    byType[type].push(packet)
  }

  lines.push("### Work Completed")
  lines.push("")
  lines.push("| Type | Count |")
  lines.push("|------|-------|")
  for (const [type, packets] of Object.entries(byType)) {
    const emoji = type === "feature" ? "✨" :
                  type === "bugfix" ? "🐛" :
                  type === "test" ? "🧪" :
                  type === "docs" ? "📄" :
                  type === "refactor" ? "🔧" : "📦"
    lines.push(`| ${emoji} ${type} | ${packets.length} |`)
  }
  lines.push("")

  // Key achievements
  lines.push("## Key Achievements")
  lines.push("")
  for (const packet of completedPackets) {
    const emoji = packet.type === "feature" ? "✨" :
                  packet.type === "bugfix" ? "🐛" :
                  packet.type === "test" ? "🧪" :
                  packet.type === "docs" ? "📄" : "📦"
    lines.push(`- ${emoji} **${packet.title}**`)
    if (packet.metadata?.outputSummary) {
      lines.push(`  - ${packet.metadata.outputSummary}`)
    }
  }
  lines.push("")

  // Files changed
  const allFilesChanged = completedPackets
    .flatMap(p => (p.metadata?.filesChanged as string[] | undefined) || [])
    .filter((f, i, arr) => arr.indexOf(f) === i)

  if (allFilesChanged.length > 0) {
    lines.push("## Files Changed")
    lines.push("")
    lines.push("```")
    for (const file of allFilesChanged.slice(0, 50)) {
      lines.push(file)
    }
    if (allFilesChanged.length > 50) {
      lines.push(`... and ${allFilesChanged.length - 50} more files`)
    }
    lines.push("```")
    lines.push("")
  }

  // Timeline
  lines.push("## Timeline")
  lines.push("")
  const sortedByCompletion = [...completedPackets]
    .filter(p => p.metadata?.completedAt)
    .sort((a, b) => {
      const aDate = new Date(a.metadata!.completedAt as string).getTime()
      const bDate = new Date(b.metadata!.completedAt as string).getTime()
      return aDate - bDate
    })

  for (const packet of sortedByCompletion) {
    const completedAt = new Date(packet.metadata!.completedAt as string).toLocaleString()
    lines.push(`- **${completedAt}** - ${packet.title}`)
  }
  lines.push("")

  // Footer
  lines.push("---")
  lines.push("")
  lines.push("*This touchdown was automatically generated by Claudia Coder when all work packets were completed.*")
  lines.push("")
  lines.push("🎉 **Congratulations on reaching the end zone!** 🎉")

  return lines.join("\n")
}

/**
 * Create a touchdown packet for the project
 */
export function createTouchdownPacket(
  projectId: string,
  projectName: string,
  completedPackets: WorkPacket[],
  celebrationData: TouchdownResult["celebrationData"]
): TouchdownPacket {
  return {
    id: generatePacketId(),
    phaseId: "phase-touchdown",
    title: `🏈 TOUCHDOWN - ${projectName}`,
    description: `All ${completedPackets.length} work packets have been completed!\n\n` +
      `**Duration:** ${celebrationData?.duration || "N/A"}\n` +
      `**Files Changed:** ${celebrationData?.filesChanged || 0}\n\n` +
      `### Achievements\n` +
      completedPackets.map(p => `- ${p.title}`).join("\n"),
    type: "docs",
    priority: "high",
    status: "completed",
    tasks: [
      {
        id: `task-td-${Date.now()}-1`,
        description: "All work packets completed",
        completed: true,
        order: 0,
      },
      {
        id: `task-td-${Date.now()}-2`,
        description: "TOUCHDOWN.md generated",
        completed: true,
        order: 1,
      },
      {
        id: `task-td-${Date.now()}-3`,
        description: "Project marked as completed",
        completed: true,
        order: 2,
      },
    ],
    suggestedTaskType: "review",
    acceptanceCriteria: [
      "All work packets completed",
      "Documentation generated",
      "Project ready for deployment/release",
    ],
    estimatedTokens: 0,
    blockedBy: completedPackets.map(p => p.id),
    blocks: [],
    metadata: {
      source: "touchdown-detector",
      isTouchdown: true,
      touchdownAt: new Date().toISOString(),
      completedPacketIds: completedPackets.map(p => p.id),
      celebrationData,
    },
  }
}

/**
 * Get run history for a project
 */
export async function getProjectRunHistory(projectId: string) {
  try {
    const history = await getRecentRunsForProject(projectId)
    return history
  } catch {
    return []
  }
}
