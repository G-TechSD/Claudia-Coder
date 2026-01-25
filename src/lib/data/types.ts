/**
 * Claudia Data Types
 * Core types for projects, interviews, and related entities
 */

// ============ User Roles ============

export type UserRole = "admin" | "beta_tester" | "user"

// ============ API Key Sources ============

export type ApiKeySource = "provided" | "own"

// ============ User API Budget ============

export interface UserApiBudget {
  apiKeySource: ApiKeySource           // Whether we provide API key or user brings own
  anthropicApiKey?: string             // User's own API key (encrypted)
  apiUsageBudget: number               // Max spend allowed in dollars (e.g., 10.00)
  apiUsageSpent: number                // Current spend in dollars
  apiUsageResetDate: string            // ISO date string when budget resets
}

// ============ Beta Invites ============

export interface BetaInvite {
  id: string
  email: string
  inviteCode: string
  invitedBy: string
  createdAt: string
  expiresAt: string
  usedAt?: string
  maxUses: number
  currentUses: number
}

// ============ NDA Signatures ============

export interface NDASignature {
  id: string
  userId: string
  version: string
  signedAt: string
  ipAddress?: string
  userAgent?: string
  signatureData: string
}

// ============ Projects ============

export type ProjectStatus = "planning" | "active" | "paused" | "completed" | "archived" | "trashed"
export type ProjectPriority = "low" | "medium" | "high" | "critical"
export type LinearSyncMode = "none" | "imported" | "two_way"

// Project category determines project type and workflow
// Game/creative categories: "game", "vr", "creative", "interactive"
// Non-game categories: "web", "mobile", "desktop", "api", "library", "tool", "standard"
// Ideation categories: "ideas", "research" - for brainstorming and exploration without code
export type ProjectCategory =
  | "game"
  | "vr"
  | "creative"
  | "interactive"
  | "web"
  | "mobile"
  | "desktop"
  | "api"
  | "library"
  | "tool"
  | "standard"
  | "ideas"      // Ideation/brainstorming - generates markdown deliverables, not code
  | "research"   // Research/exploration - generates analysis docs and can spawn coding projects

export interface LinearSyncConfig {
  mode: LinearSyncMode
  projectId?: string
  teamId?: string
  lastSyncAt?: string
  syncErrors?: string[]

  // What to sync
  syncIssues: boolean
  syncComments: boolean
  syncStatus: boolean

  // Import metadata
  importedAt?: string
  importedIssueCount?: number
}

export interface LinkedRepo {
  provider: "gitlab" | "github" | "local"
  id: number
  name: string
  path: string
  url: string
  localPath?: string // Filesystem path for Claude Code execution (e.g., ~/projects/goldeneye)
}

export interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  priority: ProjectPriority
  createdAt: string
  updatedAt: string

  // User ownership - required for multi-user support
  // Projects are scoped to the user who created them
  userId?: string

  // Working directory - always available for Claude Code
  // Created at ~/claudia-projects/{project-slug}/
  workingDirectory?: string

  // Base path for the project's primary codebase location
  // This is the root directory where the main project files are located
  basePath?: string

  // Linked resources
  repos: LinkedRepo[]
  packetIds: string[]
  resourceIds?: string[]

  // Optional Linear sync
  linearSync?: LinearSyncConfig

  // Interview data (from creation) - LEGACY: migrate to interviewIds
  creationInterview?: InterviewSession

  // Multiple interviews support
  interviewIds?: string[]  // IDs of all interviews for this project

  // MCP server configuration
  mcpSettings?: ProjectMCPSettings

  // Metadata
  tags: string[]
  estimatedEffort?: string
  color?: string

  // Project category - explicitly set to control game/creative detection
  // If set to a non-game category (web, mobile, api, etc.), game detection is skipped
  category?: ProjectCategory

  // User preferences
  starred?: boolean

  // Trash metadata - tracks when project was trashed and what status it had before
  trashedAt?: string
  previousStatus?: ProjectStatus

  // Collaboration (future feature)
  collaboratorIds?: string[]
  isPublic?: boolean

  // Business Development
  businessDev?: BusinessDev

  // Model Selection - project-specific default model
  // If set, overrides the global default model for this project
  defaultModelId?: string
  defaultProviderId?: string

  // Source type - how the project was created
  // "fresh" = new project from scratch
  // "imported" = imported from existing repo
  // "auto-mod" = modifying an existing repo
  sourceType?: "fresh" | "imported" | "auto-mod"

  // Source repository info (for imported/auto-mod projects)
  sourceRepo?: {
    url: string                // Original repo URL
    branch: string             // Branch that was cloned
    clonedAt: string           // ISO date when cloned
    originalCommit: string     // Commit hash at time of clone
    provider: "github" | "gitlab" | "bitbucket" | "local"
  }

  // Codebase analysis (for imported/auto-mod projects)
  codebaseAnalysisId?: string  // Reference to stored analysis
  hasCodebaseContext?: boolean // Whether CODEBASE.md has been generated
}

// ============ Codebase Analysis Storage ============

export interface StoredCodebaseAnalysis {
  id: string
  projectId: string
  analyzedAt: string
  projectType: string
  techStack: {
    runtime: string
    framework?: string
    language: string
    packageManager?: string
    database?: string[]
    ui?: string
    styling?: string
    testing?: string[]
    deployment?: string
  }
  totalFiles: number
  totalLines: number
  totalSize: number
  keyFileCount: number
  apiEndpointCount: number
  dependencyCount: number
  languages: { [lang: string]: { files: number; lines: number } }
}

// ============ MCP Settings (Project-scoped) ============

export interface ProjectMCPSettings {
  enabledServers: string[]           // IDs of enabled MCP servers
  autoDetectFromTechStack: boolean   // Auto-suggest based on tags
  customServers?: MCPServerConfig[]  // Project-specific servers
}

// Local re-export of MCPServerConfig to avoid circular imports
export interface MCPServerConfig {
  id: string
  name: string
  description?: string
  command: string
  args?: string[]
  env?: Record<string, string>
  enabled: boolean
  autoStart?: boolean
}

// ============ Interviews ============

export type InterviewType = "project_creation" | "ideation" | "feature_discussion" | "refinement" | "feedback" | "contextual"
export type InterviewStatus = "in_progress" | "completed" | "cancelled"
export type InterviewTargetType = "commit" | "activity" | "packet" | "project" | "approval" | "quality_gate"

export interface InterviewMessage {
  id: string
  role: "assistant" | "user"
  content: string
  timestamp: string

  // For voice
  transcribedFrom?: "voice" | "text"

  // Metadata
  skipped?: boolean
  followUpRequested?: boolean
}

export interface InterviewSession {
  id: string
  type: InterviewType
  status: InterviewStatus

  // Project association (for multi-interview support)
  projectId?: string
  version?: number        // Ordering/versioning within project
  isActive?: boolean      // Can be continued

  // Target context (for contextual interviews)
  targetType?: InterviewTargetType
  targetId?: string
  targetTitle?: string
  targetContext?: Record<string, unknown>

  // Conversation
  messages: InterviewMessage[]

  // Extracted insights (populated on completion)
  summary?: string
  keyPoints?: string[]
  suggestedActions?: string[]
  extractedData?: Record<string, unknown>

  // Timestamps
  createdAt: string
  completedAt?: string
}

// ============ Interview Prompts ============

export interface InterviewPromptConfig {
  type: InterviewType
  targetType?: InterviewTargetType
  systemPrompt: string
  initialQuestion: string
  minQuestions: number
  maxQuestions: number
  extractionPrompt?: string
}

// ============ Helper Types ============

export interface ProjectStats {
  total: number
  byStatus: Record<ProjectStatus, number>
  activeRepos: number
  activePackets: number
}

export interface ProjectFilter {
  status?: ProjectStatus
  priority?: ProjectPriority
  search?: string
  tags?: string[]
}

// ============ Project Resources ============

export type ResourceType = "markdown" | "json" | "csv" | "image" | "audio" | "pdf" | "other"
export type ResourceStorageType = "indexeddb" | "filepath"

export interface ProjectResource {
  id: string
  projectId: string
  name: string
  type: ResourceType
  mimeType: string
  size: number
  createdAt: string
  updatedAt: string

  // Storage location
  storage: ResourceStorageType
  filePath?: string           // For local file references
  indexedDbKey?: string       // For IndexedDB storage

  // Metadata
  description?: string
  tags: string[]

  // For audio resources - transcription data
  transcription?: TranscriptionData
}

// ============ Transcription ============

export type TranscriptionMethod = "whisper-local" | "openai-whisper" | "browser-speech"

export interface TranscriptionSegment {
  start: number   // seconds
  end: number
  text: string
}

export interface TranscriptionData {
  text: string
  method: TranscriptionMethod
  duration: number          // seconds
  wordCount: number
  confidence?: number       // 0-1 for whisper
  transcribedAt: string
  segments?: TranscriptionSegment[]  // For longer recordings
}

// ============ Brain Dumps ============

export type BrainDumpStatus = "recording" | "transcribing" | "processing" | "review" | "completed" | "archived"

export interface BrainDump {
  id: string
  projectId: string
  resourceId: string        // Link to the audio resource
  status: BrainDumpStatus
  createdAt: string
  updatedAt: string

  // Transcription
  transcription?: TranscriptionData

  // Processed content
  processedContent?: ProcessedBrainDump

  // Review state
  reviewNotes?: string
  approvedSections?: string[]
}

export interface ProcessedBrainDump {
  summary: string
  structuredMarkdown: string
  sections: BrainDumpSection[]
  actionItems: ActionItem[]
  ideas: string[]
  decisions: Decision[]
  questions: string[]
  rawInsights: string[]
  processedAt: string
  processedBy: string        // Model that processed it
}

export interface BrainDumpSection {
  id: string
  title: string
  content: string
  type: "overview" | "feature" | "technical" | "requirement" | "idea" | "concern" | "decision"
  approved: boolean
  convertedToIssue?: string  // Issue ID if converted
}

export interface ActionItem {
  id: string
  description: string
  priority: "high" | "medium" | "low"
  category: "task" | "research" | "decision" | "question"
  approved: boolean
  convertedToPacket?: string
}

export interface Decision {
  id: string
  description: string
  rationale: string
  approved: boolean
}

// ============ Security Evaluation ============

export type SecuritySeverity = "critical" | "high" | "medium" | "low" | "info"
export type SecurityCategory =
  | "injection"           // SQL, command, code injection
  | "xss"                 // Cross-site scripting
  | "auth"                // Authentication issues
  | "access-control"      // Authorization/access control
  | "cryptography"        // Weak crypto, key management
  | "data-exposure"       // Sensitive data exposure
  | "configuration"       // Security misconfiguration
  | "dependencies"        // Vulnerable dependencies
  | "input-validation"    // Missing/improper input validation
  | "session"             // Session management issues
  | "logging"             // Insufficient logging/monitoring
  | "api-security"        // API security issues
  | "other"

export type SecurityScanStatus = "pending" | "running" | "completed" | "failed"

export interface SecurityFinding {
  id: string
  category: SecurityCategory
  severity: SecuritySeverity
  title: string
  description: string

  // Location
  filePath?: string
  lineStart?: number
  lineEnd?: number
  codeSnippet?: string

  // Reference
  cweId?: string           // Common Weakness Enumeration ID
  owaspCategory?: string   // OWASP Top 10 category
  cvssScore?: number       // 0-10 score

  // Remediation
  recommendation: string
  fixExample?: string
  resources?: string[]     // Links to docs, articles

  // Estimated fix effort
  estimatedEffort?: "trivial" | "small" | "medium" | "large"
  breakingChange?: boolean

  // Status
  acknowledged?: boolean
  falsePositive?: boolean
  fixedInCommit?: string
}

export interface SecurityScan {
  id: string
  projectId: string
  status: SecurityScanStatus
  startedAt: string
  completedAt?: string

  // What was scanned
  scanScope: {
    repos?: string[]       // Repo IDs
    paths?: string[]       // Specific paths
    excludePaths?: string[]
  }

  // Results
  findings: SecurityFinding[]
  summary?: {
    critical: number
    high: number
    medium: number
    low: number
    info: number
    totalFiles: number
    scanDuration: number   // seconds
  }

  // Generation metadata
  generatedBy: string      // Model/tool that ran the scan
  generatedWorkPackets?: string[]  // Packet IDs created from findings

  // Error handling
  error?: string
  warnings?: string[]
}

// ============ Stored Build Plans ============

export type StoredBuildPlanStatus = "draft" | "approved" | "locked"

export interface PacketFeedback {
  packetId: string
  approved: boolean | null  // null = no vote, true = thumbs up, false = thumbs down
  priority: "low" | "medium" | "high" | "critical"
  comment: string
}

export interface EditedObjective {
  id: string
  text: string
  isOriginal: boolean      // Was this in the original plan?
  isDeleted: boolean       // Soft delete
}

export interface EditedNonGoal {
  id: string
  text: string
  isOriginal: boolean
  isDeleted: boolean
}

export interface SectionComment {
  sectionId: string        // "tech-stack", "assumptions", "risks", etc.
  comment: string
  createdAt: string
}

export interface StoredBuildPlan {
  id: string
  projectId: string
  status: StoredBuildPlanStatus
  createdAt: string
  updatedAt: string

  // The original generated plan
  originalPlan: {
    spec: {
      name: string
      description: string
      objectives: string[]
      nonGoals: string[]
      assumptions: string[]
      risks: string[]
      techStack: string[]
    }
    phases: Array<{
      id: string
      name: string
      description: string
      order: number
    }>
    packets: Array<{
      id: string
      phaseId: string
      title: string
      description: string
      type: string
      priority: string
      tasks: Array<{ id: string; description: string; completed: boolean; order: number }>
      acceptanceCriteria: string[]
    }>
  }

  // User edits and feedback
  editedObjectives: EditedObjective[]
  editedNonGoals: EditedNonGoal[]
  packetFeedback: PacketFeedback[]
  sectionComments: SectionComment[]

  // Generation metadata
  generatedBy: {
    server: string
    model: string
  }

  // Revision history
  revisionNumber: number
  previousVersionId?: string  // Link to previous version if revised
  revisionNotes?: string      // Why this was revised

  // Approval
  approvedAt?: string
  approvedBy?: string         // User who approved
  lockedAt?: string           // When project started
}

// ============ Packet Execution ============

export type PacketRunStatus = "running" | "completed" | "failed" | "cancelled"
export type PacketRunRating = "thumbs_up" | "thumbs_down" | null

// Packet execution run record
export interface PacketRun {
  id: string
  packetId: string
  projectId: string
  startedAt: string
  completedAt?: string
  status: PacketRunStatus
  output: string
  exitCode?: number
  // Refinement/feedback
  rating?: PacketRunRating
  comment?: string
  iteration: number  // 1, 2, 3... for each run of the same packet
}

// Extended WorkPacket with run history
export interface WorkPacketWithHistory {
  id: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  tasks: Array<{ id: string; description: string; completed: boolean }>
  acceptanceCriteria: string[]
  runs: PacketRun[]
  currentRunId?: string
}

// ============ Run History (Execution Audit Trail) ============

export type RunHistoryStatus = "running" | "complete" | "error" | "cancelled"

export interface RunHistoryEntry {
  id: string                    // Same as ExecutionSession.id
  projectId: string
  projectName?: string
  userId: string
  startedAt: string
  completedAt?: string
  status: RunHistoryStatus

  // Summary (for list view)
  packetCount: number
  successCount: number
  failedCount: number
  duration?: number             // In milliseconds

  // Details (loaded on demand)
  events?: RunHistoryEvent[]
  packetIds?: string[]
  packetTitles?: string[]
  qualityGates?: QualityGateResults
  mode?: string
  providerId?: string
  modelId?: string
  output?: string
}

export interface RunHistoryEvent {
  id: string
  type: "info" | "success" | "error" | "warning" | "progress"
  message: string
  timestamp: string
  detail?: string
}

export interface QualityGateResults {
  passed: boolean
  tests: {
    success: boolean
    output: string
    errorCount?: number
  }
  typeCheck: {
    success: boolean
    output: string
    errorCount?: number
  }
  build: {
    success: boolean
    output: string
  }
}

// ============ Business Development ============

export type BusinessDevStatus = "draft" | "review" | "approved" | "archived"

export type BusinessDevSectionType =
  | "executiveSummary"
  | "features"
  | "marketAnalysis"
  | "monetization"
  | "proForma"
  | "goToMarket"
  | "risks"

export interface BusinessDevExecutiveSummary {
  overview: string
  problem: string
  solution: string
  targetMarket: string
  uniqueValue: string
}

export interface BusinessDevFeature {
  id: string
  name: string
  description: string
  userBenefit: string
  priority: "must-have" | "should-have" | "nice-to-have"
}

export interface BusinessDevMarketAnalysis {
  marketSize: string
  targetAudience: string
  competitors: Array<{
    name: string
    description: string
    strengths: string[]
    weaknesses: string[]
  }>
  differentiators: string[]
  marketTrends: string[]
}

export interface BusinessDevMonetization {
  model: string  // freemium, subscription, one-time, ads, etc.
  pricing: string
  pricingTiers?: Array<{
    name: string
    price: string
    features: string[]
  }>
  revenueStreams: string[]
}

export interface BusinessDevProForma {
  yearOneRevenue: string
  yearTwoRevenue: string
  yearThreeRevenue: string
  expenses: Array<{
    category: string
    amount: string
    frequency: "one-time" | "monthly" | "annually"
  }>
  profitMargin: string
  breakEvenPoint: string
  assumptions: string[]
}

export interface BusinessDevGoToMarket {
  launchStrategy: string
  marketingChannels: string[]
  partnerships: string[]
  milestones: Array<{
    name: string
    date: string
    description: string
  }>
}

export interface BusinessDevRisks {
  risks: Array<{
    id: string
    category: "market" | "technical" | "financial" | "operational" | "regulatory"
    description: string
    likelihood: "low" | "medium" | "high"
    impact: "low" | "medium" | "high"
    mitigation: string
  }>
}

export interface BusinessDev {
  id: string
  projectId: string
  status: BusinessDevStatus

  // Core sections
  executiveSummary: BusinessDevExecutiveSummary
  features: BusinessDevFeature[]
  marketAnalysis: BusinessDevMarketAnalysis
  monetization: BusinessDevMonetization
  proForma: BusinessDevProForma
  goToMarket?: BusinessDevGoToMarket
  risks?: BusinessDevRisks

  // Generation metadata
  generatedBy: {
    server: string
    model: string
  }
  generatedFromBuildPlanId?: string

  // Timestamps
  createdAt: string
  updatedAt: string
  approvedAt?: string
  approvedBy?: string
}

// ============ Patent Search & Generation ============

export type PatentSearchStatus = "pending" | "searching" | "completed" | "failed"
export type PatentSectionType =
  | "abstract"
  | "background"
  | "summary"
  | "detailedDescription"
  | "claims"

export interface PriorArt {
  id: string
  title: string
  patentNumber?: string
  publicationDate?: string
  inventors?: string[]
  assignee?: string
  abstract: string
  claims?: string[]
  url?: string
  source: "USPTO" | "Google Patents" | "EPO" | "WIPO" | "Other"

  // Similarity analysis
  similarityScore: number  // 0-100
  overlapAreas: string[]
  differentiators: string[]
  riskLevel: "low" | "medium" | "high"
}

export interface PatentSearch {
  id: string
  inventionTitle: string
  inventionDescription: string
  technicalField: string
  keywords: string[]
  searchedAt: string
  status: PatentSearchStatus

  // Results
  priorArt: PriorArt[]
  overallPatentabilityScore: number  // 0-100
  patentabilityAssessment: string
  recommendations: string[]

  // Generation metadata
  generatedBy: {
    server: string
    model: string
  }

  error?: string
}

export interface PatentSection {
  type: PatentSectionType
  title: string
  content: string
  isEdited: boolean
  lastEditedAt?: string
  suggestions?: string[]
  warnings?: string[]
}

export type PatentSubmissionStatus = "draft" | "in_progress" | "review" | "completed"

export interface PatentClaim {
  id: string
  number: number
  type: "independent" | "dependent"
  dependsOn?: number  // For dependent claims
  content: string
  isEdited: boolean
}

export interface PatentSubmission {
  id: string
  projectId?: string
  status: PatentSubmissionStatus

  // Invention details
  inventionTitle: string
  inventionDescription: string
  technicalField: string
  inventors: Array<{
    name: string
    address: string
    citizenship: string
  }>
  applicant?: {
    name: string
    address: string
    type: "individual" | "organization"
  }

  // Generated sections
  sections: {
    abstract?: PatentSection
    background?: PatentSection
    summary?: PatentSection
    detailedDescription?: PatentSection
  }
  claims: PatentClaim[]

  // Figures/drawings reference
  figures?: Array<{
    number: number
    title: string
    description: string
  }>

  // Prior art reference
  priorArtSearchId?: string
  citedReferences?: Array<{
    type: "patent" | "non-patent"
    citation: string
    relevance: string
  }>

  // Review checklist
  reviewChecklist: {
    abstractComplete: boolean
    backgroundComplete: boolean
    summaryComplete: boolean
    detailedDescriptionComplete: boolean
    claimsComplete: boolean
    figuresDescribed: boolean
    priorArtCited: boolean
    inventorInfoComplete: boolean
  }

  // Generation metadata
  generatedBy: {
    server: string
    model: string
  }

  // Timestamps
  createdAt: string
  updatedAt: string
  completedAt?: string
}

// ============ Patent Research ============

export type PatentResearchStatus = "research" | "drafting" | "review" | "filed" | "approved" | "rejected"

export interface PatentPriorArt {
  id: string
  title: string
  patentNumber?: string
  applicationNumber?: string
  inventor?: string
  assignee?: string
  filingDate?: string
  publicationDate?: string
  abstract?: string
  url?: string
  relevance: "low" | "medium" | "high"
  notes: string
  addedAt: string
}

export interface PatentResearchClaim {
  id: string
  number: number
  type: "independent" | "dependent"
  dependsOn?: number // For dependent claims, references the independent claim number
  text: string
  status: "draft" | "reviewed" | "approved"
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface PatentAttorney {
  id: string
  name: string
  firm?: string
  email?: string
  phone?: string
  specializations: string[]
  notes?: string
  rating?: number // 1-5 stars
  contacted: boolean
  contactedAt?: string
}

export interface PatentResearch {
  id: string
  title: string
  status: PatentResearchStatus
  createdAt: string
  updatedAt: string

  // Links to other entities
  projectId?: string
  businessIdeaId?: string

  // Invention Description
  inventionDescription: {
    summary: string
    background?: string
    technicalField?: string
    problemSolved?: string
    solutionDescription?: string
    advantages?: string[]
    embodiments?: string[]
    drawings?: Array<{
      id: string
      name: string
      description: string
      filePath?: string
    }>
  }

  // Prior Art Search
  priorArt: PatentPriorArt[]
  priorArtSearchNotes?: string
  priorArtSearchCompletedAt?: string

  // Patentability Analysis
  patentabilityAnalysis?: {
    noveltyAssessment: string
    nonObviousnessAssessment: string
    utilityAssessment: string
    patentableSubjectMatter: string
    overallAssessment: "strong" | "moderate" | "weak" | "not-patentable" | "undetermined"
    recommendations: string[]
    analyzedAt: string
  }

  // Claims Draft
  claims: PatentResearchClaim[]
  claimsDraftNotes?: string

  // Filing Information
  filing?: {
    type: "provisional" | "non-provisional" | "pct" | "continuation" | "divisional"
    jurisdiction: string // US, EU, PCT, etc.
    applicationNumber?: string
    filingDate?: string
    priorityDate?: string
    assignee?: string
    inventors: Array<{
      name: string
      address?: string
      citizenship?: string
    }>
    status: "preparing" | "filed" | "pending" | "granted" | "abandoned" | "rejected"
    notes?: string
  }

  // Attorney Referrals
  attorneys: PatentAttorney[]
  selectedAttorneyId?: string

  // Metadata
  tags: string[]
  notes?: string
  estimatedCost?: string
  targetFilingDate?: string
}

// ============ Voice Recordings ============

export interface VoiceRecording {
  id: string
  userId: string

  // Audio data
  audioUrl: string           // Relative path to audio file in storage
  audioDuration: number      // Duration in seconds
  audioMimeType: string      // e.g., "audio/webm"
  audioSize: number          // File size in bytes

  // Transcription
  transcription: string
  transcriptionMethod: "whisper-local" | "browser-speech"
  transcriptionConfidence?: number  // 0-1 for whisper

  // User-editable metadata
  title: string
  tags: string[]

  // Linked entities - recordings can be linked to multiple entities
  linkedProjectId?: string
  linkedBusinessIdeaId?: string
  linkedPatentId?: string

  // Tracking
  createdAt: string
  updatedAt: string

  // Source context - where was this recording made?
  sourceContext?: "voice-page" | "project-creation" | "business-idea" | "brain-dump"

  // If a project was created from this recording
  createdProjectId?: string
}

// ============ Prior Art Research (Has This Been Done Before?) ============

export type PriorArtRecommendation = "pursue" | "pivot" | "abandon" | "undetermined"
export type PriorArtResearchStatus = "pending" | "researching" | "completed" | "failed"

export interface CompetitorAnalysis {
  id: string
  name: string
  url?: string
  description: string
  category: "direct" | "indirect" | "potential"

  // Features comparison
  features: string[]
  missingFeatures?: string[]  // Features our project has that they don't

  // Business model
  pricing?: string
  pricingModel?: "free" | "freemium" | "subscription" | "one-time" | "usage-based" | "enterprise"

  // Market position
  estimatedUsers?: string     // e.g., "10K-50K", "1M+"
  targetAudience?: string
  launchDate?: string
  fundingStatus?: string      // e.g., "Bootstrapped", "Series A", "Public"

  // Strengths and weaknesses
  strengths: string[]
  weaknesses: string[]

  // Our advantage over them
  ourAdvantage?: string
}

export interface MarketGapAnalysis {
  gaps: Array<{
    id: string
    description: string
    opportunity: "high" | "medium" | "low"
    addressedByOurProject: boolean
  }>
  underservedSegments: string[]
  emergingTrends: string[]
}

export interface PriorArtResearch {
  id: string
  projectId: string
  status: PriorArtResearchStatus

  // Research query context
  projectName: string
  projectDescription: string
  searchQueries: string[]     // Queries used to find prior art

  // Findings
  competitors: CompetitorAnalysis[]
  totalCompetitorsFound: number

  // Market analysis
  marketGapAnalysis?: MarketGapAnalysis
  marketSaturation: "low" | "medium" | "high" | "oversaturated"

  // Comparison summary
  comparisonTable?: {
    features: string[]        // Feature names as columns
    rows: Array<{
      name: string            // Competitor or "Your Project"
      values: Record<string, boolean | string>  // feature -> has/value
    }>
  }

  // Assessment
  recommendation: PriorArtRecommendation
  confidenceLevel: "low" | "medium" | "high"

  // Reasoning
  whyPursue: string[]         // Reasons to pursue
  whyNotPursue: string[]      // Reasons not to pursue
  whatWouldChange: string[]   // Conditions that would change the assessment

  // Key insights
  keyInsights: string[]
  differentiators: string[]   // What makes our project unique
  risks: string[]             // Competitive risks
  opportunities: string[]     // Market opportunities

  // Generation metadata
  generatedBy: {
    server: string
    model: string
  }
  researchedAt: string
  updatedAt: string

  // Source tracking
  sources: Array<{
    title: string
    url: string
    snippet?: string
  }>
}
