/**
 * Codebase Analyzer
 *
 * Scans and analyzes an entire codebase to extract:
 * - Project type and tech stack
 * - File structure and statistics
 * - Key files and entry points
 * - Dependencies
 * - API endpoints
 * - Components
 */

import { promises as fs } from "fs"
import path from "path"
import os from "os"

// ============================================================================
// Types
// ============================================================================

export interface TechStackInfo {
  runtime: string // node, python, rust, go, etc.
  framework?: string // nextjs, django, fastapi, etc.
  language: string // typescript, javascript, python, etc.
  packageManager?: string // npm, yarn, pnpm, pip, cargo
  database?: string[] // postgres, mongodb, sqlite, etc.
  ui?: string // react, vue, svelte, etc.
  styling?: string // tailwind, css-modules, styled-components
  testing?: string[] // jest, pytest, vitest
  deployment?: string // docker, vercel, aws
}

export interface KeyFile {
  path: string
  type: "config" | "entry" | "component" | "api" | "model" | "test" | "doc" | "script" | "style"
  summary?: string // AI-generated summary
  importance: "critical" | "high" | "medium" | "low"
  exports?: string[] // Exported functions/classes
  size: number
  lines: number
}

export interface Dependency {
  name: string
  version?: string
  type: "production" | "development" | "peer"
  category?: string // ui, testing, build, database, etc.
}

export interface APIEndpoint {
  path: string
  method: string
  file: string
  description?: string
}

export interface ComponentInfo {
  name: string
  file: string
  type: "page" | "component" | "layout" | "hook" | "util"
  props?: string[]
}

export interface DirectoryNode {
  name: string
  path: string
  type: "file" | "directory"
  size?: number
  children?: DirectoryNode[]
  extension?: string
  importance?: "critical" | "high" | "medium" | "low"
}

export interface CodebaseAnalysis {
  projectType: string
  techStack: TechStackInfo
  structure: DirectoryNode
  keyFiles: KeyFile[]
  dependencies: Dependency[]
  entryPoints: string[]
  apis: APIEndpoint[]
  components: ComponentInfo[]
  totalFiles: number
  totalLines: number
  totalSize: number
  languages: { [lang: string]: { files: number; lines: number } }
  analyzedAt: string
}

// ============================================================================
// Constants
// ============================================================================

const SKIP_DIRECTORIES = [
  "node_modules",
  ".git",
  ".next",
  ".cache",
  "__pycache__",
  ".pytest_cache",
  ".venv",
  "venv",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vercel",
  "target",
  "vendor",
]

const SKIP_FILES = [".DS_Store", "Thumbs.db", ".gitkeep", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"]

const CODE_EXTENSIONS: { [ext: string]: string } = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".kt": "kotlin",
  ".swift": "swift",
  ".rb": "ruby",
  ".php": "php",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".cs": "csharp",
  ".vue": "vue",
  ".svelte": "svelte",
}

const CONFIG_FILES = [
  "package.json",
  "tsconfig.json",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "vite.config.ts",
  "webpack.config.js",
  "tailwind.config.js",
  "tailwind.config.ts",
  "pyproject.toml",
  "requirements.txt",
  "Cargo.toml",
  "go.mod",
  "docker-compose.yml",
  "Dockerfile",
  ".env.example",
]

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Expand ~ to home directory
 */
function expandPath(p: string): string {
  if (!p) return p
  return p.replace(/^~/, os.homedir())
}

/**
 * Check if path should be skipped
 */
function shouldSkip(name: string, isDirectory: boolean): boolean {
  if (isDirectory) {
    return SKIP_DIRECTORIES.includes(name)
  }
  return SKIP_FILES.includes(name) || name.startsWith(".")
}

/**
 * Count lines in a file
 */
async function countLines(filePath: string): Promise<number> {
  try {
    const content = await fs.readFile(filePath, "utf-8")
    return content.split("\n").length
  } catch {
    return 0
  }
}

/**
 * Get file extension
 */
function getExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  return ext
}

/**
 * Determine file importance
 */
function getFileImportance(filePath: string, name: string): KeyFile["importance"] {
  // Critical: entry points and main config
  if (
    name === "package.json" ||
    name === "index.ts" ||
    name === "index.tsx" ||
    name === "main.py" ||
    name === "app.py" ||
    name === "main.rs" ||
    name === "main.go" ||
    filePath.includes("/app/page.") ||
    filePath.includes("/pages/index.")
  ) {
    return "critical"
  }

  // High: configs and important files
  if (
    CONFIG_FILES.includes(name) ||
    filePath.includes("/api/") ||
    filePath.includes("/routes/") ||
    filePath.includes("/models/") ||
    filePath.includes("/lib/")
  ) {
    return "high"
  }

  // Medium: components and hooks
  if (
    filePath.includes("/components/") ||
    filePath.includes("/hooks/") ||
    filePath.includes("/utils/") ||
    filePath.includes("/services/")
  ) {
    return "medium"
  }

  return "low"
}

/**
 * Determine file type
 */
function getFileType(filePath: string, name: string): KeyFile["type"] {
  if (CONFIG_FILES.includes(name) || name.endsWith(".config.js") || name.endsWith(".config.ts")) {
    return "config"
  }
  if (filePath.includes("/api/") || filePath.includes("/routes/")) {
    return "api"
  }
  if (filePath.includes("/components/") || filePath.includes("/ui/")) {
    return "component"
  }
  if (filePath.includes("/models/") || filePath.includes("/entities/") || filePath.includes("/schema")) {
    return "model"
  }
  if (name.includes(".test.") || name.includes(".spec.") || filePath.includes("/__tests__/")) {
    return "test"
  }
  if (name.endsWith(".md") || name.endsWith(".mdx") || name === "README") {
    return "doc"
  }
  if (name.endsWith(".css") || name.endsWith(".scss") || name.endsWith(".sass")) {
    return "style"
  }
  if (filePath.includes("/scripts/") || name.endsWith(".sh")) {
    return "script"
  }
  return "entry"
}

// ============================================================================
// Analyzer Functions
// ============================================================================

/**
 * Scan directory recursively
 */
async function scanDirectory(
  dirPath: string,
  basePath: string,
  maxDepth: number = 10,
  currentDepth: number = 0
): Promise<{
  tree: DirectoryNode
  files: { path: string; name: string; size: number; lines: number; extension: string }[]
}> {
  const name = path.basename(dirPath)
  const relativePath = path.relative(basePath, dirPath)
  const files: { path: string; name: string; size: number; lines: number; extension: string }[] = []

  const node: DirectoryNode = {
    name: name || path.basename(basePath),
    path: relativePath || ".",
    type: "directory",
    children: [],
  }

  if (currentDepth >= maxDepth) {
    return { tree: node, files }
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    // Sort: directories first, then files
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })

    for (const entry of entries) {
      if (shouldSkip(entry.name, entry.isDirectory())) {
        continue
      }

      const fullPath = path.join(dirPath, entry.name)
      const entryRelativePath = path.relative(basePath, fullPath)

      if (entry.isDirectory()) {
        const result = await scanDirectory(fullPath, basePath, maxDepth, currentDepth + 1)
        node.children!.push(result.tree)
        files.push(...result.files)
      } else {
        try {
          const stats = await fs.stat(fullPath)
          const extension = getExtension(entry.name)
          const lines = CODE_EXTENSIONS[extension] ? await countLines(fullPath) : 0

          node.children!.push({
            name: entry.name,
            path: entryRelativePath,
            type: "file",
            size: stats.size,
            extension,
            importance: getFileImportance(entryRelativePath, entry.name),
          })

          files.push({
            path: entryRelativePath,
            name: entry.name,
            size: stats.size,
            lines,
            extension,
          })
        } catch {
          // Skip files we can't stat
        }
      }
    }
  } catch (error) {
    console.error(`[analyzer] Error scanning ${dirPath}:`, error)
  }

  return { tree: node, files }
}

/**
 * Detect tech stack from package.json
 */
async function detectTechStackFromPackageJson(repoPath: string): Promise<Partial<TechStackInfo>> {
  const packageJsonPath = path.join(repoPath, "package.json")
  const stack: Partial<TechStackInfo> = {
    runtime: "node",
    language: "javascript",
  }

  try {
    const content = await fs.readFile(packageJsonPath, "utf-8")
    const pkg = JSON.parse(content)
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }

    // Detect TypeScript
    if (allDeps.typescript) {
      stack.language = "typescript"
    }

    // Detect framework
    if (allDeps.next) {
      stack.framework = "nextjs"
      stack.ui = "react"
    } else if (allDeps.nuxt) {
      stack.framework = "nuxt"
      stack.ui = "vue"
    } else if (allDeps.react) {
      stack.ui = "react"
      if (allDeps.vite) stack.framework = "vite"
    } else if (allDeps.vue) {
      stack.ui = "vue"
    } else if (allDeps.svelte) {
      stack.ui = "svelte"
      if (allDeps["@sveltejs/kit"]) stack.framework = "sveltekit"
    } else if (allDeps.express) {
      stack.framework = "express"
    } else if (allDeps.fastify) {
      stack.framework = "fastify"
    }

    // Detect styling
    if (allDeps.tailwindcss) {
      stack.styling = "tailwind"
    } else if (allDeps["styled-components"]) {
      stack.styling = "styled-components"
    } else if (allDeps["@emotion/react"]) {
      stack.styling = "emotion"
    }

    // Detect testing
    const testing: string[] = []
    if (allDeps.jest) testing.push("jest")
    if (allDeps.vitest) testing.push("vitest")
    if (allDeps.mocha) testing.push("mocha")
    if (allDeps["@playwright/test"]) testing.push("playwright")
    if (allDeps.cypress) testing.push("cypress")
    if (testing.length > 0) stack.testing = testing

    // Detect database
    const database: string[] = []
    if (allDeps.prisma || allDeps["@prisma/client"]) database.push("prisma")
    if (allDeps.mongoose) database.push("mongodb")
    if (allDeps.pg || allDeps.postgres) database.push("postgres")
    if (allDeps.mysql2) database.push("mysql")
    if (allDeps["better-sqlite3"] || allDeps.sqlite3) database.push("sqlite")
    if (allDeps.redis || allDeps.ioredis) database.push("redis")
    if (database.length > 0) stack.database = database

    // Detect package manager
    if (await fileExists(path.join(repoPath, "pnpm-lock.yaml"))) {
      stack.packageManager = "pnpm"
    } else if (await fileExists(path.join(repoPath, "yarn.lock"))) {
      stack.packageManager = "yarn"
    } else if (await fileExists(path.join(repoPath, "bun.lockb"))) {
      stack.packageManager = "bun"
    } else {
      stack.packageManager = "npm"
    }
  } catch {
    // No package.json or invalid JSON
  }

  return stack
}

/**
 * Check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Detect tech stack from various sources
 */
async function detectTechStack(repoPath: string): Promise<TechStackInfo> {
  // Start with defaults
  let stack: TechStackInfo = {
    runtime: "unknown",
    language: "unknown",
  }

  // Check for Node.js project
  if (await fileExists(path.join(repoPath, "package.json"))) {
    const nodeStack = await detectTechStackFromPackageJson(repoPath)
    stack = { ...stack, ...nodeStack }
  }

  // Check for Python project
  if (
    (await fileExists(path.join(repoPath, "requirements.txt"))) ||
    (await fileExists(path.join(repoPath, "pyproject.toml"))) ||
    (await fileExists(path.join(repoPath, "setup.py")))
  ) {
    stack.runtime = "python"
    stack.language = "python"
    stack.packageManager = "pip"

    // Try to detect framework
    try {
      const reqPath = path.join(repoPath, "requirements.txt")
      if (await fileExists(reqPath)) {
        const content = await fs.readFile(reqPath, "utf-8")
        if (content.includes("django")) stack.framework = "django"
        else if (content.includes("fastapi")) stack.framework = "fastapi"
        else if (content.includes("flask")) stack.framework = "flask"
      }
    } catch {
      // Ignore
    }
  }

  // Check for Rust project
  if (await fileExists(path.join(repoPath, "Cargo.toml"))) {
    stack.runtime = "rust"
    stack.language = "rust"
    stack.packageManager = "cargo"
  }

  // Check for Go project
  if (await fileExists(path.join(repoPath, "go.mod"))) {
    stack.runtime = "go"
    stack.language = "go"
    stack.packageManager = "go"
  }

  // Check for deployment
  if (await fileExists(path.join(repoPath, "Dockerfile"))) {
    stack.deployment = "docker"
  } else if (await fileExists(path.join(repoPath, "vercel.json"))) {
    stack.deployment = "vercel"
  } else if (await fileExists(path.join(repoPath, "netlify.toml"))) {
    stack.deployment = "netlify"
  }

  return stack
}

/**
 * Extract dependencies from package.json
 */
async function extractDependencies(repoPath: string): Promise<Dependency[]> {
  const dependencies: Dependency[] = []

  try {
    const packageJsonPath = path.join(repoPath, "package.json")
    const content = await fs.readFile(packageJsonPath, "utf-8")
    const pkg = JSON.parse(content)

    // Production dependencies
    for (const [name, version] of Object.entries(pkg.dependencies || {})) {
      dependencies.push({
        name,
        version: version as string,
        type: "production",
        category: categorizeDependency(name),
      })
    }

    // Dev dependencies
    for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
      dependencies.push({
        name,
        version: version as string,
        type: "development",
        category: categorizeDependency(name),
      })
    }

    // Peer dependencies
    for (const [name, version] of Object.entries(pkg.peerDependencies || {})) {
      dependencies.push({
        name,
        version: version as string,
        type: "peer",
        category: categorizeDependency(name),
      })
    }
  } catch {
    // No package.json
  }

  return dependencies
}

/**
 * Categorize a dependency
 */
function categorizeDependency(name: string): string {
  if (name.includes("test") || name.includes("jest") || name.includes("vitest")) return "testing"
  if (name.includes("eslint") || name.includes("prettier")) return "linting"
  if (name.includes("webpack") || name.includes("vite") || name.includes("rollup")) return "build"
  if (name.includes("react") || name.includes("vue") || name.includes("svelte")) return "ui"
  if (name.includes("tailwind") || name.includes("styled") || name.includes("css")) return "styling"
  if (name.includes("prisma") || name.includes("mongo") || name.includes("sql")) return "database"
  if (name.includes("auth") || name.includes("jwt")) return "auth"
  return "other"
}

/**
 * Detect API endpoints (Next.js app router style)
 */
async function detectAPIEndpoints(repoPath: string): Promise<APIEndpoint[]> {
  const endpoints: APIEndpoint[] = []
  const apiDir = path.join(repoPath, "src", "app", "api")

  try {
    await scanAPIDirectory(apiDir, "/api", endpoints)
  } catch {
    // Try pages/api for Next.js pages router
    try {
      const pagesApiDir = path.join(repoPath, "pages", "api")
      await scanAPIDirectory(pagesApiDir, "/api", endpoints)
    } catch {
      // No API routes found
    }
  }

  return endpoints
}

/**
 * Recursively scan API directory
 */
async function scanAPIDirectory(dirPath: string, basePath: string, endpoints: APIEndpoint[]): Promise<void> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        const segment = entry.name.startsWith("[") ? `:${entry.name.slice(1, -1)}` : entry.name
        await scanAPIDirectory(fullPath, `${basePath}/${segment}`, endpoints)
      } else if (entry.name === "route.ts" || entry.name === "route.js") {
        // Detect HTTP methods from file content
        try {
          const content = await fs.readFile(fullPath, "utf-8")
          const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"]
          for (const method of methods) {
            if (content.includes(`export async function ${method}`) || content.includes(`export function ${method}`)) {
              endpoints.push({
                path: basePath,
                method,
                file: fullPath,
              })
            }
          }
        } catch {
          // Couldn't read file
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
}

/**
 * Identify key files
 */
function identifyKeyFiles(
  files: { path: string; name: string; size: number; lines: number; extension: string }[]
): KeyFile[] {
  const keyFiles: KeyFile[] = []

  for (const file of files) {
    const importance = getFileImportance(file.path, file.name)

    // Only include critical and high importance files, plus configs
    if (importance === "critical" || importance === "high" || CONFIG_FILES.includes(file.name)) {
      keyFiles.push({
        path: file.path,
        type: getFileType(file.path, file.name),
        importance,
        size: file.size,
        lines: file.lines,
      })
    }
  }

  // Sort by importance
  const importanceOrder: Record<KeyFile["importance"], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }

  keyFiles.sort((a, b) => importanceOrder[a.importance] - importanceOrder[b.importance])

  return keyFiles
}

/**
 * Calculate language statistics
 */
function calculateLanguageStats(
  files: { path: string; name: string; size: number; lines: number; extension: string }[]
): { [lang: string]: { files: number; lines: number } } {
  const stats: { [lang: string]: { files: number; lines: number } } = {}

  for (const file of files) {
    const lang = CODE_EXTENSIONS[file.extension]
    if (lang) {
      if (!stats[lang]) {
        stats[lang] = { files: 0, lines: 0 }
      }
      stats[lang].files++
      stats[lang].lines += file.lines
    }
  }

  return stats
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Analyze a codebase
 */
export async function analyzeCodebase(repoPath: string): Promise<CodebaseAnalysis> {
  const expandedPath = expandPath(repoPath)

  console.log(`[analyzer] Starting analysis of: ${expandedPath}`)

  // Scan directory structure
  const { tree, files } = await scanDirectory(expandedPath, expandedPath)

  // Detect tech stack
  const techStack = await detectTechStack(expandedPath)

  // Extract dependencies
  const dependencies = await extractDependencies(expandedPath)

  // Detect API endpoints
  const apis = await detectAPIEndpoints(expandedPath)

  // Identify key files
  const keyFiles = identifyKeyFiles(files)

  // Calculate language stats
  const languages = calculateLanguageStats(files)

  // Find entry points
  const entryPoints = keyFiles.filter((f) => f.type === "entry" && f.importance === "critical").map((f) => f.path)

  // Calculate totals
  const totalFiles = files.length
  const totalLines = files.reduce((sum, f) => sum + f.lines, 0)
  const totalSize = files.reduce((sum, f) => sum + f.size, 0)

  // Determine project type
  let projectType = techStack.framework || techStack.runtime || "unknown"
  if (techStack.framework === "nextjs") projectType = "Next.js"
  else if (techStack.framework === "django") projectType = "Django"
  else if (techStack.framework === "fastapi") projectType = "FastAPI"
  else if (techStack.runtime === "rust") projectType = "Rust"
  else if (techStack.runtime === "go") projectType = "Go"

  console.log(`[analyzer] Analysis complete: ${totalFiles} files, ${totalLines} lines`)

  return {
    projectType,
    techStack,
    structure: tree,
    keyFiles,
    dependencies,
    entryPoints,
    apis,
    components: [], // Will be populated by summarizer
    totalFiles,
    totalLines,
    totalSize,
    languages,
    analyzedAt: new Date().toISOString(),
  }
}

/**
 * Quick analysis - just returns basic stats without deep scanning
 */
export async function quickAnalyzeCodebase(repoPath: string): Promise<{
  projectType: string
  techStack: TechStackInfo
  totalFiles: number
  hasPackageJson: boolean
}> {
  const expandedPath = expandPath(repoPath)

  const techStack = await detectTechStack(expandedPath)
  const hasPackageJson = await fileExists(path.join(expandedPath, "package.json"))

  // Quick file count
  let totalFiles = 0
  const countFiles = async (dir: string, depth: number = 0): Promise<void> => {
    if (depth > 5) return
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (shouldSkip(entry.name, entry.isDirectory())) continue
        if (entry.isDirectory()) {
          await countFiles(path.join(dir, entry.name), depth + 1)
        } else {
          totalFiles++
        }
      }
    } catch {
      // Ignore errors
    }
  }

  await countFiles(expandedPath)

  let projectType = techStack.framework || techStack.runtime || "unknown"
  if (techStack.framework === "nextjs") projectType = "Next.js"
  else if (techStack.framework === "django") projectType = "Django"

  return {
    projectType,
    techStack,
    totalFiles,
    hasPackageJson,
  }
}
