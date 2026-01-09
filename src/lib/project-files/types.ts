/**
 * Project File System Types
 * Types for Claudia project folder structure and file-based communication with Claude Code
 *
 * Project folders live at: /home/bill/claudia-projects/{project-slug}/
 * Structure:
 *   .claudia/
 *     config.json          - ClaudiaProjectConfig
 *     status/              - Status updates from Claude Code
 *     requests/            - Requests from Claude Code to Claudia
 *   packets/
 *     {packet-slug}.md     - Individual packet markdown files
 *   resources/
 *     ...                  - Project resources and assets
 */

// ============================================
// Status Types (matching existing project types)
// ============================================

export type PacketStatus = "queued" | "in_progress" | "completed" | "failed"
export type PacketPriority = "critical" | "high" | "medium" | "low"
export type PacketType = "feature" | "bugfix" | "refactor" | "test" | "docs" | "config" | "research" | "infrastructure"

// ============================================
// Project Configuration
// ============================================

/**
 * Main project configuration stored in .claudia/config.json
 * This is the source of truth for project metadata in the file system
 */
export interface ClaudiaProjectConfig {
  /** Unique project identifier (UUID) */
  projectId: string
  /** URL-friendly project identifier */
  projectSlug: string
  /** Human-readable project name */
  name: string
  /** ISO 8601 timestamp when project was created */
  createdAt: string
  /** Reference to the approved build plan, if any */
  buildPlanId?: string
  /** ISO 8601 timestamp when build plan was approved */
  buildPlanApprovedAt?: string
  /** Index of all packets in this project */
  packets: PacketIndex[]
  /** ISO 8601 timestamp of last file system scan */
  lastScanned?: string
}

/**
 * Lightweight packet reference for the project config index
 * Full packet details live in the individual markdown files
 */
export interface PacketIndex {
  /** Unique packet identifier (UUID) */
  id: string
  /** URL-friendly packet identifier */
  slug: string
  /** Packet title for display */
  title: string
  /** Current execution status */
  status: PacketStatus
  /** Relative path from project root to packet file */
  filePath: string
  /** ISO 8601 timestamp of last modification */
  lastUpdated: string
}

// ============================================
// Status Updates (Claude Code -> Claudia)
// ============================================

export type StatusUpdateType = "started" | "in_progress" | "completed" | "failed" | "blocked"

/**
 * Status update written by Claude Code to .claudia/status/
 * Filename format: {timestamp}-{packetId}.json
 */
export interface ClaudiaStatusUpdate {
  /** ISO 8601 timestamp when status was written */
  timestamp: string
  /** ID of the packet this status relates to */
  packetId: string
  /** Current status of the work */
  status: StatusUpdateType
  /** Progress percentage (0-100) */
  progress?: number
  /** Human-readable notes about current state */
  notes?: string
  /** List of files that were changed */
  filesChanged?: string[]
  /** Error message if status is "failed" or "blocked" */
  error?: string
  /** Current task being worked on */
  currentTask?: string
  /** Tasks completed so far */
  tasksCompleted?: string[]
}

// ============================================
// Requests (Claude Code -> Claudia)
// ============================================

export type ClaudiaRequestType =
  | "new_packet"
  | "quality_review"
  | "approval_needed"
  | "activity"
  | "feedback"
  | "clarification"
  | "dependency_blocked"

/**
 * Request from Claude Code to Claudia
 * Written to .claudia/requests/{timestamp}-{type}.json
 */
export interface ClaudiaRequest {
  /** ISO 8601 timestamp when request was created */
  timestamp: string
  /** Type of request determining the payload structure */
  type: ClaudiaRequestType
  /** Request-specific payload */
  payload: ClaudiaRequestPayload
  /** Whether this request has been processed by Claudia */
  processed?: boolean
  /** ISO 8601 timestamp when request was processed */
  processedAt?: string
  /** Response from Claudia after processing */
  response?: ClaudiaResponse
}

export type ClaudiaRequestPayload =
  | NewPacketRequest
  | QualityReviewRequest
  | ApprovalRequest
  | ActivityRequest
  | FeedbackRequest
  | ClarificationRequest
  | DependencyBlockedRequest

/**
 * Request to create a new packet discovered during work
 */
export interface NewPacketRequest {
  /** Suggested title for the new packet */
  title: string
  /** Detailed description of what needs to be done */
  description: string
  /** Suggested packet type */
  type: PacketType
  /** Suggested priority level */
  priority: PacketPriority
  /** Breakdown of tasks for the new packet */
  tasks: string[]
  /** Explanation of why this new packet is needed */
  reason: string
  /** ID of the packet that triggered this request */
  sourcePacketId?: string
  /** IDs of packets this depends on or should follow */
  suggestedDependencies?: string[]
}

/**
 * Request for quality review of completed work
 */
export interface QualityReviewRequest {
  /** ID of the packet that was completed */
  packetId: string
  /** List of files that need review */
  files: string[]
  /** Notes about the implementation */
  notes?: string
  /** Specific areas to focus on during review */
  reviewFocus?: string[]
  /** Test commands that were run */
  testsRun?: string[]
  /** Test results summary */
  testResults?: string
}

/**
 * Request for user approval on a decision or change
 */
export interface ApprovalRequest {
  /** ID of the related packet */
  packetId: string
  /** Title of the approval request */
  title: string
  /** Detailed description of what needs approval */
  description: string
  /** Available options for the user to choose from */
  options?: ApprovalOption[]
  /** Why approval is needed */
  reason: string
  /** Impact of each option */
  impact?: string
  /** Whether work is blocked until approval is received */
  blocking: boolean
}

export interface ApprovalOption {
  /** Unique identifier for this option */
  id: string
  /** Short label for the option */
  label: string
  /** Detailed description of this option */
  description: string
  /** Potential consequences of choosing this option */
  consequences?: string
}

/**
 * Activity report for logging and monitoring
 */
export interface ActivityRequest {
  /** ID of the related packet */
  packetId: string
  /** Type of activity */
  activityType: "file_created" | "file_modified" | "file_deleted" | "command_run" | "test_run" | "error" | "milestone"
  /** Human-readable summary of the activity */
  summary: string
  /** Detailed information about the activity */
  details?: Record<string, unknown>
  /** Files affected by this activity */
  affectedFiles?: string[]
  /** Duration of the activity in milliseconds */
  duration?: number
}

/**
 * Feedback or question from Claude Code
 */
export interface FeedbackRequest {
  /** ID of the related packet, if any */
  packetId?: string
  /** Feedback category */
  category: "question" | "suggestion" | "concern" | "info"
  /** Main message */
  message: string
  /** Additional context */
  context?: string
  /** Whether a response is needed */
  responseRequested: boolean
}

/**
 * Request for clarification on requirements or approach
 */
export interface ClarificationRequest {
  /** ID of the related packet */
  packetId: string
  /** What needs clarification */
  question: string
  /** Context for the question */
  context: string
  /** Possible interpretations or options */
  possibleAnswers?: string[]
  /** What Claude Code will assume if no response */
  defaultAssumption?: string
  /** Whether work is blocked until clarification is received */
  blocking: boolean
}

/**
 * Notification that work is blocked by a dependency
 */
export interface DependencyBlockedRequest {
  /** ID of the blocked packet */
  packetId: string
  /** ID of the blocking packet or external dependency */
  blockedBy: string
  /** Whether the blocker is internal (another packet) or external */
  blockerType: "packet" | "external"
  /** Description of what's needed to unblock */
  unblockRequirements: string
  /** Suggested actions to resolve the block */
  suggestedActions?: string[]
}

// ============================================
// Responses (Claudia -> Claude Code)
// ============================================

export interface ClaudiaResponse {
  /** ISO 8601 timestamp of response */
  timestamp: string
  /** Whether the request was approved/accepted */
  approved: boolean
  /** Response message or decision */
  message?: string
  /** Selected option ID for approval requests */
  selectedOption?: string
  /** Additional instructions or context */
  additionalInstructions?: string
  /** User who responded */
  respondedBy?: string
}

// ============================================
// Packet Markdown Frontmatter
// ============================================

/**
 * Frontmatter for packet markdown files in packets/{slug}.md
 * Parsed from YAML at the top of the markdown file
 */
export interface PacketFrontmatter {
  /** Unique packet identifier */
  id: string
  /** Packet title */
  title: string
  /** Packet type category */
  type: PacketType
  /** Priority level */
  priority: PacketPriority
  /** Current status */
  status: PacketStatus
  /** Build plan phase ID this packet belongs to */
  phaseId?: string
  /** IDs of packets this depends on */
  dependencies?: string[]
  /** Tags for categorization */
  tags?: string[]
  /** Estimated effort (e.g., "2h", "1d", "1w") */
  estimatedEffort?: string
  /** Actual time spent */
  actualEffort?: string
  /** ISO 8601 timestamp of creation */
  createdAt: string
  /** ISO 8601 timestamp of last update */
  updatedAt: string
  /** ISO 8601 timestamp of completion */
  completedAt?: string
  /** Assigned model or worker */
  assignedTo?: string
}

/**
 * Task item within a packet
 */
export interface PacketTask {
  /** Unique task identifier */
  id: string
  /** Task description */
  description: string
  /** Whether the task is completed */
  completed: boolean
  /** Order/sequence number */
  order: number
  /** Notes about completion */
  completionNotes?: string
}

/**
 * Full parsed packet from markdown file
 */
export interface ParsedPacket {
  /** Parsed frontmatter */
  frontmatter: PacketFrontmatter
  /** Description section (markdown) */
  description: string
  /** Array of tasks */
  tasks: PacketTask[]
  /** Array of acceptance criteria */
  acceptanceCriteria: string[]
  /** Implementation notes section (markdown) */
  implementationNotes?: string
  /** Testing requirements section (markdown) */
  testingRequirements?: string
  /** Additional notes or context (markdown) */
  additionalContext?: string
  /** Raw markdown content */
  rawContent: string
}

// ============================================
// Build Plan Frontmatter
// ============================================

/**
 * Frontmatter for build plan markdown files
 */
export interface BuildPlanFrontmatter {
  /** Unique build plan identifier */
  id: string
  /** Build plan name */
  name: string
  /** Project ID this plan belongs to */
  projectId: string
  /** Version number */
  version: number
  /** Plan status */
  status: "draft" | "approved" | "locked" | "archived"
  /** ISO 8601 timestamp of creation */
  createdAt: string
  /** ISO 8601 timestamp of approval */
  approvedAt?: string
  /** User who approved the plan */
  approvedBy?: string
  /** Model/system that generated the plan */
  generatedBy?: string
}

/**
 * Phase definition in a build plan
 */
export interface BuildPlanPhase {
  /** Unique phase identifier */
  id: string
  /** Phase name */
  name: string
  /** Phase description */
  description: string
  /** Order in the sequence */
  order: number
  /** IDs of packets in this phase */
  packetIds: string[]
}

// ============================================
// File System Utilities
// ============================================

/**
 * Result of scanning a project directory
 */
export interface ProjectScanResult {
  /** Whether the scan was successful */
  success: boolean
  /** Project configuration if found */
  config?: ClaudiaProjectConfig
  /** Array of found packet files */
  packets: PacketFileInfo[]
  /** Array of pending status updates */
  statusUpdates: ClaudiaStatusUpdate[]
  /** Array of pending requests */
  pendingRequests: ClaudiaRequest[]
  /** Errors encountered during scan */
  errors: string[]
  /** ISO 8601 timestamp of scan */
  scannedAt: string
}

/**
 * Information about a packet file on disk
 */
export interface PacketFileInfo {
  /** File path relative to project root */
  filePath: string
  /** Absolute file path */
  absolutePath: string
  /** Packet slug (filename without extension) */
  slug: string
  /** File modification timestamp */
  modifiedAt: string
  /** File size in bytes */
  size: number
  /** Parsed frontmatter (if readable) */
  frontmatter?: PacketFrontmatter
}

/**
 * Options for file system operations
 */
export interface FileSystemOptions {
  /** Base path for claudia projects */
  basePath?: string
  /** Whether to create directories if they don't exist */
  createIfMissing?: boolean
  /** Whether to validate file contents */
  validate?: boolean
}

// ============================================
// Event Types (for real-time monitoring)
// ============================================

export type ProjectFileEventType =
  | "config_changed"
  | "packet_created"
  | "packet_updated"
  | "packet_deleted"
  | "status_update"
  | "request_created"
  | "request_processed"

/**
 * Event emitted when project files change
 */
export interface ProjectFileEvent {
  /** Type of event */
  type: ProjectFileEventType
  /** Project ID */
  projectId: string
  /** ISO 8601 timestamp of event */
  timestamp: string
  /** Path to the affected file */
  filePath: string
  /** Event-specific data */
  data?: unknown
}

// ============================================
// Type Guards
// ============================================

export function isNewPacketRequest(payload: ClaudiaRequestPayload): payload is NewPacketRequest {
  return 'reason' in payload && 'tasks' in payload && Array.isArray((payload as NewPacketRequest).tasks)
}

export function isQualityReviewRequest(payload: ClaudiaRequestPayload): payload is QualityReviewRequest {
  return 'files' in payload && Array.isArray((payload as QualityReviewRequest).files)
}

export function isApprovalRequest(payload: ClaudiaRequestPayload): payload is ApprovalRequest {
  return 'blocking' in payload && 'title' in payload && 'description' in payload
}

export function isActivityRequest(payload: ClaudiaRequestPayload): payload is ActivityRequest {
  return 'activityType' in payload && 'summary' in payload
}

export function isFeedbackRequest(payload: ClaudiaRequestPayload): payload is FeedbackRequest {
  return 'category' in payload && 'message' in payload && 'responseRequested' in payload
}

export function isClarificationRequest(payload: ClaudiaRequestPayload): payload is ClarificationRequest {
  return 'question' in payload && 'context' in payload && 'blocking' in payload
}

export function isDependencyBlockedRequest(payload: ClaudiaRequestPayload): payload is DependencyBlockedRequest {
  return 'blockedBy' in payload && 'blockerType' in payload && 'unblockRequirements' in payload
}
