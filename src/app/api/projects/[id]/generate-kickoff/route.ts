/**
 * Generate KICKOFF.md API
 *
 * POST /api/projects/[id]/generate-kickoff
 *
 * Generates KICKOFF.md file for a project using the comprehensive generator.
 * This should be called after a build plan is approved to create the kickoff
 * document that Claude Code will use for execution context.
 *
 * Body: {
 *   workingDirectory: string,
 *   project: Project,
 *   buildPlan: StoredBuildPlan,
 *   currentPacketId?: string
 * }
 */

import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import { existsSync } from "fs"
import path from "path"

import {
  generateKickoffMarkdown,
  generatePRD,
  generateBuildPlanMarkdown,
  generatePacketMarkdown,
  generateConfigJSON,
  getPacketFilename
} from "@/lib/project-files/generators"
import type { BuildPlan, WorkPacket } from "@/lib/ai/build-plan"
import type { Project } from "@/lib/data/types"

interface RouteParams {
  params: Promise<{ id: string }>
}

interface StoredBuildPlanInput {
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
      dependencies?: string[]
      estimatedEffort?: {
        optimistic: number
        realistic: number
        pessimistic: number
        confidence: "low" | "medium" | "high"
      }
      successCriteria?: string[]
    }>
    packets: Array<{
      id: string
      phaseId: string
      title: string
      description: string
      type: string
      priority: string
      status?: string
      tasks: Array<{ id: string; description: string; completed: boolean; order: number }>
      acceptanceCriteria: string[]
      suggestedTaskType?: string
      blockedBy?: string[]
      blocks?: string[]
      estimatedTokens?: number
      estimatedCost?: number
    }>
  }
  generatedBy: {
    server: string
    model: string
  }
  approvedAt?: string
}

interface GenerateKickoffRequest {
  workingDirectory: string
  project: Project
  buildPlan: StoredBuildPlanInput
  currentPacketId?: string
  generateAllDocs?: boolean // Also generate PRD, BUILD_PLAN, and packet files
}

/**
 * Convert StoredBuildPlan to BuildPlan format expected by generators
 */
function convertToBuildPlanFormat(stored: StoredBuildPlanInput): BuildPlan {
  return {
    id: stored.id,
    projectId: stored.projectId,
    version: stored.revisionNumber || 1,
    createdAt: stored.createdAt,
    status: stored.status === "approved" ? "approved" : "draft",
    constraints: {
      requireLocalFirst: true,
      requireHumanApproval: ["planning"],
      maxParallelPackets: 3
    },
    generatedBy: `${stored.generatedBy?.server || "unknown"}:${stored.generatedBy?.model || "unknown"}`,
    spec: {
      ...stored.originalPlan.spec,
      objectives: stored.originalPlan.spec.objectives || [],
      nonGoals: stored.originalPlan.spec.nonGoals || [],
      assumptions: stored.originalPlan.spec.assumptions || [],
      risks: stored.originalPlan.spec.risks || [],
      techStack: stored.originalPlan.spec.techStack || []
    },
    phases: (stored.originalPlan.phases || []).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      order: p.order,
      packetIds: [],
      dependencies: p.dependencies || [],
      estimatedEffort: p.estimatedEffort || {
        optimistic: 8,
        realistic: 16,
        pessimistic: 32,
        confidence: "medium" as const
      },
      successCriteria: p.successCriteria || []
    })),
    packets: (stored.originalPlan.packets || []).map(p => ({
      id: p.id,
      phaseId: p.phaseId,
      title: p.title,
      description: p.description,
      type: p.type as WorkPacket["type"],
      priority: p.priority as WorkPacket["priority"],
      status: (p.status || "queued") as WorkPacket["status"],
      tasks: p.tasks || [],
      acceptanceCriteria: p.acceptanceCriteria || [],
      suggestedTaskType: p.suggestedTaskType || "coding",
      blockedBy: p.blockedBy || [],
      blocks: p.blocks || [],
      estimatedTokens: p.estimatedTokens || 1000,
      estimatedCost: p.estimatedCost || 0
    })),
    modelAssignments: []
  }
}

/**
 * POST /api/projects/[id]/generate-kickoff
 * Generate KICKOFF.md and optionally all project documentation
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId } = await params
    const body: GenerateKickoffRequest = await request.json()

    // Validate required fields
    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      )
    }

    if (!body.workingDirectory) {
      return NextResponse.json(
        { error: "workingDirectory is required" },
        { status: 400 }
      )
    }

    if (!body.project) {
      return NextResponse.json(
        { error: "project data is required" },
        { status: 400 }
      )
    }

    if (!body.buildPlan) {
      return NextResponse.json(
        { error: "buildPlan data is required" },
        { status: 400 }
      )
    }

    const { workingDirectory, project, buildPlan: storedBuildPlan, currentPacketId, generateAllDocs } = body

    // Convert to format expected by generators
    const buildPlan = convertToBuildPlanFormat(storedBuildPlan)
    const packets = buildPlan.packets || []

    // Find current packet if specified
    const currentPacket = currentPacketId
      ? packets.find(p => p.id === currentPacketId)
      : undefined

    // Ensure working directory exists
    if (!existsSync(workingDirectory)) {
      await fs.mkdir(workingDirectory, { recursive: true })
      console.log(`[generate-kickoff] Created working directory: ${workingDirectory}`)
    }

    const createdFiles: { path: string; description: string }[] = []
    const errors: string[] = []

    // Generate KICKOFF.md (only if it doesn't exist)
    try {
      const kickoffPath = path.join(workingDirectory, "KICKOFF.md")

      // Check if KICKOFF.md already exists
      if (existsSync(kickoffPath)) {
        console.log(`[generate-kickoff] KICKOFF.md already exists at: ${kickoffPath} - skipping to avoid overwriting`)
        createdFiles.push({ path: kickoffPath, description: "Project kickoff summary (existing, not modified)" })
      } else {
        const kickoffContent = generateKickoffMarkdown(
          project as Parameters<typeof generateKickoffMarkdown>[0],
          buildPlan as Parameters<typeof generateKickoffMarkdown>[1],
          currentPacket as Parameters<typeof generateKickoffMarkdown>[2]
        )
        await fs.writeFile(kickoffPath, kickoffContent, "utf-8")
        createdFiles.push({ path: kickoffPath, description: "Project kickoff summary for Claude Code" })
        console.log(`[generate-kickoff] Generated KICKOFF.md at: ${kickoffPath}`)
      }
    } catch (error) {
      const msg = `Failed to generate KICKOFF.md: ${error instanceof Error ? error.message : "Unknown error"}`
      errors.push(msg)
      console.error(`[generate-kickoff] ${msg}`)
    }

    // If generateAllDocs is true, also generate PRD, BUILD_PLAN, packet files, and config
    if (generateAllDocs) {
      // Create directory structure
      const directories = [
        path.join(workingDirectory, ".claudia"),
        path.join(workingDirectory, ".claudia", "status"),
        path.join(workingDirectory, ".claudia", "requests"),
        path.join(workingDirectory, "docs"),
        path.join(workingDirectory, "docs", "packets")
      ]

      for (const dir of directories) {
        if (!existsSync(dir)) {
          await fs.mkdir(dir, { recursive: true })
        }
      }

      // Generate .claudia/config.json
      try {
        const configPath = path.join(workingDirectory, ".claudia", "config.json")
        const configContent = generateConfigJSON(
          project as Parameters<typeof generateConfigJSON>[0],
          buildPlan as Parameters<typeof generateConfigJSON>[1]
        )
        await fs.writeFile(configPath, configContent, "utf-8")
        createdFiles.push({ path: configPath, description: "Claudia configuration" })
      } catch (error) {
        errors.push(`Failed to generate config.json: ${error instanceof Error ? error.message : "Unknown error"}`)
      }

      // Generate docs/PRD.md
      try {
        const prdPath = path.join(workingDirectory, "docs", "PRD.md")
        const prdContent = generatePRD(
          buildPlan as Parameters<typeof generatePRD>[0],
          project as Parameters<typeof generatePRD>[1]
        )
        await fs.writeFile(prdPath, prdContent, "utf-8")
        createdFiles.push({ path: prdPath, description: "Product Requirements Document" })
      } catch (error) {
        errors.push(`Failed to generate PRD.md: ${error instanceof Error ? error.message : "Unknown error"}`)
      }

      // Generate docs/BUILD_PLAN.md
      try {
        const buildPlanPath = path.join(workingDirectory, "docs", "BUILD_PLAN.md")
        const buildPlanContent = generateBuildPlanMarkdown(
          buildPlan as Parameters<typeof generateBuildPlanMarkdown>[0],
          project as Parameters<typeof generateBuildPlanMarkdown>[1]
        )
        await fs.writeFile(buildPlanPath, buildPlanContent, "utf-8")
        createdFiles.push({ path: buildPlanPath, description: "Development build plan" })
      } catch (error) {
        errors.push(`Failed to generate BUILD_PLAN.md: ${error instanceof Error ? error.message : "Unknown error"}`)
      }

      // Generate individual packet files
      for (let i = 0; i < packets.length; i++) {
        const packet = packets[i]
        try {
          const filename = getPacketFilename(packet as Parameters<typeof getPacketFilename>[0], i + 1)
          const packetPath = path.join(workingDirectory, "docs", "packets", filename)
          const packetContent = generatePacketMarkdown(
            packet as Parameters<typeof generatePacketMarkdown>[0],
            buildPlan as Parameters<typeof generatePacketMarkdown>[1]
          )
          await fs.writeFile(packetPath, packetContent, "utf-8")
          createdFiles.push({ path: packetPath, description: `Work packet: ${packet.title}` })
        } catch (error) {
          errors.push(`Failed to generate packet ${packet.id}: ${error instanceof Error ? error.message : "Unknown error"}`)
        }
      }
    }

    // Return result
    return NextResponse.json({
      success: errors.length === 0,
      projectId,
      workingDirectory,
      kickoffPath: path.join(workingDirectory, "KICKOFF.md"),
      createdFiles,
      filesCreated: createdFiles.length,
      packetsIncluded: packets.length,
      phasesIncluded: buildPlan.phases?.length || 0,
      currentPacketId: currentPacket?.id,
      errors: errors.length > 0 ? errors : undefined,
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate KICKOFF.md"
    console.error("[generate-kickoff] Error:", error)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
