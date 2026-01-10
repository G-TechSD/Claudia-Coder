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

// Legacy storage keys (kept for migration purposes)
const LEGACY_STORAGE_KEY = "claudia_projects"
const LEGACY_INTERVIEWS_KEY = "claudia_interviews"

// Base directory for all Claudia project working directories
const CLAUDIA_PROJECTS_BASE = "/home/bill/claudia-projects"

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
 * Format: /home/bill/claudia-projects/{project-slug}/
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
 * 1. Project's workingDirectory field (if set)
 * 2. First repo with localPath
 * 3. Generate a new working directory path
 */
export function getEffectiveWorkingDirectory(project: Project): string {
  // First check project's own working directory
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
 * This should be called from the server/API side
 * Returns the working directory path
 */
export async function ensureProjectWorkingDirectory(projectId: string): Promise<string | null> {
  // This is a client-side function that just returns the path
  // The actual directory creation happens on the server via API
  const project = getProject(projectId)
  if (!project) return null

  const workingDir = getEffectiveWorkingDirectory(project)

  // If project doesn't have a working directory set, update it
  if (!project.workingDirectory) {
    updateProject(projectId, { workingDirectory: workingDir })
  }

  return workingDir
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
  if (!project.workingDirectory) {
    const workingDir = generateWorkingDirectoryPath(project.name, project.id)
    const updatedProject = updateProject(id, { workingDirectory: workingDir }, userId)
    return updatedProject
  }

  return project
}

/**
 * Create a new project
 * @param data - Project data (without id, createdAt, updatedAt)
 * @param userId - Optional: The user ID creating the project (will be set as owner)
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
 * Attach an interview to a project
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

// ============ Sample Data ============

/**
 * Seed sample projects for a user
 * @param userId - The user ID to create sample projects for
 */
export function seedSampleProjects(userId?: string): void {
  const existing = userId ? getStoredProjectsForUser(userId) : getStoredProjects()
  if (existing.length > 0) return // Don't overwrite existing data

  const sampleProjects: Omit<Project, "id" | "createdAt" | "updatedAt">[] = [
    {
      name: "GoldenEye",
      description: "Multi-provider AI chain system for intelligent routing and model selection",
      status: "active",
      priority: "high",
      repos: [
        { provider: "gitlab", id: 2, name: "GoldenEye", path: "goldeneye", url: "https://bill-dev-linux-1/gtechsd/goldeneye" }
      ],
      packetIds: [],
      tags: ["ai", "infrastructure"],
      linearSync: {
        mode: "two_way",
        projectId: "GTE",
        teamId: "claudia",
        syncIssues: true,
        syncComments: true,
        syncStatus: true,
        lastSyncAt: new Date().toISOString()
      }
    },
    {
      name: "Claudia Coder",
      description: "Admin dashboard for the Claudia Coder",
      status: "active",
      priority: "high",
      repos: [],
      packetIds: [],
      tags: ["frontend", "dashboard"]
    },
    {
      name: "n8n Workflows",
      description: "Automation workflows for the development pipeline",
      status: "active",
      priority: "medium",
      repos: [],
      packetIds: [],
      tags: ["automation", "workflows"]
    }
  ]

  for (const project of sampleProjects) {
    createProject(project, userId)
  }
}
