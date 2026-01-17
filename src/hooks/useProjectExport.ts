"use client"

/**
 * Project Export Hook
 *
 * Gathers all project data from localStorage and IndexedDB
 * and provides an export function to download as ZIP.
 */

import { useState, useCallback } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { getProject, getInterviewsForTarget } from "@/lib/data/projects"
import { getBuildPlanForProject, getBuildPlanHistory } from "@/lib/data/build-plans"
import { getProjectRuns } from "@/lib/data/packet-runs"
import {
  getResourcesForProject,
  getResourceBlob,
  getBrainDumpsForProject,
} from "@/lib/data/resources"
import { getBusinessDev, getBusinessDevHistory } from "@/lib/data/business-dev"
import type {
  Project,
  StoredBuildPlan,
  PacketRun,
  ProjectResource,
  BrainDump,
  BusinessDev,
  InterviewSession,
} from "@/lib/data/types"

// ============ Types ============

export interface ExportOptions {
  /** Include source code from working directory (requires server-side fetch) */
  includeSourceCode?: boolean
  /** Include resource file blobs (base64 encoded) */
  includeResourceBlobs?: boolean
  /** Include execution history (packet runs) */
  includeExecutionHistory?: boolean
  /** Include build plan revision history */
  includeBuildPlanHistory?: boolean
  /** Include business development documents */
  includeBusinessDev?: boolean
}

export interface ExportProgress {
  step: string
  percent: number
}

export interface ExportedProjectData {
  exportVersion: string
  exportedAt: string
  exportedBy: string | null

  // Core project data
  project: Project

  // Build plan data
  buildPlan: StoredBuildPlan | null
  buildPlanHistory?: StoredBuildPlan[]

  // Execution data
  packetRuns?: PacketRun[]

  // Resources
  resources: ProjectResource[]
  resourceBlobs?: Record<string, string> // indexedDbKey -> base64 data

  // Brain dumps
  brainDumps: BrainDump[]

  // Business development
  businessDev?: BusinessDev | null
  businessDevHistory?: BusinessDev[]

  // Voice recordings (from localStorage index)
  voiceRecordings?: VoiceRecordingExport[]

  // Interview data
  interviews?: InterviewSession[]
}

export interface VoiceRecordingExport {
  id: string
  title: string
  transcription: string
  audioDuration: number
  audioMimeType: string
  audioSize: number
  linkedProjectId?: string
  createdAt: string
  updatedAt: string
  tags: string[]
  sourceContext?: string
}

export interface UseProjectExportReturn {
  exportProject: (projectId: string, options?: ExportOptions) => Promise<void>
  isExporting: boolean
  error: string | null
  progress: ExportProgress | null
}

// ============ Helper Functions ============

/**
 * Convert a Blob to base64 string
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(",")[1] || result
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Get voice recordings for a project from localStorage
 * Voice recordings module uses server-only imports, so we read the index directly
 */
function getVoiceRecordingsForProject(projectId: string): VoiceRecordingExport[] {
  if (typeof window === "undefined") return []

  try {
    const stored = localStorage.getItem("claudia_voice_recordings_index")
    if (!stored) return []

    const recordings = JSON.parse(stored) as Array<{
      id: string
      title: string
      transcription: string
      audioDuration: number
      audioMimeType: string
      audioSize: number
      linkedProjectId?: string
      createdProjectId?: string
      createdAt: string
      updatedAt: string
      tags: string[]
      sourceContext?: string
    }>

    // Filter recordings linked to this project
    return recordings
      .filter(r => r.linkedProjectId === projectId || r.createdProjectId === projectId)
      .map(r => ({
        id: r.id,
        title: r.title,
        transcription: r.transcription,
        audioDuration: r.audioDuration,
        audioMimeType: r.audioMimeType,
        audioSize: r.audioSize,
        linkedProjectId: r.linkedProjectId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        tags: r.tags,
        sourceContext: r.sourceContext,
      }))
  } catch (error) {
    console.error("Failed to get voice recordings:", error)
    return []
  }
}

/**
 * Download data as a file
 */
function downloadFile(data: Blob | string, filename: string, mimeType: string): void {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

// ============ Hook ============

export function useProjectExport(): UseProjectExportReturn {
  const { user } = useAuth()
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<ExportProgress | null>(null)

  const exportProject = useCallback(async (
    projectId: string,
    options: ExportOptions = {}
  ): Promise<void> => {
    const {
      includeSourceCode = false,
      includeResourceBlobs = true,
      includeExecutionHistory = true,
      includeBuildPlanHistory = false,
      includeBusinessDev = true,
    } = options

    setIsExporting(true)
    setError(null)
    setProgress({ step: "Initializing export...", percent: 0 })

    try {
      const userId = user?.id

      // Step 1: Get project data
      setProgress({ step: "Loading project data...", percent: 5 })
      const project = getProject(projectId, userId)

      if (!project) {
        throw new Error("Project not found or you don't have access to it")
      }

      // Step 2: Get build plan
      setProgress({ step: "Loading build plan...", percent: 15 })
      const buildPlan = getBuildPlanForProject(projectId, userId)
      let buildPlanHistory: StoredBuildPlan[] | undefined

      if (includeBuildPlanHistory) {
        buildPlanHistory = getBuildPlanHistory(projectId, userId)
      }

      // Step 3: Get packet runs
      setProgress({ step: "Loading execution history...", percent: 25 })
      let packetRuns: PacketRun[] | undefined

      if (includeExecutionHistory) {
        // Get runs for all packets in the project
        packetRuns = []
        const packetIds = project.packetIds || []
        for (const packetId of packetIds) {
          const runs = getProjectRuns(projectId, userId)
          packetRuns.push(...runs)
          break // getProjectRuns already gets all runs for the project
        }

        // If no packet IDs, try getting runs directly by project ID
        if (packetRuns.length === 0) {
          packetRuns = getProjectRuns(projectId, userId)
        }
      }

      // Step 4: Get resources
      setProgress({ step: "Loading resources...", percent: 35 })
      const resources = getResourcesForProject(projectId, userId)

      // Step 5: Get resource blobs
      const resourceBlobs: Record<string, string> = {}

      if (includeResourceBlobs && resources.length > 0) {
        const totalResources = resources.filter(r => r.storage === "indexeddb" && r.indexedDbKey).length
        let processedResources = 0

        for (const resource of resources) {
          if (resource.storage === "indexeddb" && resource.indexedDbKey) {
            setProgress({
              step: `Loading resource: ${resource.name}...`,
              percent: 35 + Math.floor((processedResources / totalResources) * 20),
            })

            try {
              const blob = await getResourceBlob(resource.indexedDbKey, userId)
              if (blob) {
                resourceBlobs[resource.indexedDbKey] = await blobToBase64(blob)
              }
            } catch (err) {
              console.warn(`Failed to load resource blob for ${resource.name}:`, err)
            }

            processedResources++
          }
        }
      }

      // Step 6: Get brain dumps
      setProgress({ step: "Loading brain dumps...", percent: 60 })
      const brainDumps = getBrainDumpsForProject(projectId, userId)

      // Step 7: Get business dev
      setProgress({ step: "Loading business development data...", percent: 70 })
      let businessDev: BusinessDev | null | undefined
      let businessDevHistory: BusinessDev[] | undefined

      if (includeBusinessDev) {
        businessDev = getBusinessDev(projectId, userId)
        businessDevHistory = getBusinessDevHistory(projectId, userId)
      }

      // Step 8: Get voice recordings
      setProgress({ step: "Loading voice recordings...", percent: 70 })
      const voiceRecordings = getVoiceRecordingsForProject(projectId)

      // Step 9: Get interview data
      setProgress({ step: "Loading interview data...", percent: 75 })
      let interviews: InterviewSession[] = []
      try {
        // Get interviews associated with this project
        interviews = getInterviewsForTarget("project", projectId, userId)
      } catch (err) {
        console.warn("Failed to get interviews:", err)
      }

      // Step 10: Compile export data
      setProgress({ step: "Compiling export data...", percent: 80 })

      const exportData: ExportedProjectData = {
        exportVersion: "2.0.0",
        exportedAt: new Date().toISOString(),
        exportedBy: user?.email || user?.id || null,
        project,
        buildPlan,
        buildPlanHistory: includeBuildPlanHistory ? buildPlanHistory : undefined,
        packetRuns: includeExecutionHistory ? packetRuns : undefined,
        resources,
        resourceBlobs: includeResourceBlobs && Object.keys(resourceBlobs).length > 0
          ? resourceBlobs
          : undefined,
        brainDumps,
        businessDev: includeBusinessDev ? businessDev : undefined,
        businessDevHistory: includeBusinessDev && businessDevHistory && businessDevHistory.length > 0
          ? businessDevHistory
          : undefined,
        voiceRecordings: voiceRecordings.length > 0 ? voiceRecordings : undefined,
        interviews: interviews.length > 0 ? interviews : undefined,
      }

      // Step 11: Send to API for ZIP creation (if includeSourceCode) or download JSON
      if (includeSourceCode) {
        setProgress({ step: "Creating GitHub-ready export with source code...", percent: 85 })

        // Build resource files array with base64 data for the API
        const resourceFilesForApi = Object.entries(resourceBlobs).map(([key, data]) => {
          const resource = resources.find(r => r.indexedDbKey === key)
          return {
            id: key,
            name: resource?.name || key,
            data: data,
          }
        })

        // Send data in the format expected by the API (ExportRequestBody)
        const response = await fetch(`/api/projects/${projectId}/export-all?includeSourceCode=true`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            project,
            buildPlans: buildPlan ? [buildPlan, ...(buildPlanHistory || [])] : (buildPlanHistory || []),
            packets: buildPlan?.originalPlan?.packets || [],
            packetRuns: packetRuns || [],
            brainDumps: brainDumps || [],
            resources: resources || [],
            resourceFiles: resourceFilesForApi,
            businessDev: businessDev || null,
            voiceRecordings: voiceRecordings || [],
            interviews: interviews || [],
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Export failed: HTTP ${response.status}`)
        }

        setProgress({ step: "Downloading ZIP file...", percent: 95 })

        const blob = await response.blob()
        const filename = `${project.name.toLowerCase().replace(/\s+/g, "-")}-export-${
          new Date().toISOString().split("T")[0]
        }.zip`

        downloadFile(blob, filename, "application/zip")
      } else {
        // Just download the JSON
        setProgress({ step: "Preparing download...", percent: 90 })

        const jsonString = JSON.stringify(exportData, null, 2)
        const filename = `${project.name.toLowerCase().replace(/\s+/g, "-")}-export-${
          new Date().toISOString().split("T")[0]
        }.json`

        downloadFile(jsonString, filename, "application/json")
      }

      setProgress({ step: "Export complete!", percent: 100 })

      // Clear progress after a short delay
      setTimeout(() => {
        setProgress(null)
      }, 2000)

    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed"
      setError(message)
      console.error("Export error:", err)
    } finally {
      setIsExporting(false)
    }
  }, [user])

  return {
    exportProject,
    isExporting,
    error,
    progress,
  }
}

// ============ Re-exports ============

export type { Project, StoredBuildPlan, PacketRun, ProjectResource, BrainDump, BusinessDev, InterviewSession }
