/**
 * Projects API - Main Route
 *
 * GET /api/projects - Get all projects for the current user
 * POST /api/projects - Create a new project
 *
 * The server-side file (~/.claudia-data/projects.json) is the SOURCE OF TRUTH.
 * Clients should sync their localStorage cache from this API.
 */

import { NextRequest, NextResponse } from "next/server"
import {
  getProjectsForUser,
  createProject as serverCreateProject,
  readProjectsFile,
  getDataDir
} from "@/lib/data/server-projects"
import { Project } from "@/lib/data/types"

// Base directory for project working directories
import * as os from "os"
import * as path from "path"

function getClaudiaProjectsBase(): string {
  return process.env.CLAUDIA_PROJECTS_BASE || path.join(os.homedir(), "claudia-projects")
}

/**
 * Generate a slug from a project name for use in directory paths
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "project"
}

/**
 * Generate the working directory path for a project
 */
function generateWorkingDirectoryPath(projectName: string, projectId?: string): string {
  const base = getClaudiaProjectsBase()
  const slug = generateSlug(projectName)
  const suffix = projectId ? `-${projectId.slice(0, 8)}` : ""
  return `${base}/${slug}${suffix}`
}

/**
 * GET /api/projects
 *
 * Query params:
 * - userId: Filter by user ID (required for user-scoped data)
 * - includeTrashed: Include trashed projects (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get("userId")
    const includeTrashed = url.searchParams.get("includeTrashed") === "true"

    let projects: Project[]

    if (userId) {
      projects = await getProjectsForUser(userId)
    } else {
      // Return all projects if no userId (admin use case)
      projects = await readProjectsFile()
    }

    // Filter out trashed projects unless explicitly requested
    if (!includeTrashed) {
      projects = projects.filter(p => p.status !== "trashed")
    }

    return NextResponse.json({
      success: true,
      projects,
      count: projects.length,
      dataDir: getDataDir()
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch projects"
    console.error("[api/projects] GET error:", error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/projects
 *
 * Create a new project.
 * Body should contain project data (without id, createdAt, updatedAt).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Extract userId and id from body or use as separate param
    const { userId, id: clientId, ...projectData } = body as {
      userId?: string
      id?: string  // Client may provide ID for sync
      name: string
      description?: string
      status?: string
      priority?: string
      repos?: unknown[]
      packetIds?: string[]
      tags?: string[]
      workingDirectory?: string
      basePath?: string
      [key: string]: unknown
    }

    // Validate required fields
    if (!projectData.name) {
      return NextResponse.json(
        { success: false, error: "Project name is required" },
        { status: 400 }
      )
    }

    // Use client-provided ID if available, otherwise generate temp ID for working directory path
    const effectiveId = clientId || crypto.randomUUID()

    // Set defaults - include id if provided by client for server to use
    const projectToCreate: Omit<Project, "id" | "createdAt" | "updatedAt"> & { id?: string } = {
      id: clientId,  // Pass client ID if provided, server will use it
      name: projectData.name,
      description: projectData.description || "",
      status: (projectData.status as Project["status"]) || "planning",
      priority: (projectData.priority as Project["priority"]) || "medium",
      repos: (projectData.repos as Project["repos"]) || [],
      packetIds: projectData.packetIds || [],
      tags: projectData.tags || [],
      userId: userId,
      workingDirectory: projectData.workingDirectory || generateWorkingDirectoryPath(projectData.name, effectiveId),
      basePath: projectData.basePath,
    }

    // Copy any additional optional fields if they exist
    if (projectData.linearSync) {
      projectToCreate.linearSync = projectData.linearSync as Project["linearSync"]
    }
    if (projectData.creationInterview) {
      projectToCreate.creationInterview = projectData.creationInterview as Project["creationInterview"]
    }
    if (projectData.interviewIds) {
      projectToCreate.interviewIds = projectData.interviewIds as string[]
    }
    if (projectData.mcpSettings) {
      projectToCreate.mcpSettings = projectData.mcpSettings as Project["mcpSettings"]
    }
    if (projectData.category) {
      projectToCreate.category = projectData.category as Project["category"]
    }
    if (projectData.starred !== undefined) {
      projectToCreate.starred = projectData.starred as boolean
    }
    if (projectData.businessDev) {
      projectToCreate.businessDev = projectData.businessDev as Project["businessDev"]
    }
    if (projectData.defaultModelId) {
      projectToCreate.defaultModelId = projectData.defaultModelId as string
    }
    if (projectData.defaultProviderId) {
      projectToCreate.defaultProviderId = projectData.defaultProviderId as string
    }
    if (projectData.sourceType) {
      projectToCreate.sourceType = projectData.sourceType as Project["sourceType"]
    }
    if (projectData.sourceRepo) {
      projectToCreate.sourceRepo = projectData.sourceRepo as Project["sourceRepo"]
    }
    if (projectData.codebaseAnalysisId) {
      projectToCreate.codebaseAnalysisId = projectData.codebaseAnalysisId as string
    }
    if (projectData.hasCodebaseContext !== undefined) {
      projectToCreate.hasCodebaseContext = projectData.hasCodebaseContext as boolean
    }

    // Create the project on server (will use clientId if provided)
    const project = await serverCreateProject(projectToCreate, userId)

    // Update working directory with actual ID if it was generated with a temp ID (no client ID provided)
    // This only happens when client didn't provide an ID and we used a random temp ID
    if (!clientId && project.workingDirectory?.includes(effectiveId.slice(0, 8))) {
      const { updateProject } = await import("@/lib/data/server-projects")
      const correctWorkingDir = generateWorkingDirectoryPath(project.name, project.id)
      await updateProject(project.id, { workingDirectory: correctWorkingDir })
      project.workingDirectory = correctWorkingDir
    }

    console.log(`[api/projects] Created project: ${project.id} - ${project.name}`)

    return NextResponse.json({
      success: true,
      project
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create project"
    console.error("[api/projects] POST error:", error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
