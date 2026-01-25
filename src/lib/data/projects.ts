/**
 * Projects Data Store
 *
 * SERVER-SIDE STORAGE IS THE SOURCE OF TRUTH.
 * All CRUD operations go through the server API first.
 * localStorage serves only as a fast cache for initial renders.
 *
 * Data Flow:
 * - On page load: Show cached projects from localStorage immediately
 * - Fetch fresh data from server, update localStorage + state
 * - On create/update/delete: API call first, then update cache
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

// UUID generator that works in all contexts
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
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
function getClaudiaProjectsBase(): string {
  if (typeof window === "undefined") {
    return process.env.CLAUDIA_PROJECTS_BASE || path.join(os.homedir(), "claudia-projects")
  }
  return "~/claudia-projects"
}

const CLAUDIA_PROJECTS_BASE = getClaudiaProjectsBase()

// ============ Working Directory Helpers ============

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "project"
}

export function generateWorkingDirectoryPath(projectName: string, projectId?: string): string {
  const slug = generateSlug(projectName)
  const suffix = projectId ? `-${projectId.slice(0, 8)}` : ""
  return `${CLAUDIA_PROJECTS_BASE}/${slug}${suffix}`
}

export function getEffectiveWorkingDirectory(project: Project): string {
  if (project.basePath) return project.basePath
  if (project.workingDirectory) return project.workingDirectory
  const repoWithPath = project.repos.find(r => r.localPath)
  if (repoWithPath?.localPath) return repoWithPath.localPath
  return generateWorkingDirectoryPath(project.name, project.id)
}

export async function ensureProjectWorkingDirectory(projectId: string, userId?: string): Promise<string | null> {
  const project = await fetchProject(projectId, userId)
  if (!project) return null

  const workingDir = getEffectiveWorkingDirectory(project)

  if (!project.workingDirectory) {
    await updateProjectApi(projectId, { workingDirectory: workingDir }, userId)
  }

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
      console.warn(`[projects] Failed to create working directory for project ${projectId}`)
    }
  } catch (error) {
    console.warn(`[projects] Failed to call ensure-working-directory API:`, error)
  }

  return workingDir
}

export function getProjectWorkingDirectory(projectId: string): string | null {
  const project = getProjectFromCache(projectId)
  if (!project) return null
  return project.workingDirectory || null
}

// ============ localStorage Cache Helpers ============

/**
 * Get projects from localStorage cache (synchronous, fast)
 * Used for immediate UI rendering before server fetch completes
 */
export function getStoredProjectsForUser(userId: string): Project[] {
  if (typeof window === "undefined") return []

  const userProjects = getUserStorageItem<Project[]>(userId, USER_STORAGE_KEYS.PROJECTS)
  if (userProjects) return userProjects

  // Fallback to legacy storage
  const stored = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (stored) {
    const allProjects: Project[] = JSON.parse(stored)
    return allProjects.filter(p =>
      p.userId === userId ||
      p.isPublic === true ||
      p.collaboratorIds?.includes(userId) ||
      !p.userId
    )
  }

  return []
}

/**
 * Update localStorage cache
 */
function updateLocalCache(userId: string, projects: Project[]): void {
  if (typeof window === "undefined") return

  const projectsWithUser = projects.map(p => ({
    ...p,
    userId: p.userId || userId
  }))

  setUserStorageItem(userId, USER_STORAGE_KEYS.PROJECTS, projectsWithUser)
  dispatchStorageChange(userId, USER_STORAGE_KEYS.PROJECTS, projectsWithUser)
}

/**
 * Get a single project from cache (synchronous)
 */
function getProjectFromCache(projectId: string, userId?: string): Project | null {
  if (typeof window === "undefined") return null

  let projects: Project[] = []
  if (userId) {
    projects = getStoredProjectsForUser(userId)
  } else {
    const stored = localStorage.getItem(LEGACY_STORAGE_KEY)
    projects = stored ? JSON.parse(stored) : []
  }

  return projects.find(p => p.id === projectId) || null
}

/**
 * Add a project to the local cache
 */
function addToLocalCache(userId: string, project: Project): void {
  const projects = getStoredProjectsForUser(userId)
  const existing = projects.findIndex(p => p.id === project.id)
  if (existing >= 0) {
    projects[existing] = project
  } else {
    projects.push(project)
  }
  updateLocalCache(userId, projects)
}

/**
 * Update a project in the local cache
 */
function updateInLocalCache(userId: string, projectId: string, updates: Partial<Project>): void {
  const projects = getStoredProjectsForUser(userId)
  const index = projects.findIndex(p => p.id === projectId)
  if (index >= 0) {
    projects[index] = { ...projects[index], ...updates, updatedAt: new Date().toISOString() }
    updateLocalCache(userId, projects)
  }
}

/**
 * Remove a project from the local cache
 */
function removeFromLocalCache(userId: string, projectId: string): void {
  const projects = getStoredProjectsForUser(userId)
  const filtered = projects.filter(p => p.id !== projectId)
  updateLocalCache(userId, filtered)
}

// ============ Server API Functions ============

/**
 * Fetch all projects from server
 * This is the PRIMARY way to get projects - server is source of truth
 */
export async function fetchProjects(userId?: string, options?: { includeTrashed?: boolean }): Promise<Project[]> {
  if (typeof window === "undefined") return []

  try {
    const params = new URLSearchParams()
    if (userId) params.set("userId", userId)
    if (options?.includeTrashed) params.set("includeTrashed", "true")

    const response = await fetch(`/api/projects?${params}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.status}`)
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error || "Failed to fetch projects")
    }

    const projects = data.projects as Project[]

    // Update local cache with server data
    if (userId) {
      updateLocalCache(userId, projects)
    }

    return projects
  } catch (error) {
    console.error("[projects] Failed to fetch from server:", error)
    // Fall back to cache on error
    if (userId) {
      return getStoredProjectsForUser(userId)
    }
    return []
  }
}

/**
 * Fetch a single project from server
 */
export async function fetchProject(projectId: string, userId?: string): Promise<Project | null> {
  if (typeof window === "undefined") return null

  try {
    const params = new URLSearchParams()
    if (userId) params.set("userId", userId)

    const response = await fetch(`/api/projects/${projectId}?${params}`)
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Failed to fetch project: ${response.status}`)
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error || "Failed to fetch project")
    }

    // Update cache
    if (userId && data.project) {
      addToLocalCache(userId, data.project)
    }

    return data.project as Project
  } catch (error) {
    console.error(`[projects] Failed to fetch project ${projectId}:`, error)
    // Fall back to cache
    return getProjectFromCache(projectId, userId)
  }
}

/**
 * Create a project via server API
 */
export async function createProjectApi(
  data: Omit<Project, "id" | "createdAt" | "updatedAt">,
  userId?: string
): Promise<Project> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, userId })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to create project")
  }

  const result = await response.json()
  if (!result.success) {
    throw new Error(result.error || "Failed to create project")
  }

  const project = result.project as Project

  // Update local cache
  if (userId) {
    addToLocalCache(userId, project)
  }

  // Auto-create folder on disk (non-blocking)
  createProjectFolderOnDisk(project).catch(err => {
    console.warn(`[projects] Background folder creation failed:`, err)
  })

  return project
}

/**
 * Update a project via server API
 */
export async function updateProjectApi(
  projectId: string,
  updates: Partial<Project>,
  userId?: string
): Promise<Project | null> {
  const response = await fetch(`/api/projects/${projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...updates, userId })
  })

  if (!response.ok) {
    if (response.status === 404) return null
    const error = await response.json()
    throw new Error(error.error || "Failed to update project")
  }

  const result = await response.json()
  if (!result.success) {
    throw new Error(result.error || "Failed to update project")
  }

  const project = result.project as Project

  // Update local cache
  if (userId) {
    addToLocalCache(userId, project)
  }

  return project
}

/**
 * Delete a project via server API
 */
export async function deleteProjectApi(
  projectId: string,
  userId?: string,
  permanent: boolean = false
): Promise<boolean> {
  const params = new URLSearchParams()
  if (userId) params.set("userId", userId)
  if (permanent) params.set("permanent", "true")

  const response = await fetch(`/api/projects/${projectId}?${params}`, {
    method: "DELETE"
  })

  if (!response.ok) {
    if (response.status === 404) return false
    const error = await response.json()
    throw new Error(error.error || "Failed to delete project")
  }

  const result = await response.json()

  // Update local cache
  if (userId) {
    if (permanent) {
      removeFromLocalCache(userId, projectId)
    } else if (result.project) {
      addToLocalCache(userId, result.project)
    }
  }

  return result.success
}

/**
 * Trash a project via server API
 */
export async function trashProjectApi(projectId: string, userId?: string): Promise<Project | null> {
  return deleteProjectApi(projectId, userId, false).then(async (success) => {
    if (success) {
      return fetchProject(projectId, userId)
    }
    return null
  })
}

/**
 * Restore a project from trash via server API
 */
export async function restoreProjectApi(projectId: string, userId?: string): Promise<Project | null> {
  const response = await fetch(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "restore", userId })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to restore project")
  }

  const result = await response.json()

  if (userId && result.project) {
    addToLocalCache(userId, result.project)
  }

  return result.project as Project
}

/**
 * Toggle star on a project via server API
 */
export async function toggleStarApi(projectId: string, userId?: string): Promise<Project | null> {
  const project = await fetchProject(projectId, userId)
  if (!project) return null

  const action = project.starred ? "unstar" : "star"

  const response = await fetch(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, userId })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to toggle star")
  }

  const result = await response.json()

  if (userId && result.project) {
    addToLocalCache(userId, result.project)
  }

  return result.project as Project
}

// ============ Legacy Synchronous Functions (use cache) ============
// These are kept for backwards compatibility but should be migrated to async versions

/**
 * Get all projects (synchronous, from cache)
 * @deprecated Use fetchProjects() for server data
 */
export function getAllProjects(options?: {
  includeTrashed?: boolean
  userId?: string
  isAdmin?: boolean
}): Project[] {
  if (!options?.userId) {
    console.warn("[projects] getAllProjects called without userId - returning empty")
    return []
  }

  let projects = getStoredProjectsForUser(options.userId)
  projects = filterUserAccessibleItems(options.userId, projects, options.isAdmin || false)

  if (!options?.includeTrashed) {
    projects = projects.filter(p => p.status !== "trashed")
  }

  return projects
}

export const getProjects = getAllProjects

/**
 * Get a project by ID (synchronous, from cache)
 * @deprecated Use fetchProject() for server data
 */
export function getProject(id: string, userId?: string, isAdmin?: boolean): Project | null {
  let projects: Project[]

  if (userId) {
    projects = getStoredProjectsForUser(userId)
  } else {
    if (typeof window === "undefined") return null
    const stored = localStorage.getItem(LEGACY_STORAGE_KEY)
    projects = stored ? JSON.parse(stored) : []
  }

  const project = projects.find(p => p.id === id)
  if (!project) return null

  if (userId && !canUserAccessItem(userId, project, isAdmin || false)) {
    return null
  }

  // Ensure workingDirectory is set
  if (!project.workingDirectory) {
    const workingDir = generateWorkingDirectoryPath(project.name, project.id)
    project.workingDirectory = workingDir
    // Async update to server (non-blocking)
    updateProjectApi(id, { workingDirectory: workingDir }, userId).catch(() => {})
  }

  return project
}

/**
 * Create a project (synchronous, writes to cache immediately)
 * Server sync happens in background
 * @deprecated Use createProjectApi() for guaranteed persistence
 */
export function createProject(
  data: Omit<Project, "id" | "createdAt" | "updatedAt">,
  userId?: string
): Project {
  const now = new Date().toISOString()
  const id = generateUUID()
  const workingDirectory = data.workingDirectory || generateWorkingDirectoryPath(data.name, id)
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

  // Update local cache immediately for fast UI
  if (userId || project.userId) {
    const ownerUserId = userId || project.userId!
    addToLocalCache(ownerUserId, project)
  }

  // Sync to server in background
  fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, userId, id, createdAt: now, updatedAt: now, workingDirectory, basePath })
  }).catch(err => {
    console.error("[projects] Failed to sync create to server:", err)
  })

  // Auto-create folder (non-blocking)
  createProjectFolderOnDisk(project).catch(() => {})

  return project
}

/**
 * Update a project (synchronous, writes to cache immediately)
 * @deprecated Use updateProjectApi() for guaranteed persistence
 */
export function updateProject(
  id: string,
  updates: Partial<Project>,
  userId?: string
): Project | null {
  const existingProject = getProject(id, userId)
  if (!existingProject) return null

  const ownerUserId = userId || existingProject.userId

  // Update cache immediately
  if (ownerUserId) {
    updateInLocalCache(ownerUserId, id, updates)
  }

  // Sync to server in background
  updateProjectApi(id, updates, userId).catch(err => {
    console.error("[projects] Failed to sync update to server:", err)
  })

  return { ...existingProject, ...updates, updatedAt: new Date().toISOString() }
}

/**
 * Delete a project (synchronous, writes to cache immediately)
 * @deprecated Use deleteProjectApi() for guaranteed persistence
 */
export function deleteProject(id: string, userId?: string): boolean {
  const existingProject = getProject(id, userId)
  if (!existingProject) return false

  const ownerUserId = userId || existingProject.userId

  if (ownerUserId) {
    removeFromLocalCache(ownerUserId, id)
  }

  // Sync to server in background
  deleteProjectApi(id, userId, true).catch(err => {
    console.error("[projects] Failed to sync delete to server:", err)
  })

  return true
}

// ============ Project Trash (sync versions) ============

export function trashProject(id: string, userId?: string): Project | null {
  const project = getProject(id, userId)
  if (!project || project.status === "trashed") return null

  return updateProject(id, {
    previousStatus: project.status,
    status: "trashed",
    trashedAt: new Date().toISOString()
  }, userId)
}

export function restoreProject(id: string, userId?: string): Project | null {
  const project = getProject(id, userId)
  if (!project || project.status !== "trashed") return null

  return updateProject(id, {
    status: project.previousStatus || "active",
    previousStatus: undefined,
    trashedAt: undefined
  }, userId)
}

export function getTrashedProjects(userId: string): Project[] {
  if (!userId) return []
  return getStoredProjectsForUser(userId).filter(p => p.status === "trashed")
}

export function permanentlyDeleteProject(id: string, userId?: string): boolean {
  const project = getProject(id, userId)
  if (!project || project.status !== "trashed") return false
  return deleteProject(id, userId)
}

export function emptyTrash(userId: string): number {
  if (!userId) return 0

  const projects = getStoredProjectsForUser(userId)
  const trashedCount = projects.filter(p => p.status === "trashed").length
  const remaining = projects.filter(p => p.status !== "trashed")

  updateLocalCache(userId, remaining)

  // Sync to server
  projects
    .filter(p => p.status === "trashed")
    .forEach(p => deleteProjectApi(p.id, userId, true).catch(() => {}))

  return trashedCount
}

// ============ Project Starring ============

export function toggleProjectStar(id: string, userId?: string): Project | null {
  const project = getProject(id, userId)
  if (!project) return null
  return updateProject(id, { starred: !project.starred }, userId)
}

export function getStarredProjects(userId: string): Project[] {
  if (!userId) return []
  return getStoredProjectsForUser(userId).filter(p => p.starred === true)
}

// ============ Project Queries ============

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
    planning: 0, active: 0, paused: 0, completed: 0, archived: 0, trashed: 0
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

  return {
    total: projects.filter(p => p.status !== "trashed").length,
    byStatus,
    activeRepos,
    activePackets
  }
}

// ============ Working Directory Helpers ============

async function createProjectFolderOnDisk(project: Project): Promise<void> {
  if (typeof window === "undefined") return

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
      console.warn(`[projects] Auto-create folder failed for ${project.name}`)
    }
  } catch (error) {
    console.warn(`[projects] Failed to auto-create project folder:`, error)
  }
}

export function migrateProjectWorkingDirectories(): number {
  // This is a no-op now since server handles migration
  return 0
}

export async function createProjectWithFolder(
  data: Omit<Project, "id" | "createdAt" | "updatedAt">,
  userId?: string
): Promise<Project> {
  const project = await createProjectApi(data, userId)
  await createProjectFolderOnDisk(project)
  return project
}

// ============ Repo Linking ============

export function linkRepoToProject(
  projectId: string,
  repo: LinkedRepo,
  userId?: string
): Project | null {
  const project = getProject(projectId, userId)
  if (!project) return null

  if (project.repos.some(r => r.provider === repo.provider && r.id === repo.id)) {
    return project
  }

  return updateProject(projectId, { repos: [...project.repos, repo] }, userId)
}

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

export function configureLinearSync(
  projectId: string,
  config: LinearSyncConfig,
  userId?: string
): Project | null {
  return updateProject(projectId, { linearSync: config }, userId)
}

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

export interface LinearImportData {
  projectId: string
  teamId: string
  name: string
  description: string
  issueCount: number
  userId?: string
}

export function importFromLinear(data: LinearImportData): Project {
  return createProject({
    name: data.name,
    description: data.description,
    status: "planning",
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

export function disableLinearSync(projectId: string, userId?: string): Project | null {
  const project = getProject(projectId, userId)
  if (!project) return null
  return updateProject(projectId, { linearSync: undefined }, userId)
}

// ============ Interview Storage ============

function getStoredInterviewsForUser(userId: string): InterviewSession[] {
  if (typeof window === "undefined") return []

  const userInterviews = getUserStorageItem<InterviewSession[]>(userId, USER_STORAGE_KEYS.INTERVIEWS)
  if (userInterviews) return userInterviews

  const stored = localStorage.getItem(LEGACY_INTERVIEWS_KEY)
  return stored ? JSON.parse(stored) : []
}

function saveInterviewsForUser(userId: string, interviews: InterviewSession[]): void {
  if (typeof window === "undefined") return
  setUserStorageItem(userId, USER_STORAGE_KEYS.INTERVIEWS, interviews)
}

function getStoredInterviews(): InterviewSession[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(LEGACY_INTERVIEWS_KEY)
  return stored ? JSON.parse(stored) : []
}

function saveInterviews(interviews: InterviewSession[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LEGACY_INTERVIEWS_KEY, JSON.stringify(interviews))
}

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

export function getInterview(id: string, userId?: string): InterviewSession | null {
  const interviews = userId ? getStoredInterviewsForUser(userId) : getStoredInterviews()
  return interviews.find(i => i.id === id) || null
}

export function getInterviewsForTarget(
  targetType: string,
  targetId: string,
  userId?: string
): InterviewSession[] {
  const interviews = userId ? getStoredInterviewsForUser(userId) : getStoredInterviews()
  return interviews.filter(i => i.targetType === targetType && i.targetId === targetId)
}

export function attachInterviewToProject(
  projectId: string,
  interview: InterviewSession,
  userId?: string
): Project | null {
  saveInterview(interview, userId)
  return updateProject(projectId, { creationInterview: interview }, userId)
}

// ============ Multi-Interview Support ============

export function getInterviewsForProject(projectId: string, userId?: string): InterviewSession[] {
  const project = getProject(projectId, userId)
  if (!project) return []

  const interviews: InterviewSession[] = []

  if (project.interviewIds?.length) {
    for (const interviewId of project.interviewIds) {
      const interview = getInterview(interviewId, userId)
      if (interview) interviews.push(interview)
    }
  }

  if (project.creationInterview) {
    const alreadyIncluded = interviews.some(i => i.id === project.creationInterview!.id)
    if (!alreadyIncluded) interviews.push(project.creationInterview)
  }

  return interviews.sort((a, b) => {
    if (a.version !== undefined && b.version !== undefined) {
      return a.version - b.version
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}

export function addInterviewToProject(
  projectId: string,
  interview: InterviewSession,
  userId?: string
): Project | null {
  const project = getProject(projectId, userId)
  if (!project) return null

  const existingInterviews = getInterviewsForProject(projectId, userId)
  const maxVersion = Math.max(0, ...existingInterviews.map(i => i.version || 0))

  const interviewWithMeta: InterviewSession = {
    ...interview,
    projectId,
    version: maxVersion + 1,
    isActive: interview.status === "in_progress"
  }

  saveInterview(interviewWithMeta, userId)

  const interviewIds = [...(project.interviewIds || []), interview.id]
  return updateProject(projectId, { interviewIds }, userId)
}

export function deleteInterviewFromProject(
  interviewId: string,
  projectId: string,
  userId?: string
): Project | null {
  const project = getProject(projectId, userId)
  if (!project) return null

  const interviewIds = (project.interviewIds || []).filter(id => id !== interviewId)

  if (userId) {
    const interviews = getStoredInterviewsForUser(userId)
    const filtered = interviews.filter(i => i.id !== interviewId)
    saveInterviewsForUser(userId, filtered)
  } else {
    const interviews = getStoredInterviews()
    const filtered = interviews.filter(i => i.id !== interviewId)
    saveInterviews(filtered)
  }

  const updates: Partial<Project> = { interviewIds }
  if (project.creationInterview?.id === interviewId) {
    updates.creationInterview = undefined
  }

  return updateProject(projectId, updates, userId)
}

export function updateInterview(interview: InterviewSession, userId?: string): void {
  saveInterview(interview, userId)

  if (interview.projectId) {
    const project = getProject(interview.projectId, userId)
    if (project?.creationInterview?.id === interview.id) {
      updateProject(interview.projectId, { creationInterview: interview }, userId)
    }
  }
}

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
    if (interview.summary) combined.allSummaries.push(interview.summary)
    if (interview.keyPoints) combined.keyPoints.push(...interview.keyPoints)
    if (interview.suggestedActions) combined.suggestedActions.push(...interview.suggestedActions)

    const data = interview.extractedData
    if (data) {
      if (Array.isArray(data.goals)) combined.goals.push(...data.goals)
      if (Array.isArray(data.features)) combined.features.push(...data.features)
      if (Array.isArray(data.techStack)) combined.techStack.push(...data.techStack)
      if (Array.isArray(data.requirements)) combined.requirements.push(...data.requirements)
      if (Array.isArray(data.constraints)) combined.constraints.push(...data.constraints)
    }
  }

  return {
    goals: [...new Set(combined.goals)],
    features: [...new Set(combined.features)],
    techStack: [...new Set(combined.techStack)],
    requirements: [...new Set(combined.requirements)],
    constraints: [...new Set(combined.constraints)],
    keyPoints: [...new Set(combined.keyPoints)],
    suggestedActions: [...new Set(combined.suggestedActions)],
    allSummaries: combined.allSummaries
  }
}

export function migrateCreationInterview(projectId: string, userId?: string): Project | null {
  const project = getProject(projectId, userId)
  if (!project) return null

  if (project.interviewIds?.length || !project.creationInterview) {
    return project
  }

  const interview = project.creationInterview

  const migratedInterview: InterviewSession = {
    ...interview,
    projectId,
    version: 1,
    isActive: interview.status === "in_progress"
  }

  saveInterview(migratedInterview, userId)
  return updateProject(projectId, { interviewIds: [interview.id] }, userId)
}
