/**
 * Ideation Detector
 *
 * Determines if user input describes:
 * - A clear software project to BUILD
 * - An exploration/ideation that needs RESEARCH
 *
 * This runs BEFORE any interview to route to the correct flow.
 */

export interface DetectionResult {
  type: "build" | "ideation"
  confidence: number  // 0-1
  reason: string
  suggestedApproach: string
}

/**
 * Analyze user input to determine if it's a build request or ideation request
 */
export function detectProjectType(input: string): DetectionResult {
  const text = input.toLowerCase().trim()

  let buildScore = 0
  let ideationScore = 0
  const reasons: string[] = []

  // === STRONG BUILD SIGNALS ===

  // Explicit build language
  if (/\b(build|create|develop|make|implement)\s+(a|an|the|my)\s+\w+/i.test(input)) {
    buildScore += 3
    reasons.push("Explicit build language")
  }

  // Technical stack mentioned
  if (/\b(react|vue|angular|node|python|typescript|javascript|rust|go|swift|kotlin|flutter|nextjs|express|django|rails|laravel)\b/i.test(input)) {
    buildScore += 2
    reasons.push("Technical stack specified")
  }

  // Clear app type mentioned
  if (/\b(app|application|website|webapp|api|backend|frontend|mobile app|desktop app|cli|dashboard|portal|saas)\b/i.test(input)) {
    buildScore += 2
    reasons.push("Clear app type mentioned")
  }

  // Feature-specific language
  if (/\b(authentication|login|signup|crud|database|user management|admin panel|payment|checkout)\b/i.test(input)) {
    buildScore += 1
    reasons.push("Specific features mentioned")
  }

  // === STRONG IDEATION SIGNALS ===

  // Questions without clear answers
  if (/\b(what|how|could|should|might|would)\s+(we|i|you|one)\b/i.test(input)) {
    ideationScore += 2
    reasons.push("Open-ended questions")
  }

  // Exploration language
  if (/\b(explore|brainstorm|ideas?|options?|possibilities|approaches|ways to|research|investigate|think about|consider)\b/i.test(input)) {
    ideationScore += 3
    reasons.push("Exploration language")
  }

  // Conversation/context pasting (chat logs, meeting notes)
  if (/\b(you sent|he said|she said|we discussed|charles|meeting|call|conversation)\b/i.test(input)) {
    ideationScore += 2
    reasons.push("Conversation context detected")
  }

  // Market/business exploration
  if (/\b(market|opportunity|potential|viable|competitors?|industry|customers?|revenue|monetize|business model)\b/i.test(input)) {
    ideationScore += 1
    reasons.push("Business exploration")
  }

  // Uncertainty markers
  if (/\b(not sure|uncertain|maybe|perhaps|wondering|figuring out|haven't decided|don't know)\b/i.test(input)) {
    ideationScore += 2
    reasons.push("Uncertainty expressed")
  }

  // Help with thinking/deciding
  if (/\b(help me (think|figure|decide|understand)|come up with|generate|list of|dozen|several|multiple)\b/i.test(input)) {
    ideationScore += 2
    reasons.push("Asking for ideation help")
  }

  // Trade show / demonstration context
  if (/\b(trade show|roadshow|demo|showcase|display|presentation|exhibition|booth)\b/i.test(input)) {
    ideationScore += 1
    reasons.push("Presentation/showcase context")
  }

  // === LENGTH AND STRUCTURE SIGNALS ===

  // Very short input with no clear direction
  const wordCount = input.split(/\s+/).length
  if (wordCount < 20 && buildScore === 0) {
    ideationScore += 1
    reasons.push("Brief input without clear direction")
  }

  // Long conversational input (pasted context)
  if (wordCount > 100 && /\n/.test(input)) {
    ideationScore += 1
    reasons.push("Long contextual input")
  }

  // No verbs indicating action
  if (!/\b(build|create|make|develop|implement|write|code)\b/i.test(input)) {
    ideationScore += 1
    reasons.push("No build action verbs")
  }

  // Calculate final scores
  const totalScore = buildScore + ideationScore
  const buildConfidence = totalScore > 0 ? buildScore / totalScore : 0.5
  const ideationConfidence = totalScore > 0 ? ideationScore / totalScore : 0.5

  // Determine type
  const type = buildScore > ideationScore ? "build" : "ideation"
  const confidence = type === "build" ? buildConfidence : ideationConfidence

  // Generate approach suggestion
  let suggestedApproach: string
  if (type === "build") {
    suggestedApproach = "Generate a build plan with code work packets"
  } else {
    if (/\b(ways to|ideas for|options for)\b/i.test(input)) {
      suggestedApproach = "Generate a list of viable approaches"
    } else if (/\b(research|investigate|understand)\b/i.test(input)) {
      suggestedApproach = "Create a research report with findings"
    } else {
      suggestedApproach = "Create an understanding report and explore options"
    }
  }

  return {
    type,
    confidence: Math.round(confidence * 100) / 100,
    reason: reasons.join(", ") || "No strong signals detected",
    suggestedApproach
  }
}

/**
 * Generate an understanding report from user input
 * This is shown immediately so user can confirm/refine
 */
export interface UnderstandingReport {
  title: string
  summary: string
  keyPoints: string[]
  questions: string[]  // Questions we still have
  suggestedPackets: IdeationPacket[]
}

export interface IdeationPacket {
  id: string
  title: string
  description: string
  type: "research" | "brainstorm" | "analysis" | "report"
  outputFormat: "markdown" | "list" | "comparison"
  prompt: string  // The actual task for Claude to execute
}

/**
 * Parse user input and generate an understanding report
 * This uses simple heuristics - for LLM-powered version, use the API
 */
export function generateQuickUnderstanding(input: string): UnderstandingReport {
  const lines = input.split(/\n/).filter(l => l.trim())

  // Extract key entities and topics
  const topics: string[] = []
  const questions: string[] = []

  // Look for questions in the input
  for (const line of lines) {
    if (/\?$/.test(line.trim())) {
      questions.push(line.trim())
    }
  }

  // Extract potential topics (nouns, proper nouns)
  const topicMatches = input.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
  const uniqueTopics = [...new Set(topicMatches)].slice(0, 5)
  topics.push(...uniqueTopics)

  // Generate title
  const title = uniqueTopics.length > 0
    ? `Ideas: ${uniqueTopics.slice(0, 2).join(" & ")}`
    : "Ideas Exploration"

  // Generate suggested packets based on context
  const suggestedPackets: IdeationPacket[] = []

  // Always suggest a core ideation packet
  suggestedPackets.push({
    id: `ideation-${Date.now()}-1`,
    title: "Generate Ideas List",
    description: "Brainstorm 10-15 viable approaches based on the context",
    type: "brainstorm",
    outputFormat: "list",
    prompt: `Based on the following context, generate a comprehensive list of 10-15 viable ideas or approaches. For each idea, include:
- A clear title
- 2-3 sentence description
- Key benefits
- Potential challenges

Context:
${input}

Output as a well-formatted markdown list.`
  })

  // Add market/opportunity analysis if business-related
  if (/\b(market|business|customer|revenue|sell|monetize)\b/i.test(input)) {
    suggestedPackets.push({
      id: `ideation-${Date.now()}-2`,
      title: "Market Opportunity Analysis",
      description: "Analyze market potential and competitive landscape",
      type: "analysis",
      outputFormat: "markdown",
      prompt: `Analyze the market opportunity for the following concept. Include:
- Target market segments
- Competitive landscape
- Potential revenue models
- Key success factors

Context:
${input}`
    })
  }

  // Add technical feasibility if tech-related
  if (/\b(ai|technology|software|system|platform|app)\b/i.test(input)) {
    suggestedPackets.push({
      id: `ideation-${Date.now()}-3`,
      title: "Technical Approaches",
      description: "Explore technical implementation options",
      type: "research",
      outputFormat: "comparison",
      prompt: `For the following concept, outline 3-5 different technical approaches. For each approach:
- Describe the technical solution
- List required technologies/skills
- Estimate complexity (low/medium/high)
- Note pros and cons

Context:
${input}`
    })
  }

  return {
    title,
    summary: input.slice(0, 500) + (input.length > 500 ? "..." : ""),
    keyPoints: topics.map(t => `Involves: ${t}`),
    questions: questions.length > 0 ? questions : [
      "What specific outcomes are you hoping to achieve?",
      "What constraints should we consider?",
      "Who is the target audience?"
    ],
    suggestedPackets
  }
}
