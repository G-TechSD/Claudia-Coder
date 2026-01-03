/**
 * Repository Context
 *
 * Gather context from repositories for code generation.
 */

import type { LinkedRepo } from "@/lib/data/types"

const GITLAB_URL = process.env.NEXT_PUBLIC_GITLAB_URL || "https://bill-dev-linux-1"

export interface RepoContext {
  projectName: string
  techStack: string[]
  fileTree: string[]
  relevantFiles: Array<{ path: string; summary: string }>
  existingCode?: string
}

export interface TreeItem {
  id: string
  name: string
  type: "tree" | "blob"
  path: string
  mode: string
}

/**
 * Get GitLab token
 */
function getGitLabToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("gitlab_token")
  }
  return process.env.GITLAB_TOKEN || null
}

/**
 * Fetch the file tree from a GitLab repository
 */
export async function getGitLabFileTree(
  repoId: number,
  options?: {
    path?: string
    ref?: string
    recursive?: boolean
  }
): Promise<TreeItem[]> {
  const token = getGitLabToken()
  if (!token) {
    throw new Error("GitLab token not configured")
  }

  const params = new URLSearchParams()
  if (options?.path) params.set("path", options.path)
  if (options?.ref) params.set("ref", options.ref)
  if (options?.recursive) params.set("recursive", "true")
  params.set("per_page", "100")

  try {
    const response = await fetch(
      `${GITLAB_URL}/api/v4/projects/${repoId}/repository/tree?${params}`,
      {
        headers: {
          "PRIVATE-TOKEN": token
        }
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return [] // Empty repo
      }
      throw new Error(`Failed to fetch file tree: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error("Error fetching file tree:", error)
    return []
  }
}

/**
 * Get raw file content from repository
 */
export async function getFileContent(
  repoId: number,
  filePath: string,
  ref = "main"
): Promise<string | null> {
  const token = getGitLabToken()
  if (!token) return null

  try {
    const encodedPath = encodeURIComponent(filePath)
    const response = await fetch(
      `${GITLAB_URL}/api/v4/projects/${repoId}/repository/files/${encodedPath}/raw?ref=${ref}`,
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
 * Detect tech stack from package.json
 */
export function detectTechStack(packageJson: string | null): string[] {
  if (!packageJson) return ["Unknown"]

  try {
    const pkg = JSON.parse(packageJson)
    const stack: string[] = []

    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies
    }

    // Frameworks
    if (allDeps.next) stack.push("Next.js")
    else if (allDeps.react) stack.push("React")
    if (allDeps.vue) stack.push("Vue.js")
    if (allDeps.angular || allDeps["@angular/core"]) stack.push("Angular")
    if (allDeps.svelte) stack.push("Svelte")
    if (allDeps.express) stack.push("Express")
    if (allDeps.fastify) stack.push("Fastify")
    if (allDeps.nestjs || allDeps["@nestjs/core"]) stack.push("NestJS")

    // Languages
    if (allDeps.typescript || pkg.devDependencies?.typescript) stack.push("TypeScript")

    // State management
    if (allDeps.redux || allDeps["@reduxjs/toolkit"]) stack.push("Redux")
    if (allDeps.zustand) stack.push("Zustand")
    if (allDeps.jotai) stack.push("Jotai")
    if (allDeps.recoil) stack.push("Recoil")

    // UI
    if (allDeps.tailwindcss) stack.push("Tailwind CSS")
    if (allDeps["@mui/material"]) stack.push("Material UI")
    if (allDeps["@chakra-ui/react"]) stack.push("Chakra UI")
    if (allDeps["styled-components"]) stack.push("Styled Components")

    // Database
    if (allDeps.prisma || allDeps["@prisma/client"]) stack.push("Prisma")
    if (allDeps.mongoose) stack.push("MongoDB")
    if (allDeps.pg) stack.push("PostgreSQL")
    if (allDeps.mysql2) stack.push("MySQL")
    if (allDeps["better-sqlite3"] || allDeps.sqlite3) stack.push("SQLite")
    if (allDeps.drizzle || allDeps["drizzle-orm"]) stack.push("Drizzle")

    // Testing
    if (allDeps.jest) stack.push("Jest")
    if (allDeps.vitest) stack.push("Vitest")
    if (allDeps.mocha) stack.push("Mocha")
    if (allDeps["@playwright/test"]) stack.push("Playwright")
    if (allDeps.cypress) stack.push("Cypress")

    // API
    if (allDeps.graphql) stack.push("GraphQL")
    if (allDeps.trpc || allDeps["@trpc/server"]) stack.push("tRPC")

    return stack.length > 0 ? stack : ["Node.js"]
  } catch {
    return ["Unknown"]
  }
}

/**
 * Get summaries of key project files
 */
export async function getKeyFileSummaries(
  repoId: number,
  tree: TreeItem[]
): Promise<Array<{ path: string; summary: string }>> {
  const summaries: Array<{ path: string; summary: string }> = []

  // Key files to look for
  const keyFiles = [
    "README.md",
    "package.json",
    "tsconfig.json",
    "next.config.js",
    "next.config.mjs",
    "vite.config.ts",
    "tailwind.config.js",
    "tailwind.config.ts",
    ".env.example",
    "prisma/schema.prisma",
    "drizzle.config.ts"
  ]

  const blobFiles = tree.filter(t => t.type === "blob")

  for (const keyFile of keyFiles) {
    const found = blobFiles.find(f => f.path === keyFile || f.path.endsWith(`/${keyFile}`))
    if (found) {
      const content = await getFileContent(repoId, found.path)
      if (content) {
        // Generate summary based on file type
        let summary = ""
        if (found.path.endsWith("package.json")) {
          try {
            const pkg = JSON.parse(content)
            summary = `${pkg.name || "Project"} - ${pkg.description || "No description"}`
          } catch {
            summary = "Package configuration"
          }
        } else if (found.path.endsWith("README.md")) {
          // First line or first 100 chars
          const firstLine = content.split("\n").find(l => l.trim() && !l.startsWith("#"))
          summary = firstLine?.slice(0, 100) || "Project documentation"
        } else if (found.path.endsWith("schema.prisma")) {
          const modelCount = (content.match(/^model\s+\w+/gm) || []).length
          summary = `Database schema with ${modelCount} models`
        } else {
          summary = `Configuration file`
        }

        summaries.push({ path: found.path, summary })
      }
    }
  }

  // Also find entry points
  const entryPoints = ["src/index.ts", "src/index.tsx", "src/main.ts", "src/main.tsx", "index.ts", "index.js"]
  for (const entry of entryPoints) {
    const found = blobFiles.find(f => f.path === entry)
    if (found) {
      summaries.push({ path: found.path, summary: "Application entry point" })
      break
    }
  }

  // Find app structure for Next.js
  const appDir = blobFiles.find(f => f.path.includes("app/page.tsx") || f.path.includes("app/page.js"))
  if (appDir) {
    summaries.push({ path: appDir.path, summary: "Next.js App Router home page" })
  }

  const pagesDir = blobFiles.find(f => f.path.includes("pages/index.tsx") || f.path.includes("pages/index.js"))
  if (pagesDir) {
    summaries.push({ path: pagesDir.path, summary: "Next.js Pages Router home page" })
  }

  return summaries
}

/**
 * Find relevant files for a specific task
 */
export async function findRelevantFiles(
  repoId: number,
  keywords: string[],
  tree: TreeItem[]
): Promise<Array<{ path: string; summary: string }>> {
  const relevant: Array<{ path: string; summary: string }> = []

  const blobFiles = tree.filter(t => t.type === "blob")

  // Match by file name
  for (const file of blobFiles) {
    const fileName = file.path.toLowerCase()
    for (const keyword of keywords) {
      if (fileName.includes(keyword.toLowerCase())) {
        relevant.push({
          path: file.path,
          summary: `Matches keyword: ${keyword}`
        })
        break
      }
    }

    // Stop at 10 files
    if (relevant.length >= 10) break
  }

  return relevant
}

/**
 * Get full repository context for code generation
 */
export async function getRepoContext(
  repo: LinkedRepo,
  options?: {
    keywords?: string[]
    includeExistingCode?: string[]
  }
): Promise<RepoContext> {
  // Fetch file tree
  const tree = await getGitLabFileTree(repo.id, { recursive: true })

  // Get package.json
  const packageJson = await getFileContent(repo.id, "package.json")

  // Detect tech stack
  const techStack = detectTechStack(packageJson)

  // Get key file summaries
  const keyFiles = await getKeyFileSummaries(repo.id, tree)

  // Find relevant files based on keywords
  let relevantFiles = keyFiles
  if (options?.keywords && options.keywords.length > 0) {
    const keywordFiles = await findRelevantFiles(repo.id, options.keywords, tree)
    relevantFiles = [...keyFiles, ...keywordFiles]
  }

  // Get existing code if requested
  let existingCode: string | undefined
  if (options?.includeExistingCode && options.includeExistingCode.length > 0) {
    const codeSnippets: string[] = []
    for (const filePath of options.includeExistingCode.slice(0, 5)) {
      const content = await getFileContent(repo.id, filePath)
      if (content) {
        codeSnippets.push(`// ${filePath}\n${content}`)
      }
    }
    if (codeSnippets.length > 0) {
      existingCode = codeSnippets.join("\n\n")
    }
  }

  return {
    projectName: repo.name,
    techStack,
    fileTree: tree.map(t => t.path),
    relevantFiles: relevantFiles.slice(0, 15), // Limit context size
    existingCode
  }
}

/**
 * Get minimal context for quick operations
 */
export async function getMinimalContext(repo: LinkedRepo): Promise<RepoContext> {
  const packageJson = await getFileContent(repo.id, "package.json")
  const techStack = detectTechStack(packageJson)

  return {
    projectName: repo.name,
    techStack,
    fileTree: [],
    relevantFiles: []
  }
}
