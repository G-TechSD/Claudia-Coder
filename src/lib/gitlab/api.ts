/**
 * GitLab API Helper
 * Handles GitLab operations including repo creation
 */

const GITLAB_URL = process.env.NEXT_PUBLIC_GITLAB_URL || "https://bill-dev-linux-1"

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
 */
export async function createGitLabRepo(options: CreateRepoOptions): Promise<GitLabProject> {
  const token = getGitLabToken()
  if (!token) {
    throw new Error("GitLab token not configured. Please set your GitLab access token.")
  }

  const body: Record<string, unknown> = {
    name: options.name,
    description: options.description || "",
    visibility: options.visibility || "private",
    initialize_with_readme: options.initializeWithReadme ?? true,
  }

  if (options.defaultBranch) {
    body.default_branch = options.defaultBranch
  }

  const response = await fetch(`${GITLAB_URL}/api/v4/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "PRIVATE-TOKEN": token,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }))
    throw new Error(error.message || `Failed to create repository: ${response.status}`)
  }

  return response.json()
}

/**
 * List GitLab projects accessible to the user
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
  if (options?.perPage) params.set("per_page", options.perPage.toString())
  if (options?.page) params.set("page", options.page.toString())
  if (options?.owned) params.set("owned", "true")

  const response = await fetch(`${GITLAB_URL}/api/v4/projects?${params}`, {
    headers: {
      "PRIVATE-TOKEN": token,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to list projects: ${response.status}`)
  }

  return response.json()
}

/**
 * Get a specific GitLab project by ID
 */
export async function getGitLabProject(projectId: number): Promise<GitLabProject> {
  const token = getGitLabToken()
  if (!token) {
    throw new Error("GitLab token not configured")
  }

  const response = await fetch(`${GITLAB_URL}/api/v4/projects/${projectId}`, {
    headers: {
      "PRIVATE-TOKEN": token,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to get project: ${response.status}`)
  }

  return response.json()
}

/**
 * Delete a GitLab project
 */
export async function deleteGitLabProject(projectId: number): Promise<void> {
  const token = getGitLabToken()
  if (!token) {
    throw new Error("GitLab token not configured")
  }

  const response = await fetch(`${GITLAB_URL}/api/v4/projects/${projectId}`, {
    method: "DELETE",
    headers: {
      "PRIVATE-TOKEN": token,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to delete project: ${response.status}`)
  }
}

/**
 * Validate GitLab token by attempting to get current user
 */
export async function validateGitLabToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${GITLAB_URL}/api/v4/user`, {
      headers: {
        "PRIVATE-TOKEN": token,
      },
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Get current GitLab user info
 */
export async function getCurrentGitLabUser(): Promise<{ id: number; username: string; name: string; email: string } | null> {
  const token = getGitLabToken()
  if (!token) return null

  try {
    const response = await fetch(`${GITLAB_URL}/api/v4/user`, {
      headers: {
        "PRIVATE-TOKEN": token,
      },
    })

    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}
