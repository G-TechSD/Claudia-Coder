/**
 * Analyze Codebase API
 *
 * POST /api/projects/analyze-codebase
 *
 * Analyzes a codebase at the given path and returns structured analysis.
 * Optionally saves the analysis and generates CODEBASE.md.
 *
 * Body: {
 *   path: string                    // Path to the codebase to analyze
 *   projectId?: string              // Optional: Project to associate analysis with
 *   generateMarkdown?: boolean      // Generate CODEBASE.md file (default: true)
 *   summarizeFiles?: boolean        // Run LLM file summarization (default: false)
 *   quickAnalysis?: boolean         // Fast mode with less detail (default: false)
 * }
 *
 * Returns: {
 *   success: boolean
 *   analysis: CodebaseAnalysis
 *   markdownPath?: string           // Path to generated CODEBASE.md
 *   error?: string
 * }
 */

import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import os from "os"
import { verifyApiAuth, unauthorizedResponse } from "@/lib/auth/api-helpers"
import { analyzeCodebase } from "@/lib/codebase/analyzer"
import { summarizeKeyFiles } from "@/lib/codebase/summarizer"
import { generateCodebaseMarkdown } from "@/lib/codebase/context-generator"
import type { CodebaseAnalysis } from "@/lib/codebase/analyzer"

// ============================================================================
// Helpers
// ============================================================================

function expandPath(p: string): string {
  if (!p) return p
  return p.replace(/^~/, os.homedir())
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  // Verify authentication
  const auth = await verifyApiAuth()
  if (!auth) {
    return unauthorizedResponse()
  }

  try {
    const body = await request.json()
    const {
      path: repoPath,
      projectId,
      generateMarkdown = true,
      summarizeFiles = false,
      quickAnalysis = false,
    } = body as {
      path: string
      projectId?: string
      generateMarkdown?: boolean
      summarizeFiles?: boolean
      quickAnalysis?: boolean
    }

    if (!repoPath) {
      return NextResponse.json({ error: "path is required" }, { status: 400 })
    }

    const expandedPath = expandPath(repoPath)

    // Verify path exists
    try {
      const stats = await fs.stat(expandedPath)
      if (!stats.isDirectory()) {
        return NextResponse.json({ error: "Path is not a directory" }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: "Directory not found" }, { status: 404 })
    }

    console.log(`[analyze-codebase] Analyzing ${expandedPath}`)
    console.log(`[analyze-codebase] Options: quick=${quickAnalysis}, summarize=${summarizeFiles}, markdown=${generateMarkdown}`)

    // Run analysis (always full analysis for API)
    const analysis = await analyzeCodebase(expandedPath)

    console.log(`[analyze-codebase] Analysis complete: ${analysis.totalFiles} files, ${analysis.totalLines} lines`)
    console.log(`[analyze-codebase] Tech stack: ${analysis.projectType}, ${analysis.techStack.framework || analysis.techStack.runtime}`)

    // Optional: Summarize key files with LLM
    let summaries
    if (summarizeFiles) {
      console.log(`[analyze-codebase] Summarizing key files...`)
      const result = await summarizeKeyFiles(expandedPath, analysis, {
        maxFiles: 30,
        onProgress: (current, total, file) => {
          console.log(`[analyze-codebase] Summarizing ${current}/${total}: ${file}`)
        },
      })
      summaries = result.summaries
      console.log(`[analyze-codebase] Summarized ${result.totalProcessed} files`)
    }

    // Generate CODEBASE.md
    let markdownPath: string | undefined
    if (generateMarkdown) {
      const markdown = generateCodebaseMarkdown(analysis, summaries, {
        projectName: path.basename(expandedPath),
        includeFileTree: true,
        includeDependencies: true,
        includeAPIs: true,
      })

      // Write to .claudia directory in the repo
      const claudiaDir = path.join(expandedPath, ".claudia")
      await fs.mkdir(claudiaDir, { recursive: true })

      markdownPath = path.join(claudiaDir, "CODEBASE.md")
      await fs.writeFile(markdownPath, markdown, "utf-8")

      console.log(`[analyze-codebase] Generated CODEBASE.md at ${markdownPath}`)
    }

    // Return analysis
    return NextResponse.json({
      success: true,
      analysis,
      summaries,
      markdownPath,
      stats: {
        totalFiles: analysis.totalFiles,
        totalLines: analysis.totalLines,
        projectType: analysis.projectType,
        keyFilesCount: analysis.keyFiles.length,
        apisCount: analysis.apis.length,
        dependenciesCount: analysis.dependencies.length,
      },
    })
  } catch (error) {
    console.error("[analyze-codebase] Error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Analysis failed",
      },
      { status: 500 }
    )
  }
}
