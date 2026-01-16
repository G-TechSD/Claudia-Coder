/**
 * Gitea Service Implementation
 *
 * Implements the GitService interface for Gitea API v1.
 * Uses /api/v1/ endpoints with owner/repo format.
 *
 * Documentation: https://docs.gitea.com/api/1.20/
 */

import {
  type GitService,
  type GitServiceConfig,
  type GitUser,
  type ValidationResult,
  type Repository,
  type Commit,
  type Branch,
  type PullRequest,
  type RepoListOptions,
  type CommitListOptions,
  type BranchListOptions,
  type PullRequestListOptions,
  type CreateRepoOptions,
  GitServiceError,
  GitAuthenticationError,
  GitNotFoundError,
  GitPermissionError,
} from './types'

// ============ Gitea API Response Types ============

interface GiteaUser {
  id: number
  login: string
  full_name: string
  email: string
  avatar_url: string
  html_url: string
  is_admin: boolean
}

interface GiteaRepository {
  id: number
  name: string
  full_name: string
  description: string
  private: boolean
  fork: boolean
  html_url: string
  ssh_url: string
  clone_url: string
  default_branch: string
  created_at: string
  updated_at: string
  stars_count: number
  forks_count: number
  open_issues_count: number
  owner: {
    id: number
    login: string
    avatar_url: string
  }
  internal?: boolean
}

interface GiteaCommit {
  sha: string
  html_url: string
  commit: {
    message: string
    author: {
      name: string
      email: string
      date: string
    }
    committer: {
      name: string
      email: string
      date: string
    }
  }
  parents: Array<{ sha: string }>
  stats?: {
    additions: number
    deletions: number
    total: number
  }
}

interface GiteaBranch {
  name: string
  commit: {
    id: string
    message: string
    author: {
      name: string
      email: string
      date: string
    }
  }
  protected: boolean
}

interface GiteaPullRequest {
  id: number
  number: number
  title: string
  body: string
  state: 'open' | 'closed'
  head: {
    ref: string
    sha: string
  }
  base: {
    ref: string
    sha: string
  }
  user: {
    login: string
    full_name: string
    avatar_url: string
  }
  created_at: string
  updated_at: string
  merged_at: string | null
  closed_at: string | null
  html_url: string
  additions: number
  deletions: number
  changed_files: number
  mergeable: boolean
  merged: boolean
  labels: Array<{ name: string }>
}

// ============ Gitea Service Implementation ============

export class GiteaService implements GitService {
  readonly provider = 'gitea' as const
  readonly baseUrl: string
  private readonly token: string
  private readonly timeout: number

  constructor(config: GitServiceConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')
    this.token = config.token
    this.timeout = config.timeout || 30000
  }

  // ============ Private Helpers ============

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `token ${this.token}`,
      ...(options.headers as Record<string, string> || {}),
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        await this.handleErrorResponse(response)
      }

      // Handle empty responses (e.g., DELETE)
      const text = await response.text()
      if (!text) return undefined as T

      return JSON.parse(text) as T
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof GitServiceError) {
        throw error
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new GitServiceError(
            `Request timeout after ${this.timeout}ms`,
            'gitea'
          )
        }
        throw new GitServiceError(error.message, 'gitea', undefined, error)
      }

      throw new GitServiceError('Unknown error occurred', 'gitea', undefined, error)
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = `Gitea API error: ${response.status} ${response.statusText}`

    try {
      const errorData = await response.json()
      if (errorData.message) {
        errorMessage = errorData.message
      } else if (errorData.error) {
        errorMessage = errorData.error
      }
    } catch {
      // Use default error message
    }

    switch (response.status) {
      case 401:
        throw new GitAuthenticationError(
          'Invalid or expired token. Please check your Gitea access token.',
          'gitea'
        )
      case 403:
        throw new GitPermissionError(
          `Access denied: ${errorMessage}`,
          'gitea'
        )
      case 404:
        throw new GitNotFoundError(
          `Resource not found: ${errorMessage}`,
          'gitea'
        )
      default:
        throw new GitServiceError(errorMessage, 'gitea', response.status)
    }
  }

  // ============ Normalization Helpers ============

  private normalizeUser(user: GiteaUser): GitUser {
    return {
      id: user.id,
      username: user.login,
      name: user.full_name || user.login,
      email: user.email,
      avatarUrl: user.avatar_url,
      webUrl: user.html_url,
      isAdmin: user.is_admin,
    }
  }

  private normalizeRepository(repo: GiteaRepository): Repository {
    let visibility: 'private' | 'internal' | 'public' = 'public'
    if (repo.private) {
      visibility = 'private'
    } else if (repo.internal) {
      visibility = 'internal'
    }

    return {
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || null,
      defaultBranch: repo.default_branch || null,
      visibility,
      webUrl: repo.html_url,
      cloneUrl: repo.clone_url,
      sshUrl: repo.ssh_url,
      createdAt: repo.created_at,
      updatedAt: repo.updated_at,
      stars: repo.stars_count,
      forks: repo.forks_count,
      openIssues: repo.open_issues_count,
      owner: {
        id: repo.owner.id,
        username: repo.owner.login,
        avatarUrl: repo.owner.avatar_url,
      },
      _raw: repo,
    }
  }

  private normalizeCommit(commit: GiteaCommit): Commit {
    const title = commit.commit.message.split('\n')[0]

    return {
      sha: commit.sha,
      shortSha: commit.sha.substring(0, 7),
      message: commit.commit.message,
      title,
      authorName: commit.commit.author.name,
      authorEmail: commit.commit.author.email,
      authoredAt: commit.commit.author.date,
      committerName: commit.commit.committer.name,
      committerEmail: commit.commit.committer.email,
      committedAt: commit.commit.committer.date,
      webUrl: commit.html_url,
      stats: commit.stats ? {
        additions: commit.stats.additions,
        deletions: commit.stats.deletions,
        total: commit.stats.total,
      } : undefined,
      parentShas: commit.parents.map(p => p.sha),
      _raw: commit,
    }
  }

  private normalizeBranch(branch: GiteaBranch, repo: Repository): Branch {
    return {
      name: branch.name,
      isDefault: branch.name === repo.defaultBranch,
      isProtected: branch.protected,
      commitSha: branch.commit.id,
      commitMessage: branch.commit.message,
      commitAuthor: branch.commit.author.name,
      commitDate: branch.commit.author.date,
      webUrl: `${repo.webUrl}/src/branch/${encodeURIComponent(branch.name)}`,
      _raw: branch,
    }
  }

  private normalizePullRequest(pr: GiteaPullRequest): PullRequest {
    return {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      description: pr.body || null,
      state: pr.merged ? 'merged' : pr.state,
      sourceBranch: pr.head.ref,
      targetBranch: pr.base.ref,
      author: {
        username: pr.user.login,
        name: pr.user.full_name || pr.user.login,
        avatarUrl: pr.user.avatar_url,
      },
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      mergedAt: pr.merged_at,
      closedAt: pr.closed_at,
      webUrl: pr.html_url,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      labels: pr.labels?.map(l => l.name),
      mergeable: pr.mergeable,
      merged: pr.merged,
      _raw: pr,
    }
  }

  // ============ Authentication Methods ============

  async validateToken(): Promise<ValidationResult> {
    try {
      const user = await this.getCurrentUser()
      if (user) {
        return {
          valid: true,
          user,
          provider: 'gitea',
        }
      }
      return {
        valid: false,
        error: 'Failed to get user info',
        provider: 'gitea',
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token validation failed',
        provider: 'gitea',
      }
    }
  }

  async getCurrentUser(): Promise<GitUser | null> {
    try {
      const user = await this.request<GiteaUser>('/user')
      return this.normalizeUser(user)
    } catch {
      return null
    }
  }

  // ============ Repository Methods ============

  async listRepos(options: RepoListOptions = {}): Promise<Repository[]> {
    const params = new URLSearchParams()

    if (options.page) params.set('page', options.page.toString())
    if (options.perPage) params.set('limit', options.perPage.toString())
    if (options.search) params.set('q', options.search)

    // Map orderBy to Gitea sort field
    if (options.orderBy) {
      const sortMap: Record<string, string> = {
        created: 'created',
        updated: 'updated',
        name: 'alpha',
      }
      params.set('sort', sortMap[options.orderBy] || 'updated')
    }

    if (options.sort === 'asc') params.set('order', 'asc')

    const endpoint = options.owned
      ? `/user/repos?${params}`
      : `/repos/search?${params}`

    let repos: GiteaRepository[]

    if (options.owned) {
      repos = await this.request<GiteaRepository[]>(endpoint)
    } else {
      const response = await this.request<{ data: GiteaRepository[] }>(endpoint)
      repos = response.data
    }

    return repos.map(r => this.normalizeRepository(r))
  }

  async getRepo(identifier: string | number): Promise<Repository> {
    // Gitea uses owner/repo format
    const repo = await this.request<GiteaRepository>(`/repos/${identifier}`)
    return this.normalizeRepository(repo)
  }

  async createRepo(options: CreateRepoOptions): Promise<Repository> {
    const body = {
      name: options.name,
      description: options.description || '',
      private: options.visibility === 'private',
      auto_init: options.autoInit ?? options.initializeWithReadme ?? true,
      default_branch: options.defaultBranch || 'main',
    }

    const repo = await this.request<GiteaRepository>('/user/repos', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    return this.normalizeRepository(repo)
  }

  async deleteRepo(identifier: string | number): Promise<void> {
    await this.request<void>(`/repos/${identifier}`, {
      method: 'DELETE',
    })
  }

  // ============ Branch Methods ============

  async listBranches(
    repoId: string | number,
    options: BranchListOptions = {}
  ): Promise<Branch[]> {
    const params = new URLSearchParams()
    if (options.page) params.set('page', options.page.toString())
    if (options.perPage) params.set('limit', options.perPage.toString())

    const queryString = params.toString()
    const endpoint = `/repos/${repoId}/branches${queryString ? `?${queryString}` : ''}`

    const branches = await this.request<GiteaBranch[]>(endpoint)

    // Get repo info for default branch check
    const repo = await this.getRepo(repoId)

    return branches.map(b => this.normalizeBranch(b, repo))
  }

  async getBranch(repoId: string | number, branchName: string): Promise<Branch> {
    const branch = await this.request<GiteaBranch>(
      `/repos/${repoId}/branches/${encodeURIComponent(branchName)}`
    )

    const repo = await this.getRepo(repoId)
    return this.normalizeBranch(branch, repo)
  }

  // ============ Commit Methods ============

  async listCommits(
    repoId: string | number,
    options: CommitListOptions = {}
  ): Promise<Commit[]> {
    const params = new URLSearchParams()

    if (options.page) params.set('page', options.page.toString())
    if (options.perPage) params.set('limit', options.perPage.toString())
    if (options.ref) params.set('sha', options.ref)
    if (options.path) params.set('path', options.path)
    if (options.withStats) params.set('stat', 'true')

    const queryString = params.toString()
    const endpoint = `/repos/${repoId}/commits${queryString ? `?${queryString}` : ''}`

    const commits = await this.request<GiteaCommit[]>(endpoint)
    return commits.map(c => this.normalizeCommit(c))
  }

  async getCommit(repoId: string | number, sha: string): Promise<Commit> {
    const commit = await this.request<GiteaCommit>(
      `/repos/${repoId}/git/commits/${sha}`
    )
    return this.normalizeCommit(commit)
  }

  // ============ Pull Request Methods ============

  async listPullRequests(
    repoId: string | number,
    options: PullRequestListOptions = {}
  ): Promise<PullRequest[]> {
    const params = new URLSearchParams()

    if (options.page) params.set('page', options.page.toString())
    if (options.perPage) params.set('limit', options.perPage.toString())
    if (options.state && options.state !== 'all') {
      params.set('state', options.state === 'merged' ? 'closed' : options.state)
    }

    const queryString = params.toString()
    const endpoint = `/repos/${repoId}/pulls${queryString ? `?${queryString}` : ''}`

    const prs = await this.request<GiteaPullRequest[]>(endpoint)

    // Filter merged PRs if specifically requested
    if (options.state === 'merged') {
      return prs.filter(pr => pr.merged).map(pr => this.normalizePullRequest(pr))
    }

    return prs.map(pr => this.normalizePullRequest(pr))
  }

  async getPullRequest(repoId: string | number, prNumber: number): Promise<PullRequest> {
    const pr = await this.request<GiteaPullRequest>(
      `/repos/${repoId}/pulls/${prNumber}`
    )
    return this.normalizePullRequest(pr)
  }

  // ============ URL Utility Methods ============

  getRepoUrl(repo: Repository): string {
    return repo.webUrl
  }

  getCommitUrl(repo: Repository, sha: string): string {
    return `${repo.webUrl}/commit/${sha}`
  }

  getBranchUrl(repo: Repository, branchName: string): string {
    return `${repo.webUrl}/src/branch/${encodeURIComponent(branchName)}`
  }

  getPullRequestUrl(repo: Repository, prNumber: number): string {
    return `${repo.webUrl}/pulls/${prNumber}`
  }
}

/**
 * Create a Gitea service instance
 */
export function createGiteaService(config: Omit<GitServiceConfig, 'provider'>): GiteaService {
  return new GiteaService({ ...config, provider: 'gitea' })
}
