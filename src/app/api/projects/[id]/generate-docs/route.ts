/**
 * Generate Documentation API
 *
 * POST /api/projects/[id]/generate-docs
 * Generate various types of documentation for a project
 */

import { NextRequest, NextResponse } from "next/server"
import { getProject } from "@/lib/data/projects"
import { getBuildPlanForProject } from "@/lib/data/build-plans"
import { getRunHistoryEntry } from "@/lib/data/execution-sessions"
import {
  DocType,
  DocTemplateData,
  generateWorkSummary,
  getUserGuidePrompt,
  getTechSpecsPrompt,
  getRequirementsPrompt,
} from "@/lib/docs/templates"
import { generateWithLocalLLM, getAvailableServer } from "@/lib/llm/local-llm"

interface GenerateDocsRequest {
  type: DocType
  executionSessionId?: string
  useAI?: boolean // Whether to use AI for generation (default: true for user-guide, tech-specs, requirements)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body: GenerateDocsRequest = await request.json()
    const { type, executionSessionId, useAI = true } = body

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "Project ID is required" },
        { status: 400 }
      )
    }

    if (!type || !["work-summary", "user-guide", "tech-specs", "requirements"].includes(type)) {
      return NextResponse.json(
        { success: false, error: "Valid document type is required" },
        { status: 400 }
      )
    }

    // Get project data
    const project = await getProject(projectId, undefined)
    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      )
    }

    // Get build plan if available
    const buildPlan = getBuildPlanForProject(projectId)

    // Build template data
    const templateData: DocTemplateData = {
      projectName: project.name,
      projectDescription: project.description,
    }

    if (buildPlan) {
      templateData.buildPlan = {
        objectives: buildPlan.originalPlan.spec.objectives,
        nonGoals: buildPlan.originalPlan.spec.nonGoals,
        assumptions: buildPlan.originalPlan.spec.assumptions,
        risks: buildPlan.originalPlan.spec.risks,
        techStack: buildPlan.originalPlan.spec.techStack,
        phases: buildPlan.originalPlan.phases,
      }
    }

    // Get execution session data if provided
    if (executionSessionId) {
      const session = await getRunHistoryEntry(executionSessionId)
      if (session) {
        templateData.sessionId = session.id
        templateData.startedAt = session.startedAt
        templateData.completedAt = session.completedAt
        templateData.duration = session.duration
          ? `${Math.round(session.duration / 1000)}s`
          : undefined
        templateData.mode = session.mode
        templateData.packetCount = session.packetCount
        templateData.successCount = session.successCount
        templateData.failedCount = session.failedCount
        templateData.qualityGates = session.qualityGates
        templateData.packets = session.packetTitles?.map((title, i) => ({
          title,
          status: i < (session.successCount || 0) ? "completed" : "failed",
          description: "N/A",
        }))
        templateData.events = session.events?.map(e => ({
          timestamp: new Date(e.timestamp).toLocaleTimeString(),
          type: e.type,
          message: e.message,
        }))
      }
    }

    let content: string

    // Generate document based on type
    switch (type) {
      case "work-summary":
        // Work summary doesn't need AI - it's a structured report
        content = generateWorkSummary(templateData)
        break

      case "user-guide":
        if (useAI) {
          const prompt = getUserGuidePrompt(templateData)
          content = await generateWithAI(prompt)
        } else {
          content = `# ${project.name} - User Guide\n\nPlease use AI generation for user guides.`
        }
        break

      case "tech-specs":
        if (useAI) {
          const prompt = getTechSpecsPrompt(templateData)
          content = await generateWithAI(prompt)
        } else {
          content = `# ${project.name} - Technical Specification\n\nPlease use AI generation for technical specs.`
        }
        break

      case "requirements":
        if (useAI) {
          const prompt = getRequirementsPrompt(templateData)
          content = await generateWithAI(prompt)
        } else {
          content = `# ${project.name} - Requirements\n\nPlease use AI generation for requirements docs.`
        }
        break

      default:
        return NextResponse.json(
          { success: false, error: "Unknown document type" },
          { status: 400 }
        )
    }

    // Return the generated document
    return NextResponse.json({
      success: true,
      document: {
        type,
        content,
        projectId,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("[generate-docs] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate document",
      },
      { status: 500 }
    )
  }
}

/**
 * Generate content using local LLM
 */
async function generateWithAI(prompt: string): Promise<string> {
  try {
    // Try to get an available local LLM server
    const server = await getAvailableServer()

    if (!server) {
      return `# Documentation Generation

Unable to generate AI-powered documentation. No local LLM server is available.

Please ensure LM Studio or Ollama is running, or generate this document manually.

---

**Prompt that would be used:**
\`\`\`
${prompt}
\`\`\`
`
    }

    // Generate with local LLM - uses systemPrompt and userPrompt format
    const result = await generateWithLocalLLM(
      "You are a technical documentation writer. Generate clear, professional documentation in markdown format.",
      prompt,
      {
        max_tokens: 4000,
        temperature: 0.7,
        preferredServer: server.name,
      }
    )

    return result.content || "Failed to generate content."
  } catch (error) {
    console.error("[generate-docs] AI generation failed:", error)
    return `# Documentation Generation Failed

An error occurred while generating documentation:
${error instanceof Error ? error.message : "Unknown error"}

Please try again or generate this document manually.
`
  }
}
