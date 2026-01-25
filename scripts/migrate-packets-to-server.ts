#!/usr/bin/env npx ts-node
/**
 * Migration script to move packets from build-plans.json to server storage
 * Run with: npx ts-node scripts/migrate-packets-to-server.ts
 */

import * as fs from "fs"
import * as path from "path"

const CLAUDIA_DATA_DIR = path.join(process.env.HOME || "", ".claudia-data")
const BUILD_PLANS_FILE = path.join(CLAUDIA_DATA_DIR, "build-plans.json")
const STORAGE_DIR = path.join(process.cwd(), ".local-storage")
const PACKETS_FILE = path.join(STORAGE_DIR, "packets.json")

interface WorkPacket {
  id: string
  phaseId: string
  title: string
  description: string
  type: string
  priority: string
  status?: string
  tasks?: Array<{ id: string; description: string; completed: boolean; order: number }>
  acceptanceCriteria?: string[]
  blockedBy?: string[]
  blocks?: string[]
}

interface BuildPlan {
  id: string
  projectId: string
  status: string
  originalPlan: {
    packets: WorkPacket[]
  }
}

interface PacketsStore {
  packets: Record<string, WorkPacket[]>
  lastUpdated: string
}

async function migrate() {
  console.log("Starting packet migration...")

  // Read build plans
  if (!fs.existsSync(BUILD_PLANS_FILE)) {
    console.error("Build plans file not found:", BUILD_PLANS_FILE)
    process.exit(1)
  }

  const buildPlans: BuildPlan[] = JSON.parse(fs.readFileSync(BUILD_PLANS_FILE, "utf-8"))
  console.log(`Found ${buildPlans.length} build plans`)

  // Ensure storage directory exists
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true })
  }

  // Read existing packets store or create new one
  let packetsStore: PacketsStore = { packets: {}, lastUpdated: new Date().toISOString() }
  if (fs.existsSync(PACKETS_FILE)) {
    try {
      packetsStore = JSON.parse(fs.readFileSync(PACKETS_FILE, "utf-8"))
    } catch (e) {
      console.log("Could not read existing packets file, starting fresh")
    }
  }

  // Group packets by project, using latest build plan for each project
  const projectPackets: Record<string, WorkPacket[]> = {}
  const projectBuildPlanDates: Record<string, string> = {}

  for (const plan of buildPlans) {
    if (!plan.originalPlan?.packets || plan.originalPlan.packets.length === 0) {
      continue
    }

    const projectId = plan.projectId
    const packets = plan.originalPlan.packets.map(p => ({
      ...p,
      status: p.status || "queued"
    }))

    // Use the latest build plan for each project (assuming they're in order)
    projectPackets[projectId] = packets
    console.log(`  Project ${projectId}: ${packets.length} packets`)
  }

  // Merge into packets store
  for (const [projectId, packets] of Object.entries(projectPackets)) {
    // Only add if not already present or if server has fewer packets
    const existingPackets = packetsStore.packets[projectId] || []
    if (existingPackets.length < packets.length) {
      packetsStore.packets[projectId] = packets
      console.log(`  Migrated ${packets.length} packets for project ${projectId}`)
    } else {
      console.log(`  Skipped project ${projectId} (already has ${existingPackets.length} packets)`)
    }
  }

  packetsStore.lastUpdated = new Date().toISOString()

  // Write to server storage
  fs.writeFileSync(PACKETS_FILE, JSON.stringify(packetsStore, null, 2), "utf-8")
  console.log(`\nMigration complete! Packets saved to ${PACKETS_FILE}`)
  console.log(`Total projects with packets: ${Object.keys(packetsStore.packets).length}`)
}

migrate().catch(console.error)
