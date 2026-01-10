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
    const errorData = await response.json().catch(() => ({ message: "Unknown error" }))
    // GitLab returns errors in various formats - handle them all
    let errorMessage: string
    if (typeof errorData.message === "string") {
      errorMessage = errorData.message
    } else if (typeof errorData.message === "object" && errorData.message !== null) {
      // Validation errors come as { message: { field: ["error1", "error2"] } }
      errorMessage = Object.entries(errorData.message)
        .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(", ") : errors}`)
        .join("; ")
    } else if (typeof errorData.error === "string") {
      errorMessage = errorData.error
    } else {
      errorMessage = `Failed to create repository: ${response.status}`
    }
    throw new Error(errorMessage)
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
 * Parse error for better debugging messages
 */
function parseConnectionError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Connection failed"
  }

  const message = error.message.toLowerCase()

  if (
    message.includes("certificate") ||
    message.includes("ssl") ||
    message.includes("self-signed")
  ) {
    return "SSL certificate error. The GitLab server may use a self-signed certificate."
  }

  if (message.includes("network") || message.includes("enotfound")) {
    return "Network error. Cannot reach the GitLab server."
  }

  if (message.includes("econnrefused")) {
    return "Connection refused. GitLab server may not be running."
  }

  return error.message
}

/**
 * Validate GitLab token by attempting to get current user
 * Returns detailed validation result
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
    const response = await fetch(`${GITLAB_URL}/api/v4/user`, {
      headers: {
        "PRIVATE-TOKEN": token,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: "Invalid or expired token" }
      }
      if (response.status === 403) {
        return { valid: false, error: "Token lacks required permissions (api scope)" }
      }
      return { valid: false, error: `GitLab returned HTTP ${response.status}` }
    }

    const user = await response.json()
    return { valid: true, user }
  } catch (error) {
    return { valid: false, error: parseConnectionError(error) }
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
