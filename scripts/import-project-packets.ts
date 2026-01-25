#!/usr/bin/env npx ts-node
/**
 * Import packets from project directories into server storage
 * Scans ~/claudia-projects/* for docs/packets/ directories
 */

import * as fs from "fs"
import * as path from "path"
import * as os from "os"

const CLAUDIA_PROJECTS_DIR = path.join(os.homedir(), "claudia-projects")
const STORAGE_DIR = path.join(process.cwd(), ".local-storage")
const PACKETS_FILE = path.join(STORAGE_DIR, "packets.json")
const PROJECTS_FILE = path.join(os.homedir(), ".claudia-data", "projects.json")

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
}

interface PacketsStore {
  packets: Record<string, WorkPacket[]>
  lastUpdated: string
}

interface Project {
  id: string
  name: string
  workingDirectory?: string
  basePath?: string
}

// Parse a packet markdown file into a WorkPacket
function parsePacketMarkdown(content: string, filename: string): WorkPacket | null {
  try {
    // Extract ID from filename (e.g., PKT-001-repository-initialization.md -> PK1)
    const idMatch = filename.match(/PKT-(\d+)/)
    const pkNum = idMatch ? parseInt(idMatch[1]) : 0
    const id = `PK${pkNum}`

    // Try to extract frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    let title = ""
    let type = "feature"
    let priority = "medium"
    let phaseId = "P1"

    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1]
      const titleFm = frontmatter.match(/title:\s*"?([^"\n]+)"?/)
      if (titleFm) title = titleFm[1].trim()

      const typeFm = frontmatter.match(/type:\s*"?([^"\n]+)"?/)
      if (typeFm) type = typeFm[1].trim()

      const priorityFm = frontmatter.match(/priority:\s*"?([^"\n]+)"?/)
      if (priorityFm) priority = priorityFm[1].trim()

      const phaseFm = frontmatter.match(/phase_id:\s*"?([^"\n]+)"?/)
      if (phaseFm) phaseId = phaseFm[1].trim()
    }

    // Fall back to extracting title from first heading
    if (!title) {
      const titleMatch = content.match(/^#\s+(.+)$/m)
      title = titleMatch ? titleMatch[1] : filename.replace(".md", "")
    }

    // Extract description section
    const descSectionMatch = content.match(/## Description\n\n([\s\S]*?)(?=\n##|$)/)
    let description = descSectionMatch ? descSectionMatch[1].trim() : ""

    // If no explicit description section, get content after title
    if (!description) {
      const titleLineEnd = content.indexOf("\n", content.indexOf("# "))
      if (titleLineEnd > 0) {
        const afterTitle = content.substring(titleLineEnd).trim()
        // Get first paragraph or up to first ## heading
        const endIdx = afterTitle.indexOf("\n##")
        description = endIdx > 0 ? afterTitle.substring(0, endIdx).trim() : afterTitle.substring(0, 500).trim()
      }
    }

    // Extract tasks from markdown checklist
    const tasks: Array<{ id: string; description: string; completed: boolean; order: number }> = []
    const taskMatches = content.matchAll(/- \[([ x])\] (.+)/g)
    let taskOrder = 0
    for (const match of taskMatches) {
      tasks.push({
        id: `task-${id}-${taskOrder}`,
        description: match[2].trim(),
        completed: match[1] === "x",
        order: taskOrder++
      })
    }

    // Extract acceptance criteria
    const acceptanceCriteria: string[] = []
    const acSectionMatch = content.match(/## Acceptance Criteria\n\n([\s\S]*?)(?=\n##|$)/)
    if (acSectionMatch) {
      const acContent = acSectionMatch[1]
      const acMatches = acContent.matchAll(/- \[[ x]\] (.+)/g)
      for (const match of acMatches) {
        acceptanceCriteria.push(match[1].trim())
      }
    }

    return {
      id,
      phaseId,
      title,
      description: description || title,
      type,
      priority,
      status: "queued",
      tasks: tasks.length > 0 ? tasks : undefined,
      acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined
    }
  } catch (error) {
    console.error(`Failed to parse ${filename}:`, error)
    return null
  }
}

// Load projects to get project IDs
function loadProjects(): Project[] {
  try {
    const data = fs.readFileSync(PROJECTS_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

// Find project ID by working directory
function findProjectId(projects: Project[], workingDir: string): string | null {
  const normalized = workingDir.replace(/^~/, os.homedir())
  for (const project of projects) {
    const projDir = (project.workingDirectory || project.basePath || "").replace(/^~/, os.homedir())
    if (projDir && normalized.includes(projDir.split("/").pop() || "")) {
      return project.id
    }
  }
  return null
}

async function main() {
  console.log("Importing packets from project directories...")

  // Load existing packets store
  let packetsStore: PacketsStore = { packets: {}, lastUpdated: new Date().toISOString() }
  if (fs.existsSync(PACKETS_FILE)) {
    try {
      packetsStore = JSON.parse(fs.readFileSync(PACKETS_FILE, "utf-8"))
    } catch {
      console.log("Could not read existing packets.json, starting fresh")
    }
  }

  // Load projects
  const projects = loadProjects()
  console.log(`Found ${projects.length} projects`)

  // Scan claudia-projects directory
  if (!fs.existsSync(CLAUDIA_PROJECTS_DIR)) {
    console.log("No claudia-projects directory found")
    return
  }

  const projectDirs = fs.readdirSync(CLAUDIA_PROJECTS_DIR)
  let importedCount = 0

  for (const dirName of projectDirs) {
    const projectPath = path.join(CLAUDIA_PROJECTS_DIR, dirName)
    const packetsDir = path.join(projectPath, "docs", "packets")

    if (!fs.existsSync(packetsDir)) continue

    // Find the project ID
    const projectId = findProjectId(projects, projectPath)
    if (!projectId) {
      console.log(`  Skipping ${dirName} - no matching project found`)
      continue
    }

    // Check if we already have packets for this project
    const existingPackets = packetsStore.packets[projectId] || []
    if (existingPackets.length > 0) {
      console.log(`  Skipping ${dirName} - already has ${existingPackets.length} packets`)
      continue
    }

    // Read packet files
    const packetFiles = fs.readdirSync(packetsDir).filter(f => f.endsWith(".md"))
    if (packetFiles.length === 0) continue

    console.log(`  Importing ${packetFiles.length} packets from ${dirName}...`)

    const packets: WorkPacket[] = []
    for (const file of packetFiles) {
      const content = fs.readFileSync(path.join(packetsDir, file), "utf-8")
      const packet = parsePacketMarkdown(content, file)
      if (packet) {
        packets.push(packet)
      }
    }

    if (packets.length > 0) {
      packetsStore.packets[projectId] = packets
      importedCount += packets.length
      console.log(`    Added ${packets.length} packets for project ${projectId}`)
    }
  }

  // Also check project config files for packets
  for (const project of projects) {
    const projDir = (project.workingDirectory || project.basePath || "").replace(/^~/, os.homedir())
    if (!projDir || !fs.existsSync(projDir)) continue

    const configPath = path.join(projDir, ".claudia", "config.json")
    if (!fs.existsSync(configPath)) continue

    // Check if we already have packets
    if (packetsStore.packets[project.id]?.length > 0) continue

    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
      if (config.buildPlan?.originalPlan?.packets?.length > 0) {
        const packets = config.buildPlan.originalPlan.packets.map((p: WorkPacket) => ({
          ...p,
          status: p.status || "queued"
        }))
        packetsStore.packets[project.id] = packets
        importedCount += packets.length
        console.log(`  Imported ${packets.length} packets from ${project.name} config`)
      }
    } catch {
      // Ignore config parse errors
    }
  }

  // Save updated packets store
  packetsStore.lastUpdated = new Date().toISOString()
  fs.mkdirSync(STORAGE_DIR, { recursive: true })
  fs.writeFileSync(PACKETS_FILE, JSON.stringify(packetsStore, null, 2), "utf-8")

  console.log(`\nImport complete! Added ${importedCount} packets`)
  console.log(`Total projects with packets: ${Object.keys(packetsStore.packets).length}`)
}

main().catch(console.error)
