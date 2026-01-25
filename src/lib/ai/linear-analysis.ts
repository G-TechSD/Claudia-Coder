/**
 * Linear Issue Analysis Module
 *
 * Analyzes Linear issues with their comments to extract multiple
 * distinct features, requirements, bugs, and tasks.
 *
 * Uses LLM to identify actionable items from issue discussions
 * that may contain multiple work items in a single thread.
 *
 * AGGRESSIVE EXTRACTION MODE:
 * - Extract MORE items, not fewer
 * - When in doubt, create separate packets
 * - Each distinct feature request = separate packet
 * - Each bug mentioned = separate packet
 * - Each task/todo = separate packet
 * - Each enhancement idea = separate packet
 *
 * GRANULARITY GUIDELINES:
 * - Each packet should be 0.5-1 hour of focused work (NOT 2+ hours)
 * - Large features should be decomposed into 2-4 sub-packets
 * - Include a mix of packet types: feature, bugfix, test, docs, config
 * - Minimum 30-50 packets for a typical project with many comments
 * - Aim for 50-100+ packets from large issues with 50+ comments
 */

import { generateWithLocalLLM } from "@/lib/llm/local-llm"
import { LinearIssue, LinearComment } from "@/lib/linear/api"

// ============================================================================
// GRANULARITY GUIDELINES
// ============================================================================

/**
 * Granularity guidelines for packet generation
 * These rules guide how we break down work into appropriately-sized packets
 *
 * AGGRESSIVE EXTRACTION MODE: Designed to maximize packet count
 * - Extract MORE items, not fewer
 * - When in doubt, create separate packets
 * - Each distinct mention becomes its own packet
 */
export const GRANULARITY_GUIDELINES = {
  // Target hours per packet (REDUCED for more granular packets)
  targetHoursMin: 0.25,
  targetHoursMax: 0.5,

  // Decomposition threshold - packets over this should be split (REDUCED to trigger more decomposition)
  decompositionThreshold: 0.5,

  // Minimum packets per project (INCREASED significantly)
  minimumPackets: 50,

  // Target packets for issues with many comments (50+)
  targetPacketsForLargeIssues: 100,

  // Sub-packet range when decomposing (INCREASED for more granularity)
  subPacketMin: 3,
  subPacketMax: 5,

  // Task count per packet
  tasksMin: 3,
  tasksMax: 5,

  // Acceptance criteria count per packet
  criteriaMin: 2,
  criteriaMax: 4,

  // Packet type distribution targets (percentages)
  typeDistribution: {
    feature: 40,   // Core functionality
    test: 20,      // Testing
    bugfix: 15,    // Bug fixes
    docs: 10,      // Documentation
    config: 10,    // Configuration/setup
    refactor: 5,   // Refactoring
  } as Record<string, number>
}

/**
 * Estimated hours for a work packet
 */
export interface PacketEstimate {
  optimistic: number
  realistic: number
  pessimistic: number
}

/**
 * Task within a work packet (granularity-aware)
 */
export interface GranularPacketTask {
  id: string
  description: string
  completed: boolean
  order: number
}

/**
 * A work packet with full granularity information
 */
export interface WorkPacketWithGranularity {
  id: string
  title: string
  description: string
  type: ExtractedItemType | "test" | "docs" | "config" | "bugfix"
  priority: "critical" | "high" | "medium" | "low"
  estimatedHours: PacketEstimate
  tasks: GranularPacketTask[]
  acceptanceCriteria: string[]
  // Decomposition tracking
  parentIssueId?: string
  parentPacketId?: string
  isDecomposed?: boolean
  decompositionReason?: string
  // Source tracking
  source?: {
    linearId?: string
    linearIdentifier?: string
    linearLabels?: string[]
  }
}

/**
 * Result of decomposition/granularity processing
 */
export interface GranularityProcessingResult {
  packets: WorkPacketWithGranularity[]
  summary: {
    originalCount: number
    decomposedCount: number
    finalCount: number
    estimatedTotalHours: number
    byType: Record<string, number>
  }
  decompositionLog: Array<{
    originalTitle: string
    reason: string
    subPacketCount: number
  }>
}

/**
 * Type of extracted item
 */
export type ExtractedItemType = "feature" | "requirement" | "bug" | "task" | "enhancement" | "refactor"

/**
 * Priority level for extracted items
 */
export type ExtractedItemPriority = "critical" | "high" | "medium" | "low"

/**
 * Source information for traceability
 */
export interface ExtractedItemSource {
  type: "issue" | "comment"
  id: string
  author?: string
  timestamp?: string
  excerpt?: string // Short excerpt from where this was extracted
}

/**
 * A single extracted feature/requirement/bug/task from a Linear issue
 */
export interface ExtractedLinearFeature {
  /** Concise title for the extracted item */
  title: string
  /** Detailed description of what needs to be done */
  description: string
  /** Type of work item */
  type: ExtractedItemType
  /** Priority based on context and explicit mentions */
  priority: ExtractedItemPriority
  /** Reasoning for why this was extracted and how priority was determined */
  reasoning?: string
  /** Who requested or mentioned this item (from comment authors) */
  requestedBy?: string[]
  /** Where this item was found */
  source: ExtractedItemSource
  /** Any acceptance criteria mentioned */
  acceptanceCriteria?: string[]
  /** Dependencies or blockers mentioned */
  dependencies?: string[]
  /** Estimated complexity (if mentioned) */
  complexity?: "trivial" | "small" | "medium" | "large" | "unknown"
  /** Original text that led to this extraction (for debugging) */
  rawContext?: string
}

/**
 * Result of analyzing a Linear issue
 */
export interface LinearAnalysisResult {
  /** Original issue identifier */
  issueId: string
  issueIdentifier: string
  issueTitle: string
  /** All extracted items */
  items: ExtractedLinearFeature[]
  /** Summary of the analysis */
  summary: string
  /** Any warnings or notes about the extraction */
  warnings?: string[]
  /** Processing metadata */
  metadata: {
    totalComments: number
    chunksProcessed: number
    model?: string
    processingTimeMs: number
  }
}

/**
 * System prompt for feature extraction - FULL VERSION
 * Designed for capable models that can handle detailed instructions and large context
 *
 * Use this prompt when:
 * - Working with capable models (GPT-4, Claude, etc.)
 * - Issue has many comments (50+)
 * - Need detailed reasoning and attribution
 */
export const FEATURE_EXTRACTION_SYSTEM_PROMPT = `You are an expert product analyst extracting actionable items from Linear issues.

Your task is to AGGRESSIVELY and THOROUGHLY extract EVERY POSSIBLE distinct actionable item from the issue title, description, and ALL comments.

=== CRITICAL: EXTRACT MORE, NOT FEWER ===
Your goal is to MAXIMIZE the number of packets extracted. Aim for 50-100+ items from large issues.
- Every DISTINCT feature request = separate packet
- Every bug mentioned = separate packet
- Every task or todo = separate packet
- Every enhancement idea = separate packet
- Every improvement suggestion = separate packet
- Every configuration change = separate packet
- Every documentation need = separate packet
- When in doubt, CREATE SEPARATE PACKETS rather than combining

=== GRANULARITY REQUIREMENTS ===
Each packet should be 15-30 MINUTES (0.25-0.5 hours) of focused work (NOT 1+ hours).
If something would take more than 30 minutes, BREAK IT DOWN into multiple packets:
- BAD: "Implement authentication system" (way too broad)
- BAD: "Create login flow" (still too broad)
- GOOD: "Create user schema fields", "Add password hashing", "Create login endpoint", "Build login form", "Add form validation", "Handle login errors", "Add session storage", "Write login unit test", "Write login e2e test" (9 separate packets for one feature)

=== AGGRESSIVE EXTRACTION RULES ===
1. READ EVERY SINGLE COMMENT - Even if there are 50+ comments, analyze each one thoroughly
2. Extract ALL types of items: features, bugs, tasks, requirements, enhancements, refactors
3. DO NOT over-merge - only merge if items are EXACTLY the same work
4. Track WHO requested each item - Use the comment author's name
5. Preserve CONTEXT - Include reasoning for why each item matters

=== WHAT TO EXTRACT ===
Look for and extract EACH of these as separate packets:
- Feature requests (any new functionality)
- Bug reports (any issue mentioned)
- Tasks (any work item mentioned)
- Requirements (any "must have" or "should have")
- Enhancements (any "would be nice" or "improvement")
- Refactoring needs (any code quality mentions)
- Documentation needs (any docs mentioned)
- Configuration changes (any settings/config mentioned)
- Testing needs (any test requirements)
- UI/UX changes (any design mentions)
- Performance improvements (any speed/optimization mentions)
- Security items (any security mentions)
- Integration needs (any API/service integration mentions)

=== HANDLING LARGE COMMENT THREADS (50+ comments) ===
For issues with many comments, expect to extract 50-100+ packets:
- Read chronologically to understand how requirements evolved
- Note when later comments MODIFY or SUPERSEDE earlier requests
- If the same person mentions something multiple times, it may still be MULTIPLE items if discussing different aspects
- If DIFFERENT people mention the same thing, note ALL of them in requestedBy
- Track decision points where direction changed
- Extract BOTH historical items AND current requirements for complete coverage

=== MINIMAL DEDUPLICATION ===
Only merge items if they are EXACTLY the same work:
- "Add login button" and "implement login flow" = DIFFERENT items (keep separate)
- "Add Google OAuth" and "Add GitHub OAuth" = DIFFERENT items (keep separate)
- "Fix login bug" mentioned twice = SAME item (merge)
- If conflicting requirements exist, create SEPARATE packets for each approach
- If priority differs between mentions, use the HIGHEST mentioned priority

=== FOR EACH ITEM EXTRACT ===
- title: Clear, actionable title (imperative form: "Add...", "Fix...", "Implement...")
- description: Detailed description of what needs to be done, including any nuances from discussion
- type: One of: "feature", "requirement", "bug", "task", "enhancement", "refactor"
- priority: One of: "critical", "high", "medium", "low"
- reasoning: WHY this item was extracted and HOW you determined its priority
- requestedBy: Array of ALL people who mentioned/requested this (empty if from issue description only)
- sourceType: "issue" or "comment"
- sourceExcerpt: Brief quote showing where this was found
- acceptanceCriteria: Array of criteria if mentioned
- dependencies: Array of blockers or prerequisites if mentioned
- complexity: "trivial" (<30min), "small" (30min-1hr), "medium" (1hr), "large" (>1hr - SHOULD BE SPLIT)

=== ITEM TYPES ===
- feature: New functionality or capability (user-facing)
- requirement: Specific behavior that MUST be implemented (often technical)
- bug: Issue with EXISTING functionality that needs fixing
- task: Non-feature work (documentation, cleanup, config, setup)
- enhancement: Improvement to EXISTING functionality (not new)
- refactor: Code restructuring WITHOUT behavior change

=== PRIORITY DETERMINATION ===
- "critical": Explicitly marked urgent, blocking other work, has deadline, or security issue
- "high": Multiple people requested, stakeholder mentioned, significant user impact
- "medium": Normal feature request, standard task, single person requested
- "low": Nice-to-have, future consideration, explicitly deprioritized, or low user impact

When determining priority, consider:
- How many different people mentioned it?
- Was urgency explicitly stated?
- Does it block other work?
- What's the user/business impact?

=== OUTPUT FORMAT ===
Respond with valid JSON only (no markdown, no explanation):
{
  "items": [
    {
      "title": "Add OAuth2 authentication with Google",
      "description": "Implement OAuth2 login flow for Google provider. Handle token exchange and user profile fetching.",
      "type": "feature",
      "priority": "high",
      "reasoning": "Requested by 3 different team members. Security-critical feature.",
      "requestedBy": ["John Smith", "Sarah Jones", "Mike Chen"],
      "sourceType": "comment",
      "sourceExcerpt": "we need OAuth with Google support",
      "acceptanceCriteria": ["User can login with Google", "Tokens are stored securely"],
      "dependencies": ["User model must support OAuth"],
      "complexity": "small"
    },
    {
      "title": "Add OAuth2 authentication with GitHub",
      "description": "Implement OAuth2 login flow for GitHub provider. Handle token exchange and user profile fetching.",
      "type": "feature",
      "priority": "high",
      "reasoning": "Requested alongside Google OAuth. Important for developer users.",
      "requestedBy": ["John Smith"],
      "sourceType": "comment",
      "sourceExcerpt": "and GitHub support too",
      "acceptanceCriteria": ["User can login with GitHub", "Tokens are stored securely"],
      "dependencies": ["User model must support OAuth"],
      "complexity": "small"
    }
  ],
  "summary": "Brief 2-3 sentence summary of overall scope and key themes extracted",
  "stats": {
    "totalItemsFound": 50,
    "duplicatesMerged": 2,
    "commentsAnalyzed": 47
  }
}

=== FINAL REMINDER ===
EXTRACT MORE ITEMS, NOT FEWER. When in doubt, create separate packets.
Aim for 50-100+ packets from large issues with many comments.
Each packet should be 0.5-1 hour of work maximum.

IMPORTANT:
- Return ONLY the JSON, no markdown code blocks
- Start with { and end with }
- Use double quotes for all strings
- No trailing commas`

/**
 * Simplified prompt for smaller/less capable models
 * More direct instructions, shorter context requirements
 *
 * Use this prompt when:
 * - Working with smaller models (7B-13B parameters)
 * - Need faster processing
 * - Issue has fewer comments
 * - Model struggles with complex JSON output
 */
export const FEATURE_EXTRACTION_SIMPLE_PROMPT = `Extract ALL actionable items from this Linear issue and its comments.

CRITICAL: EXTRACT MORE ITEMS, NOT FEWER. Aim for 30-50+ items from large issues.

READ ALL COMMENTS. Analyze each one for actionable items.

=== WHAT TO EXTRACT (each as SEPARATE item) ===
- Every feature request
- Every bug mentioned
- Every task/todo
- Every enhancement idea
- Every config change
- Every documentation need
- Every test requirement

=== GRANULARITY ===
Each item should be 0.5-1 hour of work MAX.
If something is bigger, SPLIT IT into multiple items.
- BAD: "Implement auth system" (too big)
- GOOD: "Create user model", "Add login endpoint", "Build login form" (3 items)

For each item, extract:
- title: Clear action title ("Add X", "Fix Y")
- description: What needs to be done
- type: feature, bug, task, requirement, enhancement, or refactor
- priority: critical, high, medium, or low
- reasoning: Why this priority (1 sentence)
- requestedBy: Names of people who mentioned this (array)
- sourceExcerpt: Short quote from where this was found
- complexity: trivial (<30min), small (30min-1hr), medium (1hr), large (>1hr - should split)

MINIMAL DEDUPLICATION: Only merge if EXACTLY the same work. When in doubt, keep separate.

Priority guide:
- critical = urgent/blocking
- high = important, multiple requesters
- medium = normal request
- low = nice-to-have

Return JSON only:
{
  "items": [
    {
      "title": "Add user login form",
      "description": "Create the login form component with email/password fields",
      "type": "feature",
      "priority": "high",
      "reasoning": "Multiple people requested, security critical",
      "requestedBy": ["John", "Sarah"],
      "sourceExcerpt": "we need user login",
      "complexity": "small"
    },
    {
      "title": "Add login API endpoint",
      "description": "Create POST /api/auth/login endpoint",
      "type": "feature",
      "priority": "high",
      "reasoning": "Required for login functionality",
      "requestedBy": ["John"],
      "sourceExcerpt": "need login API",
      "complexity": "small"
    }
  ],
  "summary": "Brief summary of items found"
}

REMEMBER: Extract MORE items, not fewer. When in doubt, create separate packets.

Return ONLY the JSON. No markdown. No extra text.`

/**
 * Format a Linear issue and its comments for LLM analysis
 */
function formatIssueForAnalysis(issue: LinearIssue): string {
  const parts: string[] = []

  // Issue header
  parts.push(`ISSUE: ${issue.identifier} - ${issue.title}`)
  parts.push(`Priority: ${issue.priorityLabel} | State: ${issue.state.name}`)
  if (issue.labels.nodes.length > 0) {
    parts.push(`Labels: ${issue.labels.nodes.map(l => l.name).join(", ")}`)
  }
  parts.push("")

  // Issue description
  parts.push("DESCRIPTION:")
  parts.push(issue.description || "(No description provided)")
  parts.push("")

  // Comments
  if (issue.comments && issue.comments.length > 0) {
    parts.push(`COMMENTS (${issue.comments.length} total):`)
    parts.push("")

    // Sort comments by date
    const sortedComments = [...issue.comments].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    for (const comment of sortedComments) {
      const author = comment.user?.name || comment.user?.email || "Unknown"
      const date = new Date(comment.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      })
      parts.push(`[${author} - ${date}]:`)
      parts.push(comment.body)
      parts.push("---")
    }
  } else {
    parts.push("COMMENTS: None")
  }

  return parts.join("\n")
}

/**
 * Split comments into chunks for issues with many comments
 * Each chunk will be processed separately, then results merged
 */
function chunkComments(comments: LinearComment[], maxCommentsPerChunk: number = 25): LinearComment[][] {
  const chunks: LinearComment[][] = []

  // Sort by date first
  const sorted = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  for (let i = 0; i < sorted.length; i += maxCommentsPerChunk) {
    chunks.push(sorted.slice(i, i + maxCommentsPerChunk))
  }

  return chunks
}

/**
 * Parse and validate JSON response from LLM
 */
function parseExtractionResponse(response: string): {
  items: Array<{
    title: string
    description: string
    type: string
    priority: string
    reasoning?: string
    requestedBy?: string[]
    sourceType?: string
    sourceExcerpt?: string
    acceptanceCriteria?: string[]
    dependencies?: string[]
    complexity?: string
  }>
  summary: string
  stats?: {
    totalItemsFound?: number
    duplicatesMerged?: number
    commentsAnalyzed?: number
  }
} | null {
  // Try direct parse
  try {
    return JSON.parse(response.trim())
  } catch {
    // Continue to cleanup
  }

  // Remove markdown code blocks
  let cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim()

  // Try to find JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      // Continue to more cleanup
    }
  }

  // Try fixing common JSON issues
  try {
    cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1") // trailing commas
    cleaned = cleaned.replace(/\/\/[^\n]*/g, "") // comments
    cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // unquoted keys

    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      return JSON.parse(match[0])
    }
  } catch {
    // All attempts failed
  }

  return null
}

/**
 * Map string type to ExtractedItemType
 */
function mapItemType(type: string): ExtractedItemType {
  const normalized = type.toLowerCase().trim()
  const validTypes: ExtractedItemType[] = ["feature", "requirement", "bug", "task", "enhancement", "refactor"]

  if (validTypes.includes(normalized as ExtractedItemType)) {
    return normalized as ExtractedItemType
  }

  // Map common variations
  if (normalized.includes("fix") || normalized.includes("issue")) return "bug"
  if (normalized.includes("improve")) return "enhancement"
  if (normalized.includes("clean") || normalized.includes("tech debt")) return "refactor"
  if (normalized.includes("doc")) return "task"

  return "task" // default
}

/**
 * Map string priority to ExtractedItemPriority
 */
function mapItemPriority(priority: string): ExtractedItemPriority {
  const normalized = priority.toLowerCase().trim()

  if (normalized.includes("critical") || normalized.includes("urgent")) return "critical"
  if (normalized.includes("high") || normalized.includes("important")) return "high"
  if (normalized.includes("low") || normalized.includes("minor")) return "low"

  return "medium" // default
}

/**
 * Process a single chunk of an issue
 */
async function processIssueChunk(
  issue: LinearIssue,
  comments: LinearComment[],
  chunkIndex: number,
  totalChunks: number,
  options?: {
    preferredServer?: string
    preferredModel?: string
    useSimplePrompt?: boolean
  }
): Promise<ExtractedLinearFeature[]> {
  // Create a modified issue with just this chunk's comments
  const chunkIssue: LinearIssue = {
    ...issue,
    comments: comments
  }

  const formattedIssue = formatIssueForAnalysis(chunkIssue)

  const chunkContext = totalChunks > 1
    ? `\n\nNOTE: This is chunk ${chunkIndex + 1} of ${totalChunks} for this issue. Focus on items mentioned in these specific comments.`
    : ""

  const userPrompt = `${formattedIssue}${chunkContext}

Extract ALL distinct actionable items from the above issue and comments.`

  const systemPrompt = options?.useSimplePrompt
    ? FEATURE_EXTRACTION_SIMPLE_PROMPT
    : FEATURE_EXTRACTION_SYSTEM_PROMPT

  console.log(`[Linear Analysis] Processing chunk ${chunkIndex + 1}/${totalChunks} for issue ${issue.identifier}`)

  const response = await generateWithLocalLLM(
    systemPrompt,
    userPrompt,
    {
      temperature: 0.3,
      max_tokens: 4096,
      preferredServer: options?.preferredServer,
      preferredModel: options?.preferredModel
    }
  )

  if (response.error) {
    console.error(`[Linear Analysis] LLM error for chunk ${chunkIndex + 1}:`, response.error)
    return []
  }

  const parsed = parseExtractionResponse(response.content)

  if (!parsed || !Array.isArray(parsed.items)) {
    console.warn(`[Linear Analysis] Failed to parse response for chunk ${chunkIndex + 1}`)
    return []
  }

  // Convert parsed items to ExtractedLinearFeature objects
  return parsed.items.map((item, idx) => {
    // Try to find which comment this came from
    let source: ExtractedItemSource = {
      type: "issue",
      id: issue.id
    }

    if (item.sourceType === "comment" && item.sourceExcerpt && comments.length > 0) {
      // Try to match excerpt to a comment
      const matchingComment = comments.find(c =>
        c.body.toLowerCase().includes(item.sourceExcerpt?.toLowerCase().slice(0, 50) || "")
      )
      if (matchingComment) {
        source = {
          type: "comment",
          id: matchingComment.id,
          author: matchingComment.user?.name || matchingComment.user?.email,
          timestamp: matchingComment.createdAt,
          excerpt: item.sourceExcerpt
        }
      }
    }

    // Normalize requestedBy - handle both string and array formats
    // (LLMs sometimes return a string instead of an array)
    let requestedBy: string[] | undefined
    const rawRequestedBy = item.requestedBy as string[] | string | undefined
    if (Array.isArray(rawRequestedBy) && rawRequestedBy.length > 0) {
      requestedBy = rawRequestedBy.filter(r => typeof r === "string" && r.length > 0)
    } else if (typeof rawRequestedBy === "string" && rawRequestedBy.length > 0) {
      requestedBy = [rawRequestedBy]
    } else if (source.author) {
      // Fall back to source author if no requestedBy provided
      requestedBy = [source.author]
    }

    return {
      title: item.title || `Untitled item ${idx + 1}`,
      description: item.description || "",
      type: mapItemType(item.type || "task"),
      priority: mapItemPriority(item.priority || "medium"),
      reasoning: item.reasoning || undefined,
      requestedBy,
      source,
      acceptanceCriteria: Array.isArray(item.acceptanceCriteria) ? item.acceptanceCriteria : undefined,
      dependencies: Array.isArray(item.dependencies) ? item.dependencies : undefined,
      complexity: ["trivial", "small", "medium", "large", "unknown"].includes(item.complexity || "")
        ? item.complexity as ExtractedLinearFeature["complexity"]
        : "unknown",
      rawContext: item.sourceExcerpt
    }
  })
}

/**
 * Deduplicate items that might have been extracted from multiple chunks
 * Merges requestedBy arrays and keeps the most detailed description
 */
function deduplicateItems(items: ExtractedLinearFeature[]): ExtractedLinearFeature[] {
  const seen = new Map<string, ExtractedLinearFeature>()

  for (const item of items) {
    // Create a key based on title similarity
    const normalizedTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, "")

    // Check if we have a similar item
    let isDuplicate = false
    for (const [key, existing] of seen.entries()) {
      // Check for similar titles (Levenshtein would be better, but this is simpler)
      if (normalizedTitle === key ||
          normalizedTitle.includes(key) ||
          key.includes(normalizedTitle)) {

        // Merge the items - keep the one with more detail but merge requestedBy
        const mergedRequestedBy = [
          ...(existing.requestedBy || []),
          ...(item.requestedBy || [])
        ]
        // Deduplicate requestedBy names (case-insensitive)
        const uniqueRequesters = [...new Set(
          mergedRequestedBy.map(r => r.toLowerCase())
        )].map(lower =>
          mergedRequestedBy.find(r => r.toLowerCase() === lower) || lower
        )

        // Merge acceptance criteria
        const mergedCriteria = [
          ...(existing.acceptanceCriteria || []),
          ...(item.acceptanceCriteria || [])
        ]
        const uniqueCriteria = [...new Set(mergedCriteria)]

        // Merge dependencies
        const mergedDeps = [
          ...(existing.dependencies || []),
          ...(item.dependencies || [])
        ]
        const uniqueDeps = [...new Set(mergedDeps)]

        // Use higher priority
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
        const higherPriority = priorityOrder[item.priority] > priorityOrder[existing.priority]
          ? item.priority
          : existing.priority

        // Merge reasoning if both exist
        let mergedReasoning = existing.reasoning
        if (item.reasoning && existing.reasoning && item.reasoning !== existing.reasoning) {
          mergedReasoning = `${existing.reasoning} Additionally: ${item.reasoning}`
        } else if (item.reasoning && !existing.reasoning) {
          mergedReasoning = item.reasoning
        }

        // Keep the one with more detail, but apply merged fields
        const baseItem = item.description.length > existing.description.length ? item : existing

        seen.set(key, {
          ...baseItem,
          priority: higherPriority,
          reasoning: mergedReasoning,
          requestedBy: uniqueRequesters.length > 0 ? uniqueRequesters : undefined,
          acceptanceCriteria: uniqueCriteria.length > 0 ? uniqueCriteria : undefined,
          dependencies: uniqueDeps.length > 0 ? uniqueDeps : undefined
        })

        isDuplicate = true
        break
      }
    }

    if (!isDuplicate) {
      seen.set(normalizedTitle, item)
    }
  }

  return Array.from(seen.values())
}

/**
 * Extract features, requirements, bugs, and tasks from a Linear issue
 *
 * @param issue - The Linear issue with comments to analyze
 * @param options - Optional configuration
 * @returns Array of extracted actionable items
 */
export async function extractFeaturesFromLinearIssue(
  issue: LinearIssue,
  options?: {
    preferredServer?: string
    preferredModel?: string
    maxCommentsPerChunk?: number
    maxRetries?: number
  }
): Promise<LinearAnalysisResult> {
  const startTime = Date.now()
  const maxCommentsPerChunk = options?.maxCommentsPerChunk ?? 25
  const maxRetries = options?.maxRetries ?? 2

  const comments = issue.comments || []
  const totalComments = comments.length

  console.log(`[Linear Analysis] Starting analysis of ${issue.identifier}: "${issue.title}" with ${totalComments} comments`)

  // For issues with no comments, just analyze the issue itself
  if (totalComments === 0) {
    const items = await processIssueChunk(issue, [], 0, 1, {
      preferredServer: options?.preferredServer,
      preferredModel: options?.preferredModel
    })

    return {
      issueId: issue.id,
      issueIdentifier: issue.identifier,
      issueTitle: issue.title,
      items,
      summary: items.length > 0
        ? `Extracted ${items.length} item(s) from issue description`
        : "No actionable items found in issue description",
      metadata: {
        totalComments: 0,
        chunksProcessed: 1,
        processingTimeMs: Date.now() - startTime
      }
    }
  }

  // Chunk comments if there are many
  const commentChunks = chunkComments(comments, maxCommentsPerChunk)
  const totalChunks = commentChunks.length

  console.log(`[Linear Analysis] Processing ${totalChunks} chunk(s) for ${issue.identifier}`)

  const allItems: ExtractedLinearFeature[] = []
  const warnings: string[] = []
  let model: string | undefined

  // Process first chunk with issue description
  let attempts = 0
  let success = false

  while (attempts < maxRetries && !success) {
    attempts++
    try {
      const items = await processIssueChunk(
        issue,
        commentChunks[0] || [],
        0,
        totalChunks,
        {
          preferredServer: options?.preferredServer,
          preferredModel: options?.preferredModel,
          useSimplePrompt: attempts > 1
        }
      )
      allItems.push(...items)
      success = true
    } catch (error) {
      console.error(`[Linear Analysis] Attempt ${attempts} failed for chunk 1:`, error)
      if (attempts >= maxRetries) {
        warnings.push(`Failed to process first chunk after ${maxRetries} attempts`)
      }
    }
  }

  // Process remaining chunks (comments only, issue description already processed)
  for (let i = 1; i < commentChunks.length; i++) {
    try {
      // For subsequent chunks, create a minimal issue (no description to avoid re-extraction)
      const chunkIssue: LinearIssue = {
        ...issue,
        description: `(See issue description in earlier chunk)`,
        comments: commentChunks[i]
      }

      const items = await processIssueChunk(
        chunkIssue,
        commentChunks[i],
        i,
        totalChunks,
        {
          preferredServer: options?.preferredServer,
          preferredModel: options?.preferredModel
        }
      )
      allItems.push(...items)
    } catch (error) {
      console.error(`[Linear Analysis] Failed to process chunk ${i + 1}:`, error)
      warnings.push(`Failed to process chunk ${i + 1}/${totalChunks}`)
    }
  }

  // Deduplicate items
  const dedupedItems = deduplicateItems(allItems)

  if (dedupedItems.length < allItems.length) {
    console.log(`[Linear Analysis] Deduplicated ${allItems.length} items to ${dedupedItems.length}`)
  }

  // Generate summary
  const typeCounts = dedupedItems.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const typesSummary = Object.entries(typeCounts)
    .map(([type, count]) => `${count} ${type}${count > 1 ? "s" : ""}`)
    .join(", ")

  const summary = dedupedItems.length > 0
    ? `Extracted ${dedupedItems.length} item(s): ${typesSummary}`
    : "No actionable items found"

  const processingTimeMs = Date.now() - startTime
  console.log(`[Linear Analysis] Completed ${issue.identifier} in ${processingTimeMs}ms: ${summary}`)

  return {
    issueId: issue.id,
    issueIdentifier: issue.identifier,
    issueTitle: issue.title,
    items: dedupedItems,
    summary,
    warnings: warnings.length > 0 ? warnings : undefined,
    metadata: {
      totalComments,
      chunksProcessed: totalChunks,
      model,
      processingTimeMs
    }
  }
}

/**
 * Batch analyze multiple Linear issues
 */
export async function batchAnalyzeLinearIssues(
  issues: LinearIssue[],
  options?: {
    preferredServer?: string
    preferredModel?: string
    concurrency?: number
    onProgress?: (completed: number, total: number, currentIssue: string) => void
  }
): Promise<Map<string, LinearAnalysisResult>> {
  const concurrency = options?.concurrency ?? 2
  const results = new Map<string, LinearAnalysisResult>()

  console.log(`[Linear Analysis] Batch analyzing ${issues.length} issues with concurrency ${concurrency}`)

  let completed = 0

  // Process in batches
  for (let i = 0; i < issues.length; i += concurrency) {
    const batch = issues.slice(i, i + concurrency)

    const batchResults = await Promise.all(
      batch.map(async (issue) => {
        options?.onProgress?.(completed, issues.length, issue.identifier)

        const result = await extractFeaturesFromLinearIssue(issue, {
          preferredServer: options?.preferredServer,
          preferredModel: options?.preferredModel
        })

        completed++
        return { id: issue.id, result }
      })
    )

    for (const { id, result } of batchResults) {
      results.set(id, result)
    }
  }

  options?.onProgress?.(completed, issues.length, "Complete")

  // Log summary
  const totalItems = Array.from(results.values()).reduce(
    (sum, r) => sum + r.items.length,
    0
  )
  console.log(`[Linear Analysis] Batch complete: ${totalItems} items from ${issues.length} issues`)

  return results
}

/**
 * Format extracted features as a structured report
 */
export function formatAnalysisReport(result: LinearAnalysisResult): string {
  const sections: string[] = []

  sections.push(`# Analysis: ${result.issueIdentifier} - ${result.issueTitle}`)
  sections.push("")
  sections.push(`**Summary:** ${result.summary}`)
  sections.push(`**Comments Analyzed:** ${result.metadata.totalComments}`)
  sections.push(`**Processing Time:** ${result.metadata.processingTimeMs}ms`)
  sections.push("")

  if (result.warnings && result.warnings.length > 0) {
    sections.push("## Warnings")
    result.warnings.forEach(w => sections.push(`- ${w}`))
    sections.push("")
  }

  if (result.items.length === 0) {
    sections.push("_No actionable items extracted._")
    return sections.join("\n")
  }

  // Group by type
  const byType = new Map<ExtractedItemType, ExtractedLinearFeature[]>()
  for (const item of result.items) {
    const existing = byType.get(item.type) || []
    existing.push(item)
    byType.set(item.type, existing)
  }

  const typeOrder: ExtractedItemType[] = ["feature", "requirement", "bug", "enhancement", "task", "refactor"]

  for (const type of typeOrder) {
    const items = byType.get(type)
    if (!items || items.length === 0) continue

    sections.push(`## ${type.charAt(0).toUpperCase() + type.slice(1)}s`)
    sections.push("")

    for (const item of items) {
      sections.push(`### ${item.title}`)
      sections.push(`**Priority:** ${item.priority} | **Complexity:** ${item.complexity || "unknown"}`)

      if (item.requestedBy && item.requestedBy.length > 0) {
        sections.push(`**Requested by:** ${item.requestedBy.join(", ")}`)
      }
      sections.push("")

      sections.push(item.description)
      sections.push("")

      if (item.reasoning) {
        sections.push(`**Reasoning:** ${item.reasoning}`)
        sections.push("")
      }

      if (item.acceptanceCriteria && item.acceptanceCriteria.length > 0) {
        sections.push("**Acceptance Criteria:**")
        item.acceptanceCriteria.forEach(ac => sections.push(`- ${ac}`))
        sections.push("")
      }

      if (item.dependencies && item.dependencies.length > 0) {
        sections.push("**Dependencies:**")
        item.dependencies.forEach(d => sections.push(`- ${d}`))
        sections.push("")
      }

      if (item.source.excerpt) {
        sections.push(`_Source: ${item.source.author || "Issue"} - "${item.source.excerpt}"_`)
        sections.push("")
      }
    }
  }

  return sections.join("\n")
}

/**
 * WorkPacket interface for converting extracted features to work packets
 */
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
    source: "linear" | "vision-generator" | "feature-extraction"
    linearId?: string
    linearIdentifier?: string
    linearState?: string
    linearLabels?: string[]
    linearAssignee?: string
    linearParentId?: string
    extractedFeatureTitle?: string
    extractedFeatureSource?: ExtractedItemSource
  }
}

/**
 * Generate a unique ID for packets and tasks
 */
function generatePacketId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Map ExtractedItemType to WorkPacket type
 */
function mapFeatureTypeToPacketType(type: ExtractedItemType): WorkPacket["type"] {
  switch (type) {
    case "bug":
      return "bugfix"
    case "feature":
    case "requirement":
    case "enhancement":
      return "feature"
    case "refactor":
      return "refactor"
    case "task":
      return "feature"
    default:
      return "feature"
  }
}

/**
 * Convert extracted features from a Linear issue into multiple work packets
 *
 * @param issue - The original Linear issue
 * @param phaseId - The phase ID to assign to packets
 * @param features - Array of extracted features
 * @param _nuance - Optional nuance extraction data (unused but kept for API compatibility)
 * @returns Array of WorkPacket objects
 */
export function issueToPackets(
  issue: LinearIssue,
  phaseId: string,
  features: ExtractedLinearFeature[],
  _nuance?: unknown
): WorkPacket[] {
  const packets: WorkPacket[] = []

  for (const feature of features) {
    // Build tasks from acceptance criteria
    const tasks: WorkPacket["tasks"] = []
    let order = 0

    if (feature.acceptanceCriteria && feature.acceptanceCriteria.length > 0) {
      for (const criteria of feature.acceptanceCriteria) {
        tasks.push({
          id: `task-${generatePacketId()}`,
          description: criteria,
          completed: false,
          order: order++
        })
      }
    }

    // If no tasks from criteria, create a default task from the feature title
    if (tasks.length === 0) {
      tasks.push({
        id: `task-${generatePacketId()}`,
        description: feature.title,
        completed: false,
        order: 0
      })
    }

    // Build acceptance criteria array
    const acceptanceCriteria = feature.acceptanceCriteria && feature.acceptanceCriteria.length > 0
      ? feature.acceptanceCriteria
      : [`Complete: ${feature.title}`]

    // Estimate tokens based on complexity
    let estimatedTokens = 2000
    switch (feature.complexity) {
      case "trivial":
        estimatedTokens = 1000
        break
      case "small":
        estimatedTokens = 2000
        break
      case "medium":
        estimatedTokens = 3000
        break
      case "large":
        estimatedTokens = 5000
        break
      default:
        estimatedTokens = 2500
    }

    // Build dependencies from feature dependencies and parent issue
    const dependencies: string[] = []
    if (feature.dependencies && feature.dependencies.length > 0) {
      dependencies.push(...feature.dependencies.map(d => `feature:${d}`))
    }
    if (issue.parent) {
      dependencies.push(`linear:${issue.parent.id}`)
    }

    // Build description with source context
    let description = feature.description
    if (feature.rawContext) {
      description += `\n\n---\n**Source:** ${feature.rawContext}`
    }
    if (feature.source.excerpt) {
      description += `\n\n---\n**Original context:** "${feature.source.excerpt}"`
    }

    const packet: WorkPacket = {
      id: `packet-${generatePacketId()}`,
      phaseId,
      title: feature.title,
      description,
      type: mapFeatureTypeToPacketType(feature.type),
      priority: feature.priority,
      status: "queued",
      tasks,
      suggestedTaskType: "code",
      acceptanceCriteria,
      estimatedTokens,
      dependencies,
      metadata: {
        source: "feature-extraction",
        linearId: issue.id,
        linearIdentifier: issue.identifier,
        linearState: issue.state.name,
        linearLabels: issue.labels.nodes.map(l => l.name),
        linearAssignee: issue.assignee?.email,
        linearParentId: issue.parent?.id,
        extractedFeatureTitle: feature.title,
        extractedFeatureSource: feature.source
      }
    }

    packets.push(packet)
  }

  return packets
}

// ============================================================================
// GRANULARITY POST-PROCESSING FUNCTIONS
// ============================================================================

/**
 * Estimate hours for a packet based on complexity and description
 * NOTE: Estimates are now MORE AGGRESSIVE (lower) to trigger more decomposition
 */
export function estimatePacketHours(
  complexity: ExtractedLinearFeature["complexity"],
  descriptionLength: number,
  taskCount: number
): PacketEstimate {
  let baseHours = 0.75 // Default (reduced from 1.5)

  // Complexity-based estimation (all values reduced for more granularity)
  switch (complexity) {
    case "trivial":
      baseHours = 0.25
      break
    case "small":
      baseHours = 0.5
      break
    case "medium":
      baseHours = 1
      break
    case "large":
      baseHours = 2 // Reduced from 4 - will trigger decomposition
      break
    default:
      baseHours = 0.75
  }

  // Adjust based on description length (more detail = more work)
  // But only add small increments to keep packets small
  if (descriptionLength > 500) {
    baseHours += 0.25
  }
  if (descriptionLength > 1000) {
    baseHours += 0.25
  }

  // Adjust based on task count
  if (taskCount > 5) {
    baseHours += 0.25
  }

  return {
    optimistic: Math.max(0.25, baseHours * 0.7),
    realistic: baseHours,
    pessimistic: baseHours * 1.5
  }
}

/**
 * Check if a packet needs decomposition based on estimated hours
 */
export function needsDecomposition(estimatedHours: PacketEstimate): boolean {
  return estimatedHours.realistic > GRANULARITY_GUIDELINES.decompositionThreshold
}

/**
 * Ensure a packet has the required number of tasks (3-5)
 */
export function ensureTasks(
  existingTasks: GranularPacketTask[] | undefined,
  title: string,
  description: string
): GranularPacketTask[] {
  const tasks = existingTasks ? [...existingTasks] : []

  // If no tasks, generate default tasks based on type
  if (tasks.length === 0) {
    tasks.push({
      id: `task-${generatePacketId()}`,
      description: `Analyze requirements for ${title}`,
      completed: false,
      order: 1
    })
    tasks.push({
      id: `task-${generatePacketId()}`,
      description: `Implement ${title}`,
      completed: false,
      order: 2
    })
    tasks.push({
      id: `task-${generatePacketId()}`,
      description: `Test implementation`,
      completed: false,
      order: 3
    })
  }

  // Ensure minimum tasks
  while (tasks.length < GRANULARITY_GUIDELINES.tasksMin) {
    const order = tasks.length + 1
    const genericTasks = [
      "Review and refine implementation",
      "Add error handling",
      "Update documentation",
      "Write unit tests",
      "Perform code review"
    ]
    tasks.push({
      id: `task-${generatePacketId()}`,
      description: genericTasks[tasks.length % genericTasks.length],
      completed: false,
      order
    })
  }

  // Limit to max tasks
  return tasks.slice(0, GRANULARITY_GUIDELINES.tasksMax)
}

/**
 * Ensure a packet has the required number of acceptance criteria (2-4)
 */
export function ensureAcceptanceCriteria(
  existingCriteria: string[] | undefined,
  title: string
): string[] {
  const criteria = existingCriteria ? [...existingCriteria] : []

  // If no criteria, generate defaults
  if (criteria.length === 0) {
    criteria.push(`${title} is implemented and functional`)
    criteria.push(`Tests pass for ${title.toLowerCase()}`)
  }

  // Ensure minimum criteria
  while (criteria.length < GRANULARITY_GUIDELINES.criteriaMin) {
    const genericCriteria = [
      "Code follows project conventions",
      "No regressions introduced",
      "Error cases are handled",
      "Documentation is updated"
    ]
    criteria.push(genericCriteria[criteria.length % genericCriteria.length])
  }

  // Limit to max criteria
  return criteria.slice(0, GRANULARITY_GUIDELINES.criteriaMax)
}

/**
 * Decompose a large packet into smaller sub-packets
 * Uses LLM to intelligently break down the work
 */
export async function decomposePacket(
  packet: WorkPacketWithGranularity,
  options?: {
    preferredServer?: string
    preferredModel?: string
    maxRetries?: number
  }
): Promise<WorkPacketWithGranularity[]> {
  const { preferredServer, preferredModel, maxRetries = 2 } = options || {}

  const decompositionPrompt = `AGGRESSIVELY break down this work item into ${GRANULARITY_GUIDELINES.subPacketMin}-${GRANULARITY_GUIDELINES.subPacketMax} smaller, VERY focused packets.

Original Work Item:
Title: ${packet.title}
Description: ${packet.description}
Type: ${packet.type}
Priority: ${packet.priority}
Estimated Hours: ${packet.estimatedHours.realistic}

=== CRITICAL REQUIREMENTS ===
- Each sub-packet MUST be completable in 15-30 MINUTES (0.25-0.5 hours MAX)
- Create MORE sub-packets rather than fewer - err on the side of too many
- Each sub-packet should do ONE VERY specific thing
- If a sub-packet would take more than 30 minutes, it needs to be split further

=== DECOMPOSITION PATTERNS ===
For features, split into:
- Data model/schema creation
- API endpoint implementation
- Frontend component building
- State management
- Validation/error handling
- Tests
- Documentation

For bugfixes, split into:
- Investigation/reproduction
- Root cause fix
- Edge case handling
- Regression tests
- Verification

=== REQUIREMENTS ===
- Each sub-packet needs 3-5 specific tasks
- Each sub-packet needs 2-4 acceptance criteria
- Make each sub-packet as focused as possible

Return JSON only:
{
  "subPackets": [
    {
      "title": "Clear, VERY specific title",
      "description": "What this sub-packet accomplishes (focused scope)",
      "type": "feature|bugfix|test|docs|config|refactor",
      "tasks": [
        "Specific task 1",
        "Specific task 2",
        "Specific task 3"
      ],
      "acceptanceCriteria": [
        "Criterion 1",
        "Criterion 2"
      ]
    }
  ]
}

Return ONLY the JSON. No markdown. No explanation.`

  try {
    const response = await generateWithLocalLLM(
      "You are a technical project manager. Break large work items into smaller, focused packets.",
      decompositionPrompt,
      {
        temperature: 0.3,
        max_tokens: 2048,
        preferredServer,
        preferredModel
      }
    )

    if (response.error) {
      console.error("[Linear Analysis] Decomposition LLM error:", response.error)
      return fallbackDecomposition(packet)
    }

    const parsed = parseDecompositionResponse(response.content)
    if (!parsed || parsed.length === 0) {
      return fallbackDecomposition(packet)
    }

    // Convert parsed sub-packets to WorkPacketWithGranularity
    return parsed.map((sub, index) => ({
      id: `packet-${generatePacketId()}`,
      title: sub.title,
      description: sub.description,
      type: sub.type as WorkPacketWithGranularity["type"],
      priority: packet.priority,
      estimatedHours: {
        optimistic: 0.5,
        realistic: 1.5,
        pessimistic: 2
      },
      tasks: sub.tasks.map((t, i) => ({
        id: `task-${generatePacketId()}`,
        description: t,
        completed: false,
        order: i + 1
      })),
      acceptanceCriteria: sub.acceptanceCriteria,
      parentPacketId: packet.id,
      parentIssueId: packet.source?.linearId,
      isDecomposed: true,
      decompositionReason: `Decomposed from "${packet.title}" (${packet.estimatedHours.realistic}h > ${GRANULARITY_GUIDELINES.decompositionThreshold}h threshold)`,
      source: packet.source
    }))
  } catch (error) {
    console.error("[Linear Analysis] Decomposition failed:", error)
    return fallbackDecomposition(packet)
  }
}

/**
 * Parse decomposition response from LLM
 */
function parseDecompositionResponse(response: string): Array<{
  title: string
  description: string
  type: string
  tasks: string[]
  acceptanceCriteria: string[]
}> | null {
  try {
    // Try direct parse
    let parsed
    try {
      parsed = JSON.parse(response.trim())
    } catch {
      // Try to extract JSON
      const match = response.match(/\{[\s\S]*\}/)
      if (match) {
        parsed = JSON.parse(match[0])
      }
    }

    if (parsed && Array.isArray(parsed.subPackets)) {
      return parsed.subPackets.map((p: Record<string, unknown>) => ({
        title: (p.title as string) || "Sub-task",
        description: (p.description as string) || "",
        type: (p.type as string) || "feature",
        tasks: Array.isArray(p.tasks) ? p.tasks.filter((t): t is string => typeof t === "string") : [],
        acceptanceCriteria: Array.isArray(p.acceptanceCriteria)
          ? p.acceptanceCriteria.filter((c): c is string => typeof c === "string")
          : []
      }))
    }
  } catch (error) {
    console.error("[Linear Analysis] Failed to parse decomposition:", error)
  }
  return null
}

/**
 * Fallback decomposition when LLM fails
 * Now more aggressive - creates more sub-packets for better granularity
 */
function fallbackDecomposition(packet: WorkPacketWithGranularity): WorkPacketWithGranularity[] {
  const hours = packet.estimatedHours.realistic
  // More aggressive: create more packets (divide by 0.75 hours instead of 1.5)
  const numPackets = Math.min(
    GRANULARITY_GUIDELINES.subPacketMax,
    Math.max(GRANULARITY_GUIDELINES.subPacketMin, Math.ceil(hours / 0.75))
  )

  // Extended decomposition patterns for more granular breakdown
  const patterns: Record<string, Array<{ suffix: string; type: string; tasks: string[] }>> = {
    feature: [
      { suffix: "Data Model", type: "feature", tasks: ["Design schema", "Create model", "Add validations"] },
      { suffix: "Core Logic", type: "feature", tasks: ["Implement business logic", "Add error handling", "Handle edge cases"] },
      { suffix: "API Endpoint", type: "feature", tasks: ["Create endpoint", "Add request validation", "Implement response"] },
      { suffix: "UI Component", type: "feature", tasks: ["Design component", "Implement component", "Add styling"] },
      { suffix: "State Management", type: "feature", tasks: ["Define state", "Create actions", "Connect to UI"] },
      { suffix: "Tests", type: "test", tasks: ["Write unit tests", "Write integration tests", "Verify coverage"] }
    ],
    bugfix: [
      { suffix: "Investigation", type: "bugfix", tasks: ["Reproduce issue", "Identify root cause", "Document findings"] },
      { suffix: "Fix Implementation", type: "bugfix", tasks: ["Implement fix", "Test fix locally", "Verify no side effects"] },
      { suffix: "Edge Cases", type: "bugfix", tasks: ["Identify edge cases", "Handle edge cases", "Test edge cases"] },
      { suffix: "Regression Tests", type: "test", tasks: ["Add regression test", "Verify in staging", "Update docs"] }
    ],
    default: [
      { suffix: "Setup", type: "feature", tasks: ["Analyze requirements", "Plan approach", "Set up structure"] },
      { suffix: "Implementation Part 1", type: "feature", tasks: ["Begin implementation", "Implement core", "Add basics"] },
      { suffix: "Implementation Part 2", type: "feature", tasks: ["Continue implementation", "Add features", "Handle errors"] },
      { suffix: "Finalization", type: "feature", tasks: ["Complete implementation", "Write tests", "Document changes"] }
    ]
  }

  const patternKey = packet.type === "bugfix" ? "bugfix" : packet.type === "feature" ? "feature" : "default"
  const selectedPatterns = patterns[patternKey] || patterns.default

  return Array.from({ length: numPackets }, (_, i) => {
    const pattern = selectedPatterns[i % selectedPatterns.length]
    const estimatedSubHours = Math.max(0.5, hours / numPackets)
    return {
      id: `packet-${generatePacketId()}`,
      title: `${packet.title} - ${pattern.suffix}`,
      description: `${pattern.suffix} for: ${packet.description}`,
      type: pattern.type as WorkPacketWithGranularity["type"],
      priority: packet.priority,
      estimatedHours: {
        optimistic: 0.25,
        realistic: estimatedSubHours,
        pessimistic: estimatedSubHours * 1.5
      },
      tasks: pattern.tasks.map((t, j) => ({
        id: `task-${generatePacketId()}`,
        description: t,
        completed: false,
        order: j + 1
      })),
      acceptanceCriteria: [
        `${pattern.suffix} is complete`,
        `Tests pass for this component`
      ],
      parentPacketId: packet.id,
      parentIssueId: packet.source?.linearId,
      isDecomposed: true,
      decompositionReason: `Fallback decomposition from "${packet.title}" (${hours}h)`,
      source: packet.source
    }
  })
}

/**
 * Post-process extracted features to ensure granularity guidelines are met
 * This is the main entry point for granularity processing
 */
export async function postProcessForGranularity(
  features: ExtractedLinearFeature[],
  issueId: string,
  issueIdentifier: string,
  options?: {
    preferredServer?: string
    preferredModel?: string
    maxRetries?: number
  }
): Promise<GranularityProcessingResult> {
  const { preferredServer, preferredModel, maxRetries = 2 } = options || {}

  const decompositionLog: GranularityProcessingResult["decompositionLog"] = []
  const processedPackets: WorkPacketWithGranularity[] = []

  // Convert features to initial packets with granularity info
  for (const feature of features) {
    const estimatedHours = estimatePacketHours(
      feature.complexity,
      feature.description.length,
      feature.acceptanceCriteria?.length || 0
    )

    const initialPacket: WorkPacketWithGranularity = {
      id: `packet-${generatePacketId()}`,
      title: feature.title,
      description: feature.description,
      type: feature.type === "bug" ? "bugfix" : feature.type as WorkPacketWithGranularity["type"],
      priority: feature.priority,
      estimatedHours,
      tasks: ensureTasks(
        feature.acceptanceCriteria?.map((ac, i) => ({
          id: `task-${generatePacketId()}`,
          description: ac,
          completed: false,
          order: i + 1
        })),
        feature.title,
        feature.description
      ),
      acceptanceCriteria: ensureAcceptanceCriteria(feature.acceptanceCriteria, feature.title),
      parentIssueId: issueId,
      source: {
        linearId: issueId,
        linearIdentifier: issueIdentifier
      }
    }

    // Check if decomposition is needed
    if (needsDecomposition(estimatedHours)) {
      console.log(`[Linear Analysis] Decomposing large packet: "${feature.title}" (${estimatedHours.realistic}h)`)

      const subPackets = await decomposePacket(initialPacket, { preferredServer, preferredModel, maxRetries })
      processedPackets.push(...subPackets)

      decompositionLog.push({
        originalTitle: feature.title,
        reason: `Estimated ${estimatedHours.realistic}h exceeds ${GRANULARITY_GUIDELINES.decompositionThreshold}h threshold`,
        subPacketCount: subPackets.length
      })
    } else {
      processedPackets.push(initialPacket)
    }
  }

  // Calculate summary statistics
  const byType: Record<string, number> = {}
  let totalHours = 0

  for (const packet of processedPackets) {
    byType[packet.type] = (byType[packet.type] || 0) + 1
    totalHours += packet.estimatedHours.realistic
  }

  return {
    packets: processedPackets,
    summary: {
      originalCount: features.length,
      decomposedCount: decompositionLog.reduce((sum, log) => sum + log.subPacketCount, 0),
      finalCount: processedPackets.length,
      estimatedTotalHours: Math.round(totalHours * 10) / 10,
      byType
    },
    decompositionLog
  }
}

/**
 * Enhanced prompt with granularity guidelines for feature extraction
 * Instructs the LLM to break large features into smaller pieces during extraction
 */
export const FEATURE_EXTRACTION_WITH_GRANULARITY_PROMPT = `You are an expert product analyst extracting actionable items from Linear issues.

=== CRITICAL: AGGRESSIVE EXTRACTION MODE ===
Your goal is to MAXIMIZE the number of packets extracted.
- Extract MORE items, NOT fewer
- When in doubt, CREATE SEPARATE PACKETS
- Aim for 50-100+ items from large issues with many comments

=== GRANULARITY GUIDELINES ===
CRITICAL: Each work item must be 0.5-1 hour of focused work (NOT 2+ hours!).

If you identify ANY feature that would take more than 1 hour, you MUST decompose it into 2-4 smaller items:
- BAD: "Implement user authentication" (too broad, 8+ hours)
- GOOD:
  * "Create User data model and schema" (30min)
  * "Add password hashing utility" (30min)
  * "Create login API endpoint" (1 hour)
  * "Build login form component" (1 hour)
  * "Add auth state management" (1 hour)
  * "Create logout functionality" (30min)
  * "Add session persistence" (1 hour)
  * "Write auth unit tests" (1 hour)
  * "Write auth integration tests" (1 hour)

Typical decomposition patterns:
- Data model, Utilities, API endpoints, Components, State, Tests, Docs
- Schema, Validation, Business logic, Error handling, UI, Tests
- Setup, Core implementation, Edge cases, Integration, Verification

=== FOR EACH ITEM ===
${FEATURE_EXTRACTION_SYSTEM_PROMPT.slice(FEATURE_EXTRACTION_SYSTEM_PROMPT.indexOf("=== FOR EACH ITEM EXTRACT ==="))}

=== ADDITIONAL REQUIREMENTS ===
- Generate 3-5 specific, actionable tasks per item
- Generate 2-4 measurable acceptance criteria per item
- Estimate complexity: trivial (<30min), small (30min-1hr), medium (1hr), large (>1hr - MUST decompose)
- Aim for minimum 30-50 packets for a typical project with many comments
- For issues with 50+ comments, aim for 50-100+ packets

=== FINAL REMINDER ===
EXTRACT MORE ITEMS, NOT FEWER. When in doubt, create separate packets.
Each packet should be 0.5-1 hour of work maximum.

${FEATURE_EXTRACTION_SYSTEM_PROMPT.slice(FEATURE_EXTRACTION_SYSTEM_PROMPT.indexOf("=== OUTPUT FORMAT ==="))}`
