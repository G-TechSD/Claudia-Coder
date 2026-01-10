/**
 * Nuance Extraction Module
 *
 * Extracts key decisions, requirements, and context from Linear comments
 * and other discussion threads to provide richer context for packet generation.
 *
 * This module implements a two-pass approach:
 * 1. First pass: Extract all key points from comments
 * 2. Second pass: Use extracted context to generate better packets
 */

import { generateWithLocalLLM } from "@/lib/llm/local-llm"

export interface LinearComment {
  id: string
  body: string
  createdAt: string
  updatedAt: string
  user?: {
    id: string
    name: string
    email: string
  }
}

export interface ExtractedNuance {
  // Key decisions made in the discussion
  decisions: string[]
  // Requirements explicitly or implicitly stated
  requirements: string[]
  // Technical constraints mentioned
  constraints: string[]
  // Blockers or concerns raised
  concerns: string[]
  // Action items or next steps mentioned
  actionItems: string[]
  // Important context that affects implementation
  context: string[]
  // Stakeholders mentioned and their preferences
  stakeholderNotes: string[]
  // Summary of the overall discussion
  summary: string
  // Raw extracted points for debugging
  rawPoints: string[]
}

/**
 * System prompt for nuance extraction - designed to work with smaller models
 */
export const NUANCE_EXTRACTION_SYSTEM_PROMPT = `You are extracting key information from project discussion comments.

Your task is to read ALL comments carefully and extract:
1. DECISIONS - Any decisions made (even implicit ones)
2. REQUIREMENTS - What must be done, features needed, behaviors expected
3. CONSTRAINTS - Technical limitations, must-nots, restrictions
4. CONCERNS - Blockers, worries, potential issues raised
5. ACTION_ITEMS - Specific tasks or next steps mentioned
6. CONTEXT - Important background info for implementation
7. STAKEHOLDER_NOTES - Who said what important thing

Be thorough. Read EVERY comment. Small details matter.
If a comment clarifies or changes a previous decision, note that.
If someone expresses a preference, that's important context.

Respond in this exact JSON format (no markdown, no extra text):
{
  "decisions": ["decision 1", "decision 2"],
  "requirements": ["req 1", "req 2"],
  "constraints": ["constraint 1"],
  "concerns": ["concern 1"],
  "actionItems": ["action 1"],
  "context": ["context 1"],
  "stakeholderNotes": ["person X said Y"],
  "summary": "Brief 2-3 sentence summary of the discussion"
}`

/**
 * Simplified prompt for smaller/less capable models
 */
export const NUANCE_EXTRACTION_SIMPLE_PROMPT = `Read these project comments and extract key information.

List the important points in this exact JSON format:
{
  "decisions": ["what was decided"],
  "requirements": ["what must be done"],
  "constraints": ["limitations or restrictions"],
  "concerns": ["problems or blockers"],
  "actionItems": ["tasks to do"],
  "context": ["important background info"],
  "stakeholderNotes": ["who said what"],
  "summary": "Brief summary of discussion"
}

Return ONLY the JSON, no other text.`

/**
 * Format comments into a readable discussion format for the LLM
 */
export function formatCommentsForExtraction(comments: LinearComment[]): string {
  if (!comments || comments.length === 0) {
    return "No comments available."
  }

  // Sort by date
  const sorted = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  return sorted.map((c, idx) => {
    const author = c.user?.name || c.user?.email || "Unknown"
    const date = new Date(c.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
    return `[Comment ${idx + 1}] ${author} (${date}):\n${c.body}`
  }).join("\n\n---\n\n")
}

/**
 * Clean and parse JSON from LLM response
 * Handles common issues with smaller model outputs
 */
function parseNuanceJSON(response: string): Partial<ExtractedNuance> | null {
  // Try direct parse first
  try {
    return JSON.parse(response.trim())
  } catch {
    // Continue to cleanup attempts
  }

  // Remove markdown code blocks
  let cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim()

  // Try to find JSON object in response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      // Continue to more aggressive cleanup
    }
  }

  // Try fixing common JSON issues
  try {
    // Remove trailing commas
    cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1")
    // Remove comments
    cleaned = cleaned.replace(/\/\/[^\n]*/g, "")
    // Fix unquoted keys
    cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')

    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      return JSON.parse(match[0])
    }
  } catch {
    // All parsing attempts failed
  }

  return null
}

/**
 * Fallback extraction when JSON parsing fails completely
 * Uses simple pattern matching to extract at least some information
 */
function fallbackExtraction(response: string, comments: LinearComment[]): ExtractedNuance {
  const lines = response.split("\n").filter(l => l.trim())

  const result: ExtractedNuance = {
    decisions: [],
    requirements: [],
    constraints: [],
    concerns: [],
    actionItems: [],
    context: [],
    stakeholderNotes: [],
    summary: "",
    rawPoints: []
  }

  // Try to extract any bullet points or numbered items
  for (const line of lines) {
    const trimmed = line.trim()

    // Skip JSON-like lines
    if (trimmed.startsWith("{") || trimmed.startsWith("}") || trimmed.startsWith("[") || trimmed.startsWith("]")) {
      continue
    }

    // Look for categorized content
    const lowerLine = trimmed.toLowerCase()

    if (lowerLine.includes("decision") || lowerLine.includes("decided")) {
      const text = extractBulletContent(trimmed)
      if (text) result.decisions.push(text)
    } else if (lowerLine.includes("require") || lowerLine.includes("must") || lowerLine.includes("need")) {
      const text = extractBulletContent(trimmed)
      if (text) result.requirements.push(text)
    } else if (lowerLine.includes("constraint") || lowerLine.includes("limit") || lowerLine.includes("cannot")) {
      const text = extractBulletContent(trimmed)
      if (text) result.constraints.push(text)
    } else if (lowerLine.includes("concern") || lowerLine.includes("issue") || lowerLine.includes("problem") || lowerLine.includes("block")) {
      const text = extractBulletContent(trimmed)
      if (text) result.concerns.push(text)
    } else if (lowerLine.includes("action") || lowerLine.includes("todo") || lowerLine.includes("task")) {
      const text = extractBulletContent(trimmed)
      if (text) result.actionItems.push(text)
    } else {
      // Any other substantive content goes to raw points
      const text = extractBulletContent(trimmed)
      if (text && text.length > 10) {
        result.rawPoints.push(text)
      }
    }
  }

  // Generate a basic summary from comments if we couldn't extract one
  if (!result.summary && comments.length > 0) {
    const totalLength = comments.reduce((sum, c) => sum + c.body.length, 0)
    result.summary = `Discussion with ${comments.length} comments. ` +
      `${result.decisions.length} decisions, ${result.requirements.length} requirements identified.`
  }

  return result
}

function extractBulletContent(line: string): string | null {
  // Remove bullet markers, numbers, dashes, etc.
  const cleaned = line
    .replace(/^[-*+]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^["']/, "")
    .replace(/["']$/, "")
    .replace(/^:\s*/, "")
    .trim()

  return cleaned.length > 3 ? cleaned : null
}

/**
 * Extract nuance from comments with retry logic for smaller models
 */
export async function extractNuanceFromComments(
  issueTitle: string,
  issueDescription: string,
  comments: LinearComment[],
  options?: {
    preferredServer?: string
    preferredModel?: string
    maxRetries?: number
  }
): Promise<ExtractedNuance> {
  const maxRetries = options?.maxRetries ?? 2

  // If no comments, return empty result
  if (!comments || comments.length === 0) {
    return {
      decisions: [],
      requirements: [],
      constraints: [],
      concerns: [],
      actionItems: [],
      context: issueDescription ? [issueDescription] : [],
      stakeholderNotes: [],
      summary: `Issue: ${issueTitle}. No discussion comments.`,
      rawPoints: []
    }
  }

  const formattedComments = formatCommentsForExtraction(comments)

  const userPrompt = `ISSUE TITLE: ${issueTitle}

ISSUE DESCRIPTION:
${issueDescription || "(No description provided)"}

DISCUSSION COMMENTS (${comments.length} total):
${formattedComments}

Extract all key information from the above discussion. Remember to read EVERY comment carefully.`

  // Try with full prompt first
  let attempts = 0
  let lastError: string | undefined

  while (attempts < maxRetries) {
    attempts++

    // Use simpler prompt on retry
    const systemPrompt = attempts === 1
      ? NUANCE_EXTRACTION_SYSTEM_PROMPT
      : NUANCE_EXTRACTION_SIMPLE_PROMPT

    console.log(`[Nuance Extraction] Attempt ${attempts}/${maxRetries} for issue: ${issueTitle}`)

    const response = await generateWithLocalLLM(
      systemPrompt,
      userPrompt,
      {
        temperature: 0.3, // Lower temperature for more structured output
        max_tokens: 2048,
        preferredServer: options?.preferredServer,
        preferredModel: options?.preferredModel
      }
    )

    if (response.error) {
      console.error(`[Nuance Extraction] LLM error on attempt ${attempts}:`, response.error)
      lastError = response.error
      continue
    }

    // Try to parse the response
    const parsed = parseNuanceJSON(response.content)

    if (parsed) {
      console.log(`[Nuance Extraction] Successfully extracted nuance on attempt ${attempts}`)

      // Merge with defaults and ensure all fields exist
      return {
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
        constraints: Array.isArray(parsed.constraints) ? parsed.constraints : [],
        concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        context: Array.isArray(parsed.context) ? parsed.context : [],
        stakeholderNotes: Array.isArray(parsed.stakeholderNotes) ? parsed.stakeholderNotes : [],
        summary: parsed.summary || `Extracted from ${comments.length} comments.`,
        rawPoints: Array.isArray(parsed.rawPoints) ? parsed.rawPoints : []
      }
    }

    console.warn(`[Nuance Extraction] JSON parse failed on attempt ${attempts}, trying fallback extraction`)

    // On last attempt, try fallback extraction
    if (attempts >= maxRetries) {
      console.log(`[Nuance Extraction] Using fallback extraction for non-JSON response`)
      return fallbackExtraction(response.content, comments)
    }
  }

  // All attempts failed
  console.error(`[Nuance Extraction] All ${maxRetries} attempts failed. Last error: ${lastError}`)

  return {
    decisions: [],
    requirements: [],
    constraints: [],
    concerns: [],
    actionItems: [],
    context: issueDescription ? [issueDescription] : [],
    stakeholderNotes: [],
    summary: `Failed to extract nuance: ${lastError || "Unknown error"}`,
    rawPoints: []
  }
}

/**
 * Format extracted nuance into context for packet generation
 */
export function formatNuanceForPacketGeneration(nuance: ExtractedNuance): string {
  const sections: string[] = []

  if (nuance.summary) {
    sections.push(`## Discussion Summary\n${nuance.summary}`)
  }

  if (nuance.decisions.length > 0) {
    sections.push(`## Key Decisions\n${nuance.decisions.map(d => `- ${d}`).join("\n")}`)
  }

  if (nuance.requirements.length > 0) {
    sections.push(`## Requirements\n${nuance.requirements.map(r => `- ${r}`).join("\n")}`)
  }

  if (nuance.constraints.length > 0) {
    sections.push(`## Constraints\n${nuance.constraints.map(c => `- ${c}`).join("\n")}`)
  }

  if (nuance.concerns.length > 0) {
    sections.push(`## Concerns & Blockers\n${nuance.concerns.map(c => `- ${c}`).join("\n")}`)
  }

  if (nuance.actionItems.length > 0) {
    sections.push(`## Action Items\n${nuance.actionItems.map(a => `- ${a}`).join("\n")}`)
  }

  if (nuance.context.length > 0) {
    sections.push(`## Important Context\n${nuance.context.map(c => `- ${c}`).join("\n")}`)
  }

  if (nuance.stakeholderNotes.length > 0) {
    sections.push(`## Stakeholder Notes\n${nuance.stakeholderNotes.map(s => `- ${s}`).join("\n")}`)
  }

  return sections.join("\n\n")
}

/**
 * Batch extract nuance from multiple issues
 * Useful for processing a whole Linear project import
 */
export async function batchExtractNuance(
  issues: Array<{
    id: string
    title: string
    description?: string
    comments?: LinearComment[]
  }>,
  options?: {
    preferredServer?: string
    preferredModel?: string
    concurrency?: number
    onProgress?: (completed: number, total: number) => void
  }
): Promise<Map<string, ExtractedNuance>> {
  const concurrency = options?.concurrency ?? 2 // Process 2 at a time to avoid overloading
  const results = new Map<string, ExtractedNuance>()

  // Filter to only issues with comments
  const issuesWithComments = issues.filter(i => i.comments && i.comments.length > 0)

  console.log(`[Nuance Extraction] Batch processing ${issuesWithComments.length} issues with comments out of ${issues.length} total`)

  let completed = 0

  // Process in batches
  for (let i = 0; i < issuesWithComments.length; i += concurrency) {
    const batch = issuesWithComments.slice(i, i + concurrency)

    const batchResults = await Promise.all(
      batch.map(async (issue) => {
        const nuance = await extractNuanceFromComments(
          issue.title,
          issue.description || "",
          issue.comments || [],
          {
            preferredServer: options?.preferredServer,
            preferredModel: options?.preferredModel
          }
        )
        return { id: issue.id, nuance }
      })
    )

    for (const { id, nuance } of batchResults) {
      results.set(id, nuance)
    }

    completed += batch.length
    options?.onProgress?.(completed, issuesWithComments.length)
  }

  // For issues without comments, add empty nuance
  for (const issue of issues) {
    if (!results.has(issue.id)) {
      results.set(issue.id, {
        decisions: [],
        requirements: [],
        constraints: [],
        concerns: [],
        actionItems: [],
        context: issue.description ? [issue.description] : [],
        stakeholderNotes: [],
        summary: `Issue: ${issue.title}. No discussion comments.`,
        rawPoints: []
      })
    }
  }

  return results
}
