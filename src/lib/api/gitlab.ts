/**
 * GitLab API Service
 * Connects to the self-hosted GitLab via server-side proxy routes
 * to handle CORS and self-signed certificate issues
 *
 * All requests are proxied through /api/gitlab/* endpoints
 */

const GITLAB_BASE_URL = process.env.NEXT_PUBLIC_GITLAB_URL || ""

export interface GitLabProject {
  id: number
  name: string
  name_with_namespace: string
  path: string
  path_with_namespace: string
  description: string | null
  default_branch: string | null
  web_url: string
  ssh_url_to_repo: string
  http_url_to_repo: string
  created_at: string
  last_activity_at: string
  star_count: number
  forks_count: number
  open_issues_count: number
}

export interface GitLabCommit {
  id: string
  short_id: string
  title: string
  message: string
  author_name: string
  author_email: string
  authored_date: string
  created_at: string
  committed_date: string
  parent_ids: string[]
  web_url: string
  stats?: {
    additions: number
    deletions: number
    total: number
  }
}

export interface GitLabBranch {
  name: string
  merged: boolean
  protected: boolean
  default: boolean
  web_url: string
  commit: {
    id: string
    short_id: string
    title: string
    created_at: string
    author_name: string
  }
}

export interface GitLabMergeRequest {
  id: number
  iid: number
  title: string
  description: string
  state: "opened" | "closed" | "merged"
  source_branch: string
  target_branch: string
  author: {
    name: string
    username: string
  }
  created_at: string
  updated_at: string
  merged_at: string | null
  web_url: string
}

export interface GitLabTreeItem {
  id: string
  name: string
  type: "tree" | "blob"
  path: string
  mode: string
}

export interface GitLabPipeline {
  id: number
  status: "created" | "pending" | "running" | "success" | "failed" | "canceled" | "skipped"
  ref: string
  sha: string
  web_url: string
  created_at: string
  updated_at: string
}

// Get stored GitLab token from localStorage
function getGitLabToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("gitlab_token")
}

class GitLabApiService {
  private gitlabBaseUrl: string

  constructor() {
    this.gitlabBaseUrl = GITLAB_BASE_URL
  }

  /**
   * Make a request through the proxy API
   * All GitLab requests go through /api/gitlab/* to handle CORS and SSL
   */
  private async request<T>(proxyEndpoint: string): Promise<T> {
    const token = getGitLabToken()

    if (!token) {
      throw new Error("GitLab token not configured. Please set your GitLab access token.")
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-gitlab-token": token,
    }

    const response = await fetch(proxyEndpoint, {
      headers,
    })

    if (!response.ok) {
      // Parse error from proxy response
      let errorMessage = `GitLab API error: ${response.status} ${response.statusText}`

      try {
        const errorData = await response.json()
        if (errorData.error) {
          errorMessage = errorData.error
        } else if (errorData.message) {
          errorMessage = typeof errorData.message === "string"
            ? errorData.message
            : JSON.stringify(errorData.message)
        }
      } catch {
        // Use default error message
      }

      throw new Error(errorMessage)
    }

    return response.json()
  }

  // Projects
  async getProjects(perPage = 20): Promise<GitLabProject[]> {
    return this.request(`/api/gitlab/projects?per_page=${perPage}&order_by=last_activity_at`)
  }

  async getProject(projectId: number | string): Promise<GitLabProject> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
    return this.request(`/api/gitlab/projects/${id}`)
  }

  // Commits
  async getCommits(projectId: number | string, options?: {
    ref?: string
    perPage?: number
    page?: number
  }): Promise<GitLabCommit[]> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
    const params = new URLSearchParams()
    if (options?.ref) params.append("ref_name", options.ref)
    if (options?.perPage) params.append("per_page", options.perPage.toString())
    if (options?.page) params.append("page", options.page.toString())
    params.append("with_stats", "true")

    return this.request(`/api/gitlab/projects/${id}/commits?${params}`)
  }

  async getCommit(projectId: number | string, sha: string): Promise<GitLabCommit> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
    return this.request(`/api/gitlab/projects/${id}/commits/${sha}`)
  }

  // Branches
  async getBranches(projectId: number | string, perPage = 20): Promise<GitLabBranch[]> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
    return this.request(`/api/gitlab/projects/${id}/branches?per_page=${perPage}`)
  }

  async getBranch(projectId: number | string, branchName: string): Promise<GitLabBranch> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
    return this.request(`/api/gitlab/projects/${id}/branches/${encodeURIComponent(branchName)}`)
  }

  // File tree
  async getTree(projectId: number | string, options?: {
    path?: string
    ref?: string
    recursive?: boolean
  }): Promise<GitLabTreeItem[]> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
    const params = new URLSearchParams()
    if (options?.path) params.append("path", options.path)
    if (options?.ref) params.append("ref", options.ref)
    if (options?.recursive) params.append("recursive", "true")
    params.append("per_page", "100")

    return this.request(`/api/gitlab/projects/${id}/tree?${params}`)
  }

  // Merge Requests
  async getMergeRequests(projectId: number | string, state?: "opened" | "closed" | "merged" | "all"): Promise<GitLabMergeRequest[]> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
    const params = state ? `?state=${state}` : ""
    return this.request(`/api/gitlab/projects/${id}/merge_requests${params}`)
  }

  async getMergeRequest(projectId: number | string, mrIid: number): Promise<GitLabMergeRequest> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
    return this.request(`/api/gitlab/projects/${id}/merge_requests/${mrIid}`)
  }

  // Pipelines
  async getPipelines(projectId: number | string, perPage = 10): Promise<GitLabPipeline[]> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
    return this.request(`/api/gitlab/projects/${id}/pipelines?per_page=${perPage}`)
  }

  async getLatestPipeline(projectId: number | string, ref?: string): Promise<GitLabPipeline | null> {
    try {
      const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
      const params = new URLSearchParams()
      params.set("per_page", "1")
      if (ref) params.set("ref", ref)
      const pipelines = await this.request<GitLabPipeline[]>(`/api/gitlab/projects/${id}/pipelines?${params}`)
      return pipelines[0] || null
    } catch {
      return null
    }
  }

  // Compare branches
  async compareBranches(projectId: number | string, from: string, to: string): Promise<{
    commits: GitLabCommit[]
    diffs: unknown[]
    compare_timeout: boolean
    compare_same_ref: boolean
  }> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
    return this.request(`/api/gitlab/projects/${id}/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
  }

  // Utility to build web URLs (these don't need the proxy - they're just URL builders)
  getProjectUrl(project: GitLabProject): string {
    return project.web_url
  }

  getCommitUrl(project: GitLabProject, sha: string): string {
    return `${project.web_url}/-/commit/${sha}`
  }

  getBranchUrl(project: GitLabProject, branchName: string): string {
    return `${project.web_url}/-/tree/${encodeURIComponent(branchName)}`
  }

  getMergeRequestUrl(project: GitLabProject, mrIid: number): string {
    return `${project.web_url}/-/merge_requests/${mrIid}`
  }

  getFileUrl(project: GitLabProject, path: string, ref = "main"): string {
    return `${project.web_url}/-/blob/${ref}/${path}`
  }
}

// Export singleton instance
export const gitlabApi = new GitLabApiService()
