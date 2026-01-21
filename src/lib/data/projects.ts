/**
 * Projects Data Store
 * Claudia-native project storage with optional Linear sync
 *
 * IMPORTANT: All project data is user-scoped. Projects belong to specific users
 * and are stored in user-specific localStorage keys.
 */

import {
  Project,
  ProjectStatus,
  ProjectFilter,
  ProjectStats,
  LinearSyncConfig,
  InterviewSession,
  LinkedRepo
} from "./types"
import {
  getUserStorageItem,
  setUserStorageItem,
  USER_STORAGE_KEYS,
  canUserAccessItem,
  filterUserAccessibleItems,
  dispatchStorageChange
} from "./user-storage"

// UUID generator that works in all contexts (HTTP, HTTPS, localhost)
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

import os from "os"
import path from "path"

// Legacy storage keys (kept for migration purposes)
const LEGACY_STORAGE_KEY = "claudia_projects"
const LEGACY_INTERVIEWS_KEY = "claudia_interviews"

// Base directory for all Claudia project working directories
// In browser context, os.homedir() returns "/" which is not useful
// Use environment variable or a server-appropriate default
function getClaudiaProjectsBase(): string {
  // Server-side: prefer env var, then os.homedir()
  if (typeof window === "undefined") {
    return process.env.CLAUDIA_PROJECTS_BASE || path.join(os.homedir(), "claudia-projects")
  }
  // Client-side: can't determine home directory, use placeholder that server will expand
  return "~/claudia-projects"
}

const CLAUDIA_PROJECTS_BASE = getClaudiaProjectsBase()

// ============ Working Directory Helpers ============

/**
 * Generate a slug from a project name for use in directory paths
 * e.g., "My Cool Project" -> "my-cool-project"
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-")         // Replace spaces with hyphens
    .replace(/-+/g, "-")          // Replace multiple hyphens with single
    .replace(/^-|-$/g, "")        // Remove leading/trailing hyphens
    || "project"                   // Fallback if empty
}

/**
 * Generate the working directory path for a project
 * Format: ~/claudia-projects/{project-slug}/
 */
export function generateWorkingDirectoryPath(projectName: string, projectId?: string): string {
  const slug = generateSlug(projectName)
  // Add a short ID suffix to avoid collisions
  const suffix = projectId ? `-${projectId.slice(0, 8)}` : ""
  return `${CLAUDIA_PROJECTS_BASE}/${slug}${suffix}`
}

/**
 * Get the effective working directory for a project
 * Priority:
 * 1. Project's basePath field (if set) - the primary codebase location where actual code files live
 * 2. Project's workingDirectory field (if set)
 * 3. First repo with localPath
 * 4. Generate a new working directory path
 *
 * NOTE: basePath takes priority because it represents where the actual code is located.
 * workingDirectory might be an auto-generated empty directory that doesn't contain code yet.
 * This is important for operations like "Launch & Test" that need to find package.json, etc.
 */
export function getEffectiveWorkingDirectory(project: Project): string {
  // First check basePath - the primary codebase location
  // This is where the actual code files (package.json, etc.) are most likely to be
  if (project.basePath) {
    return project.basePath
  }

  // Then check project's own working directory
  if (project.workingDirectory) {
    return project.workingDirectory
  }

  // Then check for repo with local path
  const repoWithPath = project.repos.find(r => r.localPath)
  if (repoWithPath?.localPath) {
    return repoWithPath.localPath
  }

  // Generate a path (won't be persisted until ensureWorkingDirectory is called)
  return generateWorkingDirectoryPath(project.name, project.id)
}

/**
 * Ensure working directory exists for a project
 * This calls the server API to create the actual directory on disk
 * Returns the working directory path
 */
export async function ensureProjectWorkingDirectory(projectId: string, userId?: string): Promise<string | null> {
  const project = getProject(projectId, userId)
  if (!project) return null

  const workingDir = getEffectiveWorkingDirectory(project)

  // If project doesn't have a working directory set, update it
  if (!project.workingDirectory) {
    updateProject(projectId, { workingDirectory: workingDir }, userId)
  }

  // Call the API to create the actual directory on disk
  try {
    const response = await fetch("/api/projects/ensure-working-directory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        projectName: project.name,
        projectDescription: project.description,
        existingWorkingDirectory: workingDir
      })
    })

    if (!response.ok) {
      console.warn(`[projects] Failed to create working directory for project ${projectId}:`, await response.text())
    } else {
      console.log(`[projects] Created working directory for project ${projectId}: ${workingDir}`)
    }
  } catch (error) {
    console.warn(`[projects] Failed to call ensure-working-directory API:`, error)
  }

  return workingDir
}

/**
 * Create project folder on disk immediately after project creation
 * This is called automatically by createProject to ensure all projects have a folder
 */
async function createProjectFolderOnDisk(project: Project): Promise<void> {
  if (typeof window === "undefined") {
    // Server-side: skip API call
    return
  }

  try {
    const response = await fetch("/api/projects/ensure-working-directory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        projectName: project.name,
        projectDescription: project.description,
        existingWorkingDirectory: project.workingDirectory
      })
    })

    if (!response.ok) {
      console.warn(`[projects] Auto-create folder failed for ${project.name}:`, await response.text())
    } else {
      const result = await response.json()
      console.log(`[projects] Auto-created project folder: ${result.workingDirectory}`)
    }
  } catch (error) {
    // Non-fatal error - project is still created in localStorage
    console.warn(`[projects] Failed to auto-create project folder:`, error)
  }
}

/**
 * Migrate existing projects without working directories
 * Sets the workingDirectory field for all projects that don't have one
 */
export function migrateProjectWorkingDirectories(): number {
  const projects = getStoredProjects()
  let migratedCount = 0

  for (const project of projects) {
    if (!project.workingDirectory) {
      const workingDir = generateWorkingDirectoryPath(project.name, project.id)
      updateProject(project.id, { workingDirectory: workingDir })
      migratedCount++
    }
  }

  return migratedCount
}

/**
 * Get the working directory for a project by ID
 * Returns the workingDirectory path or null if project not found
 * This ensures the project has a working directory set before returning
 */
export function getProjectWorkingDirectory(projectId: string): string | null {
  const project = getProject(projectId)
  if (!project) return null

  // getProject already ensures workingDirectory is set
  return project.workingDirectory || null
}

// ============ Storage Helpers ============

/**
 * Get all projects for a specific user from user-scoped storage
 * Falls back to legacy storage for migration purposes
 */
function getStoredProjectsForUser(userId: string): Project[] {
  if (typeof window === "undefined") return []

  // Try user-scoped storage first
  const userProjects = getUserStorageItem<Project[]>(userId, USER_STORAGE_KEYS.PROJECTS)
  if (userProjects) {
    return userProjects
  }

  // Fallback to legacy storage and filter by userId
  const stored = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (stored) {
    const allProjects: Project[] = JSON.parse(stored)
    // Filter to only return projects belonging to this user or public/legacy projects
    return allProjects.filter(p =>
      p.userId === userId ||
      p.isPublic === true ||
      p.collaboratorIds?.includes(userId) ||
      !p.userId // Legacy projects without userId
    )
  }

  return []
}

/**
 * Save projects for a specific user to user-scoped storage
 */
function saveProjectsForUser(userId: string, projects: Project[]): void {
  if (typeof window === "undefined") return

  // Ensure all projects have the userId set
  const projectsWithUser = projects.map(p => ({
    ...p,
    userId: p.userId || userId
  }))

  setUserStorageItem(userId, USER_STORAGE_KEYS.PROJECTS, projectsWithUser)
  dispatchStorageChange(userId, USER_STORAGE_KEYS.PROJECTS, projectsWithUser)
}

/**
 * @deprecated Use getStoredProjectsForUser instead
 * Legacy function for backwards compatibility - returns ALL projects
 */
function getStoredProjects(): Project[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(LEGACY_STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

/**
 * @deprecated Use saveProjectsForUser instead
 * Legacy function for backwards compatibility
 */
function saveProjects(projects: Project[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(projects))
}

/**
 * Get interviews for a specific user
 */
function getStoredInterviewsForUser(userId: string): InterviewSession[] {
  if (typeof window === "undefined") return []

  const userInterviews = getUserStorageItem<InterviewSession[]>(userId, USER_STORAGE_KEYS.INTERVIEWS)
  if (userInterviews) return userInterviews

  // Fallback to legacy storage
  const stored = localStorage.getItem(LEGACY_INTERVIEWS_KEY)
  return stored ? JSON.parse(stored) : []
}

/**
 * Save interviews for a specific user
 */
function saveInterviewsForUser(userId: string, interviews: InterviewSession[]): void {
  if (typeof window === "undefined") return
  setUserStorageItem(userId, USER_STORAGE_KEYS.INTERVIEWS, interviews)
}

/**
 * @deprecated Use getStoredInterviewsForUser instead
 */
function getStoredInterviews(): InterviewSession[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(LEGACY_INTERVIEWS_KEY)
  return stored ? JSON.parse(stored) : []
}

/**
 * @deprecated Use saveInterviewsForUser instead
 */
function saveInterviews(interviews: InterviewSession[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LEGACY_INTERVIEWS_KEY, JSON.stringify(interviews))
}

// ============ Project CRUD ============

/**
 * Get all projects for a user, optionally including trashed projects
 * By default, trashed projects are excluded
 *
 * IMPORTANT: userId is now REQUIRED for user data sandboxing.
 * Projects are stored per-user to prevent data leakage.
 *
 * @param options.userId - Required: The user ID to get projects for
 * @param options.includeTrashed - Include trashed projects
 * @param options.isAdmin - If true, can see all projects (for admin monitoring)
 */
export function getAllProjects(options?: {
  includeTrashed?: boolean
  userId?: string
  isAdmin?: boolean
}): Project[] {
  // If no userId provided, return empty array for safety
  // This prevents accidental data leakage
  if (!options?.userId) {
    console.warn("getAllProjects called without userId - returning empty array for safety")
    return []
  }

  let projects = getStoredProjectsForUser(options.userId)

  // Filter by access permissions
  projects = filterUserAccessibleItems(options.userId, projects, options.isAdmin || false)

  if (options?.includeTrashed) {
    return projects
  }
  return projects.filter(p => p.status !== "trashed")
}

// Alias for getAllProjects
export const getProjects = getAllProjects

/**
 * Get a project by ID
 * @param id - The project ID
 * @param userId - Optional: The user ID requesting the project (for access control)
 * @param isAdmin - Optional: If true, bypasses access control
 */
export function getProject(id: string, userId?: string, isAdmin?: boolean): Project | null {
  // For backwards compatibility, try legacy storage first if no userId
  let projects: Project[]

  if (userId) {
    projects = getStoredProjectsForUser(userId)
  } else {
    // Fallback to legacy storage (will be deprecated)
    projects = getStoredProjects()
  }

  const project = projects.find(p => p.id === id)

  if (!project) return null

  // Check access permissions if userId is provided
  if (userId && !canUserAccessItem(userId, project, isAdmin || false)) {
    console.warn(`User ${userId} attempted to access project ${id} without permission`)
    return null
  }

  // Ensure workingDirectory is set (migrate older projects)
  // Note: We directly update and save here to avoid infinite recursion with updateProject
  if (!project.workingDirectory) {
    const workingDir = generateWorkingDirectoryPath(project.name, project.id)
    project.workingDirectory = workingDir
    project.updatedAt = new Date().toISOString()

    // Save the updated project directly (not via updateProject to avoid recursion)
    const ownerUserId = userId || project.userId
    if (ownerUserId) {
      const allProjects = getStoredProjectsForUser(ownerUserId)
      const index = allProjects.findIndex(p => p.id === id)
      if (index !== -1) {
        allProjects[index] = project
        saveProjectsForUser(ownerUserId, allProjects)
      }
    } else {
      const allProjects = getStoredProjects()
      const index = allProjects.findIndex(p => p.id === id)
      if (index !== -1) {
        allProjects[index] = project
        saveProjects(allProjects)
      }
    }
  }

  return project
}

/**
 * Create a new project
 * @param data - Project data (without id, createdAt, updatedAt)
 * @param userId - Optional: The user ID creating the project (will be set as owner)
 *
 * NOTE: This function automatically triggers folder creation on disk.
 * The project folder is created at ~/claudia-projects/{slug}-{id}/
 * with a .claudia/ subdirectory containing basic configuration.
 */
export function createProject(
  data: Omit<Project, "id" | "createdAt" | "updatedAt">,
  userId?: string
): Project {
  const now = new Date().toISOString()
  const id = generateUUID()

  // Generate working directory if not provided
  const workingDirectory = data.workingDirectory || generateWorkingDirectoryPath(data.name, id)

  // Set basePath: use provided value, or derive from first repo's localPath, or default to workingDirectory
  const basePath = data.basePath || data.repos?.find(r => r.localPath)?.localPath || workingDirectory

  const project: Project = {
    ...data,
    id,
    userId: data.userId || userId, // Set owner
    workingDirectory,
    basePath,
    createdAt: now,
    updatedAt: now
  }

  // Use user-scoped storage if userId is available
  if (userId || project.userId) {
    const ownerUserId = userId || project.userId!
    const projects = getStoredProjectsForUser(ownerUserId)
    projects.push(project)
    saveProjectsForUser(ownerUserId, projects)
  } else {
    // Fallback to legacy storage
    const projects = getStoredProjects()
    projects.push(project)
    saveProjects(projects)
  }

  // Auto-create the project folder on disk (non-blocking)
  // This ensures every project has a unique folder immediately upon creation
  createProjectFolderOnDisk(project).catch(err => {
    console.warn(`[projects] Background folder creation failed for ${project.name}:`, err)
  })

  return project
}

/**
 * Create a new project and wait for folder creation to complete
 * Use this when you need to ensure the folder exists before continuing
 * @param data - Project data (without id, createdAt, updatedAt)
 * @param userId - Optional: The user ID creating the project (will be set as owner)
 */
export async function createProjectWithFolder(
  data: Omit<Project, "id" | "createdAt" | "updatedAt">,
  userId?: string
): Promise<Project> {
  const now = new Date().toISOString()
  const id = generateUUID()

  // Generate working directory if not provided
  const workingDirectory = data.workingDirectory || generateWorkingDirectoryPath(data.name, id)

  // Set basePath: use provided value, or derive from first repo's localPath, or default to workingDirectory
  const basePath = data.basePath || data.repos?.find(r => r.localPath)?.localPath || workingDirectory

  const project: Project = {
    ...data,
    id,
    userId: data.userId || userId,
    workingDirectory,
    basePath,
    createdAt: now,
    updatedAt: now
  }

  // Use user-scoped storage if userId is available
  if (userId || project.userId) {
    const ownerUserId = userId || project.userId!
    const projects = getStoredProjectsForUser(ownerUserId)
    projects.push(project)
    saveProjectsForUser(ownerUserId, projects)
  } else {
    const projects = getStoredProjects()
    projects.push(project)
    saveProjects(projects)
  }

  // Wait for folder creation to complete
  await createProjectFolderOnDisk(project)

  return project
}

/**
 * Update a project
 * @param id - The project ID to update
 * @param updates - Partial project data to update
 * @param userId - Optional: The user ID making the update (for access control)
 */
export function updateProject(
  id: string,
  updates: Partial<Project>,
  userId?: string
): Project | null {
  // Get the project to find its owner
  const existingProject = getProject(id, userId)
  if (!existingProject) return null

  const ownerUserId = userId || existingProject.userId

  let projects: Project[]
  if (ownerUserId) {
    projects = getStoredProjectsForUser(ownerUserId)
  } else {
    projects = getStoredProjects()
  }

  const index = projects.findIndex(p => p.id === id)
  if (index === -1) return null

  projects[index] = {
    ...projects[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  if (ownerUserId) {
    saveProjectsForUser(ownerUserId, projects)
  } else {
    saveProjects(projects)
  }

  return projects[index]
}

/**
 * Delete a project
 * @param id - The project ID to delete
 * @param userId - Optional: The user ID making the deletion (for access control)
 */
export function deleteProject(id: string, userId?: string): boolean {
  const existingProject = getProject(id, userId)
  if (!existingProject) return false

  const ownerUserId = userId || existingProject.userId

  let projects: Project[]
  if (ownerUserId) {
    projects = getStoredProjectsForUser(ownerUserId)
  } else {
    projects = getStoredProjects()
  }

  const filtered = projects.filter(p => p.id !== id)
  if (filtered.length === projects.length) return false

  if (ownerUserId) {
    saveProjectsForUser(ownerUserId, filtered)
  } else {
    saveProjects(filtered)
  }

  return true
}

// ============ Project Trash ============

/**
 * Send a project to trash
 * @param id - The project ID
 * @param userId - The user ID (for access control)
 */
export function trashProject(id: string, userId?: string): Project | null {
  const project = getProject(id, userId)

  if (!project || project.status === "trashed") return null

  return updateProject(id, {
    previousStatus: project.status,
    status: "trashed",
    trashedAt: new Date().toISOString()
  }, userId)
}

/**
 * Restore a project from trash
 * @param id - The project ID
 * @param userId - The user ID (for access control)
 */
export function restoreProject(id: string, userId?: string): Project | null {
  const project = getProject(id, userId)

  if (!project || project.status !== "trashed") return null

  const restoredStatus = project.previousStatus || "active"

  return updateProject(id, {
    status: restoredStatus,
    previousStatus: undefined,
    trashedAt: undefined
  }, userId)
}

/**
 * Get all trashed projects for a user
 * @param userId - Required: The user ID
 */
export function getTrashedProjects(userId: string): Project[] {
  if (!userId) return []
  return getStoredProjectsForUser(userId).filter(p => p.status === "trashed")
}

/**
 * Permanently delete a project from trash
 * @param id - The project ID
 * @param userId - The user ID (for access control)
 */
export function permanentlyDeleteProject(id: string, userId?: string): boolean {
  const project = getProject(id, userId)

  // Only allow permanent deletion of trashed projects
  if (!project || project.status !== "trashed") return false

  return deleteProject(id, userId)
}

/**
 * Empty the trash - permanently delete all trashed projects for a user
 * @param userId - Required: The user ID
 */
export function emptyTrash(userId: string): number {
  if (!userId) return 0

  const projects = getStoredProjectsForUser(userId)
  const trashedCount = projects.filter(p => p.status === "trashed").length
  const remaining = projects.filter(p => p.status !== "trashed")

  saveProjectsForUser(userId, remaining)
  return trashedCount
}

// ============ Project Starring ============

/**
 * Toggle star status on a project
 * @param id - The project ID
 * @param userId - The user ID (for access control)
 */
export function toggleProjectStar(id: string, userId?: string): Project | null {
  const project = getProject(id, userId)
  if (!project) return null

  return updateProject(id, { starred: !project.starred }, userId)
}

/**
 * Get all starred projects for a user
 * @param userId - Required: The user ID
 */
export function getStarredProjects(userId: string): Project[] {
  if (!userId) return []
  const projects = getStoredProjectsForUser(userId)
  return projects.filter(p => p.starred === true)
}

// ============ Project Queries ============

/**
 * Filter projects by criteria
 * @param filter - Filter criteria
 * @param userId - Required: The user ID
 */
export function filterProjects(filter: ProjectFilter, userId: string): Project[] {
  if (!userId) return []

  let projects = getStoredProjectsForUser(userId)

  if (filter.status) {
    projects = projects.filter(p => p.status === filter.status)
  }

  if (filter.priority) {
    projects = projects.filter(p => p.priority === filter.priority)
  }

  if (filter.search) {
    const search = filter.search.toLowerCase()
    projects = projects.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.description.toLowerCase().includes(search) ||
      p.tags.some(t => t.toLowerCase().includes(search))
    )
  }

  if (filter.tags && filter.tags.length > 0) {
    projects = projects.filter(p =>
      filter.tags!.some(tag => p.tags.includes(tag))
    )
  }

  return projects
}

/**
 * Get project statistics for a user
 * @param userId - Required: The user ID
 */
export function getProjectStats(userId: string): ProjectStats {
  if (!userId) {
    return {
      total: 0,
      byStatus: { planning: 0, active: 0, paused: 0, completed: 0, archived: 0, trashed: 0 },
      activeRepos: 0,
      activePackets: 0
    }
  }

  const projects = getStoredProjectsForUser(userId)

  const byStatus: Record<ProjectStatus, number> = {
    planning: 0,
    active: 0,
    paused: 0,
    completed: 0,
    archived: 0,
    trashed: 0
  }

  let activeRepos = 0
  let activePackets = 0

  for (const project of projects) {
    byStatus[project.status]++
    if (project.status === "active") {
      activeRepos += project.repos.length
      activePackets += project.packetIds.length
    }
  }

  // Total excludes trashed projects for the main count
  const totalActive = projects.filter(p => p.status !== "trashed").length

  return {
    total: totalActive,
    byStatus,
    activeRepos,
    activePackets
  }
}

// ============ Repo Linking ============

/**
 * Link a repo to a project
 * @param projectId - The project ID
 * @param repo - The repo to link
 * @param userId - The user ID (for access control)
 */
export function linkRepoToProject(
  projectId: string,
  repo: LinkedRepo,
  userId?: string
): Project | null {
  const project = getProject(projectId, userId)
  if (!project) return null

  // Check if already linked
  if (project.repos.some(r => r.provider === repo.provider && r.id === repo.id)) {
    return project
  }

  return updateProject(projectId, {
    repos: [...project.repos, repo]
  }, userId)
}

/**
 * Unlink a repo from a project
 * @param projectId - The project ID
 * @param provider - The repo provider
 * @param repoId - The repo ID
 * @param userId - The user ID (for access control)
 */
export function unlinkRepoFromProject(
  projectId: string,
  provider: LinkedRepo["provider"],
  repoId: number,
  userId?: string
): Project | null {
  const project = getProject(projectId, userId)
  if (!project) return null

  return updateProject(projectId, {
    repos: project.repos.filter(r => !(r.provider === provider && r.id === repoId))
  }, userId)
}

/**
 * Update the local path for a repo
 * @param projectId - The project ID
 * @param repoId - The repo ID
 * @param localPath - The new local path
 * @param userId - The user ID (for access control)
 */
export function updateRepoLocalPath(
  projectId: string,
  repoId: number,
  localPath: string,
  userId?: string
): Project | null {
  const project = getProject(projectId, userId)
  if (!project) return null

  const updatedRepos = project.repos.map(r => {
    if (r.id === repoId) {
      return { ...r, localPath: localPath || undefined }
    }
    return r
  })

  return updateProject(projectId, { repos: updatedRepos }, userId)
}

// ============ Linear Sync ============

/**
 * Configure Linear sync for a project
 * @param projectId - The project ID
 * @param config - Linear sync configuration
 * @param userId - The user ID (for access control)
 */
export function configureLinearSync(
  projectId: string,
  config: LinearSyncConfig,
  userId?: string
): Project | null {
  return updateProject(projectId, { linearSync: config }, userId)
}

/**
 * Mark project as synced with Linear
 * @param projectId - The project ID
 * @param userId - The user ID (for access control)
 */
export function markLinearSynced(projectId: string, userId?: string): Project | null {
  const project = getProject(projectId, userId)
  if (!project || !project.linearSync) return null

  return updateProject(projectId, {
    linearSync: {
      ...project.linearSync,
      lastSyncAt: new Date().toISOString(),
      syncErrors: []
    }
  }, userId)
}

/**
 * Record a Linear sync error
 * @param projectId - The project ID
 * @param error - The error message
 * @param userId - The user ID (for access control)
 */
export function recordLinearSyncError(projectId: string, error: string, userId?: string): Project | null {
  const project = getProject(projectId, userId)
  if (!project || !project.linearSync) return null

  return updateProject(projectId, {
    linearSync: {
      ...project.linearSync,
      syncErrors: [...(project.linearSync.syncErrors || []), error]
    }
  }, userId)
}

// One-time import from Linear (creates a new project with imported mode)
export interface LinearImportData {
  projectId: string
  teamId: string
  name: string
  description: string
  issueCount: number
  userId?: string  // The user importing the project
}

/**
 * Import a project from Linear
 * @param data - Linear import data including optional userId
 */
export function importFromLinear(data: LinearImportData): Project {
  return createProject({
    name: data.name,
    description: data.description,
    status: "active",
    priority: "medium",
    repos: [],
    packetIds: [],
    linearSync: {
      mode: "imported",
      projectId: data.projectId,
      teamId: data.teamId,
      syncIssues: false,
      syncComments: false,
      syncStatus: false,
      importedAt: new Date().toISOString(),
      importedIssueCount: data.issueCount
    },
    tags: ["imported-from-linear"]
  }, data.userId)
}

/**
 * Enable two-way sync on an existing project
 * @param projectId - The project ID
 * @param linearProjectId - The Linear project ID
 * @param linearTeamId - The Linear team ID
 * @param options - Sync options
 * @param userId - The user ID (for access control)
 */
export function enableTwoWaySync(
  projectId: string,
  linearProjectId: string,
  linearTeamId: string,
  options: { syncIssues: boolean; syncComments: boolean; syncStatus: boolean },
  userId?: string
): Project | null {
  return configureLinearSync(projectId, {
    mode: "two_way",
    projectId: linearProjectId,
    teamId: linearTeamId,
    syncIssues: options.syncIssues,
    syncComments: options.syncComments,
    syncStatus: options.syncStatus
  }, userId)
}

/**
 * Disable Linear sync
 * @param projectId - The project ID
 * @param userId - The user ID (for access control)
 */
export function disableLinearSync(projectId: string, userId?: string): Project | null {
  const project = getProject(projectId, userId)
  if (!project) return null

  return updateProject(projectId, {
    linearSync: undefined
  }, userId)
}

// ============ Interview Storage ============

/**
 * Save an interview for a user
 * @param interview - The interview session
 * @param userId - The user ID
 */
export function saveInterview(interview: InterviewSession, userId?: string): void {
  if (userId) {
    const interviews = getStoredInterviewsForUser(userId)
    const index = interviews.findIndex(i => i.id === interview.id)

    if (index >= 0) {
      interviews[index] = interview
    } else {
      interviews.push(interview)
    }

    saveInterviewsForUser(userId, interviews)
  } else {
    // Legacy fallback
    const interviews = getStoredInterviews()
    const index = interviews.findIndex(i => i.id === interview.id)

    if (index >= 0) {
      interviews[index] = interview
    } else {
      interviews.push(interview)
    }

    saveInterviews(interviews)
  }
}

/**
 * Get an interview by ID
 * @param id - The interview ID
 * @param userId - The user ID
 */
export function getInterview(id: string, userId?: string): InterviewSession | null {
  const interviews = userId ? getStoredInterviewsForUser(userId) : getStoredInterviews()
  return interviews.find(i => i.id === id) || null
}

/**
 * Get interviews for a specific target
 * @param targetType - The target type
 * @param targetId - The target ID
 * @param userId - The user ID
 */
export function getInterviewsForTarget(
  targetType: string,
  targetId: string,
  userId?: string
): InterviewSession[] {
  const interviews = userId ? getStoredInterviewsForUser(userId) : getStoredInterviews()
  return interviews.filter(
    i => i.targetType === targetType && i.targetId === targetId
  )
}

/**
 * Attach an interview to a project (legacy - uses creationInterview field)
 * @param projectId - The project ID
 * @param interview - The interview session
 * @param userId - The user ID (for access control)
 */
export function attachInterviewToProject(
  projectId: string,
  interview: InterviewSession,
  userId?: string
): Project | null {
  saveInterview(interview, userId)
  return updateProject(projectId, { creationInterview: interview }, userId)
}

// ============ Multi-Interview Support ============

/**
 * Get all interviews for a project
 * Returns interviews from both legacy creationInterview and new interviewIds array
 * @param projectId - The project ID
 * @param userId - The user ID (for access control)
 */
export function getInterviewsForProject(projectId: string, userId?: string): InterviewSession[] {
  const project = getProject(projectId, userId)
  if (!project) return []

  const interviews: InterviewSession[] = []

  // Get interviews from the new interviewIds array
  if (project.interviewIds?.length) {
    for (const interviewId of project.interviewIds) {
      const interview = getInterview(interviewId, userId)
      if (interview) {
        interviews.push(interview)
      }
    }
  }

  // Include legacy creationInterview if it exists and isn't already in the list
  if (project.creationInterview) {
    const alreadyIncluded = interviews.some(i => i.id === project.creationInterview!.id)
    if (!alreadyIncluded) {
      interviews.push(project.creationInterview)
    }
  }

  // Sort by version or createdAt
  return interviews.sort((a, b) => {
    if (a.version !== undefined && b.version !== undefined) {
      return a.version - b.version
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}

/**
 * Add an interview to a project
 * @param projectId - The project ID
 * @param interview - The interview session to add
 * @param userId - The user ID (for access control)
 */
export function addInterviewToProject(
  projectId: string,
  interview: InterviewSession,
  userId?: string
): Project | null {
  const project = getProject(projectId, userId)
  if (!project) return null

  // Get existing interviews to determine version number
  const existingInterviews = getInterviewsForProject(projectId, userId)
  const maxVersion = Math.max(0, ...existingInterviews.map(i => i.version || 0))

  // Set interview properties
  const interviewWithMeta: InterviewSession = {
    ...interview,
    projectId,
    version: maxVersion + 1,
    isActive: interview.status === "in_progress"
  }

  // Save the interview to storage
  saveInterview(interviewWithMeta, userId)

  // Add interview ID to project's interviewIds array
  const interviewIds = [...(project.interviewIds || []), interview.id]

  return updateProject(projectId, { interviewIds }, userId)
}

/**
 * Delete an interview from a project
 * @param interviewId - The interview ID to delete
 * @param projectId - The project ID
 * @param userId - The user ID (for access control)
 */
export function deleteInterviewFromProject(
  interviewId: string,
  projectId: string,
  userId?: string
): Project | null {
  const project = getProject(projectId, userId)
  if (!project) return null

  // Remove from interviewIds array
  const interviewIds = (project.interviewIds || []).filter(id => id !== interviewId)

  // Also remove from interview storage
  if (userId) {
    const interviews = getStoredInterviewsForUser(userId)
    const filtered = interviews.filter(i => i.id !== interviewId)
    saveInterviewsForUser(userId, filtered)
  } else {
    const interviews = getStoredInterviews()
    const filtered = interviews.filter(i => i.id !== interviewId)
    saveInterviews(filtered)
  }

  // If this was the creationInterview, also clear that
  const updates: Partial<Project> = { interviewIds }
  if (project.creationInterview?.id === interviewId) {
    updates.creationInterview = undefined
  }

  return updateProject(projectId, updates, userId)
}

/**
 * Update an existing interview
 * @param interview - The updated interview session
 * @param userId - The user ID (for access control)
 */
export function updateInterview(interview: InterviewSession, userId?: string): void {
  saveInterview(interview, userId)

  // If linked to a project and was the creationInterview, update that too
  if (interview.projectId) {
    const project = getProject(interview.projectId, userId)
    if (project?.creationInterview?.id === interview.id) {
      updateProject(interview.projectId, { creationInterview: interview }, userId)
    }
  }
}

/**
 * Combined insights from all interviews for a project
 */
export interface CombinedInterviewInsights {
  goals: string[]
  features: string[]
  techStack: string[]
  requirements: string[]
  constraints: string[]
  keyPoints: string[]
  suggestedActions: string[]
  allSummaries: string[]
}

/**
 * Get combined insights from all interviews for a project
 * Merges extractedData from all interviews, deduplicating entries
 * @param projectId - The project ID
 * @param userId - The user ID (for access control)
 */
export function getCombinedInterviewInsights(projectId: string, userId?: string): CombinedInterviewInsights {
  const interviews = getInterviewsForProject(projectId, userId)

  const combined: CombinedInterviewInsights = {
    goals: [],
    features: [],
    techStack: [],
    requirements: [],
    constraints: [],
    keyPoints: [],
    suggestedActions: [],
    allSummaries: []
  }

  for (const interview of interviews) {
    // Add summary
    if (interview.summary) {
      combined.allSummaries.push(interview.summary)
    }

    // Add key points
    if (interview.keyPoints) {
      combined.keyPoints.push(...interview.keyPoints)
    }

    // Add suggested actions
    if (interview.suggestedActions) {
      combined.suggestedActions.push(...interview.suggestedActions)
    }

    // Merge extractedData
    const data = interview.extractedData
    if (data) {
      if (Array.isArray(data.goals)) combined.goals.push(...data.goals)
      if (Array.isArray(data.features)) combined.features.push(...data.features)
      if (Array.isArray(data.techStack)) combined.techStack.push(...data.techStack)
      if (Array.isArray(data.requirements)) combined.requirements.push(...data.requirements)
      if (Array.isArray(data.constraints)) combined.constraints.push(...data.constraints)
    }
  }

  // Deduplicate all arrays
  return {
    goals: [...new Set(combined.goals)],
    features: [...new Set(combined.features)],
    techStack: [...new Set(combined.techStack)],
    requirements: [...new Set(combined.requirements)],
    constraints: [...new Set(combined.constraints)],
    keyPoints: [...new Set(combined.keyPoints)],
    suggestedActions: [...new Set(combined.suggestedActions)],
    allSummaries: combined.allSummaries // Keep all summaries, don't dedupe
  }
}

/**
 * Migrate a project's creationInterview to the new interviewIds system
 * @param projectId - The project ID
 * @param userId - The user ID (for access control)
 */
export function migrateCreationInterview(projectId: string, userId?: string): Project | null {
  const project = getProject(projectId, userId)
  if (!project) return null

  // Skip if already migrated or no creation interview
  if (project.interviewIds?.length || !project.creationInterview) {
    return project
  }

  const interview = project.creationInterview

  // Set project association on the interview
  const migratedInterview: InterviewSession = {
    ...interview,
    projectId,
    version: 1,
    isActive: interview.status === "in_progress"
  }

  // Save to interview storage
  saveInterview(migratedInterview, userId)

  // Update project with interviewIds (keep creationInterview for backwards compat)
  return updateProject(projectId, {
    interviewIds: [interview.id]
  }, userId)
}

