/**
 * Voice Recordings Data Store
 * Persistent storage for voice recordings with transcriptions
 *
 * Key principle: Users are tired of losing ideas. NOTHING GETS LOST unless user deletes.
 * Every voice recording is preserved with its full transcription and can be linked to projects.
 */

import "server-only"

import { promises as fs } from "fs"
import path from "path"

// ============ Types ============

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

export interface VoiceRecordingSearchResult {
  recording: VoiceRecording
  matchType: "title" | "transcription" | "tag"
  matchSnippet?: string
}

// ============ Storage Configuration ============

const STORAGE_BASE = ".local-storage/voice-recordings"

// Client-side localStorage key for metadata index
const RECORDINGS_INDEX_KEY = "claudia_voice_recordings_index"

// ============ UUID Generator ============

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ============ Client-Side Index Operations ============

function getRecordingsIndex(): VoiceRecording[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(RECORDINGS_INDEX_KEY)
  return stored ? JSON.parse(stored) : []
}

function saveRecordingsIndex(recordings: VoiceRecording[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(RECORDINGS_INDEX_KEY, JSON.stringify(recordings))
}

// ============ Server-Side File Operations ============

/**
 * Get the storage directory path for a user
 */
export function getUserStoragePath(userId: string): string {
  // Use project root for storage
  const projectRoot = process.cwd()
  return path.join(projectRoot, STORAGE_BASE, userId)
}

/**
 * Ensure the storage directory exists for a user (server-side only)
 */
export async function ensureUserStorageDirectory(userId: string): Promise<string> {
  const storagePath = getUserStoragePath(userId)
  await fs.mkdir(storagePath, { recursive: true })
  return storagePath
}

/**
 * Save an audio blob to storage (server-side only)
 * Returns the relative path to the saved file
 */
export async function saveAudioFile(
  userId: string,
  audioBuffer: Buffer,
  recordingId: string,
  mimeType: string
): Promise<string> {
  const storagePath = await ensureUserStorageDirectory(userId)

  // Determine file extension from mime type
  const extension = mimeType.includes("webm") ? "webm"
    : mimeType.includes("ogg") ? "ogg"
    : mimeType.includes("mp4") ? "mp4"
    : mimeType.includes("wav") ? "wav"
    : "webm"

  const fileName = `${recordingId}.${extension}`
  const filePath = path.join(storagePath, fileName)

  await fs.writeFile(filePath, audioBuffer)

  // Return relative path from project root
  return `${STORAGE_BASE}/${userId}/${fileName}`
}

/**
 * Delete an audio file from storage (server-side only)
 */
export async function deleteAudioFile(audioUrl: string): Promise<boolean> {
  try {
    const projectRoot = process.cwd()
    const filePath = path.join(projectRoot, audioUrl)
    await fs.unlink(filePath)
    return true
  } catch (err) {
    console.error("Failed to delete audio file:", err)
    return false
  }
}

/**
 * Get audio file as buffer (server-side only)
 */
export async function getAudioFile(audioUrl: string): Promise<Buffer | null> {
  try {
    const projectRoot = process.cwd()
    const filePath = path.join(projectRoot, audioUrl)
    return await fs.readFile(filePath)
  } catch (err) {
    console.error("Failed to read audio file:", err)
    return null
  }
}

// ============ CRUD Operations (Client-Side) ============

/**
 * Get all recordings for a user
 */
export function getRecordings(userId: string, options?: {
  includeArchived?: boolean
  sortBy?: "createdAt" | "updatedAt" | "title"
  sortOrder?: "asc" | "desc"
}): VoiceRecording[] {
  const allRecordings = getRecordingsIndex()
  const recordings = allRecordings.filter(r => r.userId === userId)

  // Sort
  const sortBy = options?.sortBy || "createdAt"
  const sortOrder = options?.sortOrder || "desc"

  recordings.sort((a, b) => {
    let comparison = 0
    if (sortBy === "title") {
      comparison = a.title.localeCompare(b.title)
    } else {
      comparison = new Date(a[sortBy]).getTime() - new Date(b[sortBy]).getTime()
    }
    return sortOrder === "desc" ? -comparison : comparison
  })

  return recordings
}

/**
 * Get a single recording by ID
 */
export function getRecording(recordingId: string): VoiceRecording | null {
  const recordings = getRecordingsIndex()
  return recordings.find(r => r.id === recordingId) || null
}

/**
 * Get recordings linked to a specific project
 */
export function getRecordingsForProject(projectId: string): VoiceRecording[] {
  const recordings = getRecordingsIndex()
  return recordings.filter(r => r.linkedProjectId === projectId || r.createdProjectId === projectId)
}

/**
 * Get recordings linked to a specific business idea
 */
export function getRecordingsForBusinessIdea(businessIdeaId: string): VoiceRecording[] {
  const recordings = getRecordingsIndex()
  return recordings.filter(r => r.linkedBusinessIdeaId === businessIdeaId)
}

/**
 * Create a new recording entry (metadata only - audio saved separately via API)
 */
export function createRecording(data: {
  userId: string
  audioUrl: string
  audioDuration: number
  audioMimeType: string
  audioSize: number
  transcription: string
  transcriptionMethod: "whisper-local" | "browser-speech"
  transcriptionConfidence?: number
  title?: string
  tags?: string[]
  sourceContext?: VoiceRecording["sourceContext"]
  linkedProjectId?: string
  linkedBusinessIdeaId?: string
}): VoiceRecording {
  const recordings = getRecordingsIndex()
  const now = new Date().toISOString()

  // Auto-generate title from transcription if not provided
  const autoTitle = data.title || generateTitleFromTranscription(data.transcription)

  const recording: VoiceRecording = {
    id: generateUUID(),
    userId: data.userId,
    audioUrl: data.audioUrl,
    audioDuration: data.audioDuration,
    audioMimeType: data.audioMimeType,
    audioSize: data.audioSize,
    transcription: data.transcription,
    transcriptionMethod: data.transcriptionMethod,
    transcriptionConfidence: data.transcriptionConfidence,
    title: autoTitle,
    tags: data.tags || [],
    sourceContext: data.sourceContext,
    linkedProjectId: data.linkedProjectId,
    linkedBusinessIdeaId: data.linkedBusinessIdeaId,
    createdAt: now,
    updatedAt: now
  }

  recordings.push(recording)
  saveRecordingsIndex(recordings)

  return recording
}

/**
 * Update a recording's metadata
 */
export function updateRecording(
  recordingId: string,
  updates: Partial<Pick<VoiceRecording,
    "title" | "tags" | "linkedProjectId" | "linkedBusinessIdeaId" | "linkedPatentId" | "createdProjectId"
  >>
): VoiceRecording | null {
  const recordings = getRecordingsIndex()
  const index = recordings.findIndex(r => r.id === recordingId)

  if (index === -1) return null

  recordings[index] = {
    ...recordings[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  saveRecordingsIndex(recordings)
  return recordings[index]
}

/**
 * Delete a recording (removes from index - API should handle file deletion)
 */
export function deleteRecording(recordingId: string): { deleted: boolean; audioUrl?: string } {
  const recordings = getRecordingsIndex()
  const recording = recordings.find(r => r.id === recordingId)

  if (!recording) return { deleted: false }

  const filtered = recordings.filter(r => r.id !== recordingId)
  saveRecordingsIndex(filtered)

  return { deleted: true, audioUrl: recording.audioUrl }
}

/**
 * Link a recording to a project
 */
export function linkToProject(recordingId: string, projectId: string): VoiceRecording | null {
  return updateRecording(recordingId, { linkedProjectId: projectId })
}

/**
 * Unlink a recording from its project
 */
export function unlinkFromProject(recordingId: string): VoiceRecording | null {
  return updateRecording(recordingId, { linkedProjectId: undefined })
}

/**
 * Mark that a project was created from this recording
 */
export function markProjectCreated(recordingId: string, projectId: string): VoiceRecording | null {
  return updateRecording(recordingId, {
    createdProjectId: projectId,
    linkedProjectId: projectId  // Also link it
  })
}

/**
 * Link a recording to a business idea
 */
export function linkToBusinessIdea(recordingId: string, businessIdeaId: string): VoiceRecording | null {
  return updateRecording(recordingId, { linkedBusinessIdeaId: businessIdeaId })
}

// ============ Search Operations ============

/**
 * Search recordings by text query
 * Searches title, transcription, and tags
 */
export function searchRecordings(
  userId: string,
  query: string
): VoiceRecordingSearchResult[] {
  const recordings = getRecordings(userId)
  const lowerQuery = query.toLowerCase()
  const results: VoiceRecordingSearchResult[] = []

  for (const recording of recordings) {
    // Check title
    if (recording.title.toLowerCase().includes(lowerQuery)) {
      results.push({
        recording,
        matchType: "title"
      })
      continue
    }

    // Check tags
    if (recording.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
      results.push({
        recording,
        matchType: "tag"
      })
      continue
    }

    // Check transcription
    const transcriptionLower = recording.transcription.toLowerCase()
    const matchIndex = transcriptionLower.indexOf(lowerQuery)
    if (matchIndex !== -1) {
      // Extract a snippet around the match
      const start = Math.max(0, matchIndex - 50)
      const end = Math.min(recording.transcription.length, matchIndex + query.length + 50)
      let snippet = recording.transcription.slice(start, end)
      if (start > 0) snippet = "..." + snippet
      if (end < recording.transcription.length) snippet = snippet + "..."

      results.push({
        recording,
        matchType: "transcription",
        matchSnippet: snippet
      })
    }
  }

  return results
}

/**
 * Get recordings by tag
 */
export function getRecordingsByTag(userId: string, tag: string): VoiceRecording[] {
  const recordings = getRecordings(userId)
  return recordings.filter(r => r.tags.includes(tag))
}

/**
 * Get all unique tags used by a user
 */
export function getAllTags(userId: string): string[] {
  const recordings = getRecordings(userId)
  const tagSet = new Set<string>()

  for (const recording of recordings) {
    for (const tag of recording.tags) {
      tagSet.add(tag)
    }
  }

  return Array.from(tagSet).sort()
}

// ============ Statistics ============

export interface VoiceRecordingStats {
  totalRecordings: number
  totalDuration: number        // Total seconds
  linkedToProjects: number
  linkedToBusinessIdeas: number
  createdProjects: number
  byMonth: Record<string, number>  // "2024-01": 5
}

/**
 * Get statistics for a user's recordings
 */
export function getRecordingStats(userId: string): VoiceRecordingStats {
  const recordings = getRecordings(userId)

  const byMonth: Record<string, number> = {}
  let totalDuration = 0
  let linkedToProjects = 0
  let linkedToBusinessIdeas = 0
  let createdProjects = 0

  for (const recording of recordings) {
    totalDuration += recording.audioDuration

    if (recording.linkedProjectId) linkedToProjects++
    if (recording.linkedBusinessIdeaId) linkedToBusinessIdeas++
    if (recording.createdProjectId) createdProjects++

    const monthKey = recording.createdAt.slice(0, 7) // "2024-01"
    byMonth[monthKey] = (byMonth[monthKey] || 0) + 1
  }

  return {
    totalRecordings: recordings.length,
    totalDuration,
    linkedToProjects,
    linkedToBusinessIdeas,
    createdProjects,
    byMonth
  }
}

// ============ Helpers ============

/**
 * Generate a title from transcription text
 */
function generateTitleFromTranscription(transcription: string): string {
  // Clean up and take first meaningful words
  const cleaned = transcription
    .replace(/^(um|uh|so|like|okay|well)\s+/gi, "")
    .trim()

  // Take first sentence or first ~50 chars
  const firstSentence = cleaned.split(/[.!?]/)[0]

  if (firstSentence.length <= 60) {
    return firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1)
  }

  // Truncate at word boundary
  const truncated = firstSentence.slice(0, 60).replace(/\s+\S*$/, "")
  return truncated.charAt(0).toUpperCase() + truncated.slice(1) + "..."
}

/**
 * Format duration as mm:ss
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

/**
 * Format file size as human readable
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
