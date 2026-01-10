/**
 * GitLab API Helper
 * Handles GitLab operations including repo creation
 *
 * NOTE: All API calls are proxied through /api/gitlab/* to handle:
 * - CORS issues when calling GitLab from the browser
 * - Self-signed certificate handling for internal GitLab servers
 */

export interface GitLabProject {
  id: number
  name: string
  path: string
  path_with_namespace: string
  description: string
  web_url: string
  ssh_url_to_repo: string
  http_url_to_repo: string
  created_at: string
  default_branch: string
  visibility: "private" | "internal" | "public"
}

export interface CreateRepoOptions {
  name: string
  description?: string
  visibility?: "private" | "internal" | "public"
  initializeWithReadme?: boolean
  defaultBranch?: string
}

// Get stored GitLab token from localStorage
function getGitLabToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("gitlab_token")
}

// Store GitLab token in localStorage
export function setGitLabToken(token: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem("gitlab_token", token)
}

// Check if GitLab token is configured
export function hasGitLabToken(): boolean {
  return !!getGitLabToken()
}

// Clear GitLab token
export function clearGitLabToken(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem("gitlab_token")
}

/**
 * Create a new GitLab repository
 * Uses server-side proxy to handle CORS and self-signed certs
 */
export async function createGitLabRepo(options: CreateRepoOptions): Promise<GitLabProject> {
  const token = getGitLabToken()
  if (!token) {
    throw new Error("GitLab token not configured. Please set your GitLab access token.")
  }

  const response = await fetch("/api/gitlab/repos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token,
      name: options.name,
      description: options.description || "",
      visibility: options.visibility || "private",
      initializeWithReadme: options.initializeWithReadme ?? true,
      defaultBranch: options.defaultBranch,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `Failed to create repository: ${response.status}`)
  }

  return data
}

/**
 * List GitLab projects accessible to the user
 * Uses server-side proxy to handle CORS and self-signed certs
 */
export async function listGitLabProjects(options?: {
  search?: string
  perPage?: number
  page?: number
  owned?: boolean
}): Promise<GitLabProject[]> {
  const token = getGitLabToken()
  if (!token) {
    throw new Error("GitLab token not configured")
  }

  const params = new URLSearchParams()
  if (options?.search) params.set("search", options.search)
  if (options?.perPage) params.set("perPage", options.perPage.toString())
  if (options?.page) params.set("page", options.page.toString())
  if (options?.owned) params.set("owned", "true")

  const response = await fetch(`/api/gitlab/repos?${params}`, {
    headers: {
      "x-gitlab-token": token,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `Failed to list projects: ${response.status}`)
  }

  return data
}

/**
 * Get a specific GitLab project by ID
 * Uses server-side proxy to handle CORS and self-signed certs
 */
export async function getGitLabProject(projectId: number): Promise<GitLabProject> {
  const token = getGitLabToken()
  if (!token) {
    throw new Error("GitLab token not configured")
  }

  const response = await fetch(`/api/gitlab/repos/${projectId}`, {
    headers: {
      "x-gitlab-token": token,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `Failed to get project: ${response.status}`)
  }

  return data
}

/**
 * Delete a GitLab project
 * Uses server-side proxy to handle CORS and self-signed certs
 */
export async function deleteGitLabProject(projectId: number): Promise<void> {
  const token = getGitLabToken()
  if (!token) {
    throw new Error("GitLab token not configured")
  }

  const response = await fetch(`/api/gitlab/repos/${projectId}`, {
    method: "DELETE",
    headers: {
      "x-gitlab-token": token,
    },
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `Failed to delete project: ${response.status}`)
  }
}

/**
 * Validate GitLab token by attempting to get current user
 * Returns detailed validation result
 * Uses server-side proxy to handle CORS and self-signed certs
 */
export async function validateGitLabToken(token: string): Promise<{
  valid: boolean
  error?: string
  user?: { id: number; username: string; name: string; email: string }
}> {
  if (!token) {
    return { valid: false, error: "No token provided" }
  }

  try {
    const response = await fetch("/api/gitlab/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Connection failed",
    }
  }
}

/**
 * Simple token validation (backwards compatible)
 */
export async function isTokenValid(token: string): Promise<boolean> {
  const result = await validateGitLabToken(token)
  return result.valid
}

/**
 * Get current GitLab user info
 */
export async function getCurrentGitLabUser(): Promise<{ id: number; username: string; name: string; email: string } | null> {
  const token = getGitLabToken()
  if (!token) return null

  try {
    const result = await validateGitLabToken(token)
    return result.valid && result.user ? result.user : null
  } catch {
    return null
  }
}
