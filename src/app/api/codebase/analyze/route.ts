/**
 * Codebase Analysis API
 *
 * Analyzes an existing codebase to extract structure, TODOs,
 * commit history, and generate AI-powered documentation and recommendations.
 */

import { NextRequest, NextResponse } from "next/server"
import {
  performFullAnalysis,
  generateProjectDocumentation,
  recommendPackets,
  type CodebaseAnalysis,
  type ProjectDocumentation,
  type RecommendedPacket
} from "@/lib/ai/codebase-analysis"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"

// LLM client wrapper for the analysis functions
async function llmClient(
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; error?: string }> {
  // Try local LLM first
  const localResponse = await generateWithLocalLLM(systemPrompt, userPrompt, {
    temperature: 0.7,
    max_tokens: 4096
  })

  if (!localResponse.error) {
    return { content: localResponse.content }
  }

  // Try Anthropic fallback if local fails and API key is available
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      })

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      })

      const content = response.content[0].type === "text"
        ? response.content[0].text.trim()
        : ""

      return { content }
    } catch (error) {
      console.error("Anthropic fallback failed:", error)
    }
  }

  return { content: "", error: localResponse.error || "No LLM available" }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { repoPath, projectId, projectName } = body

    if (!repoPath || typeof repoPath !== "string") {
      return NextResponse.json(
        { error: "repoPath is required" },
        { status: 400 }
      )
    }

    console.log(`[Codebase Analysis] Starting analysis of ${repoPath} for project ${projectId}`)

    // Perform the full analysis
    const analysis: CodebaseAnalysis = await performFullAnalysis(repoPath)

    console.log(`[Codebase Analysis] Found ${analysis.structure.totalFiles} files, ${analysis.todos.length} TODOs`)

    // Generate documentation using LLM
    let documentation: ProjectDocumentation | null = null
    try {
      documentation = await generateProjectDocumentation(analysis, llmClient)
      console.log(`[Codebase Analysis] Generated documentation: ${documentation?.summary?.substring(0, 100)}...`)
    } catch (error) {
      console.error("[Codebase Analysis] Documentation generation failed:", error)
    }

    // Generate recommended packets using LLM
    let packets: RecommendedPacket[] = []
    try {
      packets = await recommendPackets(analysis, documentation, llmClient)
      console.log(`[Codebase Analysis] Generated ${packets.length} recommended packets`)
    } catch (error) {
      console.error("[Codebase Analysis] Packet generation failed:", error)
    }

    // Build response
    const response = {
      success: true,
      projectId,
      projectName,
      analysis: {
        structure: {
          rootPath: analysis.structure.rootPath,
          totalFiles: analysis.structure.totalFiles,
          totalFolders: analysis.structure.totalFolders,
          languageBreakdown: analysis.structure.languageBreakdown,
          topLevelFolders: analysis.structure.topLevelFolders,
          hasPackageJson: analysis.structure.hasPackageJson,
          hasCargoToml: analysis.structure.hasCargoToml,
          hasPyprojectToml: analysis.structure.hasPyprojectToml,
          hasGoMod: analysis.structure.hasGoMod,
          hasGitignore: analysis.structure.hasGitignore,
          hasReadme: analysis.structure.hasReadme,
          detectedFrameworks: analysis.structure.detectedFrameworks,
          // Limit files for response size
          files: analysis.structure.files.slice(0, 500).map(f => ({
            relativePath: f.relativePath,
            name: f.name,
            extension: f.extension,
            language: f.language,
            size: f.size
          })),
          folders: analysis.structure.folders.slice(0, 100).map(f => ({
            relativePath: f.relativePath,
            name: f.name,
            fileCount: f.fileCount,
            subfolderCount: f.subfolderCount
          }))
        },
        todos: analysis.todos.slice(0, 100), // Limit TODOs
        commitHistory: analysis.commitHistory ? {
          totalCommits: analysis.commitHistory.totalCommits,
          activitySummary: analysis.commitHistory.activitySummary,
          lastCommitDate: analysis.commitHistory.lastCommitDate,
          primaryBranch: analysis.commitHistory.primaryBranch,
          recentCommits: analysis.commitHistory.recentCommits.slice(0, 20),
          contributors: analysis.commitHistory.contributors.slice(0, 10)
        } : null,
        analyzedAt: analysis.analyzedAt,
        analysisVersion: analysis.analysisVersion
      },
      documentation,
      packets,
      summary: {
        fileCount: analysis.structure.totalFiles,
        folderCount: analysis.structure.totalFolders,
        todoCount: analysis.todos.length,
        commitCount: analysis.commitHistory?.totalCommits || 0,
        languages: Object.keys(analysis.structure.languageBreakdown).length,
        frameworks: analysis.structure.detectedFrameworks.length,
        packetCount: packets.length
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[Codebase Analysis] Error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Analysis failed",
        success: false
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint for quick structure check
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const repoPath = searchParams.get("path")

  if (!repoPath) {
    return NextResponse.json(
      { error: "path query parameter is required" },
      { status: 400 }
    )
  }

  try {
    // Quick check - just scan structure without LLM
    const { analyzeCodebase } = await import("@/lib/ai/codebase-analysis")
    const structure = await analyzeCodebase(repoPath)

    return NextResponse.json({
      success: true,
      structure: {
        totalFiles: structure.totalFiles,
        totalFolders: structure.totalFolders,
        languageBreakdown: structure.languageBreakdown,
        topLevelFolders: structure.topLevelFolders,
        detectedFrameworks: structure.detectedFrameworks,
        hasPackageJson: structure.hasPackageJson,
        hasCargoToml: structure.hasCargoToml,
        hasPyprojectToml: structure.hasPyprojectToml,
        hasGoMod: structure.hasGoMod,
        hasReadme: structure.hasReadme
      }
    })
  } catch (error) {
    console.error("[Codebase Analysis] Quick check error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Analysis failed",
        success: false
      },
      { status: 500 }
    )
  }
}
