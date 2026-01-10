/**
 * Codebase Analysis Module
 *
 * Analyzes existing codebases to understand structure, extract todos,
 * parse commit history, and generate intelligent recommendations.
 * Works with any language (Rust, TypeScript, Python, Go, etc.)
 */

import * as fs from "fs/promises"
import * as path from "path"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

// ============ Types ============

export interface FileInfo {
  path: string
  relativePath: string
  name: string
  extension: string
  size: number
  language: string
}

export interface FolderInfo {
  path: string
  relativePath: string
  name: string
  fileCount: number
  subfolderCount: number
}

export interface CodebaseStructure {
  rootPath: string
  totalFiles: number
  totalFolders: number
  files: FileInfo[]
  folders: FolderInfo[]
  languageBreakdown: Record<string, number>
  topLevelFolders: string[]
  hasPackageJson: boolean
  hasCargoToml: boolean
  hasPyprojectToml: boolean
  hasGoMod: boolean
  hasGitignore: boolean
  hasReadme: boolean
  detectedFrameworks: string[]
}

export interface TodoComment {
  type: "TODO" | "FIXME" | "HACK" | "NOTE" | "XXX" | "BUG"
  content: string
  filePath: string
  lineNumber: number
  context: string // Surrounding lines for context
  priority: "low" | "medium" | "high"
}

export interface CommitInfo {
  hash: string
  shortHash: string
  author: string
  date: string
  message: string
  filesChanged: number
  insertions: number
  deletions: number
}

export interface CommitHistory {
  totalCommits: number
  recentCommits: CommitInfo[]
  contributors: { name: string; commits: number }[]
  activitySummary: string
  lastCommitDate: string | null
  primaryBranch: string
}

export interface CodebaseAnalysis {
  structure: CodebaseStructure
  todos: TodoComment[]
  commitHistory: CommitHistory | null
  analyzedAt: string
  analysisVersion: string
}

export interface ProjectDocumentation {
  summary: string
  purpose: string
  architecture: string
  techStack: string[]
  keyFeatures: string[]
  entryPoints: string[]
  mainModules: { name: string; purpose: string; files: string[] }[]
  dependencies: string[]
  developmentNotes: string[]
}

export interface RecommendedPacket {
  id: string
  title: string
  description: string
  type: "feature" | "fix" | "refactor" | "docs" | "test" | "chore"
  priority: "low" | "medium" | "high" | "critical"
  estimatedEffort: "small" | "medium" | "large"
  reasoning: string
  affectedFiles: string[]
  tasks: string[]
}

// ============ Language Detection ============

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  // JavaScript/TypeScript
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",

  // Rust
  ".rs": "Rust",

  // Python
  ".py": "Python",
  ".pyw": "Python",
  ".pyi": "Python",

  // Go
  ".go": "Go",

  // Ruby
  ".rb": "Ruby",
  ".erb": "Ruby",

  // Java/Kotlin
  ".java": "Java",
  ".kt": "Kotlin",
  ".kts": "Kotlin",

  // C/C++
  ".c": "C",
  ".h": "C",
  ".cpp": "C++",
  ".hpp": "C++",
  ".cc": "C++",
  ".cxx": "C++",

  // C#
  ".cs": "C#",

  // Swift
  ".swift": "Swift",

  // PHP
  ".php": "PHP",

  // Shell
  ".sh": "Shell",
  ".bash": "Shell",
  ".zsh": "Shell",

  // Config/Data
  ".json": "JSON",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".toml": "TOML",
  ".xml": "XML",

  // Markup
  ".html": "HTML",
  ".htm": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".sass": "SASS",
  ".less": "LESS",

  // Documentation
  ".md": "Markdown",
  ".mdx": "MDX",
  ".rst": "reStructuredText",

  // SQL
  ".sql": "SQL",

  // Other
  ".lua": "Lua",
  ".vim": "Vim Script",
  ".el": "Emacs Lisp",
  ".clj": "Clojure",
  ".ex": "Elixir",
  ".exs": "Elixir",
  ".erl": "Erlang",
  ".hs": "Haskell",
  ".scala": "Scala",
  ".dart": "Dart",
  ".r": "R",
  ".R": "R",
  ".jl": "Julia",
  ".v": "V",
  ".zig": "Zig",
  ".nim": "Nim",
  ".cr": "Crystal",
  ".ml": "OCaml",
  ".fs": "F#",
  ".fsx": "F#"
}

// Folders to ignore during scanning
const IGNORE_FOLDERS = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "target",
  "build",
  "dist",
  "out",
  ".next",
  ".nuxt",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  "venv",
  ".venv",
  "env",
  ".env",
  "vendor",
  "deps",
  "_deps",
  ".cargo",
  "pkg",
  "bin",
  "obj",
  ".idea",
  ".vscode",
  ".vs",
  "coverage",
  ".nyc_output",
  ".cache",
  ".parcel-cache",
  ".turbo",
  ".vercel",
  ".claudia"
])

// Files to ignore
const IGNORE_FILES = new Set([
  ".DS_Store",
  "Thumbs.db",
  ".gitignore",
  ".gitattributes",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "Cargo.lock",
  "poetry.lock",
  "Gemfile.lock",
  "go.sum"
])

function getLanguage(extension: string): string {
  return EXTENSION_TO_LANGUAGE[extension.toLowerCase()] || "Unknown"
}

function detectFrameworks(files: FileInfo[]): string[] {
  const frameworks: string[] = []
  const fileNames = new Set(files.map(f => f.name.toLowerCase()))
  const hasFile = (name: string) => fileNames.has(name.toLowerCase())

  // JavaScript/TypeScript frameworks
  if (hasFile("next.config.js") || hasFile("next.config.mjs") || hasFile("next.config.ts")) {
    frameworks.push("Next.js")
  }
  if (hasFile("nuxt.config.js") || hasFile("nuxt.config.ts")) {
    frameworks.push("Nuxt.js")
  }
  if (hasFile("svelte.config.js")) {
    frameworks.push("SvelteKit")
  }
  if (hasFile("astro.config.mjs") || hasFile("astro.config.js")) {
    frameworks.push("Astro")
  }
  if (hasFile("vite.config.js") || hasFile("vite.config.ts")) {
    frameworks.push("Vite")
  }
  if (hasFile("angular.json")) {
    frameworks.push("Angular")
  }
  if (hasFile("remix.config.js")) {
    frameworks.push("Remix")
  }
  if (hasFile("gatsby-config.js")) {
    frameworks.push("Gatsby")
  }
  if (hasFile("electron-builder.json") || hasFile("electron-builder.yml")) {
    frameworks.push("Electron")
  }
  if (hasFile("tauri.conf.json")) {
    frameworks.push("Tauri")
  }

  // Python frameworks
  if (files.some(f => f.name === "manage.py" || f.name === "settings.py")) {
    frameworks.push("Django")
  }
  if (files.some(f => f.name === "app.py" && f.size < 50000)) {
    frameworks.push("Flask (possible)")
  }
  if (hasFile("pyproject.toml")) {
    frameworks.push("Python (pyproject)")
  }

  // Rust
  if (hasFile("Cargo.toml")) {
    frameworks.push("Rust (Cargo)")
  }

  // Go
  if (hasFile("go.mod")) {
    frameworks.push("Go Modules")
  }

  // Testing frameworks
  if (hasFile("jest.config.js") || hasFile("jest.config.ts")) {
    frameworks.push("Jest")
  }
  if (hasFile("vitest.config.js") || hasFile("vitest.config.ts")) {
    frameworks.push("Vitest")
  }
  if (hasFile("playwright.config.ts") || hasFile("playwright.config.js")) {
    frameworks.push("Playwright")
  }
  if (hasFile("cypress.config.js") || hasFile("cypress.config.ts")) {
    frameworks.push("Cypress")
  }
  if (hasFile("pytest.ini") || hasFile("conftest.py")) {
    frameworks.push("Pytest")
  }

  // Build tools
  if (hasFile("webpack.config.js")) {
    frameworks.push("Webpack")
  }
  if (hasFile("rollup.config.js")) {
    frameworks.push("Rollup")
  }
  if (hasFile("esbuild.config.js") || hasFile("esbuild.config.mjs")) {
    frameworks.push("esbuild")
  }

  // Containerization
  if (hasFile("Dockerfile") || hasFile("dockerfile")) {
    frameworks.push("Docker")
  }
  if (hasFile("docker-compose.yml") || hasFile("docker-compose.yaml")) {
    frameworks.push("Docker Compose")
  }

  return frameworks
}

// ============ Core Analysis Functions ============

/**
 * Scan and analyze the structure of a codebase
 */
export async function analyzeCodebase(repoPath: string): Promise<CodebaseStructure> {
  const files: FileInfo[] = []
  const folders: FolderInfo[] = []
  const languageBreakdown: Record<string, number> = {}
  const topLevelFolders: string[] = []

  async function scanDirectory(dirPath: string, isTopLevel = false): Promise<{ fileCount: number; subfolderCount: number }> {
    let fileCount = 0
    let subfolderCount = 0

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        const relativePath = path.relative(repoPath, fullPath)

        if (entry.isDirectory()) {
          if (IGNORE_FOLDERS.has(entry.name)) {
            continue
          }

          if (isTopLevel) {
            topLevelFolders.push(entry.name)
          }

          const subStats = await scanDirectory(fullPath, false)

          folders.push({
            path: fullPath,
            relativePath,
            name: entry.name,
            fileCount: subStats.fileCount,
            subfolderCount: subStats.subfolderCount
          })

          subfolderCount++
          fileCount += subStats.fileCount
        } else if (entry.isFile()) {
          if (IGNORE_FILES.has(entry.name)) {
            continue
          }

          const extension = path.extname(entry.name)
          const language = getLanguage(extension)

          try {
            const stats = await fs.stat(fullPath)

            files.push({
              path: fullPath,
              relativePath,
              name: entry.name,
              extension,
              size: stats.size,
              language
            })

            languageBreakdown[language] = (languageBreakdown[language] || 0) + 1
            fileCount++
          } catch {
            // Skip files we can't stat
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error)
    }

    return { fileCount, subfolderCount }
  }

  await scanDirectory(repoPath, true)

  // Check for common config files
  const fileNames = new Set(files.map(f => f.name.toLowerCase()))

  return {
    rootPath: repoPath,
    totalFiles: files.length,
    totalFolders: folders.length,
    files,
    folders,
    languageBreakdown,
    topLevelFolders,
    hasPackageJson: fileNames.has("package.json"),
    hasCargoToml: fileNames.has("cargo.toml"),
    hasPyprojectToml: fileNames.has("pyproject.toml"),
    hasGoMod: fileNames.has("go.mod"),
    hasGitignore: fileNames.has(".gitignore"),
    hasReadme: fileNames.has("readme.md") || fileNames.has("readme") || fileNames.has("readme.txt"),
    detectedFrameworks: detectFrameworks(files)
  }
}

/**
 * Extract TODO, FIXME, HACK, etc. comments from the codebase
 */
export async function extractTodos(repoPath: string): Promise<TodoComment[]> {
  const todos: TodoComment[] = []

  // Patterns for different comment styles
  // Note: Using [\s\S] instead of . with 's' flag for broader compatibility
  const patterns = [
    /\/\/\s*(TODO|FIXME|HACK|NOTE|XXX|BUG)[\s:]*(.+)/gi,  // Single-line //
    /\/\*\s*(TODO|FIXME|HACK|NOTE|XXX|BUG)[\s:]*([\s\S]+?)\*\//gi,  // Block /* */
    /#\s*(TODO|FIXME|HACK|NOTE|XXX|BUG)[\s:]*(.+)/gi,  // Hash #
    /<!--\s*(TODO|FIXME|HACK|NOTE|XXX|BUG)[\s:]*([\s\S]+?)-->/gi,  // HTML <!--
    /"""\s*(TODO|FIXME|HACK|NOTE|XXX|BUG)[\s:]*(.+)"""/gi,  // Python docstring
  ]

  // File extensions to scan
  const codeExtensions = new Set([
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    ".rs", ".py", ".go", ".rb", ".java", ".kt",
    ".c", ".h", ".cpp", ".hpp", ".cs", ".swift",
    ".php", ".lua", ".ex", ".exs", ".clj", ".scala",
    ".dart", ".vue", ".svelte", ".astro",
    ".html", ".css", ".scss", ".sass", ".less"
  ])

  async function scanFile(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase()
    if (!codeExtensions.has(ext)) return

    try {
      const content = await fs.readFile(filePath, "utf-8")
      const lines = content.split("\n")

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        for (const pattern of patterns) {
          pattern.lastIndex = 0 // Reset regex state
          let match

          while ((match = pattern.exec(line)) !== null) {
            const type = match[1].toUpperCase() as TodoComment["type"]
            const todoContent = match[2].trim()

            // Determine priority based on type and content
            let priority: TodoComment["priority"] = "medium"
            if (type === "FIXME" || type === "BUG") {
              priority = "high"
            } else if (type === "HACK" || type === "XXX") {
              priority = "high"
            } else if (type === "NOTE") {
              priority = "low"
            }

            // Check for priority keywords in content
            const contentLower = todoContent.toLowerCase()
            if (contentLower.includes("urgent") || contentLower.includes("critical") || contentLower.includes("asap")) {
              priority = "high"
            } else if (contentLower.includes("later") || contentLower.includes("someday") || contentLower.includes("nice to have")) {
              priority = "low"
            }

            // Get context (surrounding lines)
            const contextStart = Math.max(0, i - 2)
            const contextEnd = Math.min(lines.length, i + 3)
            const context = lines.slice(contextStart, contextEnd).join("\n")

            todos.push({
              type,
              content: todoContent,
              filePath: path.relative(repoPath, filePath),
              lineNumber: i + 1,
              context,
              priority
            })
          }
        }
      }
    } catch {
      // Skip files we can't read
    }
  }

  async function scanDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)

        if (entry.isDirectory()) {
          if (!IGNORE_FOLDERS.has(entry.name)) {
            await scanDirectory(fullPath)
          }
        } else if (entry.isFile()) {
          await scanFile(fullPath)
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  await scanDirectory(repoPath)

  // Sort by priority (high first) then by file path
  todos.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }
    return a.filePath.localeCompare(b.filePath)
  })

  return todos
}

/**
 * Analyze git commit history
 */
export async function analyzeCommitHistory(repoPath: string, limit = 50): Promise<CommitHistory | null> {
  try {
    // Check if this is a git repository
    await execAsync("git rev-parse --git-dir", { cwd: repoPath })
  } catch {
    return null // Not a git repository
  }

  try {
    // Get recent commits with stats
    const { stdout: logOutput } = await execAsync(
      `git log --pretty=format:"%H|%h|%an|%ai|%s" --shortstat -n ${limit}`,
      { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 }
    )

    const commits: CommitInfo[] = []
    const lines = logOutput.split("\n").filter(l => l.trim())
    let currentCommit: Partial<CommitInfo> | null = null

    for (const line of lines) {
      if (line.includes("|")) {
        // Commit header line
        if (currentCommit && currentCommit.hash) {
          commits.push(currentCommit as CommitInfo)
        }

        const [hash, shortHash, author, date, ...messageParts] = line.split("|")
        currentCommit = {
          hash,
          shortHash,
          author,
          date,
          message: messageParts.join("|"),
          filesChanged: 0,
          insertions: 0,
          deletions: 0
        }
      } else if (currentCommit && (line.includes("file") || line.includes("insertion") || line.includes("deletion"))) {
        // Stats line
        const filesMatch = line.match(/(\d+) files? changed/)
        const insertionsMatch = line.match(/(\d+) insertions?\(\+\)/)
        const deletionsMatch = line.match(/(\d+) deletions?\(-\)/)

        if (filesMatch) currentCommit.filesChanged = parseInt(filesMatch[1])
        if (insertionsMatch) currentCommit.insertions = parseInt(insertionsMatch[1])
        if (deletionsMatch) currentCommit.deletions = parseInt(deletionsMatch[1])
      }
    }

    if (currentCommit && currentCommit.hash) {
      commits.push(currentCommit as CommitInfo)
    }

    // Get total commit count
    const { stdout: countOutput } = await execAsync("git rev-list --count HEAD", { cwd: repoPath })
    const totalCommits = parseInt(countOutput.trim()) || commits.length

    // Get contributors
    const { stdout: contributorOutput } = await execAsync(
      `git shortlog -sn --all`,
      { cwd: repoPath }
    )

    const contributors: { name: string; commits: number }[] = []
    for (const line of contributorOutput.split("\n")) {
      const match = line.trim().match(/^\s*(\d+)\s+(.+)$/)
      if (match) {
        contributors.push({
          commits: parseInt(match[1]),
          name: match[2]
        })
      }
    }

    // Get primary branch
    let primaryBranch = "main"
    try {
      const { stdout: branchOutput } = await execAsync(
        `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || git branch -r --list 'origin/main' 'origin/master' | head -1`,
        { cwd: repoPath }
      )
      primaryBranch = branchOutput.trim().replace("refs/remotes/origin/", "").replace("origin/", "") || "main"
    } catch {
      primaryBranch = "main"
    }

    // Generate activity summary
    const lastWeek = commits.filter(c => {
      const commitDate = new Date(c.date)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return commitDate > weekAgo
    })

    const lastMonth = commits.filter(c => {
      const commitDate = new Date(c.date)
      const monthAgo = new Date()
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return commitDate > monthAgo
    })

    let activitySummary = ""
    if (lastWeek.length > 0) {
      activitySummary = `Active project with ${lastWeek.length} commits in the last week`
    } else if (lastMonth.length > 0) {
      activitySummary = `Moderately active with ${lastMonth.length} commits in the last month`
    } else if (commits.length > 0) {
      activitySummary = `Low activity - last commit was on ${commits[0].date.split(" ")[0]}`
    } else {
      activitySummary = "No commit history found"
    }

    return {
      totalCommits,
      recentCommits: commits,
      contributors,
      activitySummary,
      lastCommitDate: commits[0]?.date || null,
      primaryBranch
    }
  } catch (error) {
    console.error("Error analyzing commit history:", error)
    return null
  }
}

/**
 * Generate comprehensive project documentation using LLM
 */
export async function generateProjectDocumentation(
  analysis: CodebaseAnalysis,
  llmClient: (systemPrompt: string, userPrompt: string) => Promise<{ content: string; error?: string }>
): Promise<ProjectDocumentation | null> {
  const systemPrompt = `You are an expert software architect analyzing a codebase.
Your job is to generate clear, accurate documentation about the project.
Base your analysis ONLY on the provided file structure and metadata.
Be specific and avoid generic descriptions.

Return ONLY valid JSON matching the required schema. No markdown, no explanation.`

  // Prepare a summary of the codebase for the LLM
  const topFiles = analysis.structure.files
    .filter(f => f.language !== "Unknown" && !f.name.startsWith("."))
    .slice(0, 100)
    .map(f => `${f.relativePath} (${f.language})`)

  const userPrompt = `Analyze this codebase and generate documentation:

PROJECT STRUCTURE:
- Root: ${analysis.structure.rootPath}
- Total Files: ${analysis.structure.totalFiles}
- Total Folders: ${analysis.structure.totalFolders}
- Top-level folders: ${analysis.structure.topLevelFolders.join(", ")}

LANGUAGES:
${Object.entries(analysis.structure.languageBreakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => `- ${lang}: ${count} files`)
    .join("\n")}

DETECTED FRAMEWORKS:
${analysis.structure.detectedFrameworks.join(", ") || "None detected"}

CONFIG FILES:
- package.json: ${analysis.structure.hasPackageJson}
- Cargo.toml: ${analysis.structure.hasCargoToml}
- pyproject.toml: ${analysis.structure.hasPyprojectToml}
- go.mod: ${analysis.structure.hasGoMod}
- README: ${analysis.structure.hasReadme}

KEY FILES (sample):
${topFiles.join("\n")}

TODO COMMENTS FOUND: ${analysis.todos.length}
${analysis.todos.slice(0, 10).map(t => `- [${t.type}] ${t.content} (${t.filePath}:${t.lineNumber})`).join("\n")}

${analysis.commitHistory ? `
COMMIT HISTORY:
- Total commits: ${analysis.commitHistory.totalCommits}
- Activity: ${analysis.commitHistory.activitySummary}
- Contributors: ${analysis.commitHistory.contributors.slice(0, 5).map(c => `${c.name} (${c.commits} commits)`).join(", ")}
- Recent work: ${analysis.commitHistory.recentCommits.slice(0, 5).map(c => c.message).join("; ")}
` : "No git history available"}

Generate documentation in this exact JSON format:
{
  "summary": "2-3 sentence summary of what this project is",
  "purpose": "The main purpose and problem this project solves",
  "architecture": "Brief description of the project architecture",
  "techStack": ["List", "of", "technologies"],
  "keyFeatures": ["Feature 1", "Feature 2"],
  "entryPoints": ["main.ts", "index.js", "etc"],
  "mainModules": [
    {
      "name": "Module name",
      "purpose": "What this module does",
      "files": ["file1.ts", "file2.ts"]
    }
  ],
  "dependencies": ["Major dependency 1", "Major dependency 2"],
  "developmentNotes": ["Note about development", "Another note"]
}

Return ONLY the JSON.`

  try {
    const response = await llmClient(systemPrompt, userPrompt)

    if (response.error) {
      console.error("LLM error generating documentation:", response.error)
      return null
    }

    // Parse the response
    let jsonStr = response.content.trim()
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }

    const parsed = JSON.parse(jsonStr)

    return {
      summary: parsed.summary || "Project summary not available",
      purpose: parsed.purpose || "Purpose not determined",
      architecture: parsed.architecture || "Architecture not analyzed",
      techStack: parsed.techStack || [],
      keyFeatures: parsed.keyFeatures || [],
      entryPoints: parsed.entryPoints || [],
      mainModules: parsed.mainModules || [],
      dependencies: parsed.dependencies || [],
      developmentNotes: parsed.developmentNotes || []
    }
  } catch (error) {
    console.error("Error generating documentation:", error)
    return null
  }
}

/**
 * Generate recommended work packets based on codebase analysis
 */
export async function recommendPackets(
  analysis: CodebaseAnalysis,
  documentation: ProjectDocumentation | null,
  llmClient: (systemPrompt: string, userPrompt: string) => Promise<{ content: string; error?: string }>
): Promise<RecommendedPacket[]> {
  const systemPrompt = `You are an expert software project manager and architect.
Based on a codebase analysis, you generate actionable work packets (tasks/tickets).
Focus on:
1. Addressing TODO/FIXME comments
2. Improving code quality and maintainability
3. Adding missing tests
4. Improving documentation
5. Addressing technical debt
6. Security improvements

Each packet should be specific, actionable, and have clear acceptance criteria implied.
Return ONLY valid JSON array. No markdown, no explanation.`

  // Group TODOs by file for context
  const todosByFile: Record<string, TodoComment[]> = {}
  for (const todo of analysis.todos) {
    if (!todosByFile[todo.filePath]) {
      todosByFile[todo.filePath] = []
    }
    todosByFile[todo.filePath].push(todo)
  }

  const userPrompt = `Analyze this codebase and recommend work packets:

${documentation ? `
PROJECT SUMMARY:
${documentation.summary}

PURPOSE:
${documentation.purpose}

TECH STACK: ${documentation.techStack.join(", ")}
` : ""}

CODEBASE STATS:
- ${analysis.structure.totalFiles} files across ${analysis.structure.totalFolders} folders
- Languages: ${Object.entries(analysis.structure.languageBreakdown).map(([l, c]) => `${l}(${c})`).join(", ")}
- Frameworks: ${analysis.structure.detectedFrameworks.join(", ") || "None detected"}

TODO COMMENTS (${analysis.todos.length} total):
${Object.entries(todosByFile).slice(0, 10).map(([file, todos]) =>
    `${file}:\n${todos.map(t => `  - [${t.type}] ${t.content}`).join("\n")}`
  ).join("\n\n")}

${analysis.commitHistory ? `
RECENT ACTIVITY:
${analysis.commitHistory.activitySummary}
Recent commits:
${analysis.commitHistory.recentCommits.slice(0, 5).map(c => `- ${c.message}`).join("\n")}
` : ""}

Generate 5-10 recommended work packets. Return as JSON array:
[
  {
    "id": "unique-id",
    "title": "Short descriptive title",
    "description": "Detailed description of what needs to be done",
    "type": "feature|fix|refactor|docs|test|chore",
    "priority": "low|medium|high|critical",
    "estimatedEffort": "small|medium|large",
    "reasoning": "Why this packet is recommended",
    "affectedFiles": ["file1.ts", "file2.ts"],
    "tasks": ["Specific task 1", "Specific task 2"]
  }
]

Return ONLY the JSON array.`

  try {
    const response = await llmClient(systemPrompt, userPrompt)

    if (response.error) {
      console.error("LLM error generating packets:", response.error)
      return generateFallbackPackets(analysis)
    }

    let jsonStr = response.content.trim()
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }

    const parsed = JSON.parse(jsonStr)

    if (!Array.isArray(parsed)) {
      return generateFallbackPackets(analysis)
    }

    return parsed.map((p: Partial<RecommendedPacket>, index: number) => ({
      id: p.id || `packet-${Date.now()}-${index}`,
      title: p.title || "Untitled packet",
      description: p.description || "",
      type: p.type || "chore",
      priority: p.priority || "medium",
      estimatedEffort: p.estimatedEffort || "medium",
      reasoning: p.reasoning || "",
      affectedFiles: p.affectedFiles || [],
      tasks: p.tasks || []
    }))
  } catch (error) {
    console.error("Error generating packets:", error)
    return generateFallbackPackets(analysis)
  }
}

/**
 * Generate basic packets from TODOs when LLM fails
 */
function generateFallbackPackets(analysis: CodebaseAnalysis): RecommendedPacket[] {
  const packets: RecommendedPacket[] = []

  // Group TODOs by type
  const todosByType: Record<string, TodoComment[]> = {}
  for (const todo of analysis.todos) {
    if (!todosByType[todo.type]) {
      todosByType[todo.type] = []
    }
    todosByType[todo.type].push(todo)
  }

  // Create packets for FIXME items (high priority bugs)
  const fixmes = todosByType["FIXME"] || []
  if (fixmes.length > 0) {
    packets.push({
      id: `fixme-${Date.now()}`,
      title: `Address ${fixmes.length} FIXME comments`,
      description: "Fix issues marked with FIXME comments in the codebase",
      type: "fix",
      priority: "high",
      estimatedEffort: fixmes.length > 5 ? "large" : "medium",
      reasoning: "FIXME comments indicate known bugs or issues that need attention",
      affectedFiles: [...new Set(fixmes.map(f => f.filePath))],
      tasks: fixmes.slice(0, 10).map(f => `Fix: ${f.content} (${f.filePath}:${f.lineNumber})`)
    })
  }

  // Create packets for HACK items
  const hacks = todosByType["HACK"] || []
  if (hacks.length > 0) {
    packets.push({
      id: `hack-${Date.now()}`,
      title: `Refactor ${hacks.length} HACK workarounds`,
      description: "Replace hacky solutions with proper implementations",
      type: "refactor",
      priority: "medium",
      estimatedEffort: hacks.length > 3 ? "large" : "medium",
      reasoning: "HACK comments indicate technical debt that should be addressed",
      affectedFiles: [...new Set(hacks.map(h => h.filePath))],
      tasks: hacks.slice(0, 10).map(h => `Refactor: ${h.content} (${h.filePath}:${h.lineNumber})`)
    })
  }

  // Create packets for TODO items (grouped by file if many)
  const todos = todosByType["TODO"] || []
  if (todos.length > 0) {
    // Group by file
    const byFile: Record<string, TodoComment[]> = {}
    for (const todo of todos) {
      if (!byFile[todo.filePath]) {
        byFile[todo.filePath] = []
      }
      byFile[todo.filePath].push(todo)
    }

    // Create a packet for files with multiple TODOs
    for (const [file, fileTodos] of Object.entries(byFile)) {
      if (fileTodos.length >= 3 || packets.length < 3) {
        packets.push({
          id: `todo-${Date.now()}-${file.replace(/[^a-z0-9]/gi, "-")}`,
          title: `Complete ${fileTodos.length} TODOs in ${path.basename(file)}`,
          description: `Address TODO comments in ${file}`,
          type: "feature",
          priority: "medium",
          estimatedEffort: fileTodos.length > 5 ? "medium" : "small",
          reasoning: "TODO comments indicate planned work that was deferred",
          affectedFiles: [file],
          tasks: fileTodos.map(t => t.content)
        })
      }
    }
  }

  // Add documentation packet if no README
  if (!analysis.structure.hasReadme) {
    packets.push({
      id: `docs-${Date.now()}`,
      title: "Add project documentation",
      description: "Create README.md and basic documentation for the project",
      type: "docs",
      priority: "medium",
      estimatedEffort: "small",
      reasoning: "Project lacks a README file which is essential for onboarding",
      affectedFiles: ["README.md"],
      tasks: [
        "Create README.md with project overview",
        "Add installation instructions",
        "Document usage examples",
        "List dependencies and requirements"
      ]
    })
  }

  return packets.slice(0, 10) // Limit to 10 packets
}

/**
 * Perform a complete codebase analysis
 */
export async function performFullAnalysis(repoPath: string): Promise<CodebaseAnalysis> {
  const [structure, todos, commitHistory] = await Promise.all([
    analyzeCodebase(repoPath),
    extractTodos(repoPath),
    analyzeCommitHistory(repoPath)
  ])

  return {
    structure,
    todos,
    commitHistory,
    analyzedAt: new Date().toISOString(),
    analysisVersion: "1.0.0"
  }
}
