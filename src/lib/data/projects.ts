/**
 * Projects Data Store
 * Claudia-native project storage with optional Linear sync
 */

import {
  Project,
  ProjectStatus,
  ProjectFilter,
  ProjectStats,
  LinearSyncConfig,
  InterviewSession
} from "./types"

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

const STORAGE_KEY = "claudia_projects"
const INTERVIEWS_KEY = "claudia_interviews"

// ============ Storage Helpers ============

function getStoredProjects(): Project[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

function saveProjects(projects: Project[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
}

function getStoredInterviews(): InterviewSession[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(INTERVIEWS_KEY)
  return stored ? JSON.parse(stored) : []
}

function saveInterviews(interviews: InterviewSession[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(INTERVIEWS_KEY, JSON.stringify(interviews))
}

// ============ Project CRUD ============

export function getAllProjects(): Project[] {
  return getStoredProjects()
}

// Alias for getAllProjects
export const getProjects = getAllProjects

export function getProject(id: string): Project | null {
  const projects = getStoredProjects()
  return projects.find(p => p.id === id) || null
}

export function createProject(data: Omit<Project, "id" | "createdAt" | "updatedAt">): Project {
  const projects = getStoredProjects()
  const now = new Date().toISOString()

  const project: Project = {
    ...data,
    id: generateUUID(),
    createdAt: now,
    updatedAt: now
  }

  projects.push(project)
  saveProjects(projects)
  return project
}

export function updateProject(id: string, updates: Partial<Project>): Project | null {
  const projects = getStoredProjects()
  const index = projects.findIndex(p => p.id === id)

  if (index === -1) return null

  projects[index] = {
    ...projects[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  saveProjects(projects)
  return projects[index]
}

export function deleteProject(id: string): boolean {
  const projects = getStoredProjects()
  const filtered = projects.filter(p => p.id !== id)

  if (filtered.length === projects.length) return false

  saveProjects(filtered)
  return true
}

// ============ Project Queries ============

export function filterProjects(filter: ProjectFilter): Project[] {
  let projects = getStoredProjects()

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

export function getProjectStats(): ProjectStats {
  const projects = getStoredProjects()

  const byStatus: Record<ProjectStatus, number> = {
    planning: 0,
    active: 0,
    paused: 0,
    completed: 0,
    archived: 0
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
    total: projects.length,
    byStatus,
    activeRepos,
    activePackets
  }
}

// ============ Repo Linking ============

export function linkRepoToProject(
  projectId: string,
  repo: { provider: "gitlab" | "github"; id: number; name: string; path: string; url: string }
): Project | null {
  const project = getProject(projectId)
  if (!project) return null

  // Check if already linked
  if (project.repos.some(r => r.provider === repo.provider && r.id === repo.id)) {
    return project
  }

  return updateProject(projectId, {
    repos: [...project.repos, repo]
  })
}

export function unlinkRepoFromProject(
  projectId: string,
  provider: "gitlab" | "github",
  repoId: number
): Project | null {
  const project = getProject(projectId)
  if (!project) return null

  return updateProject(projectId, {
    repos: project.repos.filter(r => !(r.provider === provider && r.id === repoId))
  })
}

export function updateRepoLocalPath(
  projectId: string,
  repoId: number,
  localPath: string
): Project | null {
  const project = getProject(projectId)
  if (!project) return null

  const updatedRepos = project.repos.map(r => {
    if (r.id === repoId) {
      return { ...r, localPath: localPath || undefined }
    }
    return r
  })

  return updateProject(projectId, { repos: updatedRepos })
}

// ============ Linear Sync ============

export function configureLinearSync(
  projectId: string,
  config: LinearSyncConfig
): Project | null {
  return updateProject(projectId, { linearSync: config })
}

export function markLinearSynced(projectId: string): Project | null {
  const project = getProject(projectId)
  if (!project || !project.linearSync) return null

  return updateProject(projectId, {
    linearSync: {
      ...project.linearSync,
      lastSyncAt: new Date().toISOString(),
      syncErrors: []
    }
  })
}

export function recordLinearSyncError(projectId: string, error: string): Project | null {
  const project = getProject(projectId)
  if (!project || !project.linearSync) return null

  return updateProject(projectId, {
    linearSync: {
      ...project.linearSync,
      syncErrors: [...(project.linearSync.syncErrors || []), error]
    }
  })
}

// One-time import from Linear (creates a new project with imported mode)
export interface LinearImportData {
  projectId: string
  teamId: string
  name: string
  description: string
  issueCount: number
}

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
  })
}

// Enable two-way sync on an existing project
export function enableTwoWaySync(
  projectId: string,
  linearProjectId: string,
  linearTeamId: string,
  options: { syncIssues: boolean; syncComments: boolean; syncStatus: boolean }
): Project | null {
  return configureLinearSync(projectId, {
    mode: "two_way",
    projectId: linearProjectId,
    teamId: linearTeamId,
    syncIssues: options.syncIssues,
    syncComments: options.syncComments,
    syncStatus: options.syncStatus
  })
}

// Disable Linear sync
export function disableLinearSync(projectId: string): Project | null {
  const project = getProject(projectId)
  if (!project) return null

  return updateProject(projectId, {
    linearSync: undefined
  })
}

// ============ Interview Storage ============

export function saveInterview(interview: InterviewSession): void {
  const interviews = getStoredInterviews()
  const index = interviews.findIndex(i => i.id === interview.id)

  if (index >= 0) {
    interviews[index] = interview
  } else {
    interviews.push(interview)
  }

  saveInterviews(interviews)
}

export function getInterview(id: string): InterviewSession | null {
  const interviews = getStoredInterviews()
  return interviews.find(i => i.id === id) || null
}

export function getInterviewsForTarget(
  targetType: string,
  targetId: string
): InterviewSession[] {
  const interviews = getStoredInterviews()
  return interviews.filter(
    i => i.targetType === targetType && i.targetId === targetId
  )
}

export function attachInterviewToProject(
  projectId: string,
  interview: InterviewSession
): Project | null {
  saveInterview(interview)
  return updateProject(projectId, { creationInterview: interview })
}

// ============ Sample Data ============

export function seedSampleProjects(): void {
  const existing = getStoredProjects()
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
      name: "Claudia Admin Panel",
      description: "Admin dashboard for the Claudia Dev Agent Orchestrator",
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
    createProject(project)
  }
}
