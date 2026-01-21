/**
 * Clone Repository API
 *
 * POST /api/projects/clone-repo
 *
 * Two modes of operation:
 *
 * 1. GitLab Project Mode (existing):
 *    Clones a GitLab repository to the auto-mapped path within a project's folder.
 *    The path is automatically calculated as: <basePath>/repos/<repo-name>
 *
 *    Body: {
 *      projectId: string
 *      basePath: string              // The project's base folder path
 *      repo: {
 *        id: number
 *        name: string
 *        url: string                 // Git clone URL (HTTP or SSH)
 *        path_with_namespace: string
 *      }
 *      customPath?: string           // Optional: override the auto-mapped path
 *      skipClone?: boolean           // Optional: just record the mapping without cloning
 *    }
 *
 * 2. Import Mode (new):
 *    Clones any public repo or validates local path for importing.
 *
 *    Body: {
 *      source: string                // URL or local path
 *      type: "remote" | "local"      // Source type
 *    }
 *
 * Returns: {
 *   success: boolean
 *   localPath / path: string
 *   cloned: boolean
 *   alreadyExists: boolean
 *   error?: string
 * }
 */

import { NextRequest, NextResponse } from "next/server"
import { mkdir } from "fs/promises"
import { existsSync } from "fs"
import { promises as fs } from "fs"
import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import os from "os"
import { verifyApiAuth, unauthorizedResponse } from "@/lib/auth/api-helpers"
import { getUserGitLabToken } from "@/lib/data/user-gitlab"

const execAsync = promisify(exec)

/**
 * Get authenticated clone URL by embedding the GitLab token
 * Converts https://host/path/repo.git to https://oauth2:TOKEN@host/path/repo.git
 */
function getAuthenticatedCloneUrl(repoUrl: string, token: string | null): string {
  if (!token) return repoUrl

  try {
    const url = new URL(repoUrl)
    // Only add credentials for HTTPS URLs
    if (url.protocol === "https:") {
      url.username = "oauth2"
      url.password = token
      return url.toString()
    }
  } catch {
    // Invalid URL, return as-is
  }
  return repoUrl
}

interface CloneRepoRequest {
  projectId: string
  basePath: string
  repo: {
    id: number
    name: string
    url: string
    path_with_namespace: string
  }
  customPath?: string
  skipClone?: boolean
}

interface CloneRepoResponse {
  success: boolean
  localPath: string
  cloned: boolean
  alreadyExists: boolean
  error?: string
}

/**
 * Generate the auto-mapped local path for a repo
 * Format: <basePath>/repos/<repoName>
 */
function getAutoMappedPath(basePath: string, repoName: string): string {
  // Normalize: remove trailing slash, add /repos/<repoName>
  const normalizedBase = basePath.replace(/\/+$/, "")
  return `${normalizedBase}/repos/${repoName}`
}

/**
 * Clone a git repository to the target path
 * @param repoUrl - The repository URL to clone
 * @param targetPath - Target directory to clone into
 * @param token - Optional GitLab token for authentication
 */
async function cloneRepository(
  repoUrl: string,
  targetPath: string,
  token?: string | null
): Promise<{ success: boolean; error?: string; alreadyExists?: boolean; authFailed?: boolean }> {
  try {
    // Check if already cloned
    if (existsSync(path.join(targetPath, ".git"))) {
      console.log(`[clone-repo] Repository already cloned at: ${targetPath}`)
      return { success: true, alreadyExists: true }
    }

    // Ensure parent directory exists (create it even before clone attempt)
    const parentDir = path.dirname(targetPath)
    if (!existsSync(parentDir)) {
      await mkdir(parentDir, { recursive: true })
      console.log(`[clone-repo] Created parent directory: ${parentDir}`)
    }

    // Create target directory immediately (user requested: create folder even if empty at first)
    if (!existsSync(targetPath)) {
      await mkdir(targetPath, { recursive: true })
      console.log(`[clone-repo] Created target directory: ${targetPath}`)
    }

    // Get authenticated URL if token is available
    const cloneUrl = getAuthenticatedCloneUrl(repoUrl, token || null)

    // Log without exposing token
    console.log(`[clone-repo] Cloning repository: ${repoUrl} to ${targetPath}`)
    console.log(`[clone-repo] Using token authentication: ${!!token}`)

    // Clone with GIT_TERMINAL_PROMPT=0 to prevent interactive auth prompts
    const { stderr } = await execAsync(`git clone "${cloneUrl}" "${targetPath}"`, {
      timeout: 300000, // 5 minute timeout for large repos
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",  // Prevent interactive prompts
        GIT_ASKPASS: "",           // Disable askpass
      }
    })

    // Git outputs progress to stderr, check for actual errors
    if (stderr && stderr.includes("fatal:")) {
      // Check for authentication errors
      if (stderr.includes("Authentication failed") ||
          stderr.includes("could not read Username") ||
          stderr.includes("could not read Password") ||
          stderr.includes("Invalid username or password")) {
        return {
          success: false,
          error: "Git authentication failed. Please ensure your GitLab token is configured in Settings > GitLab, and has 'read_repository' scope.",
          authFailed: true
        }
      }
      return { success: false, error: stderr }
    }

    return { success: true, alreadyExists: false }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clone failed"
    console.error(`[clone-repo] Clone error: ${message}`)

    // Check for authentication errors in exception
    if (message.includes("Authentication failed") ||
        message.includes("could not read Username") ||
        message.includes("could not read Password") ||
        message.includes("No such device or address")) {
      return {
        success: false,
        error: "Git authentication failed. Please configure your GitLab token in Settings > GitLab with 'read_repository' scope, or use SSH URL.",
        authFailed: true
      }
    }

    return { success: false, error: message }
  }
}

// ============================================================================
// Import Mode Helpers (for importing repos from URL or local path)
// ============================================================================

function expandPath(p: string): string {
  if (!p) return p
  return p.replace(/^~/, os.homedir())
}

function getProjectsDir(): string {
  return path.join(os.homedir(), "claudia-projects")
}

/**
 * Parse repo URL to extract info
 */
function parseRepoUrl(url: string): {
  provider: "github" | "gitlab" | "bitbucket" | "other"
  owner: string
  repo: string
  normalized: string
} | null {
  // GitHub patterns
  let match = url.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/|$)/)
  if (match) {
    return {
      provider: "github",
      owner: match[1],
      repo: match[2],
      normalized: `https://github.com/${match[1]}/${match[2]}.git`,
    }
  }

  // GitLab patterns
  match = url.match(/gitlab\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/|$)/)
  if (match) {
    return {
      provider: "gitlab",
      owner: match[1],
      repo: match[2],
      normalized: `https://gitlab.com/${match[1]}/${match[2]}.git`,
    }
  }

  // Bitbucket patterns
  match = url.match(/bitbucket\.org[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/|$)/)
  if (match) {
    return {
      provider: "bitbucket",
      owner: match[1],
      repo: match[2],
      normalized: `https://bitbucket.org/${match[1]}/${match[2]}.git`,
    }
  }

  // Generic git URL
  match = url.match(/(?:https?:\/\/|git@)[\w.-]+[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/|$)/)
  if (match) {
    return {
      provider: "other",
      owner: match[1],
      repo: match[2],
      normalized: url.endsWith(".git") ? url : `${url}.git`,
    }
  }

  return null
}

/**
 * Generate a unique project folder name
 */
async function generateFolderName(baseName: string): Promise<string> {
  const projectsDir = getProjectsDir()
  await fs.mkdir(projectsDir, { recursive: true })

  let folderName = baseName.toLowerCase().replace(/[^a-z0-9-]/g, "-")
  let finalPath = path.join(projectsDir, folderName)

  // Check if exists and append number if needed
  let counter = 1
  while (true) {
    try {
      await fs.access(finalPath)
      folderName = `${baseName}-${counter}`
      finalPath = path.join(projectsDir, folderName)
      counter++
    } catch {
      // Doesn't exist, we can use this
      break
    }
  }

  return folderName
}

/**
 * Get the current commit hash
 */
async function getCurrentCommit(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync("git rev-parse HEAD", { cwd: repoPath })
    return stdout.trim()
  } catch {
    return "unknown"
  }
}

/**
 * Get the current branch name
 */
async function getCurrentBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD", { cwd: repoPath })
    return stdout.trim()
  } catch {
    return "main"
  }
}

/**
 * Handle import mode - clone from URL or validate local path
 */
async function handleImportMode(body: { source: string; type: "remote" | "local" }) {
  const { source, type } = body

  if (!source) {
    return NextResponse.json({ error: "Source is required" }, { status: 400 })
  }

  if (type === "local") {
    // Validate local path
    const expandedPath = expandPath(source)

    try {
      const stats = await fs.stat(expandedPath)
      if (!stats.isDirectory()) {
        return NextResponse.json({ error: "Path is not a directory" }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: "Directory not found" }, { status: 404 })
    }

    // Check if it's a git repo
    let isGitRepo = false
    let commit = ""
    let branch = "main"

    try {
      await fs.access(path.join(expandedPath, ".git"))
      isGitRepo = true
      commit = await getCurrentCommit(expandedPath)
      branch = await getCurrentBranch(expandedPath)
    } catch {
      // Not a git repo, that's fine
    }

    return NextResponse.json({
      success: true,
      path: expandedPath,
      folderName: path.basename(expandedPath),
      isGitRepo,
      branch,
      commit,
      provider: "local",
    })
  }

  // Remote URL - parse and clone
  const repoInfo = parseRepoUrl(source)
  if (!repoInfo) {
    return NextResponse.json(
      { error: "Invalid repository URL. Supported: GitHub, GitLab, Bitbucket, or direct git URLs" },
      { status: 400 }
    )
  }

  // Generate folder name
  const folderName = await generateFolderName(repoInfo.repo)
  const clonePath = path.join(getProjectsDir(), folderName)

  console.log(`[clone-repo] Import mode: Cloning ${repoInfo.normalized} to ${clonePath}`)

  // Clone the repository
  try {
    await execAsync(`git clone --depth 1 "${repoInfo.normalized}" "${clonePath}"`, {
      timeout: 300000, // 5 minute timeout
    })
  } catch (error) {
    console.error("[clone-repo] Clone failed:", error)

    // Clean up partial clone
    try {
      await fs.rm(clonePath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }

    return NextResponse.json(
      {
        error: "Failed to clone repository. Check that the URL is correct and the repo is public.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }

  // Get commit info
  const commit = await getCurrentCommit(clonePath)
  const branch = await getCurrentBranch(clonePath)

  console.log(`[clone-repo] Clone successful: ${folderName} @ ${commit.substring(0, 7)}`)

  return NextResponse.json({
    success: true,
    path: clonePath,
    folderName,
    isGitRepo: true,
    branch,
    commit,
    provider: repoInfo.provider,
    owner: repoInfo.owner,
    repo: repoInfo.repo,
    url: repoInfo.normalized,
  })
}

/**
 * POST - Clone a repository to the project's repos folder
 */
export async function POST(request: NextRequest) {
  // Verify authentication
  const auth = await verifyApiAuth()
  if (!auth) {
    return unauthorizedResponse()
  }

  try {
    const body = await request.json()

    // Detect import mode vs GitLab project mode
    if (body.source && body.type) {
      // Import mode - handle separately
      return handleImportMode(body as { source: string; type: "remote" | "local" })
    }

    // GitLab project mode - existing behavior
    const gitlabBody = body as CloneRepoRequest

    // Validate required fields
    if (!gitlabBody.projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      )
    }

    if (!gitlabBody.basePath) {
      return NextResponse.json(
        { error: "basePath is required. Set the project folder first." },
        { status: 400 }
      )
    }

    if (!gitlabBody.repo || !gitlabBody.repo.url || !gitlabBody.repo.name) {
      return NextResponse.json(
        { error: "repo with url and name is required" },
        { status: 400 }
      )
    }

    // Determine the local path
    const localPath = gitlabBody.customPath || getAutoMappedPath(gitlabBody.basePath, gitlabBody.repo.name)

    console.log(`[clone-repo] Project: ${gitlabBody.projectId}`)
    console.log(`[clone-repo] Base path: ${gitlabBody.basePath}`)
    console.log(`[clone-repo] Repo: ${gitlabBody.repo.name}`)
    console.log(`[clone-repo] Target path: ${localPath}`)

    // If skipClone is true, just return the path without cloning
    if (gitlabBody.skipClone) {
      console.log(`[clone-repo] Skip clone requested, returning path only`)

      // Check if the path already exists (for "repo already there" case)
      const alreadyExists = existsSync(localPath)

      return NextResponse.json({
        success: true,
        localPath,
        cloned: false,
        alreadyExists
      } as CloneRepoResponse)
    }

    // Get the user's GitLab token for authentication
    const gitlabToken = getUserGitLabToken(auth.user.id)

    // Clone the repository
    const cloneResult = await cloneRepository(gitlabBody.repo.url, localPath, gitlabToken)

    if (!cloneResult.success) {
      // Return localPath even on failure (folder was created)
      return NextResponse.json({
        success: false,
        localPath,
        cloned: false,
        alreadyExists: false,
        error: cloneResult.error,
        authFailed: cloneResult.authFailed
      } as CloneRepoResponse & { authFailed?: boolean }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      localPath,
      cloned: !cloneResult.alreadyExists,
      alreadyExists: cloneResult.alreadyExists || false
    } as CloneRepoResponse)

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to clone repository"
    console.error("[clone-repo] Error:", error)

    // Check for specific errors
    if (message.includes("EACCES") || message.includes("permission")) {
      return NextResponse.json(
        { success: false, error: "Permission denied. Cannot create directory at the specified path.", localPath: "", cloned: false, alreadyExists: false },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { success: false, error: message, localPath: "", cloned: false, alreadyExists: false },
      { status: 500 }
    )
  }
}
