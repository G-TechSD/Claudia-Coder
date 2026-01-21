/**
 * Context Generator
 *
 * Generates CODEBASE.md - a comprehensive markdown document
 * that provides context about a codebase for AI agents.
 */

import type { CodebaseAnalysis, KeyFile, TechStackInfo, APIEndpoint, Dependency } from "./analyzer"
import type { FileSummary } from "./summarizer"

// ============================================================================
// Types
// ============================================================================

export interface CodebaseContextOptions {
  projectName?: string
  projectDescription?: string
  includeFileTree?: boolean
  includeDependencies?: boolean
  includeAPIs?: boolean
  maxTreeDepth?: number
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format file size
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Format number with commas
 */
function formatNumber(n: number): string {
  return n.toLocaleString()
}

/**
 * Get importance badge
 */
function importanceBadge(importance: KeyFile["importance"]): string {
  switch (importance) {
    case "critical":
      return "🔴"
    case "high":
      return "🟠"
    case "medium":
      return "🟡"
    case "low":
      return "⚪"
  }
}

/**
 * Get file type icon
 */
function fileTypeIcon(type: KeyFile["type"]): string {
  switch (type) {
    case "config":
      return "⚙️"
    case "entry":
      return "🚀"
    case "component":
      return "🧩"
    case "api":
      return "🔌"
    case "model":
      return "📊"
    case "test":
      return "🧪"
    case "doc":
      return "📄"
    case "script":
      return "📜"
    case "style":
      return "🎨"
    default:
      return "📁"
  }
}

/**
 * Generate tech stack section
 */
function generateTechStackSection(techStack: TechStackInfo): string {
  const lines: string[] = []

  lines.push("## Tech Stack\n")

  lines.push("| Category | Technology |")
  lines.push("|----------|------------|")

  if (techStack.runtime) lines.push(`| Runtime | ${techStack.runtime} |`)
  if (techStack.language) lines.push(`| Language | ${techStack.language} |`)
  if (techStack.framework) lines.push(`| Framework | ${techStack.framework} |`)
  if (techStack.ui) lines.push(`| UI Library | ${techStack.ui} |`)
  if (techStack.styling) lines.push(`| Styling | ${techStack.styling} |`)
  if (techStack.packageManager) lines.push(`| Package Manager | ${techStack.packageManager} |`)
  if (techStack.database?.length) lines.push(`| Database | ${techStack.database.join(", ")} |`)
  if (techStack.testing?.length) lines.push(`| Testing | ${techStack.testing.join(", ")} |`)
  if (techStack.deployment) lines.push(`| Deployment | ${techStack.deployment} |`)

  return lines.join("\n")
}

/**
 * Generate statistics section
 */
function generateStatsSection(analysis: CodebaseAnalysis): string {
  const lines: string[] = []

  lines.push("## Statistics\n")

  lines.push("| Metric | Value |")
  lines.push("|--------|-------|")
  lines.push(`| Total Files | ${formatNumber(analysis.totalFiles)} |`)
  lines.push(`| Total Lines | ${formatNumber(analysis.totalLines)} |`)
  lines.push(`| Total Size | ${formatSize(analysis.totalSize)} |`)
  lines.push(`| Key Files | ${analysis.keyFiles.length} |`)
  lines.push(`| API Endpoints | ${analysis.apis.length} |`)
  lines.push(`| Dependencies | ${analysis.dependencies.length} |`)

  // Language breakdown
  if (Object.keys(analysis.languages).length > 0) {
    lines.push("\n### Languages\n")
    lines.push("| Language | Files | Lines |")
    lines.push("|----------|-------|-------|")

    const sorted = Object.entries(analysis.languages).sort((a, b) => b[1].lines - a[1].lines)

    for (const [lang, stats] of sorted) {
      lines.push(`| ${lang} | ${stats.files} | ${formatNumber(stats.lines)} |`)
    }
  }

  return lines.join("\n")
}

/**
 * Generate key files section
 */
function generateKeyFilesSection(keyFiles: KeyFile[], summaries?: FileSummary[]): string {
  const lines: string[] = []
  const summaryMap = new Map(summaries?.map((s) => [s.path, s]) || [])

  lines.push("## Key Files\n")
  lines.push("Important files in the codebase, ordered by importance.\n")

  // Group by importance
  const critical = keyFiles.filter((f) => f.importance === "critical")
  const high = keyFiles.filter((f) => f.importance === "high")

  if (critical.length > 0) {
    lines.push("### Critical Files\n")
    for (const file of critical) {
      const summary = summaryMap.get(file.path)
      lines.push(`#### ${fileTypeIcon(file.type)} \`${file.path}\``)
      if (summary?.summary) {
        lines.push(`${summary.summary}`)
      }
      if (summary?.exports?.length) {
        lines.push(`- **Exports:** ${summary.exports.join(", ")}`)
      }
      lines.push(`- **Type:** ${file.type} | **Lines:** ${file.lines}`)
      lines.push("")
    }
  }

  if (high.length > 0) {
    lines.push("### High Importance Files\n")
    lines.push("| File | Type | Lines | Summary |")
    lines.push("|------|------|-------|---------|")

    for (const file of high) {
      const summary = summaryMap.get(file.path)
      const summaryText = summary?.summary?.slice(0, 80) || "-"
      lines.push(`| \`${file.path}\` | ${file.type} | ${file.lines} | ${summaryText} |`)
    }
  }

  return lines.join("\n")
}

/**
 * Generate entry points section
 */
function generateEntryPointsSection(entryPoints: string[]): string {
  if (entryPoints.length === 0) return ""

  const lines: string[] = []

  lines.push("## Entry Points\n")
  lines.push("Main entry points for the application:\n")

  for (const entry of entryPoints) {
    lines.push(`- \`${entry}\``)
  }

  return lines.join("\n")
}

/**
 * Generate API endpoints section
 */
function generateAPISection(apis: APIEndpoint[]): string {
  if (apis.length === 0) return ""

  const lines: string[] = []

  lines.push("## API Endpoints\n")
  lines.push("| Method | Path | File |")
  lines.push("|--------|------|------|")

  for (const api of apis) {
    lines.push(`| \`${api.method}\` | \`${api.path}\` | \`${api.file}\` |`)
  }

  return lines.join("\n")
}

/**
 * Generate dependencies section
 */
function generateDependenciesSection(dependencies: Dependency[]): string {
  if (dependencies.length === 0) return ""

  const lines: string[] = []

  lines.push("## Dependencies\n")

  // Group by type
  const prod = dependencies.filter((d) => d.type === "production")
  const dev = dependencies.filter((d) => d.type === "development")

  if (prod.length > 0) {
    lines.push("### Production Dependencies\n")

    // Group by category
    const byCategory: { [cat: string]: Dependency[] } = {}
    for (const dep of prod) {
      const cat = dep.category || "other"
      if (!byCategory[cat]) byCategory[cat] = []
      byCategory[cat].push(dep)
    }

    for (const [category, deps] of Object.entries(byCategory)) {
      lines.push(`**${category}:** ${deps.map((d) => `\`${d.name}\``).join(", ")}`)
      lines.push("")
    }
  }

  if (dev.length > 0) {
    lines.push("### Development Dependencies\n")
    lines.push(dev.map((d) => `\`${d.name}\``).join(", "))
  }

  return lines.join("\n")
}

/**
 * Generate file tree section (simplified)
 */
function generateFileTreeSection(analysis: CodebaseAnalysis, maxDepth: number = 3): string {
  const lines: string[] = []

  lines.push("## Project Structure\n")
  lines.push("```")

  const renderTree = (node: typeof analysis.structure, indent: string = "", depth: number = 0): void => {
    if (depth > maxDepth) return

    const prefix = depth === 0 ? "" : indent
    lines.push(`${prefix}${node.name}/`)

    if (node.children) {
      const dirs = node.children.filter((c) => c.type === "directory")
      const files = node.children.filter((c) => c.type === "file")

      // Show directories first
      for (let i = 0; i < dirs.length; i++) {
        const isLast = i === dirs.length - 1 && files.length === 0
        const childIndent = indent + (depth === 0 ? "" : isLast ? "    " : "│   ")
        renderTree(dirs[i], childIndent, depth + 1)
      }

      // Show first few files
      const maxFiles = 5
      const shownFiles = files.slice(0, maxFiles)
      for (let i = 0; i < shownFiles.length; i++) {
        const isLast = i === shownFiles.length - 1
        const connector = isLast ? "└── " : "├── "
        lines.push(`${indent}${connector}${shownFiles[i].name}`)
      }

      if (files.length > maxFiles) {
        lines.push(`${indent}└── ... (${files.length - maxFiles} more files)`)
      }
    }
  }

  renderTree(analysis.structure)
  lines.push("```")

  return lines.join("\n")
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Generate CODEBASE.md content
 */
export function generateCodebaseMarkdown(
  analysis: CodebaseAnalysis,
  summaries?: FileSummary[],
  options?: CodebaseContextOptions
): string {
  const sections: string[] = []

  // Header
  sections.push(`# Codebase Analysis: ${options?.projectName || analysis.projectType}`)
  sections.push("")

  if (options?.projectDescription) {
    sections.push(`> ${options.projectDescription}`)
    sections.push("")
  }

  sections.push(`**Project Type:** ${analysis.projectType}`)
  sections.push(`**Analyzed:** ${new Date(analysis.analyzedAt).toLocaleString()}`)
  sections.push("")

  // Table of contents
  sections.push("## Table of Contents")
  sections.push("")
  sections.push("1. [Tech Stack](#tech-stack)")
  sections.push("2. [Statistics](#statistics)")
  sections.push("3. [Key Files](#key-files)")
  if (analysis.entryPoints.length > 0) sections.push("4. [Entry Points](#entry-points)")
  if (analysis.apis.length > 0) sections.push("5. [API Endpoints](#api-endpoints)")
  if (options?.includeDependencies !== false) sections.push("6. [Dependencies](#dependencies)")
  if (options?.includeFileTree !== false) sections.push("7. [Project Structure](#project-structure)")
  sections.push("")

  sections.push("---")
  sections.push("")

  // Tech Stack
  sections.push(generateTechStackSection(analysis.techStack))
  sections.push("")

  // Statistics
  sections.push(generateStatsSection(analysis))
  sections.push("")

  // Key Files
  sections.push(generateKeyFilesSection(analysis.keyFiles, summaries))
  sections.push("")

  // Entry Points
  const entrySection = generateEntryPointsSection(analysis.entryPoints)
  if (entrySection) {
    sections.push(entrySection)
    sections.push("")
  }

  // API Endpoints
  if (options?.includeAPIs !== false) {
    const apiSection = generateAPISection(analysis.apis)
    if (apiSection) {
      sections.push(apiSection)
      sections.push("")
    }
  }

  // Dependencies
  if (options?.includeDependencies !== false) {
    const depSection = generateDependenciesSection(analysis.dependencies)
    if (depSection) {
      sections.push(depSection)
      sections.push("")
    }
  }

  // File Tree
  if (options?.includeFileTree !== false) {
    sections.push(generateFileTreeSection(analysis, options?.maxTreeDepth || 3))
    sections.push("")
  }

  // Footer
  sections.push("---")
  sections.push("")
  sections.push("*This document was automatically generated by Claudia Coder.*")

  return sections.join("\n")
}

/**
 * Generate a compact context for KICKOFF.md inclusion
 */
export function generateCompactContext(analysis: CodebaseAnalysis): string {
  const lines: string[] = []

  lines.push("## Existing Codebase Context\n")
  lines.push(`This project is based on an existing **${analysis.projectType}** codebase.\n`)

  // Quick stats
  lines.push(`- **Files:** ${analysis.totalFiles}`)
  lines.push(`- **Lines:** ${formatNumber(analysis.totalLines)}`)
  lines.push(`- **Tech:** ${analysis.techStack.framework || analysis.techStack.runtime} / ${analysis.techStack.language}`)
  lines.push("")

  // Key files
  const critical = analysis.keyFiles.filter((f) => f.importance === "critical").slice(0, 5)
  if (critical.length > 0) {
    lines.push("**Key Files:**")
    for (const file of critical) {
      lines.push(`- \`${file.path}\` (${file.type})`)
    }
    lines.push("")
  }

  // Entry points
  if (analysis.entryPoints.length > 0) {
    lines.push(`**Entry Points:** ${analysis.entryPoints.map((e) => `\`${e}\``).join(", ")}`)
    lines.push("")
  }

  return lines.join("\n")
}

/**
 * Generate modification-focused context
 */
export function generateModificationContext(
  analysis: CodebaseAnalysis,
  modificationDescription: string
): string {
  const lines: string[] = []

  lines.push("## Modification Context\n")
  lines.push(`**Base Project:** ${analysis.projectType}`)
  lines.push(`**Modification Goal:** ${modificationDescription}`)
  lines.push("")

  lines.push("### What We're Working With\n")
  lines.push(`This is an existing ${analysis.projectType} codebase with:`)
  lines.push(`- ${formatNumber(analysis.totalFiles)} files (${formatNumber(analysis.totalLines)} lines)`)
  lines.push(`- Tech stack: ${analysis.techStack.framework || analysis.techStack.runtime}, ${analysis.techStack.language}`)

  if (analysis.techStack.ui) {
    lines.push(`- UI: ${analysis.techStack.ui}`)
  }
  if (analysis.techStack.database?.length) {
    lines.push(`- Database: ${analysis.techStack.database.join(", ")}`)
  }
  lines.push("")

  lines.push("### Files Likely to Change\n")
  lines.push("Based on the modification goal, these files will likely need updates:\n")

  // List high-importance files as likely candidates
  const candidates = analysis.keyFiles
    .filter((f) => f.importance === "critical" || f.importance === "high")
    .slice(0, 10)

  for (const file of candidates) {
    lines.push(`- \`${file.path}\` - ${file.type}`)
  }
  lines.push("")

  if (analysis.apis.length > 0) {
    lines.push("### Existing API Endpoints\n")
    lines.push("Current API structure (may need modification):\n")
    for (const api of analysis.apis.slice(0, 10)) {
      lines.push(`- \`${api.method} ${api.path}\``)
    }
    lines.push("")
  }

  lines.push("### Approach\n")
  lines.push("1. Preserve existing functionality where possible")
  lines.push("2. Modify specific files to implement changes")
  lines.push("3. Add new files only when necessary")
  lines.push("4. Maintain existing code style and patterns")

  return lines.join("\n")
}
