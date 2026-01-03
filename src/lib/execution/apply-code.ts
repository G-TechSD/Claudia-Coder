/**
 * Code Application
 *
 * Parse LLM output and apply generated code to repositories.
 */

import type { LinkedRepo } from "@/lib/data/types"

export interface FileChange {
  path: string
  content: string
  action: "create" | "update" | "delete"
}

export interface ParsedOutput {
  files: FileChange[]
  errors: string[]
}

export interface CommitResult {
  success: boolean
  commitId?: string
  branch?: string
  webUrl?: string
  error?: string
}

export interface ApplyResult {
  success: boolean
  filesApplied: string[]
  filesSkipped: string[]
  commit?: CommitResult
  errors: string[]
}

const GITLAB_URL = process.env.NEXT_PUBLIC_GITLAB_URL || "https://bill-dev-linux-1"

/**
 * Get GitLab token from localStorage (client) or env (server)
 */
function getGitLabToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("gitlab_token")
  }
  return process.env.GITLAB_TOKEN || null
}

/**
 * Parse LLM output to extract file changes
 *
 * Supports format:
 * === FILE: path/to/file.ts ===
 * ```typescript
 * // file contents
 * ```
 */
export function parseCodeOutput(output: string): ParsedOutput {
  const files: FileChange[] = []
  const errors: string[] = []

  // Match === FILE: path === followed by code block
  const filePattern = /===\s*FILE:\s*(.+?)\s*===\s*\n```\w*\n([\s\S]*?)```/g

  let match
  while ((match = filePattern.exec(output)) !== null) {
    const path = match[1].trim()
    let content = match[2]

    // Remove trailing newline from content if present
    if (content.endsWith("\n")) {
      content = content.slice(0, -1)
    }

    // Validate path
    if (!path || path.includes("..")) {
      errors.push(`Invalid file path: ${path}`)
      continue
    }

    // Basic validation
    if (!content.trim()) {
      errors.push(`Empty content for file: ${path}`)
      continue
    }

    files.push({
      path,
      content,
      action: "create" // Will be updated based on file existence
    })
  }

  // Alternative format: just code blocks with file paths in comments
  if (files.length === 0) {
    const altPattern = /```(\w+)\n\/\/\s*(?:File:\s*)?(.+?)\n([\s\S]*?)```/g

    while ((match = altPattern.exec(output)) !== null) {
      const path = match[2].trim()
      let content = match[3]

      if (content.endsWith("\n")) {
        content = content.slice(0, -1)
      }

      if (!path || path.includes("..")) {
        errors.push(`Invalid file path: ${path}`)
        continue
      }

      if (!content.trim()) {
        errors.push(`Empty content for file: ${path}`)
        continue
      }

      files.push({
        path,
        content,
        action: "create"
      })
    }
  }

  if (files.length === 0 && !output.includes("===") && !output.includes("```")) {
    errors.push("No valid file outputs found in LLM response")
  }

  return { files, errors }
}

/**
 * Check if a file exists in the repository
 */
async function fileExists(
  repoId: number,
  filePath: string,
  branch: string
): Promise<boolean> {
  const token = getGitLabToken()
  if (!token) return false

  try {
    const encodedPath = encodeURIComponent(filePath)
    const response = await fetch(
      `${GITLAB_URL}/api/v4/projects/${repoId}/repository/files/${encodedPath}?ref=${branch}`,
      {
        headers: {
          "PRIVATE-TOKEN": token
        }
      }
    )
    return response.ok
  } catch {
    return false
  }
}

/**
 * Get file content from repository
 */
export async function getFileContent(
  repoId: number,
  filePath: string,
  branch = "main"
): Promise<string | null> {
  const token = getGitLabToken()
  if (!token) return null

  try {
    const encodedPath = encodeURIComponent(filePath)
    const response = await fetch(
      `${GITLAB_URL}/api/v4/projects/${repoId}/repository/files/${encodedPath}/raw?ref=${branch}`,
      {
        headers: {
          "PRIVATE-TOKEN": token
        }
      }
    )

    if (!response.ok) return null
    return response.text()
  } catch {
    return null
  }
}

/**
 * Create a commit with file changes
 */
export async function createCommit(
  repoId: number,
  branch: string,
  commitMessage: string,
  actions: Array<{
    action: "create" | "update" | "delete" | "move" | "chmod"
    file_path: string
    content?: string
    previous_path?: string
  }>
): Promise<CommitResult> {
  const token = getGitLabToken()
  if (!token) {
    return { success: false, error: "GitLab token not configured" }
  }

  try {
    const response = await fetch(
      `${GITLAB_URL}/api/v4/projects/${repoId}/repository/commits`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "PRIVATE-TOKEN": token
        },
        body: JSON.stringify({
          branch,
          commit_message: commitMessage,
          actions
        })
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Unknown error" }))
      return { success: false, error: error.message || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return {
      success: true,
      commitId: data.id,
      branch,
      webUrl: data.web_url
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create commit"
    }
  }
}

/**
 * Create a branch if it doesn't exist
 */
async function ensureBranch(
  repoId: number,
  branchName: string,
  sourceBranch = "main"
): Promise<{ success: boolean; error?: string }> {
  const token = getGitLabToken()
  if (!token) {
    return { success: false, error: "GitLab token not configured" }
  }

  try {
    // Check if branch exists
    const checkResponse = await fetch(
      `${GITLAB_URL}/api/v4/projects/${repoId}/repository/branches/${encodeURIComponent(branchName)}`,
      {
        headers: { "PRIVATE-TOKEN": token }
      }
    )

    if (checkResponse.ok) {
      return { success: true } // Branch already exists
    }

    // Create branch
    const createResponse = await fetch(
      `${GITLAB_URL}/api/v4/projects/${repoId}/repository/branches`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "PRIVATE-TOKEN": token
        },
        body: JSON.stringify({
          branch: branchName,
          ref: sourceBranch
        })
      }
    )

    if (!createResponse.ok) {
      const error = await createResponse.json().catch(() => ({ message: "Unknown error" }))
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create branch"
    }
  }
}

/**
 * Apply parsed code changes to a GitLab repository
 */
export async function applyToGitLab(
  repo: LinkedRepo,
  changes: FileChange[],
  commitMessage: string,
  options?: {
    branch?: string
    createBranch?: boolean
    sourceBranch?: string
  }
): Promise<ApplyResult> {
  const branch = options?.branch || "claudia-generated"
  const sourceBranch = options?.sourceBranch || "main"
  const filesApplied: string[] = []
  const filesSkipped: string[] = []
  const errors: string[] = []

  if (changes.length === 0) {
    return {
      success: false,
      filesApplied,
      filesSkipped,
      errors: ["No file changes to apply"]
    }
  }

  // Create branch if needed
  if (options?.createBranch !== false) {
    const branchResult = await ensureBranch(repo.id, branch, sourceBranch)
    if (!branchResult.success) {
      return {
        success: false,
        filesApplied,
        filesSkipped,
        errors: [`Failed to create branch: ${branchResult.error}`]
      }
    }
  }

  // Determine action (create vs update) for each file
  const actions: Array<{
    action: "create" | "update"
    file_path: string
    content: string
  }> = []

  for (const change of changes) {
    const exists = await fileExists(repo.id, change.path, branch)
    actions.push({
      action: exists ? "update" : "create",
      file_path: change.path,
      content: change.content
    })
    filesApplied.push(change.path)
  }

  // Create commit
  const commitResult = await createCommit(repo.id, branch, commitMessage, actions)

  if (!commitResult.success) {
    errors.push(commitResult.error || "Commit failed")
  }

  return {
    success: commitResult.success,
    filesApplied,
    filesSkipped,
    commit: commitResult,
    errors
  }
}

/**
 * Apply changes and create a merge request
 */
export async function applyWithMergeRequest(
  repo: LinkedRepo,
  changes: FileChange[],
  options: {
    title: string
    description: string
    sourceBranch?: string
    targetBranch?: string
  }
): Promise<ApplyResult & { mergeRequestUrl?: string }> {
  const sourceBranch = options.sourceBranch || `claudia-${Date.now()}`
  const targetBranch = options.targetBranch || "main"

  // Apply changes to new branch
  const applyResult = await applyToGitLab(repo, changes, options.title, {
    branch: sourceBranch,
    createBranch: true,
    sourceBranch: targetBranch
  })

  if (!applyResult.success) {
    return applyResult
  }

  // Create merge request
  const token = getGitLabToken()
  if (!token) {
    return { ...applyResult, errors: [...applyResult.errors, "No token for MR creation"] }
  }

  try {
    const response = await fetch(
      `${GITLAB_URL}/api/v4/projects/${repo.id}/merge_requests`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "PRIVATE-TOKEN": token
        },
        body: JSON.stringify({
          source_branch: sourceBranch,
          target_branch: targetBranch,
          title: options.title,
          description: options.description
        })
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Unknown error" }))
      return {
        ...applyResult,
        errors: [...applyResult.errors, `MR creation failed: ${error.message}`]
      }
    }

    const mr = await response.json()
    return {
      ...applyResult,
      mergeRequestUrl: mr.web_url
    }
  } catch (error) {
    return {
      ...applyResult,
      errors: [...applyResult.errors, `MR creation failed: ${error}`]
    }
  }
}
