/**
 * Shared Git Proxy Utilities
 * Supports both Gitea and GitLab providers with automatic detection
 * Handles self-signed certificates and common Git API patterns
 */

// Disable SSL verification for self-signed certs
// Node.js native fetch() doesn't support the agent option, so we use this env var
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

import https from "https"
import { NextRequest, NextResponse } from "next/server"

// Git provider types
export type GitProvider = 'gitea' | 'gitlab'

// Environment variable configuration
// Priority: NEXT_PUBLIC_GIT_URL > NEXT_PUBLIC_GITEA_URL > NEXT_PUBLIC_GITLAB_URL
const GIT_URL = process.env.NEXT_PUBLIC_GIT_URL
const GITEA_URL = process.env.NEXT_PUBLIC_GITEA_URL
const GITLAB_URL = process.env.NEXT_PUBLIC_GITLAB_URL

// Default to Gitea at localhost:8929 for all-in-one container
const DEFAULT_GIT_URL = "http://localhost:8929"

// Create an HTTPS agent that accepts self-signed certificates
export const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
})

/**
 * Detect the git provider from a URL
 * Gitea uses /api/v1, GitLab uses /api/v4
 * Also checks for common provider indicators in the URL
 */
export function detectProviderFromUrl(url: string): GitProvider {
  const lowerUrl = url.toLowerCase()

  // Check for explicit provider indicators in URL
  if (lowerUrl.includes('gitlab')) {
    return 'gitlab'
  }
  if (lowerUrl.includes('gitea') || lowerUrl.includes('forgejo')) {
    return 'gitea'
  }

  // Default to gitea for self-hosted instances (most common for local dev)
  return 'gitea'
}

/**
 * Get the base URL and detect provider
 * Returns normalized URL and provider type
 */
export function getGitConfig(providedUrl?: string): { baseUrl: string; provider: GitProvider } {
  // Use provided URL first, then check env vars in priority order
  let baseUrl = providedUrl || GIT_URL || GITEA_URL || GITLAB_URL || DEFAULT_GIT_URL

  // Normalize URL - remove trailing slashes
  baseUrl = baseUrl.replace(/\/+$/, "")

  // Detect provider
  let provider: GitProvider

  // If GITLAB_URL is explicitly set and no generic GIT_URL, assume GitLab
  if (!providedUrl && !GIT_URL && !GITEA_URL && GITLAB_URL) {
    provider = 'gitlab'
  } else if (providedUrl) {
    provider = detectProviderFromUrl(providedUrl)
  } else {
    provider = detectProviderFromUrl(baseUrl)
  }

  return { baseUrl, provider }
}

/**
 * Get the API path prefix for a provider
 */
export function getApiPrefix(provider: GitProvider): string {
  return provider === 'gitlab' ? '/api/v4' : '/api/v1'
}

/**
 * Build authorization headers for a provider
 */
export function buildAuthHeaders(provider: GitProvider, token: string): Record<string, string> {
  if (provider === 'gitlab') {
    return { "PRIVATE-TOKEN": token }
  }
  // Gitea uses Authorization: token <token>
  return { "Authorization": `token ${token}` }
}

/**
 * Make a server-side fetch to a Git provider with self-signed cert support
 */
export async function gitFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {},
  config?: { baseUrl?: string; provider?: GitProvider }
): Promise<Response> {
  const { baseUrl, provider } = config?.baseUrl
    ? { baseUrl: config.baseUrl, provider: config.provider || detectProviderFromUrl(config.baseUrl) }
    : getGitConfig()

  const apiPrefix = getApiPrefix(provider)
  const url = `${baseUrl}${apiPrefix}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(provider, token),
      ...options.headers,
    },
    // @ts-expect-error - Next.js extends fetch with agent support
    agent: httpsAgent,
  })

  return response
}

/**
 * Make a fetch specifically for Gitea
 */
export async function giteaFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {},
  baseUrl?: string
): Promise<Response> {
  const url = baseUrl || GIT_URL || GITEA_URL || DEFAULT_GIT_URL
  return gitFetch(endpoint, token, options, { baseUrl: url.replace(/\/+$/, ""), provider: 'gitea' })
}

/**
 * Make a fetch specifically for GitLab
 */
export async function gitlabFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {},
  baseUrl?: string
): Promise<Response> {
  const url = baseUrl || GIT_URL || GITLAB_URL || DEFAULT_GIT_URL
  return gitFetch(endpoint, token, options, { baseUrl: url.replace(/\/+$/, ""), provider: 'gitlab' })
}

/**
 * Extract Git token from request headers
 * Supports both x-git-token (generic) and x-gitlab-token (legacy)
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  return request.headers.get("x-git-token") || request.headers.get("x-gitlab-token")
}

/**
 * Extract provider from request headers
 */
export function getProviderFromRequest(request: NextRequest): GitProvider | null {
  const provider = request.headers.get("x-git-provider")
  if (provider === 'gitea' || provider === 'gitlab') {
    return provider
  }
  return null
}

/**
 * Extract base URL from request headers
 */
export function getBaseUrlFromRequest(request: NextRequest): string | null {
  return request.headers.get("x-git-url")
}

/**
 * Create a standard error response
 */
export function createErrorResponse(
  message: string,
  status: number = 500
): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Create a missing token error response
 */
export function createAuthErrorResponse(): NextResponse {
  return NextResponse.json(
    { error: "Git token is required" },
    { status: 401 }
  )
}

/**
 * Handle a Git API error response
 */
export async function handleGitError(
  response: Response,
  fallbackMessage: string
): Promise<NextResponse> {
  const data = await response.json().catch(() => ({}))

  let errorMessage: string
  if (typeof data.message === "string") {
    errorMessage = data.message
  } else if (typeof data.message === "object" && data.message !== null) {
    errorMessage = Object.entries(data.message)
      .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(", ") : errors}`)
      .join("; ")
  } else if (typeof data.error === "string") {
    errorMessage = data.error
  } else {
    errorMessage = `${fallbackMessage}: ${response.status}`
  }

  return NextResponse.json({ error: errorMessage }, { status: response.status })
}

/**
 * Build query string from URLSearchParams, filtering empty values
 */
export function buildQueryString(params: URLSearchParams): string {
  const filtered = new URLSearchParams()
  params.forEach((value, key) => {
    if (value) {
      filtered.set(key, value)
    }
  })
  return filtered.toString()
}

/**
 * Convert Gitea repository format to normalized format
 */
export function normalizeGiteaRepo(repo: Record<string, unknown>): Record<string, unknown> {
  return {
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    default_branch: repo.default_branch,
    visibility: repo.private ? 'private' : (repo.internal ? 'internal' : 'public'),
    ssh_url_to_repo: repo.ssh_url,
    http_url_to_repo: repo.clone_url,
    web_url: repo.html_url,
    created_at: repo.created_at,
    updated_at: repo.updated_at,
    owner: typeof repo.owner === 'object' && repo.owner !== null ? {
      id: (repo.owner as Record<string, unknown>).id,
      username: (repo.owner as Record<string, unknown>).login || (repo.owner as Record<string, unknown>).username,
      name: (repo.owner as Record<string, unknown>).full_name || (repo.owner as Record<string, unknown>).login,
    } : null,
    _provider: 'gitea',
    _original: repo,
  }
}

/**
 * Convert GitLab project format to normalized format
 */
export function normalizeGitLabRepo(project: Record<string, unknown>): Record<string, unknown> {
  const namespace = project.namespace as Record<string, unknown> | undefined
  return {
    id: project.id,
    name: project.name,
    full_name: project.path_with_namespace,
    description: project.description,
    default_branch: project.default_branch,
    visibility: project.visibility,
    ssh_url_to_repo: project.ssh_url_to_repo,
    http_url_to_repo: project.http_url_to_repo,
    web_url: project.web_url,
    created_at: project.created_at,
    updated_at: project.last_activity_at,
    owner: namespace ? {
      id: namespace.id,
      username: namespace.path,
      name: namespace.name,
    } : null,
    _provider: 'gitlab',
    _original: project,
  }
}

/**
 * Normalize a repository from either provider
 */
export function normalizeRepo(repo: Record<string, unknown>, provider: GitProvider): Record<string, unknown> {
  return provider === 'gitlab' ? normalizeGitLabRepo(repo) : normalizeGiteaRepo(repo)
}

/**
 * Convert Gitea user format to normalized format
 */
export function normalizeGiteaUser(user: Record<string, unknown>): Record<string, unknown> {
  return {
    id: user.id,
    username: user.login || user.username,
    name: user.full_name || user.login || user.username,
    email: user.email,
    avatar_url: user.avatar_url,
    _provider: 'gitea',
  }
}

/**
 * Convert GitLab user format to normalized format
 */
export function normalizeGitLabUser(user: Record<string, unknown>): Record<string, unknown> {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    avatar_url: user.avatar_url,
    _provider: 'gitlab',
  }
}

/**
 * Normalize a user from either provider
 */
export function normalizeUser(user: Record<string, unknown>, provider: GitProvider): Record<string, unknown> {
  return provider === 'gitlab' ? normalizeGitLabUser(user) : normalizeGiteaUser(user)
}

export {
  GIT_URL,
  GITEA_URL,
  GITLAB_URL,
  DEFAULT_GIT_URL,
}
