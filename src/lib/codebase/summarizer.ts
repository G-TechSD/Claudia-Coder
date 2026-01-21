/**
 * File Summarizer
 *
 * Uses local LLM to generate summaries of code files.
 * Extracts key information like exports, purpose, and dependencies.
 */

import { promises as fs } from "fs"
import path from "path"
import os from "os"
import { generateWithLocalLLM, getAvailableServer } from "@/lib/llm/local-llm"
import type { KeyFile, CodebaseAnalysis } from "./analyzer"

// ============================================================================
// Types
// ============================================================================

export interface FileSummary {
  path: string
  summary: string
  purpose: string
  exports?: string[]
  imports?: string[]
  keyFunctions?: string[]
  complexity: "simple" | "moderate" | "complex"
}

export interface SummarizationResult {
  summaries: FileSummary[]
  totalProcessed: number
  totalSkipped: number
  errors: string[]
}

// ============================================================================
// Constants
// ============================================================================

const MAX_FILE_SIZE = 50000 // 50KB max for summarization
const MAX_FILES_TO_SUMMARIZE = 50 // Limit to prevent excessive LLM calls

// File extensions we can meaningfully summarize
const SUMMARIZABLE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".kt",
  ".swift",
  ".rb",
  ".php",
  ".vue",
  ".svelte",
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
 * Check if file should be summarized
 */
function shouldSummarize(file: KeyFile): boolean {
  const ext = path.extname(file.path).toLowerCase()
  return (
    SUMMARIZABLE_EXTENSIONS.includes(ext) &&
    file.size < MAX_FILE_SIZE &&
    (file.importance === "critical" || file.importance === "high")
  )
}

/**
 * Read file content safely
 */
async function readFileContent(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8")
    return content
  } catch {
    return null
  }
}

/**
 * Truncate content if too long
 */
function truncateContent(content: string, maxLength: number = 10000): string {
  if (content.length <= maxLength) return content
  return content.substring(0, maxLength) + "\n\n... [truncated]"
}

/**
 * Extract basic info from code without LLM
 */
function extractBasicInfo(content: string, ext: string): {
  exports: string[]
  imports: string[]
  functions: string[]
} {
  const exports: string[] = []
  const imports: string[] = []
  const functions: string[] = []

  // TypeScript/JavaScript
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs"].includes(ext)) {
    // Find exports
    const exportMatches = content.match(/export\s+(?:async\s+)?(?:function|const|class|interface|type)\s+(\w+)/g)
    if (exportMatches) {
      for (const match of exportMatches) {
        const name = match.match(/(?:function|const|class|interface|type)\s+(\w+)/)?.[1]
        if (name) exports.push(name)
      }
    }

    // Find default export
    const defaultExport = content.match(/export\s+default\s+(?:function\s+)?(\w+)/)?.[1]
    if (defaultExport) exports.push(`default: ${defaultExport}`)

    // Find imports
    const importMatches = content.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/g)
    if (importMatches) {
      for (const match of importMatches) {
        const pkg = match.match(/from\s+['"]([^'"]+)['"]/)?.[1]
        if (pkg && !pkg.startsWith(".")) imports.push(pkg)
      }
    }

    // Find functions
    const funcMatches = content.match(/(?:async\s+)?function\s+(\w+)/g)
    if (funcMatches) {
      for (const match of funcMatches) {
        const name = match.match(/function\s+(\w+)/)?.[1]
        if (name) functions.push(name)
      }
    }
  }

  // Python
  if (ext === ".py") {
    // Find function definitions
    const funcMatches = content.match(/def\s+(\w+)/g)
    if (funcMatches) {
      for (const match of funcMatches) {
        const name = match.match(/def\s+(\w+)/)?.[1]
        if (name) functions.push(name)
      }
    }

    // Find class definitions
    const classMatches = content.match(/class\s+(\w+)/g)
    if (classMatches) {
      for (const match of classMatches) {
        const name = match.match(/class\s+(\w+)/)?.[1]
        if (name) exports.push(`class: ${name}`)
      }
    }

    // Find imports
    const importMatches = content.match(/(?:from\s+(\S+)\s+)?import\s+(\S+)/g)
    if (importMatches) {
      for (const match of importMatches) {
        const pkg = match.match(/(?:from\s+(\S+)|import\s+(\S+))/)?.[1] || match.match(/import\s+(\S+)/)?.[1]
        if (pkg && !pkg.startsWith(".")) imports.push(pkg)
      }
    }
  }

  return { exports, imports, functions }
}

// ============================================================================
// Summarization Functions
// ============================================================================

/**
 * Generate summary for a single file using LLM
 */
async function summarizeFile(
  filePath: string,
  content: string,
  fileName: string
): Promise<FileSummary | null> {
  const ext = path.extname(fileName).toLowerCase()
  const basicInfo = extractBasicInfo(content, ext)

  // Try LLM summarization
  const server = await getAvailableServer()

  if (server) {
    try {
      const prompt = `Analyze this code file and provide a brief summary.

File: ${fileName}

\`\`\`
${truncateContent(content, 8000)}
\`\`\`

Respond in this exact JSON format:
{
  "summary": "One sentence describing what this file does",
  "purpose": "The main purpose/responsibility of this file",
  "complexity": "simple" | "moderate" | "complex"
}

Only respond with the JSON, no other text.`

      const result = await generateWithLocalLLM(
        "You are a code analysis assistant. Analyze code and provide structured summaries.",
        prompt,
        {
          max_tokens: 500,
          temperature: 0.3,
          preferredServer: server.name,
        }
      )

      if (result.content) {
        try {
          // Try to parse JSON from response
          const jsonMatch = result.content.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            return {
              path: filePath,
              summary: parsed.summary || "No summary available",
              purpose: parsed.purpose || "Unknown",
              exports: basicInfo.exports,
              imports: basicInfo.imports,
              keyFunctions: basicInfo.functions,
              complexity: parsed.complexity || "moderate",
            }
          }
        } catch {
          // JSON parsing failed, use basic info
        }
      }
    } catch (error) {
      console.error(`[summarizer] LLM error for ${fileName}:`, error)
    }
  }

  // Fallback: Generate basic summary without LLM
  const exports = basicInfo.exports.join(", ") || "none"
  const summary = `Exports: ${exports}. Contains ${basicInfo.functions.length} function(s).`

  return {
    path: filePath,
    summary,
    purpose: "Code file",
    exports: basicInfo.exports,
    imports: basicInfo.imports,
    keyFunctions: basicInfo.functions,
    complexity: basicInfo.functions.length > 10 ? "complex" : basicInfo.functions.length > 3 ? "moderate" : "simple",
  }
}

/**
 * Summarize multiple files from a codebase analysis
 */
export async function summarizeKeyFiles(
  repoPath: string,
  analysis: CodebaseAnalysis,
  options?: {
    maxFiles?: number
    onProgress?: (current: number, total: number, file: string) => void
  }
): Promise<SummarizationResult> {
  const expandedPath = expandPath(repoPath)
  const maxFiles = options?.maxFiles || MAX_FILES_TO_SUMMARIZE

  const summaries: FileSummary[] = []
  const errors: string[] = []
  let skipped = 0

  // Filter files to summarize
  const filesToSummarize = analysis.keyFiles.filter(shouldSummarize).slice(0, maxFiles)

  console.log(`[summarizer] Summarizing ${filesToSummarize.length} files`)

  for (let i = 0; i < filesToSummarize.length; i++) {
    const file = filesToSummarize[i]
    const fullPath = path.join(expandedPath, file.path)

    options?.onProgress?.(i + 1, filesToSummarize.length, file.path)

    try {
      const content = await readFileContent(fullPath)

      if (!content) {
        skipped++
        continue
      }

      const summary = await summarizeFile(file.path, content, path.basename(file.path))

      if (summary) {
        summaries.push(summary)
      } else {
        skipped++
      }
    } catch (error) {
      errors.push(`${file.path}: ${error instanceof Error ? error.message : "Unknown error"}`)
      skipped++
    }
  }

  console.log(`[summarizer] Completed: ${summaries.length} summarized, ${skipped} skipped`)

  return {
    summaries,
    totalProcessed: summaries.length,
    totalSkipped: skipped,
    errors,
  }
}

/**
 * Update analysis with summaries
 */
export function mergesSummariesIntoAnalysis(
  analysis: CodebaseAnalysis,
  summaries: FileSummary[]
): CodebaseAnalysis {
  const summaryMap = new Map(summaries.map((s) => [s.path, s]))

  const updatedKeyFiles = analysis.keyFiles.map((file) => {
    const summary = summaryMap.get(file.path)
    if (summary) {
      return {
        ...file,
        summary: summary.summary,
        exports: summary.exports,
      }
    }
    return file
  })

  return {
    ...analysis,
    keyFiles: updatedKeyFiles,
  }
}

/**
 * Generate a quick summary of a single file
 */
export async function quickSummarizeFile(filePath: string): Promise<FileSummary | null> {
  const expandedPath = expandPath(filePath)
  const content = await readFileContent(expandedPath)

  if (!content) return null

  return summarizeFile(filePath, content, path.basename(filePath))
}
