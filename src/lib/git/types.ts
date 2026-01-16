/**
 * Git Service Abstraction Layer - Shared Types
 *
 * Common types and interfaces for both GitLab and Gitea providers.
 * Normalizes differences between the two APIs into a unified interface.
 */

// ============ Provider Types ============

export type GitProvider = 'gitea' | 'gitlab'

// ============ Configuration ============

export interface GitServiceConfig {
  provider: GitProvider
  baseUrl: string
  token: string

  // Optional: Override auto-detection
  forceProvider?: GitProvider

  // Timeout in milliseconds (default: 30000)
  timeout?: number
}

// ============ Common Entities ============

export interface Repository {
  // Common fields (normalized)
  id: string | number           // Gitea: string, GitLab: number
  name: string
  fullName: string              // owner/repo format
  description: string | null
  defaultBranch: string | null
  visibility: 'private' | 'internal' | 'public'

  // URLs
  webUrl: string
  cloneUrl: string
  sshUrl: string

  // Metadata
  createdAt: string
  updatedAt: string

  // Stats
  stars: number
  forks: number
  openIssues: number

  // Provider-specific (optional)
  owner?: RepositoryOwner

  // Raw provider response (for advanced use cases)
  _raw?: unknown
}

export interface RepositoryOwner {
  id: string | number
  username: string
  avatarUrl?: string
}

export interface Commit {
  sha: string
  shortSha: string
  message: string
  title: string                 // First line of message

  // Author info
  authorName: string
  authorEmail: string
  authoredAt: string

  // Committer info (may differ from author)
  committerName?: string
  committerEmail?: string
  committedAt: string

  // URLs
  webUrl: string

  // Stats (if requested)
  stats?: CommitStats

  // Parent commits
  parentShas: string[]

  // Raw provider response
  _raw?: unknown
}

export interface CommitStats {
  additions: number
  deletions: number
  total: number
}

export interface Branch {
  name: string
  isDefault: boolean
  isProtected: boolean

  // Latest commit on branch
  commitSha: string
  commitMessage: string
  commitAuthor: string
  commitDate: string

  // URLs
  webUrl: string

  // Raw provider response
  _raw?: unknown
}

export interface PullRequest {
  // IDs
  id: number
  number: number                // PR number (iid in GitLab)

  // Content
  title: string
  description: string | null
  state: PullRequestState

  // Branches
  sourceBranch: string
  targetBranch: string

  // Author
  author: {
    username: string
    name: string
    avatarUrl?: string
  }

  // Timestamps
  createdAt: string
  updatedAt: string
  mergedAt: string | null
  closedAt: string | null

  // URLs
  webUrl: string

  // Stats
  additions?: number
  deletions?: number
  changedFiles?: number

  // Labels
  labels?: string[]

  // Merge status
  mergeable?: boolean
  merged?: boolean

  // Raw provider response
  _raw?: unknown
}

export type PullRequestState = 'open' | 'closed' | 'merged' | 'all'

export interface GitUser {
  id: number
  username: string
  name: string
  email: string
  avatarUrl?: string
  webUrl?: string
  isAdmin?: boolean
}

// ============ API Response Types ============

export interface ValidationResult {
  valid: boolean
  user?: GitUser
  error?: string
  provider?: GitProvider
}

export interface ListOptions {
  page?: number
  perPage?: number
}

export interface RepoListOptions extends ListOptions {
  search?: string
  owned?: boolean
  orderBy?: 'created' | 'updated' | 'name'
  sort?: 'asc' | 'desc'
}

export interface CommitListOptions extends ListOptions {
  ref?: string
  path?: string
  since?: string
  until?: string
  withStats?: boolean
}

export interface BranchListOptions extends ListOptions {
  search?: string
}

export interface PullRequestListOptions extends ListOptions {
  state?: PullRequestState
}

export interface CreateRepoOptions {
  name: string
  description?: string
  visibility?: 'private' | 'internal' | 'public'
  initializeWithReadme?: boolean
  defaultBranch?: string
  autoInit?: boolean
}

// ============ Service Interface ============

/**
 * Common interface for all git service implementations
 */
export interface GitService {
  // Provider info
  readonly provider: GitProvider
  readonly baseUrl: string

  // Authentication
  validateToken(): Promise<ValidationResult>
  getCurrentUser(): Promise<GitUser | null>

  // Repositories
  listRepos(options?: RepoListOptions): Promise<Repository[]>
  getRepo(identifier: string | number): Promise<Repository>
  createRepo(options: CreateRepoOptions): Promise<Repository>
  deleteRepo(identifier: string | number): Promise<void>

  // Branches
  listBranches(repoId: string | number, options?: BranchListOptions): Promise<Branch[]>
  getBranch(repoId: string | number, branchName: string): Promise<Branch>

  // Commits
  listCommits(repoId: string | number, options?: CommitListOptions): Promise<Commit[]>
  getCommit(repoId: string | number, sha: string): Promise<Commit>

  // Pull/Merge Requests
  listPullRequests(repoId: string | number, options?: PullRequestListOptions): Promise<PullRequest[]>
  getPullRequest(repoId: string | number, prNumber: number): Promise<PullRequest>

  // Utility methods
  getRepoUrl(repo: Repository): string
  getCommitUrl(repo: Repository, sha: string): string
  getBranchUrl(repo: Repository, branchName: string): string
  getPullRequestUrl(repo: Repository, prNumber: number): string
}

// ============ Error Types ============

export class GitServiceError extends Error {
  constructor(
    message: string,
    public readonly provider: GitProvider,
    public readonly statusCode?: number,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'GitServiceError'
  }
}

export class GitAuthenticationError extends GitServiceError {
  constructor(message: string, provider: GitProvider) {
    super(message, provider, 401)
    this.name = 'GitAuthenticationError'
  }
}

export class GitNotFoundError extends GitServiceError {
  constructor(message: string, provider: GitProvider) {
    super(message, provider, 404)
    this.name = 'GitNotFoundError'
  }
}

export class GitPermissionError extends GitServiceError {
  constructor(message: string, provider: GitProvider) {
    super(message, provider, 403)
    this.name = 'GitPermissionError'
  }
}
