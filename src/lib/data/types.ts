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
