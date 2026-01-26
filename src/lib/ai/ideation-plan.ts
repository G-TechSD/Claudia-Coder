/**
 * Ideation Plan Generator
 *
 * Specialized build plan generator for "ideas" projects that:
 * - Creates research/brainstorm packets instead of code packets
 * - Explores user's questions and uncertainties
 * - Proposes concrete project ideas based on analysis
 * - Outputs markdown documents, not code
 *
 * This is for users who are unsure what's possible and want
 * to explore options before committing to building something.
 */

import type { WorkPacket, BuildPlan, BuildPhase } from "./build-plan"

export interface IdeationPlan {
  id: string
  projectId: string
  createdAt: string
  title: string
  summary: string

  // Core questions to explore
  questions: string[]

  // Research packets
  packets: IdeationPacket[]

  // Proposed project ideas (generated after research)
  proposedProjects?: ProposedProject[]
}

export interface IdeationPacket {
  id: string
  title: string
  description: string
  type: "research" | "brainstorm" | "analysis" | "comparison" | "proposal"
  priority: "high" | "medium" | "low"
  status: "queued" | "in_progress" | "completed"

  // The actual prompt/question to explore
  prompt: string

  // Expected output format
  outputFormat: "markdown" | "list" | "comparison_table" | "report"

  // What this packet will produce
  expectedOutput: string

  // Dependencies
  dependsOn?: string[]

  // Generated content (filled after execution)
  content?: string
  generatedAt?: string
}

export interface ProposedProject {
  id: string
  name: string
  description: string
  category: "web" | "mobile" | "api" | "tool" | "game" | "other"
  complexity: "simple" | "moderate" | "complex"
  keyFeatures: string[]
  techSuggestions?: string[]
  estimatedEffort?: string
  pros: string[]
  cons: string[]
  sourcePacketId: string // Which research packet generated this idea
}

/**
 * System prompt for ideation plan generation
 */
export const IDEATION_PLAN_SYSTEM_PROMPT = `You are a creative research assistant helping someone explore possibilities.

Your job is to:
1. Understand what the user is curious about or unsure of
2. Break their questions into specific research tasks
3. Plan how to explore different angles and options
4. Eventually propose concrete project ideas they could build

You do NOT write code. You create research plans that output markdown documents.

RESEARCH PACKET TYPES:
- "research": Deep dive into a specific topic (outputs detailed markdown report)
- "brainstorm": Generate many ideas/options (outputs numbered list with descriptions)
- "analysis": Evaluate and compare options (outputs pros/cons analysis)
- "comparison": Side-by-side comparison of approaches (outputs comparison table)
- "proposal": Propose concrete project ideas (outputs project descriptions)

For each packet, provide:
- A clear title
- What question it answers
- The specific prompt to use when generating content
- What the output should look like

The goal is to help someone who is UNSURE become CONFIDENT about what to build.

OUTPUT FORMAT: Return valid JSON only.
- No markdown code blocks
- Start with { and end with }
- Use double quotes for all strings`

/**
 * Generate an ideation plan from user input
 */
export function generateIdeationPlanPrompt(
  userInput: string,
  projectContext?: {
    name?: string
    existingIdeas?: string[]
    constraints?: string[]
  }
): string {
  const contextSection = projectContext ? `
ADDITIONAL CONTEXT:
${projectContext.name ? `- Project Name: ${projectContext.name}` : ""}
${projectContext.existingIdeas?.length ? `- Existing Ideas: ${projectContext.existingIdeas.join(", ")}` : ""}
${projectContext.constraints?.length ? `- Constraints: ${projectContext.constraints.join(", ")}` : ""}
` : ""

  return `USER'S INPUT:
"""
${userInput}
"""
${contextSection}
Based on the above, create an ideation plan with research packets.

Generate 4-8 packets that:
1. Start with understanding/research packets (what exists, what's possible)
2. Continue with brainstorm packets (generate many options)
3. Include analysis packets (evaluate the options)
4. End with proposal packets (recommend specific projects to build)

Return JSON in this format:
{
  "title": "Exploration: [topic]",
  "summary": "Brief description of what we're exploring",
  "questions": ["Key question 1", "Key question 2", ...],
  "packets": [
    {
      "id": "packet-1",
      "title": "Research: [topic]",
      "description": "What this packet explores",
      "type": "research",
      "priority": "high",
      "prompt": "The detailed prompt to generate this content...",
      "outputFormat": "markdown",
      "expectedOutput": "A comprehensive report on..."
    },
    ...
  ]
}`
}

/**
 * Convert ideation packets to standard WorkPacket format
 * for compatibility with existing packet infrastructure
 */
export function ideationPacketsToWorkPackets(
  ideationPackets: IdeationPacket[],
  phaseId: string = "ideation"
): WorkPacket[] {
  return ideationPackets.map((packet) => ({
    id: packet.id,
    phaseId,
    title: packet.title,
    description: packet.description,
    type: mapIdeationType(packet.type),
    priority: packet.priority === "high" ? "high" : packet.priority === "medium" ? "medium" : "low",
    status: packet.status === "completed" ? "completed" : "queued",
    tasks: [
      {
        id: `${packet.id}-task-1`,
        description: packet.prompt,
        completed: packet.status === "completed",
        order: 0
      }
    ],
    suggestedTaskType: "documentation", // All ideation uses doc-style generation
    blockedBy: packet.dependsOn || [],
    blocks: [],
    estimatedTokens: 2000,
    acceptanceCriteria: [
      `Generates ${packet.outputFormat} output`,
      packet.expectedOutput
    ],
    metadata: {
      isIdeation: true,
      originalPrompt: packet.prompt,
      outputFormat: packet.outputFormat,
      ideationType: packet.type
    }
  }))
}

function mapIdeationType(type: IdeationPacket["type"]): WorkPacket["type"] {
  switch (type) {
    case "research":
      return "research"
    case "brainstorm":
      return "brainstorm"
    case "analysis":
      return "analysis"
    case "comparison":
      return "analysis"
    case "proposal":
      return "report"
    default:
      return "research"
  }
}

/**
 * Create a minimal build plan structure for ideation projects
 */
export function createIdeationBuildPlan(
  projectId: string,
  title: string,
  packets: WorkPacket[]
): BuildPlan {
  const now = new Date().toISOString()

  const phase: BuildPhase = {
    id: "ideation-phase",
    name: "Ideation & Research",
    description: "Explore possibilities and generate project ideas",
    order: 0,
    packetIds: packets.map(p => p.id),
    dependencies: [],
    estimatedEffort: {
      optimistic: 1,
      realistic: 2,
      pessimistic: 4,
      confidence: "medium"
    },
    successCriteria: [
      "All research questions answered",
      "Multiple project options identified",
      "Clear recommendation provided"
    ]
  }

  return {
    id: `ideation-plan-${Date.now()}`,
    projectId,
    createdAt: now,
    status: "approved", // Ideation plans are auto-approved
    spec: {
      name: title,
      description: "Ideation and research exploration",
      objectives: [
        "Understand the problem space",
        "Explore possible solutions",
        "Identify viable project ideas"
      ],
      nonGoals: [
        "Writing code",
        "Building prototypes",
        "Detailed technical specifications"
      ],
      assumptions: [
        "User is exploring options",
        "Final direction not yet decided"
      ],
      risks: [
        "Analysis paralysis - too many options",
        "Missing important considerations"
      ],
      techStack: [] // No tech stack for ideation
    },
    phases: [phase],
    packets,
    modelAssignments: [],
    constraints: {
      requireLocalFirst: true,
      requireHumanApproval: [],
      maxParallelPackets: 3
    },
    generatedBy: "ideation-generator",
    version: 1
  }
}

/**
 * Quick ideation plan generator (no LLM required)
 * Creates sensible default packets based on user input analysis
 */
export function generateQuickIdeationPlan(
  userInput: string,
  projectName?: string
): { plan: IdeationPlan; packets: IdeationPacket[] } {
  const now = new Date().toISOString()
  const planId = `ideation-${Date.now()}`

  // Analyze input for keywords to customize packets
  const input = userInput.toLowerCase()
  const hasBusinessContext = /market|customer|revenue|business|monetize|sell/i.test(userInput)
  const hasTechContext = /ai|software|app|platform|system|technology/i.test(userInput)
  const hasCompetitionContext = /competitor|alternative|existing|market/i.test(userInput)

  const packets: IdeationPacket[] = []
  let packetNum = 1

  // Always start with understanding packet
  packets.push({
    id: `${planId}-p${packetNum++}`,
    title: "Understanding the Space",
    description: "Research the current landscape and existing solutions",
    type: "research",
    priority: "high",
    status: "queued",
    prompt: `Based on the following context, provide a comprehensive overview of the current landscape:

Context: "${userInput}"

Include:
1. What currently exists in this space
2. Key players and solutions
3. Common approaches and patterns
4. Gaps or opportunities
5. Recent trends or developments

Output a well-structured markdown report with sections for each area.`,
    outputFormat: "markdown",
    expectedOutput: "A comprehensive landscape analysis"
  })

  // Brainstorm ideas packet
  packets.push({
    id: `${planId}-p${packetNum++}`,
    title: "Generate Ideas",
    description: "Brainstorm 10-15 potential approaches or solutions",
    type: "brainstorm",
    priority: "high",
    status: "queued",
    prompt: `Based on the following context, generate 10-15 creative ideas or approaches:

Context: "${userInput}"

For each idea, provide:
- A clear name/title
- 2-3 sentence description
- Key differentiator or unique angle
- Potential challenges

Be creative and explore both conventional and unconventional approaches. Include ideas at different scales (quick wins to ambitious projects).`,
    outputFormat: "list",
    expectedOutput: "A numbered list of 10-15 ideas with descriptions",
    dependsOn: [`${planId}-p1`]
  })

  // Add business analysis if context suggests it
  if (hasBusinessContext) {
    packets.push({
      id: `${planId}-p${packetNum++}`,
      title: "Market Opportunity Analysis",
      description: "Analyze market potential and business viability",
      type: "analysis",
      priority: "medium",
      status: "queued",
      prompt: `Analyze the business opportunity for solutions in this space:

Context: "${userInput}"

Include:
1. Target market segments and size estimates
2. Potential revenue models
3. Go-to-market considerations
4. Competitive positioning
5. Key success factors
6. Risk factors

Output a structured business analysis.`,
      outputFormat: "markdown",
      expectedOutput: "A business opportunity analysis",
      dependsOn: [`${planId}-p1`]
    })
  }

  // Add tech analysis if context suggests it
  if (hasTechContext) {
    packets.push({
      id: `${planId}-p${packetNum++}`,
      title: "Technical Approaches",
      description: "Explore different technical implementation options",
      type: "comparison",
      priority: "medium",
      status: "queued",
      prompt: `For the following context, outline 3-5 different technical approaches:

Context: "${userInput}"

For each approach:
- Name the approach/architecture
- Describe the core technology choices
- List required skills/expertise
- Estimate complexity (low/medium/high)
- Note pros and cons
- Suggest when this approach is best

Create a comparison that helps decide which technical path to take.`,
      outputFormat: "comparison_table",
      expectedOutput: "A comparison of technical approaches",
      dependsOn: [`${planId}-p1`]
    })
  }

  // Evaluation packet
  packets.push({
    id: `${planId}-p${packetNum++}`,
    title: "Evaluate Top Options",
    description: "Deep dive analysis on the most promising ideas",
    type: "analysis",
    priority: "high",
    status: "queued",
    prompt: `Based on the brainstormed ideas and research, evaluate the top 3-5 most promising options:

Context: "${userInput}"

For each option:
1. What makes it promising
2. Required resources/effort
3. Potential impact/value
4. Key risks and mitigations
5. First steps to validate

Provide a clear recommendation on which options deserve further exploration.`,
    outputFormat: "markdown",
    expectedOutput: "Detailed evaluation of top options with recommendations",
    dependsOn: [`${planId}-p2`]
  })

  // Final proposal packet
  packets.push({
    id: `${planId}-p${packetNum++}`,
    title: "Project Proposals",
    description: "Concrete project proposals ready to build",
    type: "proposal",
    priority: "high",
    status: "queued",
    prompt: `Based on all the research and analysis, propose 2-3 concrete projects that could be built:

Context: "${userInput}"

For each proposed project:
1. **Project Name**: A catchy, descriptive name
2. **One-Line Pitch**: What it is in one sentence
3. **Problem Solved**: The specific problem it addresses
4. **Key Features**: 5-7 core features
5. **Target Users**: Who would use this
6. **Tech Stack Suggestion**: Recommended technologies
7. **MVP Scope**: What a minimum viable version includes
8. **Estimated Complexity**: Simple / Moderate / Complex
9. **Why This**: Why this project is worth building

Make these proposals specific enough that someone could start building immediately.`,
    outputFormat: "report",
    expectedOutput: "2-3 detailed project proposals ready for implementation",
    dependsOn: [`${planId}-p${packetNum - 2}`] // Depends on evaluation
  })

  const plan: IdeationPlan = {
    id: planId,
    projectId: "", // Set by caller
    createdAt: now,
    title: projectName || extractTitle(userInput),
    summary: `Exploring: ${userInput.slice(0, 200)}${userInput.length > 200 ? "..." : ""}`,
    questions: extractQuestions(userInput),
    packets
  }

  return { plan, packets }
}

/**
 * Extract a title from user input
 */
function extractTitle(input: string): string {
  // Look for common title patterns
  const patterns = [
    /ideas?\s+(?:for|about|on)\s+(.+?)(?:\.|$)/i,
    /ways?\s+to\s+(.+?)(?:\.|$)/i,
    /how\s+(?:to|can|could)\s+(.+?)(?:\?|$)/i,
    /explore\s+(.+?)(?:\.|$)/i
  ]

  for (const pattern of patterns) {
    const match = input.match(pattern)
    if (match && match[1]) {
      const title = match[1].trim()
      if (title.length > 5 && title.length < 100) {
        return `Ideas: ${title.charAt(0).toUpperCase() + title.slice(1)}`
      }
    }
  }

  // Fallback: use first meaningful phrase
  const words = input.split(/\s+/).slice(0, 6).join(" ")
  return `Exploration: ${words}...`
}

/**
 * Extract key questions from user input
 */
function extractQuestions(input: string): string[] {
  const questions: string[] = []

  // Find explicit questions
  const questionMatches = input.match(/[^.!?]*\?/g)
  if (questionMatches) {
    questions.push(...questionMatches.map(q => q.trim()))
  }

  // Generate implicit questions based on content
  if (/market|business|revenue/i.test(input)) {
    questions.push("What is the market opportunity?")
  }
  if (/ai|technology|software/i.test(input)) {
    questions.push("What technical approaches are available?")
  }
  if (/competitor|alternative/i.test(input)) {
    questions.push("What solutions already exist?")
  }
  if (questions.length === 0) {
    questions.push(
      "What are the possibilities in this space?",
      "What would be the best approach?",
      "What should we build?"
    )
  }

  return questions.slice(0, 5) // Limit to 5 questions
}
