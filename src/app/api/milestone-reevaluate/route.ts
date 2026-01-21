import { NextRequest, NextResponse } from "next/server"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"

/**
 * Milestone Re-evaluation API
 *
 * After each milestone/phase completes, this API analyzes the completed work
 * and suggests updates to remaining packets:
 * - Priority adjustments based on what was accomplished
 * - Skip flags for packets that are no longer necessary
 * - New packets that emerged from the completed work
 *
 * The model CANNOT delete packets, only mark them to skip with a reason.
 * This preserves the full audit trail while allowing intelligent prioritization.
 */

interface CompletedPacket {
  id: string
  title: string
  description: string
  status: string
}

interface RemainingPacket {
  id: string
  title: string
  description: string
  phaseId?: string
  phaseName?: string
  priority: string
  status: string
  skip?: boolean
  skipReason?: string
}

interface Phase {
  id: string
  name: string
  description: string
  order: number
}

interface ReevaluationResult {
  updatedPackets: RemainingPacket[]
  stats: {
    priorityChanges: number
    packetsToSkip: number
    newPacketsAdded: number
  }
  reasoning: string
}

const REEVALUATION_SYSTEM_PROMPT = `You are a project planning assistant that re-evaluates work packets after a milestone is completed.

Your job is to analyze what was accomplished in the completed milestone and update the remaining packets accordingly.

IMPORTANT RULES:
1. You CANNOT delete packets - only mark them to skip with a reason
2. You CAN adjust priorities (critical, high, medium, low)
3. You CAN suggest skipping packets that are no longer needed
4. You CAN suggest new packets if the completed work revealed new requirements
5. Stay laser-focused on the project goals - don't add scope creep
6. Keep remaining work aligned with the original project vision

For each remaining packet, evaluate:
- Is this still necessary given what was accomplished?
- Should the priority change based on dependencies or new insights?
- Is there any new context that changes how this should be approached?

Output your analysis as JSON in this exact format:
{
  "updatedPackets": [
    {
      "id": "existing-packet-id",
      "title": "Packet Title",
      "description": "Updated description if needed",
      "priority": "high",
      "skip": false,
      "skipReason": null
    },
    {
      "id": "existing-packet-id-2",
      "title": "No Longer Needed Packet",
      "description": "...",
      "priority": "low",
      "skip": true,
      "skipReason": "This was addressed in the completed milestone by..."
    }
  ],
  "newPackets": [
    {
      "title": "New Discovered Requirement",
      "description": "During implementation we discovered...",
      "priority": "high",
      "phaseId": "phase-id-to-add-to",
      "type": "feature"
    }
  ],
  "reasoning": "Brief explanation of key changes made"
}`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      projectId,
      projectName,
      completedPhaseId,
      completedPhaseName,
      completedPackets,
      remainingPackets,
      phases
    } = body as {
      projectId: string
      projectName: string
      completedPhaseId: string
      completedPhaseName: string
      completedPackets: CompletedPacket[]
      remainingPackets: RemainingPacket[]
      phases: Phase[]
    }

    if (!completedPackets || !remainingPackets) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // If no remaining packets, nothing to re-evaluate
    if (remainingPackets.length === 0) {
      return NextResponse.json({
        updatedPackets: [],
        stats: { priorityChanges: 0, packetsToSkip: 0, newPacketsAdded: 0 },
        reasoning: "No remaining packets to re-evaluate"
      })
    }

    // Build the prompt for the LLM
    const userPrompt = buildReevaluationPrompt(
      projectName,
      completedPhaseName,
      completedPackets,
      remainingPackets,
      phases
    )

    // Call local LLM for re-evaluation (this is a quick operation)
    const response = await generateWithLocalLLM(
      REEVALUATION_SYSTEM_PROMPT,
      userPrompt,
      {
        temperature: 0.3, // Lower temperature for more consistent results
        max_tokens: 4096
      }
    )

    if (response.error) {
      console.error("[milestone-reevaluate] LLM error:", response.error)
      // Return original packets unchanged if LLM fails
      return NextResponse.json({
        updatedPackets: remainingPackets,
        stats: { priorityChanges: 0, packetsToSkip: 0, newPacketsAdded: 0 },
        reasoning: "Re-evaluation skipped due to LLM error"
      })
    }

    // Parse the LLM response
    const result = parseReevaluationResponse(response.content, remainingPackets, phases)

    console.log(`[milestone-reevaluate] Completed re-evaluation for phase "${completedPhaseName}":`, result.stats)

    return NextResponse.json(result)

  } catch (error) {
    console.error("[milestone-reevaluate] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Re-evaluation failed" },
      { status: 500 }
    )
  }
}

function buildReevaluationPrompt(
  projectName: string,
  completedPhaseName: string,
  completedPackets: CompletedPacket[],
  remainingPackets: RemainingPacket[],
  phases: Phase[]
): string {
  const completedSummary = completedPackets.map(p =>
    `- [${p.status.toUpperCase()}] ${p.title}: ${p.description}`
  ).join("\n")

  const remainingSummary = remainingPackets.map(p =>
    `- [${p.id}] ${p.title} (${p.priority}${p.skip ? ', SKIP' : ''})\n  Phase: ${p.phaseName || 'Unassigned'}\n  ${p.description}`
  ).join("\n\n")

  const phasesSummary = phases
    .sort((a, b) => a.order - b.order)
    .map(p => `${p.order}. ${p.name}: ${p.description}`)
    .join("\n")

  return `# Milestone Re-evaluation Request

## Project: ${projectName}

## Just Completed Milestone: "${completedPhaseName}"

### Work Completed in This Milestone:
${completedSummary}

### Remaining Phases:
${phasesSummary}

### Remaining Packets to Re-evaluate:
${remainingSummary}

---

Based on the work completed in "${completedPhaseName}", analyze the remaining packets and:

1. Identify any packets that can now be SKIPPED (work was already done, no longer needed, or dependencies changed)
2. Adjust priorities if the completed work changes what's most important next
3. Note any new packets needed (only if truly necessary - avoid scope creep)

Remember: You cannot delete packets, only mark them to skip with a clear reason.

Provide your analysis as JSON following the format in the system prompt.`
}

function parseReevaluationResponse(
  content: string,
  originalPackets: RemainingPacket[],
  phases: Phase[]
): ReevaluationResult {
  try {
    // Extract JSON from the response (may be wrapped in markdown code blocks)
    let jsonStr = content
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    } else {
      // Try to find raw JSON
      const startIdx = content.indexOf("{")
      const endIdx = content.lastIndexOf("}")
      if (startIdx !== -1 && endIdx !== -1) {
        jsonStr = content.slice(startIdx, endIdx + 1)
      }
    }

    const parsed = JSON.parse(jsonStr)

    // Merge updates with original packets (preserve IDs, apply changes)
    const updatedPackets = originalPackets.map(original => {
      const update = parsed.updatedPackets?.find((u: RemainingPacket) => u.id === original.id)
      if (update) {
        return {
          ...original,
          priority: update.priority || original.priority,
          skip: update.skip ?? original.skip,
          skipReason: update.skipReason || original.skipReason,
          description: update.description || original.description
        }
      }
      return original
    })

    // Add new packets if any (generate IDs for them)
    const newPackets = (parsed.newPackets || []).map((np: { title: string; description: string; priority: string; phaseId?: string; type?: string }, idx: number) => ({
      id: `new-${Date.now()}-${idx}`,
      title: np.title,
      description: np.description,
      priority: np.priority || "medium",
      status: "ready",
      phaseId: np.phaseId || phases[0]?.id,
      phaseName: phases.find(p => p.id === np.phaseId)?.name || phases[0]?.name,
      type: np.type || "feature",
      skip: false
    }))

    // Calculate stats
    let priorityChanges = 0
    let packetsToSkip = 0

    originalPackets.forEach(original => {
      const updated = updatedPackets.find(u => u.id === original.id)
      if (updated) {
        if (updated.priority !== original.priority) priorityChanges++
        if (updated.skip && !original.skip) packetsToSkip++
      }
    })

    return {
      updatedPackets: [...updatedPackets, ...newPackets],
      stats: {
        priorityChanges,
        packetsToSkip,
        newPacketsAdded: newPackets.length
      },
      reasoning: parsed.reasoning || "No reasoning provided"
    }
  } catch (parseError) {
    console.error("[milestone-reevaluate] Failed to parse LLM response:", parseError)
    // Return original packets unchanged
    return {
      updatedPackets: originalPackets,
      stats: { priorityChanges: 0, packetsToSkip: 0, newPacketsAdded: 0 },
      reasoning: "Failed to parse re-evaluation response"
    }
  }
}
