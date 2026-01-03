/**
 * GitLab API Service
 * Connects to the self-hosted GitLab at http://192.168.245.11
 */

const GITLAB_BASE_URL = process.env.NEXT_PUBLIC_GITLAB_URL || "http://192.168.245.11"

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

class GitLabApiService {
  private baseUrl: string

  constructor() {
    this.baseUrl = GITLAB_BASE_URL
  }

  private async request<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}/api/v4${endpoint}`

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json"
      },
      // Enable caching for 30 seconds for better UX
      next: { revalidate: 30 }
    })

    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Projects
  async getProjects(perPage = 20): Promise<GitLabProject[]> {
    return this.request(`/projects?per_page=${perPage}&order_by=last_activity_at`)
  }

  async getProject(projectId: number | string): Promise<GitLabProject> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
    return this.request(`/projects/${id}`)
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

    return this.request(`/projects/${id}/repository/commits?${params}`)
  }

  async getCommit(projectId: number | string, sha: string): Promise<GitLabCommit> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
    return this.request(`/projects/${id}/repository/commits/${sha}?stats=true`)
  }

  // Branches
  async getBranches(projectId: number | string, perPage = 20): Promise<GitLabBranch[]> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
    return this.request(`/projects/${id}/repository/branches?per_page=${perPage}`)
  }

  async getBranch(projectId: number | string, branchName: string): Promise<GitLabBranch> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
    return this.request(`/projects/${id}/repository/branches/${encodeURIComponent(branchName)}`)
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

    return this.request(`/projects/${id}/repository/tree?${params}`)
  }

  // Merge Requests
  async getMergeRequests(projectId: number | string, state?: "opened" | "closed" | "merged" | "all"): Promise<GitLabMergeRequest[]> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
    const params = state ? `?state=${state}` : ""
    return this.request(`/projects/${id}/merge_requests${params}`)
  }

  async getMergeRequest(projectId: number | string, mrIid: number): Promise<GitLabMergeRequest> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
    return this.request(`/projects/${id}/merge_requests/${mrIid}`)
  }

  // Pipelines
  async getPipelines(projectId: number | string, perPage = 10): Promise<GitLabPipeline[]> {
    const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
    return this.request(`/projects/${id}/pipelines?per_page=${perPage}`)
  }

  async getLatestPipeline(projectId: number | string, ref?: string): Promise<GitLabPipeline | null> {
    try {
      const id = typeof projectId === "string" ? encodeURIComponent(projectId) : projectId
      const params = ref ? `?ref=${ref}` : ""
      const pipelines = await this.request<GitLabPipeline[]>(`/projects/${id}/pipelines${params}&per_page=1`)
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
    return this.request(`/projects/${id}/repository/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
  }

  // Utility to build web URLs
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
