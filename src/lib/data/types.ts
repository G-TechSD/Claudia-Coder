/**
 * Claudia Data Types
 * Core types for projects, interviews, and related entities
 */

// ============ Projects ============

export type ProjectStatus = "planning" | "active" | "paused" | "completed" | "archived"
export type ProjectPriority = "low" | "medium" | "high" | "critical"
export type LinearSyncMode = "none" | "imported" | "two_way"

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
  provider: "gitlab" | "github"
  id: number
  name: string
  path: string
  url: string
}

export interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  priority: ProjectPriority
  createdAt: string
  updatedAt: string

  // Linked resources
  repos: LinkedRepo[]
  packetIds: string[]
  resourceIds?: string[]

  // Optional Linear sync
  linearSync?: LinearSyncConfig

  // Interview data (from creation)
  creationInterview?: InterviewSession

  // Metadata
  tags: string[]
  estimatedEffort?: string
  color?: string
}

// ============ Interviews ============

export type InterviewType = "project_creation" | "contextual"
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

export type TranscriptionMethod = "whisper-local" | "browser-speech"

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
