/**
 * Linear Project Import API
 * Imports a Linear project with all its issues as work packets
 *
 * Enhanced with nuance extraction for better context from comments
 * Enhanced with game/creative project detection and vision packet generation
 * Enhanced with markdown document saving for vision/story content
 */

import { NextRequest, NextResponse } from "next/server"
import {
  importProject,
  hasLinearToken,
  mapLinearPriority,
  mapLinearState,
  LinearIssue,
  LinearComment
} from "@/lib/linear/api"
import {
  extractNuanceFromComments,
  formatNuanceForPacketGeneration,
  type ExtractedNuance
} from "@/lib/ai/nuance-extraction"
import {
  detectGameOrCreativeProject,
  generateVisionContent,
  createVisionPacket,
  createDefaultVisionPacket,
  extractCreativeContext,
  generateGameImplementationPackets,
  generateDefaultImplementationPackets,
  implementationToWorkPackets,
  type GameProjectDetection,
  type VisionPacket,
  type ImplementationPacketResult,
  type GeneratedVision
} from "@/lib/ai/game-vision"
import {
  createVisionFromLinearExtraction,
  createStoryFromLinearExtraction,
  type ProjectDoc
} from "@/lib/data/project-docs"

interface WorkPacket {
  id: string
  phaseId: string
  title: string
  description: string
  type: "feature" | "bugfix" | "refactor" | "test" | "docs" | "config" | "research" | "vision"
  priority: "critical" | "high" | "medium" | "low"
  status: "queued" | "in_progress" | "completed" | "blocked"
  tasks: Array<{ id: string; description: string; completed: boolean; order: number }>
  suggestedTaskType: string
  acceptanceCriteria: string[]
  estimatedTokens: number
  dependencies: string[]
  metadata: {
    source: "linear" | "vision-generator"
    linearId?: string
    linearIdentifier?: string
    linearState?: string
    linearLabels?: string[]
    linearAssignee?: string
    linearParentId?: string
    linearComments?: Array<{
      id: string
      body: string
      createdAt: string
      updatedAt: string
      author?: string
    }>
    // Extracted nuance from comments (if nuance extraction was enabled)
    extractedNuance?: ExtractedNuance
    // Vision packet specific metadata
    isVisionPacket?: boolean
    completionGate?: boolean
    projectType?: string
    storeDescription?: string
    tagline?: string
    keyFeatures?: string[]
    targetAudience?: string
    uniqueSellingPoints?: string[]
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function inferPacketType(issue: LinearIssue): WorkPacket["type"] {
  const title = issue.title.toLowerCase()
  const labels = issue.labels.nodes.map(l => l.name.toLowerCase())

  if (labels.includes("bug") || labels.includes("fix") || title.includes("fix") || title.includes("bug")) {
    return "bugfix"
  }
  if (labels.includes("refactor") || title.includes("refactor")) {
    return "refactor"
  }
  if (labels.includes("test") || labels.includes("testing") || title.includes("test")) {
    return "test"
  }
  if (labels.includes("docs") || labels.includes("documentation") || title.includes("doc")) {
    return "docs"
  }
  if (labels.includes("config") || labels.includes("setup") || title.includes("config")) {
    return "config"
  }
  if (labels.includes("research") || labels.includes("spike") || title.includes("research")) {
    return "research"
  }
  return "feature"
}

function formatCommentsForContext(comments: LinearComment[]): string {
  if (!comments || comments.length === 0) return ""

  return comments
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(c => {
      const author = c.user?.name || "Unknown"
      const date = new Date(c.createdAt).toLocaleDateString()
      return `[${date}] ${author}: ${c.body}`
    })
    .join("\n\n")
}

function issueToPacket(
  issue: LinearIssue,
  phaseId: string,
  extractedNuance?: ExtractedNuance
): WorkPacket {
  // Parse description for task list items
  const tasks: WorkPacket["tasks"] = []
  if (issue.description) {
    const lines = issue.description.split("\n")
    let order = 0
    for (const line of lines) {
      const checkboxMatch = line.match(/^[-*]\s*\[([ x])\]\s*(.+)$/i)
      if (checkboxMatch) {
        tasks.push({
          id: `task-${generateId()}`,
          description: checkboxMatch[2].trim(),
          completed: checkboxMatch[1].toLowerCase() === "x",
          order: order++
        })
      }
    }
  }

  // Add action items from nuance extraction as tasks
  if (extractedNuance?.actionItems && extractedNuance.actionItems.length > 0) {
    let order = tasks.length
    for (const action of extractedNuance.actionItems) {
      // Only add if not already present (simple string check)
      const exists = tasks.some(t =>
        t.description.toLowerCase().includes(action.toLowerCase().substring(0, 20))
      )
      if (!exists) {
        tasks.push({
          id: `task-${generateId()}`,
          description: `[From discussion] ${action}`,
          completed: false,
          order: order++
        })
      }
    }
  }

  // If no tasks extracted, create one from the title
  if (tasks.length === 0) {
    tasks.push({
      id: `task-${generateId()}`,
      description: issue.title,
      completed: issue.state.type === "completed",
      order: 0
    })
  }

  // Extract acceptance criteria from description
  const acceptanceCriteria: string[] = []
  if (issue.description) {
    const acMatch = issue.description.match(/(?:acceptance criteria|done when|requirements?):?\s*\n((?:[-*]\s*.+\n?)+)/i)
    if (acMatch) {
      const criteria = acMatch[1].split("\n")
        .filter(line => line.trim().match(/^[-*]/))
        .map(line => line.replace(/^[-*]\s*/, "").trim())
      acceptanceCriteria.push(...criteria)
    }
  }

  // Add requirements from nuance extraction as acceptance criteria
  if (extractedNuance?.requirements && extractedNuance.requirements.length > 0) {
    for (const req of extractedNuance.requirements) {
      // Only add if not already present
      const exists = acceptanceCriteria.some(ac =>
        ac.toLowerCase().includes(req.toLowerCase().substring(0, 20))
      )
      if (!exists) {
        acceptanceCriteria.push(`[From discussion] ${req}`)
      }
    }
  }

  if (acceptanceCriteria.length === 0) {
    acceptanceCriteria.push(`Complete: ${issue.title}`)
  }

  // Estimate tokens based on complexity indicators
  let estimatedTokens = 2000
  if (issue.estimate) {
    estimatedTokens = issue.estimate * 1000
  } else if (issue.description && issue.description.length > 500) {
    estimatedTokens = 4000
  }
  // Add more tokens if there's extracted nuance (more context to process)
  if (extractedNuance && (
    extractedNuance.decisions.length > 0 ||
    extractedNuance.requirements.length > 0 ||
    extractedNuance.concerns.length > 0
  )) {
    estimatedTokens += 1000
  }

  // Build description with comments context if available
  let description = issue.description || issue.title
  const commentsContext = issue.comments ? formatCommentsForContext(issue.comments) : ""
  if (commentsContext) {
    description += `\n\n---\n## Discussion Notes\n${commentsContext}`
  }

  // Add extracted nuance summary to description
  if (extractedNuance) {
    const nuanceFormatted = formatNuanceForPacketGeneration(extractedNuance)
    if (nuanceFormatted) {
      description += `\n\n---\n## Extracted Context\n${nuanceFormatted}`
    }
  }

  // Map comments to metadata format
  const linearComments = issue.comments?.map(c => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    author: c.user?.name || c.user?.email
  }))

  return {
    id: `packet-${generateId()}`,
    phaseId,
    title: issue.title,
    description,
    type: inferPacketType(issue),
    priority: mapLinearPriority(issue.priority),
    status: mapLinearState(issue.state.type),
    tasks,
    suggestedTaskType: "code",
    acceptanceCriteria,
    estimatedTokens,
    dependencies: issue.parent ? [`linear:${issue.parent.id}`] : [],
    metadata: {
      source: "linear",
      linearId: issue.id,
      linearIdentifier: issue.identifier,
      linearState: issue.state.name,
      linearLabels: issue.labels.nodes.map(l => l.name),
      linearAssignee: issue.assignee?.email,
      linearParentId: issue.parent?.id,
      linearComments,
      extractedNuance
    }
  }
}

export async function POST(request: NextRequest) {
  if (!hasLinearToken()) {
    return NextResponse.json(
      { error: "Linear API key not configured" },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    // Default syncComments to TRUE - always import comments for maximum context
    // extractNuance - when true, uses AI to extract key decisions/requirements from comments
    // generateVision - when true, generates a vision packet for game/creative projects
    // generateImplementationPackets - when true, generates detailed implementation work packets for game projects
    // saveToMarkdown - when true, saves vision/story content to markdown files
    const {
      projectIds,
      projectId,
      claudiaProjectId,  // The Claudia project ID where markdown docs will be saved
      syncComments = true,
      extractNuance = false,
      generateVision = true,  // Auto-generate vision packets for game/creative projects
      generateImplementationPackets = true, // Auto-generate implementation packets for game projects
      saveToMarkdown = true,  // Save vision/story as markdown documents
      preferredServer,  // For nuance extraction LLM
      preferredModel,   // For nuance extraction LLM
      explicitCategory  // Optional: explicit project category to override keyword detection
                        // Values: "game", "vr", "creative", "interactive", "web", "mobile", "desktop", "api", "library", "tool", "standard"
    } = body

    // Support both single projectId (legacy) and multiple projectIds
    const idsToImport: string[] = projectIds || (projectId ? [projectId] : [])

    if (idsToImport.length === 0) {
      return NextResponse.json(
        { error: "projectIds or projectId is required" },
        { status: 400 }
      )
    }

    // Import all selected projects in parallel
    // Pass syncComments to fetch all comments with pagination
    console.log(`[Linear Import] Starting import of ${idsToImport.length} project(s), syncComments: ${syncComments}, extractNuance: ${extractNuance}, generateVision: ${generateVision}, generateImplementationPackets: ${generateImplementationPackets}`)
    const importResults = await Promise.all(
      idsToImport.map(id => importProject(id, { includeComments: syncComments }))
    )

    // Create a default phase for imported issues
    const defaultPhaseId = `phase-${generateId()}`
    // Create a vision phase that comes before the default phase
    const visionPhaseId = `phase-vision-${generateId()}`

    // Combine all issues from all projects
    const allIssues = importResults.flatMap(result => result.issues)

    // Log import results for debugging
    console.log(`[Linear Import] Import results:`)
    for (const result of importResults) {
      console.log(`  - Project: ${result.project.name} (${result.project.id})`)
      console.log(`    Description: ${result.project.description?.substring(0, 100) || 'No description'}`)
      console.log(`    Issues: ${result.issues.length}`)
      console.log(`    Teams: ${result.teams.map(t => t.name).join(', ')}`)
    }
    console.log(`[Linear Import] Total issues to import: ${allIssues.length}`)

    // Build project names and descriptions for detection
    const projectNames = importResults.map(r => r.project.name).join(", ")
    const projectDescriptions = importResults.map(r => r.project.description || "").join("\n")
    const issueContent = allIssues.map(i => `${i.title} ${i.description || ""}`).join("\n")

    // Detect if this is a game/creative project
    // If explicitCategory is provided, it overrides keyword detection
    const gameDetection = detectGameOrCreativeProject(
      projectNames,
      projectDescriptions,
      [issueContent],
      explicitCategory  // Pass explicit category to override keyword detection
    )

    console.log(`[Linear Import] Game/creative detection: isGameOrCreative=${gameDetection.isGameOrCreative}, confidence=${gameDetection.confidence}, type=${gameDetection.projectType}, matchedKeywords=${gameDetection.matchedKeywords.length}, explicitCategory=${explicitCategory || 'none'}`)

    // Extract nuance from comments if enabled
    const nuanceMap: Map<string, ExtractedNuance> = new Map()
    const nuanceStats = { processed: 0, withComments: 0, failed: 0 }

    if (extractNuance && syncComments) {
      console.log(`[Linear Import] Starting nuance extraction for ${allIssues.length} issues...`)

      // Filter issues with comments
      const issuesWithComments = allIssues.filter(i => i.comments && i.comments.length > 0)
      nuanceStats.withComments = issuesWithComments.length

      // Process in batches of 2 to avoid overwhelming the LLM
      for (let i = 0; i < issuesWithComments.length; i += 2) {
        const batch = issuesWithComments.slice(i, i + 2)

        const results = await Promise.all(
          batch.map(async (issue) => {
            try {
              const nuance = await extractNuanceFromComments(
                issue.title,
                issue.description || "",
                issue.comments || [],
                { preferredServer, preferredModel, maxRetries: 2 }
              )
              nuanceStats.processed++
              return { id: issue.id, nuance }
            } catch (error) {
              console.error(`[Linear Import] Nuance extraction failed for ${issue.identifier}:`, error)
              nuanceStats.failed++
              return null
            }
          })
        )

        for (const result of results) {
          if (result) {
            nuanceMap.set(result.id, result.nuance)
          }
        }
      }

      console.log(`[Linear Import] Nuance extraction complete: ${nuanceStats.processed} processed, ${nuanceStats.failed} failed`)
    }

    // Convert issues to work packets (with nuance if available)
    const packets: WorkPacket[] = allIssues.map(issue =>
      issueToPacket(issue, defaultPhaseId, nuanceMap.get(issue.id))
    )

    // Generate vision packet for game/creative projects
    let visionPacket: VisionPacket | null = null
    const visionStats = { detected: false, generated: false, error: undefined as string | undefined }

    if (gameDetection.isGameOrCreative && generateVision) {
      visionStats.detected = true
      console.log(`[Linear Import] Detected ${gameDetection.projectType} project. Generating vision packet...`)

      // Extract creative context from nuances if available
      const nuanceArray = Array.from(nuanceMap.values())
      const creativeContext = nuanceArray.length > 0
        ? extractCreativeContext(nuanceArray)
        : undefined

      try {
        // Generate vision content using AI
        const visionContent = await generateVisionContent(
          projectNames,
          projectDescriptions,
          gameDetection,
          {
            preferredServer,
            preferredModel,
            nuanceContext: creativeContext,
            maxRetries: 2
          }
        )

        if (visionContent) {
          visionPacket = createVisionPacket(
            visionPhaseId,
            projectNames,
            gameDetection,
            visionContent
          )
          visionStats.generated = true
          console.log(`[Linear Import] Vision packet generated: ${visionPacket.title}`)
        } else {
          // Fall back to default vision packet if AI generation fails
          console.log(`[Linear Import] AI vision generation failed, using default vision packet`)
          visionPacket = createDefaultVisionPacket(
            visionPhaseId,
            projectNames,
            projectDescriptions,
            gameDetection
          )
          visionStats.generated = true
          visionStats.error = "AI generation failed, used default template"
        }
      } catch (error) {
        console.error(`[Linear Import] Vision generation error:`, error)
        // Create default vision packet on error
        visionPacket = createDefaultVisionPacket(
          visionPhaseId,
          projectNames,
          projectDescriptions,
          gameDetection
        )
        visionStats.generated = true
        visionStats.error = error instanceof Error ? error.message : "Vision generation failed"
      }
    }

    // Generate implementation packets for game/creative projects
    let implementationResult: ImplementationPacketResult | null = null
    const implementationStats = {
      detected: false,
      generated: false,
      packetCount: 0,
      estimatedHours: 0,
      error: undefined as string | undefined
    }
    // Create a phase for implementation packets
    const implementationPhaseId = `phase-implementation-${generateId()}`

    if (gameDetection.isGameOrCreative && generateImplementationPackets) {
      implementationStats.detected = true
      console.log(`[Linear Import] Generating implementation packets for ${gameDetection.projectType} project...`)

      // Build the "brain dump" from project description and all issue content
      const brainDump = [
        projectDescriptions,
        ...allIssues.map(i => {
          const parts = [i.title]
          if (i.description) parts.push(i.description)
          // Include comment content as additional context
          if (i.comments && i.comments.length > 0) {
            parts.push("Discussion:\n" + i.comments.map(c => c.body).join("\n"))
          }
          return parts.join("\n")
        })
      ].join("\n\n---\n\n")

      // Extract vision content if we generated it
      let existingVision: GeneratedVision | undefined
      if (visionPacket && visionPacket.metadata) {
        existingVision = {
          gameName: projectNames,
          tagline: visionPacket.metadata.tagline || "",
          storeDescription: visionPacket.metadata.storeDescription || "",
          shortDescription: "",
          keyFeatures: visionPacket.metadata.keyFeatures || [],
          uniqueSellingPoints: visionPacket.metadata.uniqueSellingPoints || [],
          targetAudience: visionPacket.metadata.targetAudience || "",
          genre: gameDetection.suggestedCategory,
          mood: "",
          coreExperience: ""
        }
      }

      try {
        // Generate implementation packets using AI
        implementationResult = await generateGameImplementationPackets(
          projectNames,
          brainDump,
          gameDetection,
          {
            preferredServer,
            preferredModel,
            existingVision,
            maxRetries: 3
          }
        )

        if (implementationResult) {
          implementationStats.generated = true
          implementationStats.packetCount = implementationResult.packets.length
          implementationStats.estimatedHours = implementationResult.summary.estimatedTotalHours
          console.log(`[Linear Import] Generated ${implementationResult.packets.length} implementation packets (${implementationResult.summary.estimatedTotalHours} estimated hours)`)
        } else {
          // Fall back to default implementation packets
          console.log(`[Linear Import] AI implementation packet generation failed, using defaults`)
          implementationResult = generateDefaultImplementationPackets(projectNames, gameDetection)
          implementationStats.generated = true
          implementationStats.packetCount = implementationResult.packets.length
          implementationStats.estimatedHours = implementationResult.summary.estimatedTotalHours
          implementationStats.error = "AI generation failed, used default template"
        }
      } catch (error) {
        console.error(`[Linear Import] Implementation packet generation error:`, error)
        // Create default implementation packets on error
        implementationResult = generateDefaultImplementationPackets(projectNames, gameDetection)
        implementationStats.generated = true
        implementationStats.packetCount = implementationResult.packets.length
        implementationStats.estimatedHours = implementationResult.summary.estimatedTotalHours
        implementationStats.error = error instanceof Error ? error.message : "Implementation packet generation failed"
      }
    }

    // Save vision and stories as markdown documents if enabled
    const savedDocs: ProjectDoc[] = []
    const markdownStats = { visionDoc: false, storyDocs: 0, error: undefined as string | undefined }

    if (saveToMarkdown && claudiaProjectId) {
      console.log(`[Linear Import] Saving documents to project ${claudiaProjectId}...`)

      try {
        // Save vision document if we have a vision packet
        if (visionPacket && visionPacket.metadata) {
          const visionDoc = await createVisionFromLinearExtraction(claudiaProjectId, {
            projectName: projectNames,
            extractedVision: visionPacket.description,
            decisions: nuanceMap.size > 0
              ? Array.from(nuanceMap.values()).flatMap(n => n.decisions).slice(0, 10)
              : undefined,
            requirements: nuanceMap.size > 0
              ? Array.from(nuanceMap.values()).flatMap(n => n.requirements).slice(0, 10)
              : undefined,
            constraints: nuanceMap.size > 0
              ? Array.from(nuanceMap.values()).flatMap(n => n.constraints).slice(0, 5)
              : undefined,
            sourceIssueId: idsToImport[0]
          })
          savedDocs.push(visionDoc)
          markdownStats.visionDoc = true
          console.log(`[Linear Import] Saved vision document: ${visionDoc.id}`)
        }

        // Save story documents for issues with significant nuance
        if (extractNuance && nuanceMap.size > 0) {
          for (const [issueId, nuance] of nuanceMap.entries()) {
            // Only create story docs for issues with meaningful extracted content
            if (
              nuance.requirements.length >= 2 ||
              nuance.decisions.length >= 2 ||
              (nuance.summary && nuance.summary.length > 100)
            ) {
              const issue = allIssues.find(i => i.id === issueId)
              if (issue) {
                try {
                  const storyDoc = await createStoryFromLinearExtraction(claudiaProjectId, {
                    title: issue.title,
                    summary: nuance.summary || issue.description || "",
                    requirements: nuance.requirements,
                    acceptanceCriteria: nuance.actionItems,
                    context: nuance.context,
                    sourceIssueId: issue.identifier
                  })
                  savedDocs.push(storyDoc)
                  markdownStats.storyDocs++
                } catch (docError) {
                  console.error(`[Linear Import] Failed to save story for ${issue.identifier}:`, docError)
                }
              }
            }
          }
          console.log(`[Linear Import] Saved ${markdownStats.storyDocs} story documents`)
        }
      } catch (error) {
        console.error(`[Linear Import] Error saving markdown documents:`, error)
        markdownStats.error = error instanceof Error ? error.message : "Failed to save documents"
      }
    }

    // Build phases - include vision phase, implementation phase, and default phase
    const phases = []
    let phaseOrder = 0

    if (visionPacket) {
      phases.push({
        id: visionPhaseId,
        name: "Project Vision",
        description: `Vision and store description for ${projectNames}. This defines the ultimate goal of the project.`,
        order: phaseOrder++,
        status: "not_started" as const,
        isVisionPhase: true
      })

      // Add the vision packet to the beginning of packets array
      packets.unshift(visionPacket as unknown as WorkPacket)
    }

    // Add implementation phase and packets if generated
    if (implementationResult && implementationResult.packets.length > 0) {
      phases.push({
        id: implementationPhaseId,
        name: "Game Implementation",
        description: `${implementationResult.packets.length} implementation packets for building ${projectNames}. Estimated ${implementationResult.summary.estimatedTotalHours} hours.`,
        order: phaseOrder++,
        status: "not_started" as const,
        isImplementationPhase: true,
        projectAnalysis: implementationResult.projectAnalysis
      })

      // Convert implementation packets to work packets and add them
      const implementationWorkPackets = implementationToWorkPackets(implementationResult, implementationPhaseId)
      packets.push(...implementationWorkPackets as unknown as WorkPacket[])
    }

    phases.push({
      id: defaultPhaseId,
      name: "Imported from Linear",
      description: `${allIssues.length} issues imported from ${projectNames}`,
      order: phaseOrder,
      status: "not_started" as const
    })

    // Build the projects array for the response
    const projects = importResults.map(result => ({
      name: result.project.name,
      description: result.project.description || "",
      linearProjectId: result.project.id,
      teamIds: result.teams.map(t => t.id),
      progress: result.project.progress,
      // Add game detection info to project
      gameDetection: gameDetection.isGameOrCreative ? {
        isGameOrCreative: true,
        projectType: gameDetection.projectType,
        confidence: gameDetection.confidence,
        suggestedCategory: gameDetection.suggestedCategory
      } : undefined
    }))

    // Count total comments imported
    const totalComments = allIssues.reduce(
      (sum, issue) => sum + (issue.comments?.length || 0),
      0
    )
    console.log(`[Linear Import] Imported ${allIssues.length} issues with ${totalComments} total comments`)

    // Build type counts including vision
    const typeCounts = {
      feature: packets.filter(p => p.type === "feature").length,
      bugfix: packets.filter(p => p.type === "bugfix").length,
      refactor: packets.filter(p => p.type === "refactor").length,
      test: packets.filter(p => p.type === "test").length,
      docs: packets.filter(p => p.type === "docs").length,
      config: packets.filter(p => p.type === "config").length,
      research: packets.filter(p => p.type === "research").length,
      vision: packets.filter(p => p.type === "vision").length
    }

    // Build the import response
    return NextResponse.json({
      success: true,
      projects,
      phases,
      packets,
      summary: {
        totalIssues: allIssues.length,
        totalComments: syncComments ? totalComments : 0,
        commentsImported: syncComments,
        nuanceExtraction: extractNuance ? {
          enabled: true,
          issuesWithComments: nuanceStats.withComments,
          processed: nuanceStats.processed,
          failed: nuanceStats.failed
        } : { enabled: false },
        // Game/creative project detection results
        gameDetection: {
          isGameOrCreative: gameDetection.isGameOrCreative,
          confidence: gameDetection.confidence,
          projectType: gameDetection.projectType,
          suggestedCategory: gameDetection.suggestedCategory,
          matchedKeywords: gameDetection.matchedKeywords.slice(0, 20), // Limit for response size
          visionPacket: visionStats.detected ? {
            generated: visionStats.generated,
            packetId: visionPacket?.id,
            error: visionStats.error
          } : undefined,
          // Implementation packet generation results
          implementationPackets: implementationStats.detected ? {
            generated: implementationStats.generated,
            packetCount: implementationStats.packetCount,
            estimatedHours: implementationStats.estimatedHours,
            projectAnalysis: implementationResult?.projectAnalysis,
            error: implementationStats.error
          } : undefined
        },
        // Markdown document saving results
        markdownDocs: saveToMarkdown && claudiaProjectId ? {
          enabled: true,
          projectId: claudiaProjectId,
          visionDoc: markdownStats.visionDoc,
          storyDocs: markdownStats.storyDocs,
          totalDocs: savedDocs.length,
          docIds: savedDocs.map(d => d.id),
          error: markdownStats.error
        } : { enabled: false },
        byPriority: {
          critical: packets.filter(p => p.priority === "critical").length,
          high: packets.filter(p => p.priority === "high").length,
          medium: packets.filter(p => p.priority === "medium").length,
          low: packets.filter(p => p.priority === "low").length
        },
        byStatus: {
          queued: packets.filter(p => p.status === "queued").length,
          in_progress: packets.filter(p => p.status === "in_progress").length,
          completed: packets.filter(p => p.status === "completed").length
        },
        byType: typeCounts
      }
    })

  } catch (error) {
    console.error("Linear import error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    )
  }
}
