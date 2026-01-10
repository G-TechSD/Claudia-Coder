/**
 * Clone Repository API
 *
 * POST /api/projects/clone-repo
 *
 * Clones a GitLab repository to the auto-mapped path within a project's folder.
 * The path is automatically calculated as: <basePath>/repos/<repo-name>
 *
 * Body: {
 *   projectId: string
 *   basePath: string              // The project's base folder path
 *   repo: {
 *     id: number
 *     name: string
 *     url: string                 // Git clone URL (HTTP or SSH)
 *     path_with_namespace: string
 *   }
 *   customPath?: string           // Optional: override the auto-mapped path
 *   skipClone?: boolean           // Optional: just record the mapping without cloning
 * }
 *
 * Returns: {
 *   success: boolean
 *   localPath: string
 *   cloned: boolean
 *   alreadyExists: boolean
 *   error?: string
 * }
 */

import { NextRequest, NextResponse } from "next/server"
import { mkdir } from "fs/promises"
import { existsSync } from "fs"
import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import { verifyApiAuth, unauthorizedResponse } from "@/lib/auth/api-helpers"

const execAsync = promisify(exec)

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
 */
async function cloneRepository(
  repoUrl: string,
  targetPath: string
): Promise<{ success: boolean; error?: string; alreadyExists?: boolean }> {
  try {
    // Check if already cloned
    if (existsSync(path.join(targetPath, ".git"))) {
      console.log(`[clone-repo] Repository already cloned at: ${targetPath}`)
      return { success: true, alreadyExists: true }
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(targetPath)
    if (!existsSync(parentDir)) {
      await mkdir(parentDir, { recursive: true })
      console.log(`[clone-repo] Created parent directory: ${parentDir}`)
    }

    // Clone the repository
    console.log(`[clone-repo] Cloning repository: ${repoUrl} to ${targetPath}`)
    const { stderr } = await execAsync(`git clone "${repoUrl}" "${targetPath}"`, {
      timeout: 300000 // 5 minute timeout for large repos
    })

    // Git outputs progress to stderr, check for actual errors
    if (stderr && stderr.includes("fatal:")) {
      return { success: false, error: stderr }
    }

    return { success: true, alreadyExists: false }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clone failed"
    console.error(`[clone-repo] Clone error: ${message}`)
    return { success: false, error: message }
  }
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
    const body = await request.json() as CloneRepoRequest

    // Validate required fields
    if (!body.projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      )
    }

    if (!body.basePath) {
      return NextResponse.json(
        { error: "basePath is required. Set the project folder first." },
        { status: 400 }
      )
    }

    if (!body.repo || !body.repo.url || !body.repo.name) {
      return NextResponse.json(
        { error: "repo with url and name is required" },
        { status: 400 }
      )
    }

    // Determine the local path
    const localPath = body.customPath || getAutoMappedPath(body.basePath, body.repo.name)

    console.log(`[clone-repo] Project: ${body.projectId}`)
    console.log(`[clone-repo] Base path: ${body.basePath}`)
    console.log(`[clone-repo] Repo: ${body.repo.name}`)
    console.log(`[clone-repo] Target path: ${localPath}`)

    // If skipClone is true, just return the path without cloning
    if (body.skipClone) {
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

    // Clone the repository
    const cloneResult = await cloneRepository(body.repo.url, localPath)

    if (!cloneResult.success) {
      return NextResponse.json({
        success: false,
        localPath,
        cloned: false,
        alreadyExists: false,
        error: cloneResult.error
      } as CloneRepoResponse, { status: 500 })
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
