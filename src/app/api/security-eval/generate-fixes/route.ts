/**
 * Generate Fix Work Packets from Security Findings
 * Creates actionable work packets for each security issue
 */

import { NextRequest, NextResponse } from "next/server"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"
import type { SecurityFinding } from "@/lib/data/types"

const FIX_GENERATION_PROMPT = `You are a senior security engineer creating fix recommendations.

For each security finding, generate a detailed work packet that:
1. Clearly describes what needs to be fixed
2. Provides step-by-step implementation guidance
3. Includes the actual code changes needed
4. Notes any testing requirements
5. Flags if the fix might break existing functionality
6. Suggests how to verify the fix works

Be specific and actionable. Developers should be able to implement fixes directly from your recommendations.

IMPORTANT: Consider cascading effects. If fixing one issue might break something else, include those fixes too.

Return a JSON array of work packets.`

interface WorkPacket {
  id: string
  title: string
  description: string
  priority: "critical" | "high" | "medium" | "low"
  type: "security-fix"
  findingIds: string[]

  // Implementation details
  tasks: Array<{
    title: string
    description: string
    codeChanges?: Array<{
      file: string
      changeType: "modify" | "add" | "delete"
      before?: string
      after?: string
    }>
  }>

  // Testing
  testingRequirements: string[]
  verificationSteps: string[]

  // Risk assessment
  breakingRisk: "none" | "low" | "medium" | "high"
  breakingMitigation?: string

  // Effort estimation
  estimatedHours: number
}

function generateId(): string {
  return `fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      findings,
      projectName,
      groupRelated = true, // Group related findings into single packets
      preferredProvider
    } = body

    if (!findings || !Array.isArray(findings) || findings.length === 0) {
      return NextResponse.json(
        { error: "Security findings are required" },
        { status: 400 }
      )
    }

    // Build prompt with findings
    const findingsJson = JSON.stringify(findings, null, 2)

    const userPrompt = `PROJECT: ${projectName || "Unknown Project"}

SECURITY FINDINGS TO FIX:
${findingsJson}

${groupRelated ? "Group related findings into single work packets where fixes overlap." : "Create individual work packets for each finding."}

Generate work packets with this structure:
[
  {
    "title": "Fix SQL Injection in User Query",
    "description": "Detailed description of what needs to be fixed",
    "priority": "critical",
    "findingIds": ["sec-123", "sec-124"],
    "tasks": [
      {
        "title": "Replace raw SQL with parameterized query",
        "description": "Step by step instructions",
        "codeChanges": [
          {
            "file": "src/db/users.ts",
            "changeType": "modify",
            "before": "db.query('SELECT * FROM users WHERE id = ' + id)",
            "after": "db.query('SELECT * FROM users WHERE id = ?', [id])"
          }
        ]
      }
    ],
    "testingRequirements": ["Add SQL injection test cases", "Verify existing queries still work"],
    "verificationSteps": ["Run security scanner", "Attempt injection manually"],
    "breakingRisk": "low",
    "breakingMitigation": "Run all integration tests after changes",
    "estimatedHours": 2
  }
]

Return ONLY the JSON array.`

    const llmResponse = await generateWithLocalLLM(
      FIX_GENERATION_PROMPT,
      userPrompt,
      {
        temperature: 0.3,
        max_tokens: 8192,
        preferredServer: preferredProvider
      }
    )

    if (llmResponse.error) {
      return NextResponse.json({
        error: llmResponse.error
      }, { status: 503 })
    }

    // Parse work packets
    let jsonStr = llmResponse.content.trim()
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }

    let packets: WorkPacket[] = []
    try {
      const parsed = JSON.parse(jsonStr)
      packets = (Array.isArray(parsed) ? parsed : [parsed]).map((p: Record<string, unknown>) => ({
        id: generateId(),
        title: p.title as string || "Security Fix",
        description: p.description as string || "",
        priority: p.priority as WorkPacket["priority"] || "medium",
        type: "security-fix" as const,
        findingIds: p.findingIds as string[] || [],
        tasks: p.tasks as WorkPacket["tasks"] || [],
        testingRequirements: p.testingRequirements as string[] || [],
        verificationSteps: p.verificationSteps as string[] || [],
        breakingRisk: p.breakingRisk as WorkPacket["breakingRisk"] || "low",
        breakingMitigation: p.breakingMitigation as string,
        estimatedHours: p.estimatedHours as number || 1
      }))
    } catch (error) {
      console.error("Failed to parse work packets:", error)
      return NextResponse.json({
        error: "Failed to parse fix recommendations"
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      packets,
      totalEstimatedHours: packets.reduce((sum, p) => sum + p.estimatedHours, 0),
      source: llmResponse.server,
      model: llmResponse.model
    })

  } catch (error) {
    console.error("Fix generation error:", error)

    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to generate fixes"
    }, { status: 500 })
  }
}
