/**
 * Server-Side Project Storage
 *
 * This module provides server-side file operations for project storage.
 * The file ~/.claudia-data/projects.json is the SOURCE OF TRUTH for all projects.
 *
 * IMPORTANT: This module should ONLY be imported in server-side code (API routes).
 * Do not import this in client-side components or pages.
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { Project } from "./types"

// Server-side storage location
const DATA_DIR = process.env.CLAUDIA_DATA_DIR || path.join(os.homedir(), ".claudia-data")
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json")

// UUID generator for server-side use
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  // Fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Ensure the data directory exists
 */
export async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
  } catch {
    // Directory might already exist
  }
}

/**
 * Read projects from the server-side JSON file
 * Returns empty array if file doesn't exist
 */
export async function readProjectsFile(): Promise<Project[]> {
  try {
    await ensureDataDir()
    const content = await fs.readFile(PROJECTS_FILE, "utf-8")
    return JSON.parse(content) as Project[]
  } catch (error) {
    // File doesn't exist yet - return empty array
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return []
    }
    console.error("[server-projects] Error reading projects file:", error)
    throw error
  }
}

/**
 * Write projects to the server-side JSON file
 * Uses atomic write (temp file + rename) to prevent corruption
 */
export async function writeProjectsFile(projects: Project[]): Promise<void> {
  await ensureDataDir()
  const tempPath = `${PROJECTS_FILE}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(projects, null, 2), "utf-8")
  await fs.rename(tempPath, PROJECTS_FILE)
}

/**
 * Get all projects for a specific user
 * Filters by userId and includes public/collaborative projects
 */
export async function getProjectsForUser(userId: string): Promise<Project[]> {
  const allProjects = await readProjectsFile()

  return allProjects.filter(project =>
    project.userId === userId ||
    project.isPublic === true ||
    project.collaboratorIds?.includes(userId) ||
    !project.userId // Legacy projects without userId
  )
}

/**
 * Get a single project by ID
 * Optionally filter by userId for access control
 */
export async function getProjectById(
  projectId: string,
  userId?: string
): Promise<Project | null> {
  const allProjects = await readProjectsFile()
  const project = allProjects.find(p => p.id === projectId)

  if (!project) return null

  // If userId provided, check access
  if (userId) {
    const hasAccess =
      project.userId === userId ||
      project.isPublic === true ||
      project.collaboratorIds?.includes(userId) ||
      !project.userId // Legacy projects

    if (!hasAccess) {
      console.warn(`[server-projects] User ${userId} attempted to access project ${projectId} without permission`)
      return null
    }
  }

  return project
}

/**
 * Create a new project
 * Uses provided ID if available (for client-server sync), otherwise generates new
 * Generates timestamps, saves to file
 */
export async function createProject(
  data: Omit<Project, "id" | "createdAt" | "updatedAt"> & { id?: string },
  userId?: string
): Promise<Project> {
  const now = new Date().toISOString()
  // Use provided ID if available (from client), otherwise generate new
  const id = data.id || generateUUID()

  // Remove id from data spread to avoid duplication
  const { id: _providedId, ...dataWithoutId } = data as typeof data & { id?: string }

  const project: Project = {
    ...dataWithoutId,
    id,
    userId: dataWithoutId.userId || userId,
    createdAt: now,
    updatedAt: now
  }

  const projects = await readProjectsFile()
  projects.push(project)
  await writeProjectsFile(projects)

  console.log(`[server-projects] Created project ${id}: ${project.name}`)
  return project
}

/**
 * Update an existing project
 * Returns updated project or null if not found
 */
export async function updateProject(
  projectId: string,
  updates: Partial<Project>,
  userId?: string
): Promise<Project | null> {
  const projects = await readProjectsFile()
  const index = projects.findIndex(p => p.id === projectId)

  if (index === -1) return null

  // Check access if userId provided
  if (userId) {
    const project = projects[index]
    const hasAccess =
      project.userId === userId ||
      project.isPublic === true ||
      project.collaboratorIds?.includes(userId) ||
      !project.userId

    if (!hasAccess) {
      console.warn(`[server-projects] User ${userId} attempted to update project ${projectId} without permission`)
      return null
    }
  }

  // Apply updates
  projects[index] = {
    ...projects[index],
    ...updates,
    id: projectId, // Don't allow ID change
    updatedAt: new Date().toISOString()
  }

  await writeProjectsFile(projects)
  console.log(`[server-projects] Updated project ${projectId}`)
  return projects[index]
}

/**
 * Delete a project by ID
 * Returns true if deleted, false if not found
 */
export async function deleteProject(
  projectId: string,
  userId?: string
): Promise<boolean> {
  const projects = await readProjectsFile()
  const project = projects.find(p => p.id === projectId)

  if (!project) return false

  // Check access if userId provided
  if (userId) {
    const hasAccess =
      project.userId === userId ||
      !project.userId // Legacy projects

    if (!hasAccess) {
      console.warn(`[server-projects] User ${userId} attempted to delete project ${projectId} without permission`)
      return false
    }
  }

  const filtered = projects.filter(p => p.id !== projectId)

  if (filtered.length === projects.length) return false

  await writeProjectsFile(filtered)
  console.log(`[server-projects] Deleted project ${projectId}`)
  return true
}

/**
 * Get the data directory path (for debugging/info)
 */
export function getDataDir(): string {
  return DATA_DIR
}

/**
 * Get the projects file path (for debugging/info)
 */
export function getProjectsFilePath(): string {
  return PROJECTS_FILE
}
