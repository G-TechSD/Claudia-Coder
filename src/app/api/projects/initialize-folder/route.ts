/**
 * Initialize Project Folder API
 *
 * POST /api/projects/initialize-folder
 *
 * Creates the complete project folder structure including:
 * - .claudia/ directory with config.json, status/, and requests/
 * - docs/ directory with PRD.md, BUILD_PLAN.md, and packets/
 * - KICKOFF.md summary document
 * - repo/ directory with cloned git repository (if linked)
 *
 * Body: { projectId: string, targetPath?: string, project?: Project, buildPlan?: StoredBuildPlan, packets?: WorkPacket[] }
 *
 * The project, buildPlan, and packets data should be passed from the client
 * since localStorage is not available on the server.
 */

import { NextRequest, NextResponse } from "next/server"
import { mkdir, writeFile, readdir } from "fs/promises"
import { existsSync } from "fs"
import { exec } from "child_process"
import { promisify } from "util"
import path from "path"

import {
  generatePRD,
  generateBuildPlanMarkdown,
  generateKickoffMarkdown,
  generatePacketMarkdown,
  generateConfigJSON,
  getPacketFilename,
  generateSlug
} from "@/lib/project-files/generators"

const execAsync = promisify(exec)

// Base directory for all Claudia project working directories
const CLAUDIA_PROJECTS_BASE = process.env.CLAUDIA_PROJECTS_BASE || "/home/bill/claudia-projects"

// Types matching the data stores
interface LinkedRepo {
  provider: string
  id: number
  name: string
  path: string
  url: string
  localPath?: string
}

interface Project {
  id: string
  name: string
  description: string
  status: string
  priority: string
  createdAt: string
  updatedAt: string
  workingDirectory?: string
  basePath?: string
  repos: LinkedRepo[]
  packetIds: string[]
  linearSync?: {
    mode: string
    projectId?: string
    teamId?: string
  }
  tags: string[]
}

interface StoredBuildPlan {
  id: string
  projectId: string
  status: string
  createdAt: string
  updatedAt: string
  revisionNumber: number
  originalPlan: {
    spec: {
      name: string
      description: string
      objectives: string[]
      nonGoals: string[]
      assumptions: string[]
      risks: string[]
      techStack: string[]
    }
    phases: Array<{
      id: string
      name: string
      description: string
      order: number
    }>
    packets: Array<{
      id: string
      phaseId: string
      title: string
      description: string
      type: string
      priority: string
      tasks: Array<{ id: string; description: string; completed: boolean; order: number }>
      acceptanceCriteria: string[]
    }>
  }
  generatedBy: {
    server: string
    model: string
  }
  approvedAt?: string
}

interface WorkPacket {
  id: string
  phaseId: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  tasks: Array<{ id: string; description: string; completed: boolean; order: number }>
  suggestedTaskType?: string
  blockedBy?: string[]
  blocks?: string[]
  estimatedTokens?: number
  estimatedCost?: number
  acceptanceCriteria: string[]
}

interface InitializeRequest {
  projectId: string
  targetPath?: string
  // Client must pass these since localStorage is server-inaccessible
  project?: Project
  buildPlan?: StoredBuildPlan
  packets?: WorkPacket[]
  // Legacy fields for backward compatibility
  projectName?: string
  projectDescription?: string
  linkedRepo?: {
    name: string
    url: string
    localPath?: string
  }
  dryRun?: boolean
}

interface FileCreated {
  path: string
  description: string
}

interface InitializeResponse {
  success: boolean
  workingDirectory: string
  createdFiles: FileCreated[]
  summary: {
    totalFiles: number
    directories: number
    packets: number
    repoCloned: boolean
    repoPath?: string
  }
  errors?: string[]
  alreadyExists?: boolean
}

/**
 * Generate working directory path from project name
 */
function generateWorkingDirectoryPath(projectName: string, projectId?: string): string {
  const slug = generateSlug(projectName)
  const suffix = projectId ? `-${projectId.slice(0, 8)}` : ""
  return `${CLAUDIA_PROJECTS_BASE}/${slug}${suffix}`
}

/**
 * Clone a git repository
 */
async function cloneRepository(
  repoUrl: string,
  targetDir: string
): Promise<{ success: boolean; error?: string; path?: string }> {
  const repoPath = path.join(targetDir, "repo")

  try {
    // Create repo directory if it doesn't exist
    if (!existsSync(repoPath)) {
      await mkdir(repoPath, { recursive: true })
    }

    // Check if already cloned
    if (existsSync(path.join(repoPath, ".git"))) {
      console.log(`[initialize-folder] Repository already cloned at: ${repoPath}`)
      return { success: true, path: repoPath }
    }

    // Clone the repository
    console.log(`[initialize-folder] Cloning repository: ${repoUrl}`)
    const { stderr } = await execAsync(`git clone "${repoUrl}" "${repoPath}"`, {
      timeout: 120000 // 2 minute timeout
    })

    // Git outputs progress to stderr, check for actual errors
    if (stderr && stderr.includes("fatal:")) {
      return { success: false, error: stderr }
    }

    return { success: true, path: repoPath }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clone failed"
    return { success: false, error: message }
  }
}

/**
 * Convert StoredBuildPlan to BuildPlan format expected by generators
 * StoredBuildPlan wraps the plan in originalPlan, generators expect flat structure
 */
function convertToBuildPlanFormat(stored: StoredBuildPlan): {
  id: string
  projectId: string
  version: number
  createdAt: string
  updatedAt: string
  source: string
  status: string
  constraints: Record<string, unknown>
  generatedBy: { server: string; model: string }
  spec: StoredBuildPlan["originalPlan"]["spec"]
  phases: StoredBuildPlan["originalPlan"]["phases"]
  packets: StoredBuildPlan["originalPlan"]["packets"]
  modelAssignments: Record<string, unknown>
  totalEstimatedTokens: number
  totalEstimatedCost: number
} {
  return {
    id: stored.id,
    projectId: stored.projectId,
    version: stored.revisionNumber || 1,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    source: stored.generatedBy?.server || "unknown",
    status: stored.status || "draft",
    constraints: {},
    generatedBy: stored.generatedBy || { server: "unknown", model: "unknown" },
    spec: stored.originalPlan.spec,
    phases: stored.originalPlan.phases,
    packets: stored.originalPlan.packets,
    modelAssignments: {},
    totalEstimatedTokens: 0,
    totalEstimatedCost: 0
  }
}

/**
 * POST - Initialize project folder structure
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as InitializeRequest

    // Validate required fields
    if (!body.projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      )
    }

    // Build project object from request data
    const project: Project = body.project || {
      id: body.projectId,
      name: body.projectName || "Unknown Project",
      description: body.projectDescription || "",
      status: "planning",
      priority: "medium",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      repos: body.linkedRepo ? [{
        provider: "gitlab",
        id: 0,
        name: body.linkedRepo.name,
        path: body.linkedRepo.name,
        url: body.linkedRepo.url,
        localPath: body.linkedRepo.localPath
      }] : [],
      packetIds: [],
      tags: []
    }

    const buildPlan: StoredBuildPlan | null = body.buildPlan || null

    // Convert StoredBuildPlan to BuildPlan format for generators
    const buildPlanForGenerators = buildPlan ? convertToBuildPlanFormat(buildPlan) : null

    // Get packets from request, buildPlan, or empty array
    const packets: WorkPacket[] = body.packets || buildPlan?.originalPlan?.packets?.map(p => ({
      ...p,
      status: "queued",
      suggestedTaskType: "coding",
      blockedBy: [],
      blocks: []
    })) || []

    // Determine target directory
    let workingDirectory: string
    if (body.targetPath) {
      workingDirectory = body.targetPath
    } else if (project.workingDirectory) {
      workingDirectory = project.workingDirectory
    } else if (body.linkedRepo?.localPath) {
      workingDirectory = body.linkedRepo.localPath
    } else {
      workingDirectory = generateWorkingDirectoryPath(project.name, project.id)
    }

    console.log(`[initialize-folder] Project: ${project.name} (${body.projectId})`)
    console.log(`[initialize-folder] Working directory: ${workingDirectory}`)

    // Check if directory already exists
    let alreadyExists = false
    if (existsSync(workingDirectory)) {
      try {
        const contents = await readdir(workingDirectory)
        alreadyExists = contents.length > 0
      } catch {
        // Directory not readable
      }
    }

    // If dry run, return preview
    if (body.dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        workingDirectory,
        alreadyExists,
        preview: {
          directories: [
            ".claudia",
            ".claudia/status",
            ".claudia/requests",
            "docs",
            "docs/packets"
          ],
          files: [
            ".claudia/config.json",
            "docs/PRD.md",
            "docs/BUILD_PLAN.md",
            "KICKOFF.md",
            ...packets.map((p, i) => `docs/packets/${getPacketFilename(p as Parameters<typeof getPacketFilename>[0], i + 1)}`)
          ],
          packetsCount: packets.length
        }
      })
    }

    const createdFiles: FileCreated[] = []
    const errors: string[] = []

    // Ensure base directory exists
    if (!existsSync(CLAUDIA_PROJECTS_BASE)) {
      await mkdir(CLAUDIA_PROJECTS_BASE, { recursive: true })
      console.log(`[initialize-folder] Created base directory: ${CLAUDIA_PROJECTS_BASE}`)
    }

    // Create the main working directory
    if (!existsSync(workingDirectory)) {
      await mkdir(workingDirectory, { recursive: true })
      console.log(`[initialize-folder] Created working directory: ${workingDirectory}`)
    }

    // Create folder structure
    const directories = [
      path.join(workingDirectory, ".claudia"),
      path.join(workingDirectory, ".claudia", "status"),
      path.join(workingDirectory, ".claudia", "requests"),
      path.join(workingDirectory, "docs"),
      path.join(workingDirectory, "docs", "packets")
    ]

    for (const dir of directories) {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
        console.log(`[initialize-folder] Created directory: ${dir}`)
      }
    }

    // Generate and write .claudia/config.json
    // Use 'as unknown as' casting since StoredBuildPlan structure differs from BuildPlan
    // but generators only use common fields (spec, phases, packets, etc.)
    if (buildPlanForGenerators) {
      try {
        const configPath = path.join(workingDirectory, ".claudia", "config.json")
        const configContent = generateConfigJSON(
          project as unknown as Parameters<typeof generateConfigJSON>[0],
          buildPlanForGenerators as unknown as Parameters<typeof generateConfigJSON>[1]
        )
        await writeFile(configPath, configContent, "utf-8")
        createdFiles.push({ path: configPath, description: "Claudia Coder configuration" })
        console.log(`[initialize-folder] Created: ${configPath}`)
      } catch (error) {
        const msg = `Failed to create config.json: ${error instanceof Error ? error.message : "Unknown error"}`
        errors.push(msg)
        console.error(`[initialize-folder] ${msg}`)
      }
    }

    // Generate and write docs/PRD.md
    if (buildPlanForGenerators) {
      try {
        const prdPath = path.join(workingDirectory, "docs", "PRD.md")
        // generatePRD takes (buildPlan, project) - buildPlan first
        const prdContent = generatePRD(
          buildPlanForGenerators as unknown as Parameters<typeof generatePRD>[0],
          project as unknown as Parameters<typeof generatePRD>[1]
        )
        await writeFile(prdPath, prdContent, "utf-8")
        createdFiles.push({ path: prdPath, description: "Product Requirements Document" })
        console.log(`[initialize-folder] Created: ${prdPath}`)
      } catch (error) {
        const msg = `Failed to create PRD.md: ${error instanceof Error ? error.message : "Unknown error"}`
        errors.push(msg)
        console.error(`[initialize-folder] ${msg}`)
      }
    }

    // Generate and write docs/BUILD_PLAN.md
    if (buildPlanForGenerators) {
      try {
        const buildPlanPath = path.join(workingDirectory, "docs", "BUILD_PLAN.md")
        // generateBuildPlanMarkdown takes (buildPlan, project) - 2 args only
        const buildPlanContent = generateBuildPlanMarkdown(
          buildPlanForGenerators as unknown as Parameters<typeof generateBuildPlanMarkdown>[0],
          project as unknown as Parameters<typeof generateBuildPlanMarkdown>[1]
        )
        await writeFile(buildPlanPath, buildPlanContent, "utf-8")
        createdFiles.push({ path: buildPlanPath, description: "Development build plan" })
        console.log(`[initialize-folder] Created: ${buildPlanPath}`)
      } catch (error) {
        const msg = `Failed to create BUILD_PLAN.md: ${error instanceof Error ? error.message : "Unknown error"}`
        errors.push(msg)
        console.error(`[initialize-folder] ${msg}`)
      }
    }

    // Generate and write KICKOFF.md
    if (buildPlanForGenerators) {
      try {
        const kickoffPath = path.join(workingDirectory, "KICKOFF.md")
        // generateKickoffMarkdown takes (project, buildPlan, currentPacket?) - optional 3rd arg
        const kickoffContent = generateKickoffMarkdown(
          project as unknown as Parameters<typeof generateKickoffMarkdown>[0],
          buildPlanForGenerators as unknown as Parameters<typeof generateKickoffMarkdown>[1]
        )
        await writeFile(kickoffPath, kickoffContent, "utf-8")
        createdFiles.push({ path: kickoffPath, description: "Project kickoff summary" })
        console.log(`[initialize-folder] Created: ${kickoffPath}`)
      } catch (error) {
        const msg = `Failed to create KICKOFF.md: ${error instanceof Error ? error.message : "Unknown error"}`
        errors.push(msg)
        console.error(`[initialize-folder] ${msg}`)
      }
    }

    // Generate and write packet files
    if (buildPlanForGenerators) {
      for (let i = 0; i < packets.length; i++) {
        const packet = packets[i]
        try {
          const filename = getPacketFilename(packet as unknown as Parameters<typeof getPacketFilename>[0], i + 1)
          const packetPath = path.join(workingDirectory, "docs", "packets", filename)
          // generatePacketMarkdown takes (packet, buildPlan) - 2 args only
          const packetContent = generatePacketMarkdown(
            packet as unknown as Parameters<typeof generatePacketMarkdown>[0],
            buildPlanForGenerators as unknown as Parameters<typeof generatePacketMarkdown>[1]
          )
          await writeFile(packetPath, packetContent, "utf-8")
          createdFiles.push({ path: packetPath, description: `Work packet: ${packet.title}` })
          console.log(`[initialize-folder] Created: ${packetPath}`)
        } catch (error) {
          const msg = `Failed to create packet ${packet.id}: ${error instanceof Error ? error.message : "Unknown error"}`
          errors.push(msg)
          console.error(`[initialize-folder] ${msg}`)
        }
      }
    }

    // Clone git repository if one is linked
    let cloneResult: { success: boolean; error?: string; path?: string } | null = null
    const repoToClone = project.repos.find(r => r.url && !r.localPath)

    if (repoToClone) {
      console.log(`[initialize-folder] Cloning repository: ${repoToClone.url}`)
      cloneResult = await cloneRepository(repoToClone.url, workingDirectory)

      if (cloneResult.success && cloneResult.path) {
        createdFiles.push({ path: cloneResult.path, description: `Cloned repository: ${repoToClone.name}` })
        console.log(`[initialize-folder] Cloned repository to: ${cloneResult.path}`)
      } else if (cloneResult.error) {
        errors.push(`Git clone failed: ${cloneResult.error}`)
        console.error(`[initialize-folder] Git clone error: ${cloneResult.error}`)
      }
    }

    // Create initialization status file
    try {
      const statusPath = path.join(workingDirectory, ".claudia", "status", "initialized.json")
      const statusContent = JSON.stringify({
        initializedAt: new Date().toISOString(),
        projectId: project.id,
        projectName: project.name,
        filesCreated: createdFiles.length,
        packetsCreated: packets.length,
        repoCloned: cloneResult?.success || false,
        errors: errors.length > 0 ? errors : undefined
      }, null, 2)
      await writeFile(statusPath, statusContent, "utf-8")
      createdFiles.push({ path: statusPath, description: "Initialization status" })
    } catch {
      console.warn("[initialize-folder] Could not create status file")
    }

    const response: InitializeResponse = {
      success: true,
      workingDirectory,
      createdFiles,
      summary: {
        totalFiles: createdFiles.length,
        directories: directories.length,
        packets: packets.length,
        repoCloned: cloneResult?.success || false,
        repoPath: cloneResult?.path
      },
      errors: errors.length > 0 ? errors : undefined,
      alreadyExists
    }

    return NextResponse.json(response)

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize folder structure"
    console.error("[initialize-folder] Error:", error)

    // Check for specific errors
    if (message.includes("EACCES") || message.includes("permission")) {
      return NextResponse.json(
        { error: "Permission denied. Cannot create directory at the specified path." },
        { status: 403 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: message,
        workingDirectory: "",
        createdFiles: [],
        summary: { totalFiles: 0, directories: 0, packets: 0, repoCloned: false }
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Preview initialization (dry run)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get("projectId")
    const projectName = searchParams.get("projectName")
    const targetPath = searchParams.get("targetPath") || undefined

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      )
    }

    const name = projectName || `project-${projectId.slice(0, 8)}`
    const workingDirectory = targetPath || generateWorkingDirectoryPath(name, projectId)

    return NextResponse.json({
      success: true,
      workingDirectory,
      alreadyExists: existsSync(workingDirectory),
      preview: {
        directories: [
          ".claudia",
          ".claudia/status",
          ".claudia/requests",
          "docs",
          "docs/packets"
        ],
        files: [
          ".claudia/config.json",
          "docs/PRD.md",
          "docs/BUILD_PLAN.md",
          "KICKOFF.md"
        ]
      }
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to preview initialization"
    console.error("[initialize-folder] Preview error:", error)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
