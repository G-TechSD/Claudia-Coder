/**
 * Project Classifier for N8N vs Code Generation
 *
 * Analyzes work packets to determine if they're better suited for:
 * - N8N workflows (integrations, automation, data pipelines)
 * - Code generation (UI, algorithms, custom logic, schemas)
 */

// ============ Types ============

export interface WorkPacket {
  id: string
  title: string
  description: string
  type: string
  priority?: string
  tasks?: Array<{ id: string; description: string; completed?: boolean }>
  acceptanceCriteria?: string[]
  // Optional metadata that may contain labels/tags
  metadata?: {
    linearLabels?: string[]
    tags?: string[]
    source?: string
    [key: string]: unknown
  }
  // Optional tags directly on packet
  tags?: string[]
  labels?: string[]
}

export interface ProjectClassification {
  isN8NSuitable: boolean
  confidence: number // 0-1
  reason: string
  suggestedWorkflowType?: N8NWorkflowType
  codeGenerationReasons?: string[] // Why it might need code gen
  n8nReasons?: string[] // Why it might suit N8N
}

export type N8NWorkflowType =
  | "api-integration"      // Connecting external APIs
  | "data-sync"            // ETL, data synchronization
  | "scheduled-task"       // Cron jobs, scheduled automation
  | "webhook-handler"      // Receiving and processing webhooks
  | "notification"         // Email, Slack, SMS notifications
  | "workflow-orchestration" // Multi-step workflows
  | "crud-external"        // CRUD operations with external services
  | "event-trigger"        // Event-driven automation

// ============ Keyword Configurations ============

/**
 * Keywords that strongly indicate N8N suitability
 * Higher weight = stronger indicator
 */
const N8N_KEYWORDS: Record<string, { weight: number; workflowType: N8NWorkflowType }> = {
  // Integration keywords
  "integration": { weight: 0.9, workflowType: "api-integration" },
  "integrate": { weight: 0.85, workflowType: "api-integration" },
  "connect": { weight: 0.6, workflowType: "api-integration" },
  "api": { weight: 0.5, workflowType: "api-integration" },
  "external service": { weight: 0.8, workflowType: "api-integration" },
  "third-party": { weight: 0.75, workflowType: "api-integration" },
  "3rd party": { weight: 0.75, workflowType: "api-integration" },

  // Automation keywords
  "automation": { weight: 0.9, workflowType: "scheduled-task" },
  "automate": { weight: 0.85, workflowType: "scheduled-task" },
  "automated": { weight: 0.8, workflowType: "scheduled-task" },
  "schedule": { weight: 0.85, workflowType: "scheduled-task" },
  "scheduled": { weight: 0.85, workflowType: "scheduled-task" },
  "cron": { weight: 0.95, workflowType: "scheduled-task" },
  "periodic": { weight: 0.7, workflowType: "scheduled-task" },
  "recurring": { weight: 0.7, workflowType: "scheduled-task" },
  "daily": { weight: 0.6, workflowType: "scheduled-task" },
  "hourly": { weight: 0.7, workflowType: "scheduled-task" },
  "weekly": { weight: 0.6, workflowType: "scheduled-task" },

  // Trigger/Webhook keywords
  "trigger": { weight: 0.75, workflowType: "event-trigger" },
  "webhook": { weight: 0.95, workflowType: "webhook-handler" },
  "callback": { weight: 0.7, workflowType: "webhook-handler" },
  "event-driven": { weight: 0.85, workflowType: "event-trigger" },
  "on event": { weight: 0.7, workflowType: "event-trigger" },
  "listener": { weight: 0.65, workflowType: "event-trigger" },

  // Data pipeline keywords
  "etl": { weight: 0.95, workflowType: "data-sync" },
  "pipeline": { weight: 0.7, workflowType: "data-sync" },
  "data pipeline": { weight: 0.9, workflowType: "data-sync" },
  "sync": { weight: 0.75, workflowType: "data-sync" },
  "synchronize": { weight: 0.8, workflowType: "data-sync" },
  "synchronization": { weight: 0.8, workflowType: "data-sync" },
  "transform": { weight: 0.5, workflowType: "data-sync" },
  "migrate": { weight: 0.6, workflowType: "data-sync" },
  "migration": { weight: 0.55, workflowType: "data-sync" },
  "import": { weight: 0.4, workflowType: "data-sync" },
  "export": { weight: 0.4, workflowType: "data-sync" },

  // Notification keywords
  "notification": { weight: 0.85, workflowType: "notification" },
  "notify": { weight: 0.8, workflowType: "notification" },
  "alert": { weight: 0.75, workflowType: "notification" },
  "email": { weight: 0.7, workflowType: "notification" },
  "send email": { weight: 0.85, workflowType: "notification" },
  "slack": { weight: 0.85, workflowType: "notification" },
  "slack message": { weight: 0.9, workflowType: "notification" },
  "sms": { weight: 0.85, workflowType: "notification" },
  "discord": { weight: 0.8, workflowType: "notification" },
  "teams": { weight: 0.75, workflowType: "notification" },
  "push notification": { weight: 0.85, workflowType: "notification" },

  // Workflow/Orchestration keywords
  "workflow": { weight: 0.7, workflowType: "workflow-orchestration" },
  "orchestrate": { weight: 0.85, workflowType: "workflow-orchestration" },
  "orchestration": { weight: 0.85, workflowType: "workflow-orchestration" },
  "multi-step": { weight: 0.6, workflowType: "workflow-orchestration" },
  "chain": { weight: 0.5, workflowType: "workflow-orchestration" },
  "sequence": { weight: 0.45, workflowType: "workflow-orchestration" },

  // External CRUD keywords
  "crud": { weight: 0.4, workflowType: "crud-external" },
  "google sheets": { weight: 0.9, workflowType: "crud-external" },
  "airtable": { weight: 0.9, workflowType: "crud-external" },
  "notion": { weight: 0.85, workflowType: "crud-external" },
  "spreadsheet": { weight: 0.7, workflowType: "crud-external" },
  "salesforce": { weight: 0.85, workflowType: "crud-external" },
  "hubspot": { weight: 0.85, workflowType: "crud-external" },
  "zendesk": { weight: 0.85, workflowType: "crud-external" },
  "jira": { weight: 0.7, workflowType: "crud-external" },
  "linear": { weight: 0.6, workflowType: "crud-external" },
  "github": { weight: 0.5, workflowType: "crud-external" },
  "gitlab": { weight: 0.5, workflowType: "crud-external" },

  // Specific N8N-friendly services
  "stripe": { weight: 0.6, workflowType: "api-integration" },
  "twilio": { weight: 0.8, workflowType: "notification" },
  "sendgrid": { weight: 0.85, workflowType: "notification" },
  "mailchimp": { weight: 0.8, workflowType: "notification" },
  "zapier": { weight: 0.95, workflowType: "workflow-orchestration" },
  "make.com": { weight: 0.95, workflowType: "workflow-orchestration" },
}

/**
 * Keywords that strongly indicate code generation is needed
 * Higher weight = stronger indicator for code generation
 */
const CODE_GEN_KEYWORDS: Record<string, number> = {
  // UI/Frontend keywords
  "ui": 0.8,
  "user interface": 0.85,
  "frontend": 0.9,
  "front-end": 0.9,
  "component": 0.75,
  "react": 0.85,
  "vue": 0.85,
  "angular": 0.85,
  "svelte": 0.85,
  "css": 0.8,
  "styling": 0.7,
  "layout": 0.65,
  "responsive": 0.7,
  "animation": 0.8,
  "button": 0.6,
  "modal": 0.65,
  "form": 0.5,
  "page": 0.4,
  "view": 0.35,
  "dashboard": 0.5,
  "chart": 0.55,
  "graph": 0.5,
  "visualization": 0.6,

  // Algorithm keywords
  "algorithm": 0.95,
  "sorting": 0.9,
  "search": 0.4,
  "optimization": 0.7,
  "recursive": 0.9,
  "dynamic programming": 0.95,
  "graph traversal": 0.9,
  "pathfinding": 0.9,
  "machine learning": 0.85,
  "ml model": 0.85,
  "neural network": 0.9,
  "classification": 0.7,
  "clustering": 0.75,
  "parsing": 0.8,
  "compiler": 0.95,
  "interpreter": 0.9,
  "lexer": 0.95,
  "ast": 0.9,

  // Custom business logic keywords
  "business logic": 0.85,
  "domain logic": 0.85,
  "validation": 0.6,
  "calculation": 0.5,
  "pricing": 0.6,
  "discount": 0.5,
  "tax": 0.55,
  "inventory": 0.5,
  "booking": 0.55,
  "reservation": 0.55,
  "scheduling algorithm": 0.85,

  // Database/Schema keywords
  "database": 0.7,
  "schema": 0.85,
  "migration": 0.75,
  "model": 0.5,
  "entity": 0.65,
  "table": 0.6,
  "index": 0.5,
  "query": 0.45,
  "sql": 0.6,
  "prisma": 0.8,
  "drizzle": 0.8,
  "typeorm": 0.8,
  "mongoose": 0.75,
  "orm": 0.7,

  // Mobile keywords
  "mobile": 0.85,
  "ios": 0.9,
  "android": 0.9,
  "react native": 0.9,
  "flutter": 0.9,
  "swift": 0.9,
  "kotlin": 0.85,
  "app store": 0.85,
  "play store": 0.85,

  // Backend code keywords
  "endpoint": 0.5,
  "route": 0.45,
  "controller": 0.6,
  "service class": 0.7,
  "repository": 0.65,
  "middleware": 0.6,
  "authentication": 0.55,
  "authorization": 0.5,
  "jwt": 0.6,
  "oauth": 0.5,
  "session": 0.5,

  // Testing keywords
  "unit test": 0.75,
  "test case": 0.7,
  "test suite": 0.75,
  "e2e test": 0.7,
  "integration test": 0.65,
  "mock": 0.6,
  "fixture": 0.65,

  // Architecture keywords
  "refactor": 0.7,
  "architecture": 0.75,
  "design pattern": 0.8,
  "abstraction": 0.75,
  "inheritance": 0.8,
  "polymorphism": 0.85,
  "interface": 0.5,
  "class": 0.4,
  "type": 0.3,
}

/**
 * Labels/tags that indicate N8N suitability
 */
const N8N_LABELS = new Set([
  "integration",
  "automation",
  "workflow",
  "n8n",
  "pipeline",
  "etl",
  "sync",
  "notification",
  "webhook",
  "scheduled",
  "cron",
  "external-api",
  "third-party",
])

/**
 * Labels/tags that indicate code generation is needed
 */
const CODE_GEN_LABELS = new Set([
  "frontend",
  "ui",
  "backend",
  "api",
  "database",
  "schema",
  "algorithm",
  "mobile",
  "component",
  "feature",
  "bugfix",
  "refactor",
  "performance",
  "security",
  "test",
])

// ============ Classification Logic ============

/**
 * Normalize text for keyword matching
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim()
}

/**
 * Check if text contains a keyword (handles multi-word keywords)
 */
function containsKeyword(text: string, keyword: string): boolean {
  const normalizedText = normalizeText(text)
  const normalizedKeyword = normalizeText(keyword)
  return normalizedText.includes(normalizedKeyword)
}

/**
 * Extract all text content from a work packet for analysis
 */
function extractTextContent(packet: WorkPacket): string {
  const parts: string[] = [
    packet.title,
    packet.description,
  ]

  // Add task descriptions
  if (packet.tasks) {
    parts.push(...packet.tasks.map(t => t.description))
  }

  // Add acceptance criteria
  if (packet.acceptanceCriteria) {
    parts.push(...packet.acceptanceCriteria)
  }

  return parts.join(" ")
}

/**
 * Get all labels/tags from a packet
 */
function extractLabels(packet: WorkPacket): string[] {
  const labels: string[] = []

  if (packet.tags) {
    labels.push(...packet.tags)
  }

  if (packet.labels) {
    labels.push(...packet.labels)
  }

  if (packet.metadata?.linearLabels) {
    labels.push(...packet.metadata.linearLabels)
  }

  if (packet.metadata?.tags && Array.isArray(packet.metadata.tags)) {
    labels.push(...packet.metadata.tags)
  }

  return labels.map(l => normalizeText(l))
}

/**
 * Calculate N8N score based on keyword matches
 */
function calculateN8NScore(text: string): {
  score: number
  matches: Array<{ keyword: string; weight: number; workflowType: N8NWorkflowType }>
} {
  const matches: Array<{ keyword: string; weight: number; workflowType: N8NWorkflowType }> = []

  for (const [keyword, config] of Object.entries(N8N_KEYWORDS)) {
    if (containsKeyword(text, keyword)) {
      matches.push({
        keyword,
        weight: config.weight,
        workflowType: config.workflowType,
      })
    }
  }

  // Calculate weighted average, capped at 1.0
  if (matches.length === 0) return { score: 0, matches }

  const totalWeight = matches.reduce((sum, m) => sum + m.weight, 0)
  const avgWeight = totalWeight / matches.length

  // Boost score if multiple matches (indicates stronger N8N fit)
  const countBoost = Math.min(matches.length * 0.05, 0.2)

  return {
    score: Math.min(avgWeight + countBoost, 1.0),
    matches,
  }
}

/**
 * Calculate code generation score based on keyword matches
 */
function calculateCodeGenScore(text: string): {
  score: number
  matches: Array<{ keyword: string; weight: number }>
} {
  const matches: Array<{ keyword: string; weight: number }> = []

  for (const [keyword, weight] of Object.entries(CODE_GEN_KEYWORDS)) {
    if (containsKeyword(text, keyword)) {
      matches.push({ keyword, weight })
    }
  }

  if (matches.length === 0) return { score: 0, matches }

  const totalWeight = matches.reduce((sum, m) => sum + m.weight, 0)
  const avgWeight = totalWeight / matches.length

  // Boost score if multiple matches
  const countBoost = Math.min(matches.length * 0.05, 0.2)

  return {
    score: Math.min(avgWeight + countBoost, 1.0),
    matches,
  }
}

/**
 * Calculate label-based scores
 */
function calculateLabelScores(labels: string[]): { n8nScore: number; codeGenScore: number } {
  let n8nCount = 0
  let codeGenCount = 0

  for (const label of labels) {
    if (N8N_LABELS.has(label)) n8nCount++
    if (CODE_GEN_LABELS.has(label)) codeGenCount++
  }

  const totalLabels = labels.length || 1

  return {
    n8nScore: n8nCount / totalLabels,
    codeGenScore: codeGenCount / totalLabels,
  }
}

/**
 * Determine the most likely N8N workflow type based on matches
 */
function determineWorkflowType(
  matches: Array<{ keyword: string; weight: number; workflowType: N8NWorkflowType }>
): N8NWorkflowType | undefined {
  if (matches.length === 0) return undefined

  // Count workflow types, weighted by keyword weight
  const typeCounts: Record<N8NWorkflowType, number> = {
    "api-integration": 0,
    "data-sync": 0,
    "scheduled-task": 0,
    "webhook-handler": 0,
    "notification": 0,
    "workflow-orchestration": 0,
    "crud-external": 0,
    "event-trigger": 0,
  }

  for (const match of matches) {
    typeCounts[match.workflowType] += match.weight
  }

  // Find the type with highest weighted count
  let maxType: N8NWorkflowType = "workflow-orchestration"
  let maxCount = 0

  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > maxCount) {
      maxCount = count
      maxType = type as N8NWorkflowType
    }
  }

  return maxType
}

/**
 * Generate human-readable reason for the classification
 */
function generateReason(
  isN8NSuitable: boolean,
  n8nMatches: Array<{ keyword: string; weight: number; workflowType: N8NWorkflowType }>,
  codeGenMatches: Array<{ keyword: string; weight: number }>,
  confidence: number
): string {
  const confidenceLevel = confidence > 0.8 ? "high" : confidence > 0.5 ? "moderate" : "low"

  if (isN8NSuitable) {
    const topKeywords = n8nMatches
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(m => m.keyword)

    if (topKeywords.length === 0) {
      return `This project appears suitable for N8N with ${confidenceLevel} confidence based on its general characteristics.`
    }

    return `This project is well-suited for N8N workflows with ${confidenceLevel} confidence. Key indicators: ${topKeywords.join(", ")}.`
  } else {
    const topKeywords = codeGenMatches
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(m => m.keyword)

    if (topKeywords.length === 0) {
      return `This project requires code generation with ${confidenceLevel} confidence based on its general characteristics.`
    }

    return `This project requires code generation with ${confidenceLevel} confidence. Key indicators: ${topKeywords.join(", ")}.`
  }
}

// ============ Main Classification Function ============

/**
 * Classify a work packet to determine if it's better suited for N8N workflows
 * or code generation.
 *
 * @param packet - The work packet to classify
 * @returns Classification result with confidence and reasoning
 *
 * @example
 * ```ts
 * const result = classifyProject({
 *   id: "1",
 *   title: "Set up Slack notifications for new orders",
 *   description: "When a new order is placed, send a notification to the #orders Slack channel",
 *   type: "feature"
 * })
 *
 * // Result:
 * // {
 * //   isN8NSuitable: true,
 * //   confidence: 0.85,
 * //   reason: "This project is well-suited for N8N workflows with high confidence. Key indicators: slack, notification, orders.",
 * //   suggestedWorkflowType: "notification"
 * // }
 * ```
 */
export function classifyProject(packet: WorkPacket): ProjectClassification {
  // Extract all analyzable content
  const textContent = extractTextContent(packet)
  const labels = extractLabels(packet)

  // Calculate scores
  const n8nResult = calculateN8NScore(textContent)
  const codeGenResult = calculateCodeGenScore(textContent)
  const labelScores = calculateLabelScores(labels)

  // Combine text and label scores (text weighted more heavily)
  const combinedN8NScore = n8nResult.score * 0.8 + labelScores.n8nScore * 0.2
  const combinedCodeGenScore = codeGenResult.score * 0.8 + labelScores.codeGenScore * 0.2

  // Determine if N8N is suitable
  // N8N wins if its score is higher OR if scores are close but N8N has strong indicators
  const scoreDifference = combinedN8NScore - combinedCodeGenScore
  const isN8NSuitable = scoreDifference > -0.1 && combinedN8NScore > 0.3

  // Calculate confidence based on score separation
  let confidence: number
  if (Math.abs(scoreDifference) > 0.4) {
    confidence = Math.min(0.95, 0.7 + Math.abs(scoreDifference) * 0.5)
  } else if (Math.abs(scoreDifference) > 0.2) {
    confidence = 0.6 + Math.abs(scoreDifference) * 0.3
  } else {
    confidence = 0.4 + Math.abs(scoreDifference) * 0.5
  }

  // Boost confidence if we have many matching keywords
  const totalMatches = n8nResult.matches.length + codeGenResult.matches.length
  if (totalMatches > 5) {
    confidence = Math.min(confidence + 0.1, 0.95)
  }

  // If both scores are very low, reduce confidence
  if (combinedN8NScore < 0.2 && combinedCodeGenScore < 0.2) {
    confidence = Math.max(confidence - 0.2, 0.3)
  }

  return {
    isN8NSuitable,
    confidence: Math.round(confidence * 100) / 100,
    reason: generateReason(isN8NSuitable, n8nResult.matches, codeGenResult.matches, confidence),
    suggestedWorkflowType: isN8NSuitable ? determineWorkflowType(n8nResult.matches) : undefined,
    n8nReasons: n8nResult.matches.map(m => m.keyword),
    codeGenerationReasons: codeGenResult.matches.map(m => m.keyword),
  }
}

/**
 * Batch classify multiple packets
 */
export function classifyProjects(packets: WorkPacket[]): Map<string, ProjectClassification> {
  const results = new Map<string, ProjectClassification>()

  for (const packet of packets) {
    results.set(packet.id, classifyProject(packet))
  }

  return results
}

/**
 * Quick check if a packet is likely N8N-suitable (faster than full classification)
 */
export function isLikelyN8NSuitable(packet: WorkPacket): boolean {
  const textContent = extractTextContent(packet)
  const normalizedText = normalizeText(textContent)

  // Quick check for high-confidence N8N keywords
  const highConfidenceN8NKeywords = [
    "integration",
    "webhook",
    "automation",
    "notification",
    "slack",
    "email",
    "scheduled",
    "cron",
    "sync",
    "etl",
  ]

  return highConfidenceN8NKeywords.some(keyword => normalizedText.includes(keyword))
}

/**
 * Get suggested workflow templates based on classification
 */
export function getSuggestedTemplates(classification: ProjectClassification): string[] {
  if (!classification.isN8NSuitable || !classification.suggestedWorkflowType) {
    return []
  }

  const templateMap: Record<N8NWorkflowType, string[]> = {
    "api-integration": [
      "HTTP Request -> Process Data -> Update Database",
      "API Polling -> Compare -> Notify on Changes",
      "Multi-API Aggregator -> Transform -> Single Output",
    ],
    "data-sync": [
      "Source System -> Transform -> Target System",
      "Bi-directional Sync with Conflict Resolution",
      "Incremental Sync with Change Tracking",
    ],
    "scheduled-task": [
      "Cron Trigger -> Execute Task -> Report Results",
      "Daily Data Aggregation -> Email Summary",
      "Periodic Cleanup -> Archive -> Notify",
    ],
    "webhook-handler": [
      "Webhook Receive -> Validate -> Route to Handler",
      "Webhook -> Enrich Data -> Forward to System",
      "Multi-Webhook Aggregator -> Process -> Store",
    ],
    "notification": [
      "Event -> Format Message -> Multi-Channel Notify",
      "Threshold Monitor -> Alert -> Escalate",
      "Digest Collector -> Schedule -> Batch Notify",
    ],
    "workflow-orchestration": [
      "Multi-Step Approval Workflow",
      "Parallel Processing -> Aggregate Results",
      "Conditional Branching -> Route to Handlers",
    ],
    "crud-external": [
      "Create/Update Record -> Sync External Service",
      "External Service -> Local Cache -> API Response",
      "Batch Operations -> External Service -> Reconcile",
    ],
    "event-trigger": [
      "Event Listener -> Filter -> Process -> Act",
      "Multi-Source Events -> Dedupe -> Handle",
      "Event -> Enrich -> Route -> Handle by Type",
    ],
  }

  return templateMap[classification.suggestedWorkflowType] || []
}
