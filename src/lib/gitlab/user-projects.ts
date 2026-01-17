/**
 * Per-User GitLab Project Management
 *
 * Provides project isolation for each user through:
 * 1. Personal GitLab instance support (user brings their own)
 * 2. Shared GitLab instance with namespace/group isolation
 *
 * Each user can only see and manage their own projects.
 * Similar pattern to lib/n8n/user-workflows.ts
 */

import {
  getUserGitLabConfig,
  getUserGitLabUrl,
  getUserGitLabToken,
  getUserGitLabNamespace,
  generateProjectName,
  isUserProject,
  hasPersonalGitLabInstance,
  updateUserGitLabConfig,
  type UserGitLabConfig,
  type GitLabUser,
} from "@/lib/data/user-gitlab"

// ============ Types ============

export interface UserProject {
  id: number
  name: string
  path: string
  path_with_namespace: string
  description: string | null
  web_url: string
  ssh_url_to_repo: string
  http_url_to_repo: string
  created_at: string
  last_activity_at: string
  default_branch: string | null
  visibility: "private" | "internal" | "public"
  star_count?: number
  forks_count?: number
  open_issues_count?: number
  isUserOwned: boolean  // Whether this project belongs to the current user
}

export interface CreateProjectParams {
  name: string
  description?: string
  visibility?: "private" | "internal" | "public"
  initializeWithReadme?: boolean
  defaultBranch?: string
}

export interface GitLabGroup {
  id: number
  name: string
  path: string
  full_path: string
  description: string | null
  visibility: "private" | "internal" | "public"
  web_url: string
}

export interface UserGitLabCredentials {
  baseUrl: string
  personalAccessToken: string
}

// ============ Credential Factory ============

/**
 * Get the GitLab credentials for a user.
 * Returns either their personal instance credentials or the shared instance.
 */
export function getGitLabCredentials(userId: string): UserGitLabCredentials | null {
  const config = getUserGitLabConfig(userId)
  const token = getUserGitLabToken(userId)

  if (!token) {
    return null
  }

  if (config.mode === "personal" && config.personalInstance) {
    return {
      baseUrl: config.personalInstance.baseUrl,
      personalAccessToken: config.personalInstance.personalAccessToken,
    }
  }

  // Shared instance
  return {
    baseUrl: process.env.NEXT_PUBLIC_GITLAB_URL || "",
    personalAccessToken: token,
  }
}

/**
 * Check if user is using personal GitLab instance
 */
export function isUsingPersonalGitLab(userId: string): boolean {
  return hasPersonalGitLabInstance(userId)
}

// ============ Project Filtering ============

/**
 * Filter projects to only show user's projects
 */
export function filterUserProjects(userId: string, projects: UserProject[]): UserProject[] {
  const config = getUserGitLabConfig(userId)

  // For personal instances, return all projects
  if (config.mode === "personal") {
    return projects.map(p => ({ ...p, isUserOwned: true }))
  }

  // For shared instances, filter by namespace/prefix
  return projects
    .filter(p => isUserProject(userId, p.path_with_namespace))
    .map(p => ({ ...p, isUserOwned: true }))
}

// ============ User Project Service ============

/**
 * User Project Service
 * Handles all GitLab project operations with user isolation
 */
export class UserProjectService {
  private userId: string
  private credentials: UserGitLabCredentials | null
  private config: UserGitLabConfig

  constructor(userId: string) {
    this.userId = userId
    this.credentials = getGitLabCredentials(userId)
    this.config = getUserGitLabConfig(userId)
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return this.credentials !== null
  }

  /**
   * Get the base URL being used
   */
  getBaseUrl(): string {
    return this.credentials?.baseUrl || getUserGitLabUrl(this.userId)
  }

  /**
   * Parse and enhance error messages for GitLab connection failures
   */
  private parseGitLabError(error: unknown): string {
    if (!(error instanceof Error)) {
      return "Connection failed"
    }

    const message = error.message.toLowerCase()
    const baseUrl = this.credentials?.baseUrl || "GitLab server"

    // SSL/Certificate errors
    if (
      message.includes("certificate") ||
      message.includes("ssl") ||
      message.includes("cert") ||
      message.includes("self-signed") ||
      message.includes("unable to verify")
    ) {
      return `SSL certificate error: The GitLab server uses a self-signed or invalid certificate. If this is a trusted internal server, you may need to configure your browser or system to trust it.`
    }

    // Network/DNS errors
    if (
      message.includes("network") ||
      message.includes("enotfound") ||
      message.includes("dns") ||
      message.includes("getaddrinfo")
    ) {
      return `Network error: Cannot reach ${baseUrl}. Please check the URL and your network connection.`
    }

    // Connection refused
    if (message.includes("econnrefused") || message.includes("connection refused")) {
      return `Connection refused: GitLab server at ${baseUrl} is not responding.`
    }

    // Timeout
    if (message.includes("timeout") || message.includes("etimedout")) {
      return `Connection timeout: GitLab server took too long to respond.`
    }

    // CORS errors
    if (message.includes("cors") || message.includes("blocked by")) {
      return `CORS error: The GitLab server may not allow requests from this origin.`
    }

    return error.message
  }

  /**
   * Make a request to the user's GitLab instance
   */
  private async request<T>(
    endpoint: string,
    options: {
      method?: string
      body?: unknown
    } = {}
  ): Promise<T> {
    if (!this.credentials) {
      throw new Error("GitLab not configured. Please add your GitLab token in settings.")
    }

    if (!this.credentials.personalAccessToken) {
      throw new Error("GitLab Personal Access Token is missing. Please configure it in settings.")
    }

    // Clean URL - remove trailing slashes
    const baseUrl = this.credentials.baseUrl.replace(/\/+$/, "")
    const url = `${baseUrl}/api/v4${endpoint}`

    const fetchOptions: RequestInit = {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        "PRIVATE-TOKEN": this.credentials.personalAccessToken,
      },
    }

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body)
    }

    let response: Response
    try {
      response = await fetch(url, fetchOptions)
    } catch (error) {
      throw new Error(this.parseGitLabError(error))
    }

    if (!response.ok) {
      // Provide specific error messages for common HTTP status codes
      if (response.status === 401) {
        throw new Error("GitLab authentication failed. Your Personal Access Token may be invalid or expired. Please generate a new token with 'api' scope.")
      }
      if (response.status === 403) {
        throw new Error("GitLab access denied. Your token may lack required permissions. Ensure it has the 'api' scope.")
      }
      if (response.status === 404) {
        throw new Error(`GitLab resource not found. The endpoint or project may not exist.`)
      }

      let errorMessage = `GitLab API error: ${response.status}`
      try {
        const errorData = await response.json()
        if (typeof errorData.message === "string") {
          errorMessage = errorData.message
        } else if (typeof errorData.message === "object") {
          errorMessage = Object.entries(errorData.message)
            .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(", ") : errors}`)
            .join("; ")
        } else if (errorData.error) {
          errorMessage = errorData.error
        }
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage)
    }

    return response.json() as Promise<T>
  }

  /**
   * Get current GitLab user
   */
  async getCurrentUser(): Promise<GitLabUser | null> {
    try {
      return await this.request<GitLabUser>("/user")
    } catch {
      return null
    }
  }

  /**
   * Get all projects for the user
   */
  async getProjects(options?: {
    search?: string
    perPage?: number
    page?: number
    orderBy?: "created_at" | "last_activity_at" | "name"
    sort?: "asc" | "desc"
  }): Promise<UserProject[]> {
    const params = new URLSearchParams()

    // For shared instances, we'll fetch owned projects only
    if (this.config.mode === "shared") {
      params.set("owned", "true")
    }

    if (options?.search) params.set("search", options.search)
    if (options?.perPage) params.set("per_page", options.perPage.toString())
    if (options?.page) params.set("page", options.page.toString())
    if (options?.orderBy) params.set("order_by", options.orderBy)
    if (options?.sort) params.set("sort", options.sort)

    params.set("per_page", (options?.perPage || 20).toString())

    const projects = await this.request<UserProject[]>(`/projects?${params}`)

    // Filter to user's projects for shared instances
    return filterUserProjects(this.userId, projects)
  }

  /**
   * Get a specific project
   */
  async getProject(projectId: number | string): Promise<UserProject | null> {
    try {
      const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
      const project = await this.request<UserProject>(`/projects/${id}`)

      // Verify ownership for shared instances
      if (!isUserProject(this.userId, project.path_with_namespace)) {
        return null
      }

      return { ...project, isUserOwned: true }
    } catch {
      return null
    }
  }

  /**
   * Create a new project for the user
   */
  async createProject(params: CreateProjectParams): Promise<UserProject> {
    // Generate user-prefixed name for shared instances
    const name = this.config.mode === "shared"
      ? generateProjectName(this.userId, params.name)
      : params.name

    const body: Record<string, unknown> = {
      name,
      description: params.description || "",
      visibility: params.visibility || this.config.defaultVisibility,
      initialize_with_readme: params.initializeWithReadme ?? true,
    }

    if (params.defaultBranch || this.config.defaultBranch) {
      body.default_branch = params.defaultBranch || this.config.defaultBranch
    }

    // If user has a group configured, create project in that group
    if (this.config.mode === "shared" && this.config.sharedNamespace?.groupId) {
      body.namespace_id = this.config.sharedNamespace.groupId
    }

    const project = await this.request<UserProject>("/projects", {
      method: "POST",
      body,
    })

    return { ...project, isUserOwned: true }
  }

  /**
   * Update an existing project
   */
  async updateProject(
    projectId: number | string,
    updates: Partial<Pick<CreateProjectParams, "name" | "description" | "visibility" | "defaultBranch">>
  ): Promise<UserProject | null> {
    // First verify ownership
    const existing = await this.getProject(projectId)
    if (!existing) {
      return null
    }

    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
    const body: Record<string, unknown> = {}

    if (updates.name) {
      body.name = this.config.mode === "shared"
        ? generateProjectName(this.userId, updates.name)
        : updates.name
    }
    if (updates.description !== undefined) body.description = updates.description
    if (updates.visibility) body.visibility = updates.visibility
    if (updates.defaultBranch) body.default_branch = updates.defaultBranch

    const project = await this.request<UserProject>(`/projects/${id}`, {
      method: "PUT",
      body,
    })

    return { ...project, isUserOwned: true }
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: number | string): Promise<boolean> {
    // First verify ownership
    const existing = await this.getProject(projectId)
    if (!existing) {
      return false
    }

    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId

    await this.request(`/projects/${id}`, { method: "DELETE" })
    return true
  }

  /**
   * Fork a project
   */
  async forkProject(projectId: number | string, name?: string): Promise<UserProject | null> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId

    const body: Record<string, unknown> = {}

    if (name) {
      body.name = this.config.mode === "shared"
        ? generateProjectName(this.userId, name)
        : name
    }

    // Fork to user's namespace if configured
    if (this.config.mode === "shared" && this.config.sharedNamespace?.groupId) {
      body.namespace_id = this.config.sharedNamespace.groupId
    }

    try {
      const project = await this.request<UserProject>(`/projects/${id}/fork`, {
        method: "POST",
        body: Object.keys(body).length > 0 ? body : undefined,
      })

      return { ...project, isUserOwned: true }
    } catch {
      return null
    }
  }

  /**
   * Star a project
   */
  async starProject(projectId: number | string): Promise<boolean> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId

    try {
      await this.request(`/projects/${id}/star`, { method: "POST" })
      return true
    } catch {
      return false
    }
  }

  /**
   * Unstar a project
   */
  async unstarProject(projectId: number | string): Promise<boolean> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId

    try {
      await this.request(`/projects/${id}/unstar`, { method: "POST" })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get user's GitLab groups
   */
  async getGroups(): Promise<GitLabGroup[]> {
    try {
      const params = new URLSearchParams({
        owned: "true",
        per_page: "100",
      })

      return await this.request<GitLabGroup[]>(`/groups?${params}`)
    } catch {
      return []
    }
  }

  /**
   * Create a group for the user (for shared instance namespace)
   */
  async createUserGroup(): Promise<GitLabGroup | null> {
    if (this.config.mode !== "shared") {
      return null
    }

    const namespace = getUserGitLabNamespace(this.userId)
    const parts = namespace.split("/")
    const groupPath = parts[parts.length - 1] // Get the user part

    try {
      // Check if parent group exists
      const parentPath = parts.slice(0, -1).join("/")
      let parentGroup: GitLabGroup | null = null

      if (parentPath) {
        try {
          parentGroup = await this.request<GitLabGroup>(
            `/groups/${encodeURIComponent(parentPath)}`
          )
        } catch {
          // Parent group doesn't exist
        }
      }

      const body: Record<string, unknown> = {
        name: `User ${this.userId.slice(0, 8)}`,
        path: groupPath,
        visibility: "private",
        description: `Isolated namespace for user ${this.userId.slice(0, 8)}`,
      }

      if (parentGroup) {
        body.parent_id = parentGroup.id
      }

      const group = await this.request<GitLabGroup>("/groups", {
        method: "POST",
        body,
      })

      // Update config with the new group ID
      updateUserGitLabConfig(this.userId, {
        sharedNamespace: {
          groupId: group.id,
          groupPath: group.full_path,
          prefix: groupPath,
        },
      })

      return group
    } catch (error) {
      console.error("Failed to create user group:", error)
      return null
    }
  }

  /**
   * Get or create user's GitLab group
   */
  async ensureUserGroup(): Promise<GitLabGroup | null> {
    if (this.config.mode !== "shared") {
      return null
    }

    // If we already have a group ID, try to get it
    if (this.config.sharedNamespace?.groupId) {
      try {
        return await this.request<GitLabGroup>(
          `/groups/${this.config.sharedNamespace.groupId}`
        )
      } catch {
        // Group may have been deleted, try to create a new one
      }
    }

    // Try to get by path
    if (this.config.sharedNamespace?.groupPath) {
      try {
        const group = await this.request<GitLabGroup>(
          `/groups/${encodeURIComponent(this.config.sharedNamespace.groupPath)}`
        )

        // Update config with the group ID
        updateUserGitLabConfig(this.userId, {
          sharedNamespace: {
            groupId: group.id,
            groupPath: this.config.sharedNamespace.groupPath,
            prefix: this.config.sharedNamespace.prefix || group.path,
          },
        })

        return group
      } catch {
        // Group doesn't exist, create it
      }
    }

    return this.createUserGroup()
  }

  /**
   * Health check for the GitLab instance
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request("/user")
      return true
    } catch {
      return false
    }
  }

  /**
   * Get connection status
   */
  async getStatus(): Promise<{
    healthy: boolean
    mode: "shared" | "personal"
    url: string
    message: string
    user?: GitLabUser
  }> {
    try {
      const user = await this.getCurrentUser()

      if (user) {
        // Update last connection test
        updateUserGitLabConfig(this.userId, {
          lastConnectionTest: new Date().toISOString(),
          connectionHealthy: true,
        })

        return {
          healthy: true,
          mode: this.config.mode,
          url: this.getBaseUrl(),
          message: `Connected as ${user.username}`,
          user,
        }
      }

      return {
        healthy: false,
        mode: this.config.mode,
        url: this.getBaseUrl(),
        message: "Failed to get user info",
      }
    } catch (error) {
      // Update connection status
      updateUserGitLabConfig(this.userId, {
        lastConnectionTest: new Date().toISOString(),
        connectionHealthy: false,
      })

      return {
        healthy: false,
        mode: this.config.mode,
        url: this.getBaseUrl(),
        message: error instanceof Error ? error.message : "Connection failed",
      }
    }
  }
}

// ============ Factory Function ============

/**
 * Create a project service for a user
 */
export function createUserProjectService(userId: string): UserProjectService {
  return new UserProjectService(userId)
}

// ============ Utility Functions ============

/**
 * Get project URL for display
 */
export function getProjectUrl(project: UserProject): string {
  return project.web_url
}

/**
 * Get clone URL (prefer SSH if available)
 */
export function getCloneUrl(project: UserProject, preferSsh = true): string {
  return preferSsh && project.ssh_url_to_repo
    ? project.ssh_url_to_repo
    : project.http_url_to_repo
}

/**
 * Get file URL in repository
 */
export function getFileUrl(project: UserProject, path: string, ref = "main"): string {
  return `${project.web_url}/-/blob/${ref}/${path}`
}

/**
 * Get commit URL
 */
export function getCommitUrl(project: UserProject, sha: string): string {
  return `${project.web_url}/-/commit/${sha}`
}

/**
 * Get branch URL
 */
export function getBranchUrl(project: UserProject, branchName: string): string {
  return `${project.web_url}/-/tree/${encodeURIComponent(branchName)}`
}

/**
 * Get merge request URL
 */
export function getMergeRequestUrl(project: UserProject, mrIid: number): string {
  return `${project.web_url}/-/merge_requests/${mrIid}`
}
